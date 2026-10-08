// Génération du fichier .lua à partir d'un projet.
// Le format suit exactement exemples/bucheron.lua (« Mizan Script Creator ») :
// commentaire d'en-tête, globals, move() avec paliers de niveau, hooks, bank().
import { PARAMS } from '../model/registry';
import type { Bracket, BracketConfig, Project, Route, Section, Step } from '../model/types';
import { luaKey, luaValue } from './serialize';

/** Ordre d'écriture des clés d'une étape (ordre de jeu documenté dans l'API). */
const STEP_KEYS = [
  'regeneration', 'gather', 'forcegather', 'fight', 'forcefight', 'npcBank', 'lockedStorage',
  'lockedHouse', 'cell', 'custom', 'lockedCustom', 'door', 'exitCell', 'phenix',
] as const;

export function stepFields(step: Step): string[] {
  const fields = [`map = ${luaValue(step.map)}`];
  for (const key of STEP_KEYS) {
    const value = step[key];
    if (value !== undefined) fields.push(`${key} = ${luaValue(value)}`);
  }
  if (step.path !== undefined) fields.push(`${step.pathKey ?? 'path'} = ${luaValue(step.path)}`);
  for (const [key, value] of step.extra ?? []) fields.push(`${luaKey(key)} = ${luaValue(value)}`);
  return fields;
}

function stepLine(step: Step, indent: string, comma: boolean): string {
  const comment = step.comment ? ` -- ${step.comment}` : '';
  return `${indent}{ ${stepFields(step).join(', ')} }${comma ? ',' : ''}${comment}`;
}

function configLines(config: BracketConfig, indent: string): string[] {
  const lines: string[] = [];
  if (config.gatherList) lines.push(`${indent}config:setGatherList(${luaValue(config.gatherList)})`);
  if (config.minMonsters !== undefined) lines.push(`${indent}config:setMinMonsters(${config.minMonsters})`);
  if (config.maxMonsters !== undefined) lines.push(`${indent}config:setMaxMonsters(${config.maxMonsters})`);
  if (config.mandatoryMonsters) {
    lines.push(`${indent}config:setMandatoryMonsters(${luaValue(config.mandatoryMonsters)})`);
  }
  if (config.forbiddenMonsters) {
    lines.push(`${indent}config:setForbiddenMonsters(${luaValue(config.forbiddenMonsters)})`);
  }
  return lines;
}

/** Liste d'étapes d'un palier, encadrée des repères ▶ / ■ (style move() à paliers). */
function markedSteps(bracket: Bracket, indent: string): string[] {
  return [
    '',
    `${indent}-- ▶ Début étape : ${bracket.name}`,
    ...bracket.steps.map((s) => stepLine(s, indent, true)),
    `${indent}-- ■ Fin étape : ${bracket.name}`,
    '',
  ];
}

/** Liste d'étapes simple : virgule après chaque étape sauf la dernière (style bank()). */
function plainSteps(steps: Step[], indent: string, trailingComma: boolean): string[] {
  return steps.map((s, i) => stepLine(s, indent, trailingComma || i < steps.length - 1));
}

function levelRangeLabel(brackets: Bracket[], i: number): string {
  const min = brackets[i].minLevel;
  if (i === brackets.length - 1) return `niveau ${min} et plus`;
  return `niveaux ${min} à ${brackets[i + 1].minLevel - 1}`;
}

function levelExpression(route: Route): string {
  if (route.levelSource.kind === 'job') return `getJobLevel(${route.levelSource.jobId})`;
  return 'getCharacterLevel()';
}

export function generateRoute(name: string, route: Route): string {
  const lines = [`function ${name}()`];
  const trailingComma = name === 'move';
  const { brackets } = route;

  if (route.levelSource.kind === 'none' || brackets.length <= 1) {
    const bracket = brackets[0];
    if (bracket) lines.push(...configLines(bracket.config, '  '));
    lines.push('  return {');
    if (bracket) lines.push(...plainSteps(bracket.steps, '    ', trailingComma));
    lines.push('  }');
  } else {
    lines.push(`  local niveau = ${levelExpression(route)}`);
    brackets.forEach((bracket, i) => {
      const last = i === brackets.length - 1;
      lines.push(`  -- ${bracket.name} : ${levelRangeLabel(brackets, i)}`);
      if (last) lines.push('  else');
      else lines.push(`  ${i === 0 ? 'if' : 'elseif'} niveau < ${brackets[i + 1].minLevel} then`);
      lines.push(...configLines(bracket.config, '    '));
      lines.push('    return {');
      lines.push(...markedSteps(bracket, '      '));
      lines.push('    }');
    });
    lines.push('  end');
  }
  lines.push('end');
  return lines.join('\n');
}

export function generateGlobals(project: Project): string {
  const lines: string[] = [];
  for (const param of PARAMS) {
    const value = project.globals[param.key];
    if (value !== undefined) lines.push(`${param.key} = ${luaValue(value)}`);
  }
  return lines.join('\n');
}

function generateFightEnd(project: Project): string {
  const hook = project.onFightEnd;
  const body: string[] = [];
  if (hook?.openBagsOnWin) body.push('  if result.won then', '    openBags()', '  end');
  return ['function onFightEnd(result)', ...body, 'end'].join('\n');
}

/** Sections effectivement écrites : on retire celles qui sont vides et on ajoute les manquantes. */
export function normalizeSections(project: Project): Section[] {
  const present = (s: Section): boolean => {
    switch (s.kind) {
      case 'bank': return project.bank !== null;
      case 'move': return project.move !== null;
      case 'phenix': return project.phenix !== null;
      case 'onFightEnd': return project.onFightEnd !== null && project.onFightEnd.openBagsOnWin;
      case 'globals': return Object.keys(project.globals).length > 0;
      default: return true;
    }
  };
  const sections = project.sections.filter(present);
  const has = (kind: Section['kind']) => sections.some((s) => s.kind === kind);
  const ensure = (section: Section, after: Section['kind'][]) => {
    if (has(section.kind) || !present(section)) return;
    let index = -1;
    for (const kind of after) index = Math.max(index, sections.findIndex((s) => s.kind === kind));
    sections.splice(index + 1, 0, section);
  };
  ensure({ kind: 'globals' }, []);
  ensure({ kind: 'move' }, ['globals']);
  ensure({ kind: 'onFightEnd' }, ['move']);
  ensure({ kind: 'bank' }, ['move', 'onFightEnd']);
  ensure({ kind: 'phenix' }, ['move', 'onFightEnd', 'bank']);
  return sections;
}

function sectionText(project: Project, section: Section): string {
  switch (section.kind) {
    case 'globals': return generateGlobals(project);
    case 'move': return project.move ? generateRoute('move', project.move) : '';
    case 'bank': return project.bank ? generateRoute('bank', project.bank) : '';
    case 'phenix': return project.phenix ? generateRoute('phenix', project.phenix) : '';
    case 'onFightEnd': return generateFightEnd(project);
    case 'raw': return section.text;
  }
}

export function generate(project: Project): string {
  const blocks = normalizeSections(project).map((s) => sectionText(project, s)).filter((t) => t !== '');
  const header = project.header.map((line) => (line ? `-- ${line}` : '--')).join('\n');
  if (header) {
    // L'en-tête est collé au premier bloc (pas de ligne vide), comme dans les exemples.
    if (blocks.length) blocks[0] = `${header}\n${blocks[0]}`;
    else blocks.push(header);
  }
  return blocks.join('\n\n') + '\n';
}
