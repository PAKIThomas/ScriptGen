// Import d'un script .lua existant vers un projet ScriptGen.
// Ce qui est reconnu (globals du registre, move()/bank()/phenix() déclaratifs, onFightEnd)
// devient éditable ; tout le reste est conservé tel quel dans des sections « Lua brut ».
import luaparse from 'luaparse';
import { PARAM_BY_KEY } from '../model/registry';
import type {
  Bracket, BracketConfig, FightEndHook, LevelSource, LuaValue, Project, Route, Section, Step,
} from '../model/types';
import { newId } from '../model/project';
import {
  AUTOMATION_END, AUTOMATION_START, FIGHT_END_VARIANTS, generateFightEnd, generateStopped,
  parseAutomationBlock, TICK_CALL,
} from './automation';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Node = any;
interface Comment {
  value: string;
  raw: string;
  range: [number, number];
  loc: { start: { line: number }; end: { line: number } };
}

export interface ImportReport {
  project: Project;
  /** Libellés des parties conservées en Lua brut. */
  rawParts: string[];
  /** Conversions faites pour un script SnowBot / Ankabot (équivalences documentées dans l'API). */
  translated: string[];
}

class Unrecognized extends Error {}

function fail(): never {
  throw new Unrecognized();
}

export function importLua(source: string, fileName = 'script.lua'): ImportReport {
  let src = source.replace(/\r\n/g, '\n').replace(/^﻿/, '');
  // Bloc d'automatismes généré par ScriptGen : relu depuis ses réglages, puis masqué (remplacé par des
  // espaces de même longueur pour garder les positions) avant l'analyse du reste du fichier.
  let automation: ReturnType<typeof parseAutomationBlock> = null;
  const autoStart = src.indexOf(`\n${AUTOMATION_START} `);
  const autoEnd = autoStart >= 0 ? src.indexOf(`\n${AUTOMATION_END}`, autoStart) : -1;
  if (autoStart >= 0 && autoEnd >= 0) {
    const blockEnd = autoEnd + 1 + AUTOMATION_END.length;
    automation = parseAutomationBlock(src.slice(autoStart + 1, blockEnd));
    if (automation) src = src.slice(0, autoStart + 1) + src.slice(autoStart + 1, blockEnd).replace(/[^\n]/g, ' ') + src.slice(blockEnd);
  }
  const ast = luaparse.parse(src, {
    comments: true, ranges: true, locations: true, luaVersion: '5.2', encodingMode: 'pseudo-latin1',
  }) as Node;
  const comments: Comment[] = ast.comments ?? [];
  // Globals affectés au niveau du fichier : une traduction (GATHER, config:set…) ne doit jamais en écraser un.
  const assigned = new Set<string>();
  for (const stmt of ast.body as Node[]) {
    if (stmt.type === 'AssignmentStatement') {
      for (const v of stmt.variables) if (v.type === 'Identifier') assigned.add(v.name);
    }
  }
  const ctx = new ImportContext(src, comments, !!automation, assigned);

  // En-tête : lignes de commentaire consécutives tout en haut du fichier.
  const header: string[] = [];
  let cursor = 0;
  const lines = src.split('\n');
  for (const line of lines) {
    if (!/^--(?!\[=*\[)/.test(line)) break;
    header.push(line.replace(/^--\s?/, ''));
    cursor += line.length + 1;
  }
  cursor = Math.min(cursor, src.length);

  const project: Project = {
    format: 'scriptgen-project',
    version: 1,
    name: fileName.replace(/\.lua$/i, ''),
    fileName,
    mode: 'gather',
    header,
    globals: {},
    move: null,
    bank: null,
    phenix: null,
    onFightEnd: null,
    sections: [],
  };
  const rawParts: string[] = [];
  let pendingStart = -1;
  let pendingEnd = -1;

  const flush = () => {
    if (pendingStart < 0) return;
    const text = trimBlankLines(src.slice(pendingStart, pendingEnd));
    if (text) {
      const label = rawLabel(text);
      project.sections.push({ kind: 'raw', id: newId(), label, text });
      rawParts.push(label);
    }
    pendingStart = -1;
  };
  const addRaw = (start: number, end: number) => {
    if (pendingStart < 0) pendingStart = start;
    pendingEnd = end;
  };
  /** Commentaires laissés entre deux éléments reconnus : conservés en brut. */
  const keepGapComments = (start: number, end: number) => {
    if (src.slice(start, end).trim()) addRaw(start, end);
    flush();
  };

  for (const stmt of ast.body as Node[]) {
    const end = ctx.endWithTrailingComment(stmt);
    const recognized = ctx.recognize(stmt, project);
    if (recognized) {
      keepGapComments(cursor, stmt.range[0]);
      const kinds = project.sections.map((s) => s.kind);
      if (!kinds.includes(recognized)) project.sections.push({ kind: recognized } as Section);
    } else {
      addRaw(cursor, end);
    }
    cursor = end;
  }
  if (src.slice(cursor).trim()) addRaw(cursor, src.length);
  flush();

  if (automation) {
    project.automation = automation;
    const move = project.sections.findIndex((sec) => sec.kind === 'move');
    project.sections.splice(move >= 0 ? move : project.sections.length, 0, { kind: 'automation' });
  }

  if (isSnowBotScript(src, ast.body)) {
    // Doc API, « Scripts SnowBot : MAX_PODS et MAX_MONSTERS » : sans ces globals, MizanBot banque à 95 %
    // (SnowBot : 90 %) et n'a pas de maximum de monstres (SnowBot : 8).
    const defaults: [string, number][] = [['MAX_PODS', 90], ['MAX_MONSTERS', 8]];
    for (const [key, value] of defaults) {
      if (assigned.has(key) || key in project.globals) continue;
      project.globals[key] = value;
      ctx.translated.push(`${key} = ${value} ajouté (valeur SnowBot par défaut)`);
    }
    if (Object.keys(project.globals).length && !project.sections.some((sec) => sec.kind === 'globals')) {
      project.sections.unshift({ kind: 'globals' });
    }
  }

  project.mode = guessMode(project);
  return { project, rawParts, translated: [...new Set(ctx.translated)] };
}

/** Marques d'un script SnowBot / Ankabot (tables et callbacks propres à SnowBot, nom GATHER). */
function isSnowBotScript(src: string, body: Node[]): boolean {
  if (/\b(global|snowbotController|fightBasic|fightAction|fightCharacter|fightSlave|fightDebug)\s*[:.]/.test(src)) return true;
  return body.some((stmt) => (stmt.type === 'AssignmentStatement' && stmt.variables.some((v: Node) => v.name === 'GATHER'))
    || (stmt.type === 'FunctionDeclaration'
      && ['fightManagement', 'prefightManagement', 'challengeManagement', 'messagesRegistering'].includes(stmt.identifier?.name))
    || (stmt.type === 'CallStatement' && configSetter(stmt) !== null));
}

/** Appel `config:setX(…)` (colon ou point) : nom du setter, sinon null. */
function configSetter(stmt: Node): string | null {
  const call = stmt.expression;
  if (call?.type !== 'CallExpression' || call.base.type !== 'MemberExpression') return null;
  if (call.base.base.type !== 'Identifier' || call.base.base.name !== 'config') return null;
  const name: string = call.base.identifier.name;
  return /^set/i.test(name) ? name[0].toLowerCase() + name.slice(1) : null;
}

/** Module config: (doc API) : chaque setter écrit un global de Configuration. */
const CONFIG_TO_GLOBAL: Record<string, string> = {
  setGatherList: 'ELEMENTS_TO_GATHER',
  setMinMonsters: 'MIN_MONSTERS',
  setMaxMonsters: 'MAX_MONSTERS',
  setMandatoryMonsters: 'FORCE_MONSTERS',
  setForbiddenMonsters: 'FORBIDDEN_MONSTERS',
  setAmountOfSpecificMonsters: 'MONSTERS_AMOUNT',
};

/** Expression de niveau reconnue (getJobLevel, job:level, getCharacterLevel, character:level…). */
function levelCall(node: Node): LevelSource | null {
  if (node?.type !== 'CallExpression') return null;
  const args: Node[] = node.arguments;
  let name: string;
  if (node.base.type === 'Identifier') name = node.base.name;
  else if (node.base.type === 'MemberExpression' && node.base.base.type === 'Identifier') name = `${node.base.base.name}:${node.base.identifier.name}`;
  else return null;
  if (['getCharacterLevel', 'character:level', 'global:getCharacterLevel'].includes(name) && args.length === 0) return { kind: 'character' };
  if (['getJobLevel', 'job:level'].includes(name) && args.length === 1 && args[0].type === 'NumericLiteral') {
    return { kind: 'job', jobId: args[0].value };
  }
  return null;
}

function dedent(text: string): string {
  const lines = text.split('\n').map((l) => l.replace(/^\t+/, (t) => '  '.repeat(t.length)));
  const indents = lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min).replace(/\s+$/, '')).join('\n');
}

function trimBlankLines(text: string): string {
  return text.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '');
}

function rawLabel(text: string): string {
  const first = text.split('\n').find((l) => l.trim() && !l.trim().startsWith('--')) ?? text.split('\n')[0];
  const fn = /function\s+([\w.:]+)/.exec(first);
  if (fn) return `function ${fn[1]}`;
  return first.trim().slice(0, 60);
}

function guessMode(project: Project): Project['mode'] {
  const steps = (project.move?.brackets ?? []).flatMap((b) => b.steps);
  const gathers = steps.some((s) => s.gather || s.forcegather);
  const fights = steps.some((s) => s.fight || s.forcefight);
  if (fights && gathers) return 'mixed';
  return fights ? 'fight' : 'gather';
}

class ImportContext {
  /** Commentaires repris dans le modèle (libellés de palier, repères, fins de ligne). */
  private used = new Set<Comment>();

  translated: string[] = [];

  constructor(private src: string, private comments: Comment[], private hasTick = false, private assigned = new Set<string>()) {}

  text(node: Node): string {
    return this.src.slice(node.range[0], node.range[1]);
  }

  /** Fin de l'instruction, en incluant un commentaire placé sur la même ligne. */
  endWithTrailingComment(stmt: Node): number {
    const line = stmt.loc.end.line;
    const trailing = this.comments.find((c) => c.range[0] >= stmt.range[1] && c.loc.start.line === line);
    return trailing ? trailing.range[1] : stmt.range[1];
  }

  commentsWithin(start: number, end: number): Comment[] {
    return this.comments.filter((c) => c.range[0] >= start && c.range[1] <= end);
  }

  recognize(stmt: Node, project: Project): Section['kind'] | null {
    const translatedBefore = this.translated.length;
    try {
      if (stmt.type === 'AssignmentStatement') return this.recognizeGlobal(stmt, project);
      if (stmt.type === 'CallStatement') return this.recognizeConfigCall(stmt, project);
      if (stmt.type === 'FunctionDeclaration' && !stmt.isLocal && stmt.identifier?.type === 'Identifier') {
        const name: string = stmt.identifier.name;
        if (stmt.parameters.length === 0 && (name === 'move' || name === 'bank' || name === 'phenix')) {
          if (project[name] !== null) return null;
          project[name] = this.route(stmt);
          return name;
        }
        if (name === 'onFightEnd' && !project.onFightEnd) {
          project.onFightEnd = this.fightEnd(stmt);
          return 'onFightEnd';
        }
        if (name === 'stopped' && !project.stopped && this.text(stmt) === generateStopped({ notify: true })) {
          project.stopped = { notify: true };
          return 'stopped';
        }
      }
    } catch (e) {
      if (e instanceof Unrecognized) {
        this.translated.length = translatedBefore; // rien n'a été converti finalement
        return null;
      }
      throw e;
    }
    return null;
  }

  recognizeGlobal(stmt: Node, project: Project): 'globals' | null {
    if (stmt.variables.length !== 1 || stmt.init.length !== 1) return null;
    const v = stmt.variables[0];
    if (v.type !== 'Identifier') return null;
    // GATHER = nom SnowBot de ELEMENTS_TO_GATHER (lu seulement quand ELEMENTS_TO_GATHER est absent).
    if (v.name === 'GATHER' && !this.assigned.has('ELEMENTS_TO_GATHER') && !('ELEMENTS_TO_GATHER' in project.globals)) {
      project.globals.ELEMENTS_TO_GATHER = this.literal(stmt.init[0]);
      this.translated.push('GATHER → ELEMENTS_TO_GATHER');
      return 'globals';
    }
    if (!PARAM_BY_KEY[v.name] || v.name in project.globals) return null;
    project.globals[v.name] = this.literal(stmt.init[0]);
    return 'globals';
  }

  /** config:setX(valeur) au niveau du fichier = le global correspondant (le setter l'écrit au chargement). */
  recognizeConfigCall(stmt: Node, project: Project): 'globals' | null {
    const setter = configSetter(stmt);
    const key = setter && CONFIG_TO_GLOBAL[setter];
    if (!key || this.assigned.has(key) || key in project.globals) return null;
    if (this.commentsWithin(stmt.range[0], stmt.range[1]).length) return null;
    const args: Node[] = stmt.expression.arguments;
    let value: LuaValue;
    if (setter === 'setMinMonsters' || setter === 'setMaxMonsters') {
      if (args.length !== 1 || args[0].type !== 'NumericLiteral') return null;
      value = Math.min(8, Math.max(1, args[0].value)); // bornés à 1–8 par les setters
    } else if (setter === 'setGatherList' && args.length >= 1 && args.every((a) => a.type === 'NumericLiteral')) {
      value = args.map((a) => a.value as number);
    } else {
      if (args.length !== 1) return null;
      value = this.literal(args[0]);
      if (!Array.isArray(value)) return null;
    }
    project.globals[key] = value;
    this.translated.push(`config:${setter}(…) → ${key}`);
    return 'globals';
  }

  /** Valeur littérale stricte (échoue sur toute expression). */
  literal(node: Node): LuaValue {
    switch (node.type) {
      case 'StringLiteral': return node.value as string;
      case 'NumericLiteral': return node.value as number;
      case 'BooleanLiteral': return node.value as boolean;
      case 'UnaryExpression':
        if (node.operator === '-' && node.argument.type === 'NumericLiteral') return -node.argument.value;
        return fail();
      case 'TableConstructorExpression': {
        if (this.commentsWithin(node.range[0], node.range[1]).length) fail();
        const fields: Node[] = node.fields;
        if (fields.every((f) => f.type === 'TableValue')) return fields.map((f) => this.literal(f.value));
        if (fields.every((f) => f.type === 'TableKeyString')) {
          const out: Record<string, LuaValue> = {};
          for (const f of fields) out[f.key.name] = this.literal(f.value);
          return out;
        }
        return fail();
      }
      default: return fail();
    }
  }

  numberList(node: Node): number[] {
    const v = this.literal(node);
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'number')) fail();
    return v as number[];
  }

  route(fn: Node): Route {
    const route = this.routeBody(fn);
    // Un commentaire qu'on ne saurait pas réécrire : on garde la fonction en brut.
    for (const c of this.commentsWithin(fn.range[0], fn.range[1])) if (!this.used.has(c)) fail();
    return route;
  }

  routeBody(fn: Node): Route {
    let body: Node[] = fn.body;
    // Début du corps : juste après « ) » de la déclaration.
    let start = this.src.indexOf(')', fn.identifier.range[1]) + 1;
    // Appel des automatismes ajouté par ScriptGen en tête de move().
    if (this.hasTick && fn.identifier?.name === 'move' && body[0] && this.text(body[0]) === TICK_CALL) {
      start = body[0].range[1];
      body = body.slice(1);
    }
    const last = body[body.length - 1];
    const beforeLast = body[body.length - 2];
    if (last?.type === 'ReturnStatement' && beforeLast?.type !== 'IfStatement') {
      const pre = this.clauseSetup(start, body.slice(0, -1), last);
      const bracket: Bracket = {
        id: newId(), name: 'Trajet principal', minLevel: 1, config: pre.config, steps: [],
      };
      if (pre.preamble) bracket.preamble = pre.preamble;
      this.fillSteps(bracket, last, false);
      return { levelSource: { kind: 'none' }, brackets: [bracket] };
    }
    return this.levelRoute(body, start);
  }

  /**
   * move() à paliers : `if <niveau> < N then return {…} elseif … else return {…} end`
   * (forme Script Creator, avec ou sans `local niveau = …`), ou ordre décroissant `>= N` (forme SnowBot).
   * Le code placé avant le choix du palier est conservé en préambule.
   */
  levelRoute(body: Node[], start: number): Route {
    let finalReturn: Node | null = null;
    let rest = body;
    if (rest[rest.length - 1]?.type === 'ReturnStatement') {
      finalReturn = rest[rest.length - 1];
      rest = rest.slice(0, -1);
    }
    const ifStmt = rest[rest.length - 1];
    if (ifStmt?.type !== 'IfStatement') fail();
    rest = rest.slice(0, -1);
    let varName: string | null = null;
    let levelSource: LevelSource | null = null;
    const local = rest[rest.length - 1];
    if (local?.type === 'LocalStatement' && local.variables.length === 1 && local.init.length === 1) {
      const src = levelCall(local.init[0]);
      if (src) {
        varName = local.variables[0].name;
        levelSource = src;
        rest = rest.slice(0, -1);
      }
    }
    const clauses: Node[] = ifStmt.clauses;
    const hasElse = clauses[clauses.length - 1]?.type === 'ElseClause';
    if (hasElse === !!finalReturn) fail(); // exactement un « sinon »
    const firstLabel = this.bracketLabel(ifStmt);
    const setupEnd = Math.min((varName ? local : ifStmt).range[0], firstLabel?.start ?? Infinity);
    const routePreamble = this.preambleText(start, setupEnd, rest);

    type Part = { label: ReturnType<ImportContext['bracketLabel']>; op: string | null; n: number; bracket: Bracket };
    const parts: Part[] = [];
    const conditional = hasElse ? clauses.slice(0, -1) : clauses;
    if (!conditional.length) fail();
    conditional.forEach((clause, i) => {
      if (clause.type === 'ElseClause') fail();
      const c = clause.condition;
      if (c.type !== 'BinaryExpression' || !['<', '<=', '>=', '>'].includes(c.operator) || c.right.type !== 'NumericLiteral') fail();
      const src = varName && c.left.type === 'Identifier' && c.left.name === varName ? levelSource : levelCall(c.left);
      if (!src) fail();
      if (levelSource && JSON.stringify(src) !== JSON.stringify(levelSource)) fail();
      levelSource = src;
      const bodyStart = this.src.indexOf('then', c.range[1]) + 4;
      parts.push({ label: i === 0 ? firstLabel : this.bracketLabel(clause), op: c.operator, n: c.right.value, bracket: this.clauseBracket(clause.body, bodyStart) });
    });
    const elseClause = hasElse ? clauses[clauses.length - 1] : null;
    const elsePart: Part = elseClause
      ? { label: this.bracketLabel(elseClause), op: null, n: 0, bracket: this.clauseBracket(elseClause.body, elseClause.range[0] + 4) }
      : { label: null, op: null, n: 0, bracket: this.clauseBracket([finalReturn], ifStmt.range[1]) };

    const ascending = parts.every((p) => p.op === '<' || p.op === '<=');
    const descending = parts.every((p) => p.op === '>=' || p.op === '>');
    let ordered: { part: Part; min: number }[];
    if (ascending) {
      // Seuil = premier niveau du palier suivant.
      const thresholds = parts.map((p) => (p.op === '<' ? p.n : p.n + 1));
      ordered = [...parts, elsePart].map((part, i) => ({ part, min: part.label?.min ?? (i === 0 ? 1 : thresholds[i - 1]) }));
    } else if (descending) {
      const mins = parts.map((p) => (p.op === '>=' ? p.n : p.n + 1));
      ordered = [{ part: elsePart, min: 1 }, ...parts.map((part, i) => ({ part, min: mins[i] })).reverse()];
    } else return fail();
    // Les paliers doivent se suivre (le générateur écrit « niveau < min du palier suivant »).
    for (let i = 1; i < ordered.length; i++) if (ordered[i].min <= ordered[i - 1].min) fail();
    if (ordered[0].min > 1 && !ordered[0].part.label) fail();

    const brackets = ordered.map(({ part, min }, i) => ({
      ...part.bracket,
      name: part.label?.name ?? `Palier ${i + 1}`,
      minLevel: min,
    }));
    const route: Route = { levelSource: levelSource!, brackets };
    if (routePreamble) route.preamble = routePreamble;
    return route;
  }

  /** Corps d'une clause : préambule / config:set…, puis `return { étapes }`. */
  clauseBracket(body: Node[], start: number): Bracket {
    const ret = body[body.length - 1];
    if (ret?.type !== 'ReturnStatement') fail();
    const pre = this.clauseSetup(start, body.slice(0, -1), ret);
    const bracket: Bracket = { id: newId(), name: '', minLevel: 1, config: pre.config, steps: [] };
    if (pre.preamble) bracket.preamble = pre.preamble;
    this.fillSteps(bracket, ret, true);
    return bracket;
  }

  /** Instructions avant le return : des config:set… littéraux deviennent des réglages, sinon tout est gardé tel quel. */
  clauseSetup(start: number, stmts: Node[], ret: Node): { config: BracketConfig; preamble?: string } {
    if (!this.commentsWithin(start, ret.range[0]).length) {
      try {
        return { config: this.configCalls(stmts) };
      } catch (e) {
        if (!(e instanceof Unrecognized)) throw e;
      }
    }
    return { config: {}, preamble: this.preambleText(start, ret.range[0], stmts) };
  }

  /** Texte Lua conservé (commentaires compris), désindenté. */
  preambleText(start: number, end: number, stmts: Node[]): string | undefined {
    const comments = this.commentsWithin(start, end);
    if (!stmts.length && !comments.length) return undefined;
    for (const c of comments) this.used.add(c);
    const text = dedent(trimBlankLines(this.src.slice(start, end)));
    return text || undefined;
  }

  /** Commentaire « -- Nom : niveaux A à B » juste au-dessus de la clause (format Script Creator). */
  bracketLabel(anchor: Node): { name: string; min: number; start: number } | null {
    const line = anchor.loc.start.line - 1;
    const c = this.comments.find((cm) => cm.loc.start.line === line && cm.loc.end.line === line);
    const m = c && /^\s*(.+?) : niveaux? (\d+)/.exec(c.value);
    if (!m) return null;
    this.used.add(c);
    return { name: m[1], min: Number(m[2]), start: c.range[0] };
  }

  configCalls(stmts: Node[]): BracketConfig {
    const config: BracketConfig = {};
    for (const s of stmts) {
      if (s.type !== 'CallStatement') fail();
      const call = s.expression;
      if (call.type !== 'CallExpression' || call.base.type !== 'MemberExpression' || call.base.indexer !== ':'
        || call.base.base.type !== 'Identifier' || call.base.base.name !== 'config' || call.arguments.length !== 1) fail();
      const arg = call.arguments[0];
      switch (call.base.identifier.name) {
        case 'setGatherList': config.gatherList = this.numberList(arg); break;
        case 'setMandatoryMonsters': config.mandatoryMonsters = this.numberList(arg); break;
        case 'setForbiddenMonsters': config.forbiddenMonsters = this.numberList(arg); break;
        case 'setMinMonsters':
          if (arg.type !== 'NumericLiteral') fail();
          config.minMonsters = arg.value;
          break;
        case 'setMaxMonsters':
          if (arg.type !== 'NumericLiteral') fail();
          config.maxMonsters = arg.value;
          break;
        default: fail();
      }
    }
    return config;
  }

  fillSteps(bracket: Bracket, ret: Node, marked: boolean): void {
    if (ret.arguments.length !== 1 || ret.arguments[0].type !== 'TableConstructorExpression') fail();
    const table = ret.arguments[0];
    const fields: Node[] = table.fields;
    const stepNodes = fields.map((f) => {
      if (f.type !== 'TableValue' || f.value.type !== 'TableConstructorExpression') fail();
      return f.value;
    });
    // Commentaires du tableau : repères ▶/■, fin de ligne d'une étape, ou lignes de commentaire entre
    // les étapes (rattachées à l'étape suivante, ou gardées après la dernière). Un commentaire DANS une
    // étape n'est pas réécrivable : la fonction reste alors en Lua brut.
    const trailing = new Map<Node, Comment>();
    const notes = new Map<Node, string[]>();
    const tail: string[] = [];
    for (const c of this.commentsWithin(table.range[0], table.range[1])) {
      this.used.add(c);
      if (marked && /^\s*(▶ Début|■ Fin) étape : /.test(c.value)) continue;
      const owner = stepNodes.find((n) => n.loc.end.line === c.loc.start.line && n.range[1] <= c.range[0]);
      if (owner && !trailing.has(owner)) {
        trailing.set(owner, c);
        continue;
      }
      const lineStart = this.src.lastIndexOf('\n', c.range[0] - 1) + 1;
      if (this.src.slice(lineStart, c.range[0]).trim() || stepNodes.some((n) => n.range[0] < c.range[0] && c.range[1] <= n.range[1])) fail();
      const next = stepNodes.find((n) => n.range[0] > c.range[1]);
      if (next) notes.set(next, [...(notes.get(next) ?? []), c.raw]);
      else tail.push(c.raw);
    }
    bracket.steps = stepNodes.map((node) => {
      const step = this.step(node);
      const c = trailing.get(node);
      if (c) step.comment = c.value.trim();
      if (notes.has(node)) step.notes = notes.get(node);
      return step;
    });
    if (tail.length) bracket.tailNotes = tail;
  }

  step(node: Node): Step {
    const step: Step = { id: newId(), map: '' };
    let hasMap = false;
    for (const f of node.fields as Node[]) {
      if (f.type !== 'TableKeyString') fail();
      const key: string = f.key.name;
      const value = f.value;
      switch (key) {
        case 'map': {
          const v = this.literal(value);
          if (typeof v !== 'string' && typeof v !== 'number') fail();
          step.map = v;
          hasMap = true;
          break;
        }
        case 'custom':
        case 'lockedCustom':
          step[key] = { raw: this.text(value) };
          break;
        case 'path':
        case 'changeMap':
        case 'paths':
          if (step.path !== undefined) fail();
          step.path = this.literalOrRaw(value);
          step.pathKey = key;
          break;
        case 'gather': case 'forcegather': case 'fight': case 'forcefight': case 'npcBank':
        case 'forceGather': case 'forceFight': {
          const v = this.literal(value);
          if (typeof v !== 'boolean') fail();
          // forceGather / forceFight : synonymes documentés de forcegather / forcefight.
          const k = key === 'forceGather' ? 'forcegather' : key === 'forceFight' ? 'forcefight' : key;
          if (k !== key) this.translated.push(`${key} → ${k}`);
          step[k] = v;
          break;
        }
        case 'regeneration': {
          const v = this.literal(value);
          if (v !== true && typeof v !== 'number') fail();
          step.regeneration = v;
          break;
        }
        case 'cell': case 'exitCell': {
          const v = this.literal(value);
          if (typeof v !== 'number') fail();
          step[key] = v;
          break;
        }
        case 'lockedStorage': case 'lockedHouse': {
          const v = this.literal(value);
          if (typeof v !== 'string') fail();
          step[key] = v;
          break;
        }
        case 'door': case 'phenix': {
          const v = this.literal(value);
          if (typeof v !== 'string' && typeof v !== 'number') fail();
          step[key] = v;
          break;
        }
        default:
          (step.extra ??= []).push([key, this.literalOrRaw(value)]);
      }
    }
    if (!hasMap) fail();
    return step;
  }

  literalOrRaw(node: Node): LuaValue {
    try {
      return this.literal(node);
    } catch (e) {
      if (e instanceof Unrecognized) return { raw: this.text(node) };
      throw e;
    }
  }

  fightEnd(fn: Node): FightEndHook {
    // Formes reconnues : celles que ScriptGen génère (ouvrir les sacs / prévenir en cas de défaite).
    const text = this.text(fn);
    const hook = FIGHT_END_VARIANTS.find((v) => generateFightEnd(v) === text);
    return hook ? { ...hook } : fail();
  }
}
