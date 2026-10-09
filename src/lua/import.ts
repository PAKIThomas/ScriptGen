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
  const ctx = new ImportContext(src, comments, !!automation);

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

  project.mode = guessMode(project);
  return { project, rawParts };
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

  constructor(private src: string, private comments: Comment[], private hasTick = false) {}

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
    try {
      if (stmt.type === 'AssignmentStatement') return this.recognizeGlobal(stmt, project);
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
      if (e instanceof Unrecognized) return null;
      throw e;
    }
    return null;
  }

  recognizeGlobal(stmt: Node, project: Project): 'globals' | null {
    if (stmt.variables.length !== 1 || stmt.init.length !== 1) return null;
    const v = stmt.variables[0];
    if (v.type !== 'Identifier' || !PARAM_BY_KEY[v.name] || v.name in project.globals) return null;
    project.globals[v.name] = this.literal(stmt.init[0]);
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
    // Appel des automatismes ajouté par ScriptGen en tête de move().
    if (this.hasTick && fn.identifier?.name === 'move' && body[0] && this.text(body[0]) === TICK_CALL) body = body.slice(1);
    const ret = body[body.length - 1];
    if (ret?.type === 'ReturnStatement') {
      const config = this.configCalls(body.slice(0, -1));
      const bracket: Bracket = {
        id: newId(), name: 'Trajet principal', minLevel: 1, config, steps: this.steps(ret, false),
      };
      return { levelSource: { kind: 'none' }, brackets: [bracket] };
    }
    if (body.length !== 2 || body[0].type !== 'LocalStatement' || body[1].type !== 'IfStatement') fail();
    const local = body[0];
    if (local.variables.length !== 1 || local.init.length !== 1) fail();
    const varName: string = local.variables[0].name;
    const levelSource = this.levelSource(local.init[0]);
    const clauses: Node[] = body[1].clauses;
    const brackets: Bracket[] = [];
    let previousThreshold = 1;
    clauses.forEach((clause, i) => {
      const isElse = clause.type === 'ElseClause';
      if (isElse !== (i === clauses.length - 1 && i > 0)) fail();
      let threshold = Infinity;
      if (!isElse) {
        const c = clause.condition;
        if (c.type !== 'BinaryExpression' || c.operator !== '<' || c.left.type !== 'Identifier'
          || c.left.name !== varName || c.right.type !== 'NumericLiteral') fail();
        threshold = c.right.value;
      }
      const clauseBody: Node[] = clause.body;
      const ret = clauseBody[clauseBody.length - 1];
      if (ret?.type !== 'ReturnStatement') fail();
      const label = this.bracketLabel(clause, i === 0 ? body[1] : clause);
      brackets.push({
        id: newId(),
        name: label?.name ?? `Palier ${i + 1}`,
        minLevel: label?.min ?? previousThreshold,
        config: this.configCalls(clauseBody.slice(0, -1)),
        steps: this.steps(ret, true),
      });
      previousThreshold = threshold;
    });
    if (!clauses.length) fail();
    return { levelSource, brackets };
  }

  levelSource(init: Node): LevelSource {
    if (init.type !== 'CallExpression' || init.base.type !== 'Identifier') fail();
    const args: Node[] = init.arguments;
    if (init.base.name === 'getJobLevel' && args.length === 1 && args[0].type === 'NumericLiteral') {
      return { kind: 'job', jobId: args[0].value };
    }
    if (init.base.name === 'getCharacterLevel' && args.length === 0) return { kind: 'character' };
    return fail();
  }

  /** Commentaire « -- Nom : niveaux A à B » juste au-dessus de la clause. */
  bracketLabel(clause: Node, anchor: Node): { name: string; min: number } | null {
    const line = anchor.loc.start.line - 1;
    const c = this.comments.find((cm) => cm.loc.start.line === line && cm.loc.end.line === line);
    const m = c && /^\s*(.+?) : niveaux? (\d+)/.exec(c.value);
    void clause;
    if (!m) return null;
    this.used.add(c);
    return { name: m[1], min: Number(m[2]) };
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

  steps(ret: Node, marked: boolean): Step[] {
    if (ret.arguments.length !== 1 || ret.arguments[0].type !== 'TableConstructorExpression') fail();
    const table = ret.arguments[0];
    const fields: Node[] = table.fields;
    const stepNodes = fields.map((f) => {
      if (f.type !== 'TableValue' || f.value.type !== 'TableConstructorExpression') fail();
      return f.value;
    });
    // Tous les commentaires du tableau doivent être compris (repères ▶/■ ou fin de ligne d'étape),
    // sinon on préfère garder la fonction entière en brut plutôt que perdre un commentaire.
    const trailing = new Map<Node, Comment>();
    for (const c of this.commentsWithin(table.range[0], table.range[1])) {
      if (marked && /^\s*(▶ Début|■ Fin) étape : /.test(c.value)) {
        this.used.add(c);
        continue;
      }
      const owner = stepNodes.find((n) => n.loc.end.line === c.loc.start.line && n.range[1] <= c.range[0]);
      if (!owner || trailing.has(owner)) fail();
      trailing.set(owner, c);
      this.used.add(c);
    }
    return stepNodes.map((node) => {
      const step = this.step(node);
      const c = trailing.get(node);
      if (c) step.comment = c.value.trim();
      return step;
    });
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
        case 'gather': case 'forcegather': case 'fight': case 'forcefight': case 'npcBank': {
          const v = this.literal(value);
          if (typeof v !== 'boolean') fail();
          step[key] = v;
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
