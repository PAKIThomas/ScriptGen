// « Plan » échangé avec l'assistant IA (schéma de l'outil submit_plan, server/ai.mjs) et sa
// conversion vers / depuis un projet ScriptGen. Le plan ne contient que des données (cartes,
// paliers, ids) : le Lua est toujours écrit par le générateur.
import { presetBankRoute } from '../components/BankPanel';
import { suggestPath } from '../model/geo';
import { newBracket, newStep } from '../model/project';
import type { Automation, Bracket, Project, Route, StatName, Step } from '../model/types';

export interface PlanStep {
  map: string | number;
  fight?: boolean;
  gather?: boolean;
  forcefight?: boolean;
  forcegather?: boolean;
  npc_bank?: boolean;
  comment?: string;
}

export interface PlanBracket {
  name: string;
  min_level: number;
  gather_list?: number[];
  min_monsters?: number;
  max_monsters?: number;
  mandatory_monsters?: number[];
  forbidden_monsters?: number[];
  steps: PlanStep[];
}

export interface Plan {
  name?: string;
  file_name?: string;
  level_source: { kind: 'none' | 'character' | 'job'; job_id?: number };
  brackets: PlanBracket[];
  equip?: { level: number; gid: number }[];
  auto_stuff?: boolean;
  auto_stat?: StatName;
  stop_at_level?: number;
  bank_map_id?: number | null;
  max_pods?: number;
  min_monsters?: number;
  max_monsters?: number;
  open_bags_on_win?: boolean;
  to_validate?: string[];
}

function planMap(map: string | number): string | number {
  const s = String(map).trim();
  return /^\d+$/.test(s) ? Number(s) : s.replace(/\s/g, '');
}

function toBracket(b: PlanBracket): Bracket {
  const bracket = newBracket(b.name || 'Palier', Math.max(1, b.min_level || 1));
  if (b.gather_list?.length) bracket.config.gatherList = b.gather_list;
  if (b.min_monsters !== undefined) bracket.config.minMonsters = b.min_monsters;
  if (b.max_monsters !== undefined) bracket.config.maxMonsters = b.max_monsters;
  if (b.mandatory_monsters?.length) bracket.config.mandatoryMonsters = b.mandatory_monsters;
  if (b.forbidden_monsters?.length) bracket.config.forbiddenMonsters = b.forbidden_monsters;
  bracket.steps = b.steps.map((s) => {
    const step: Step = newStep(planMap(s.map));
    if (s.gather) step.gather = true;
    if (s.fight) step.fight = true;
    if (s.forcegather) step.forcegather = true;
    if (s.forcefight) step.forcefight = true;
    if (s.npc_bank) step.npcBank = true;
    if (s.comment) step.comment = s.comment;
    return step;
  });
  // Sorties : chaque carte mène à la suivante, la dernière revient à la première (boucle).
  const steps = bracket.steps;
  steps.forEach((step, i) => {
    const next = steps[(i + 1) % steps.length];
    if (steps.length > 1 && !step.forcegather && !step.forcefight) step.path = suggestPath(step, next, 'coords');
  });
  return bracket;
}

/** Applique un plan à une copie du projet (le reste — en-tête, Lua brut, réglages non cités — est gardé). */
export function applyPlan(base: Project, plan: Plan): Project {
  const p = structuredClone(base);
  if (plan.name) p.name = plan.name;
  if (plan.file_name) p.fileName = plan.file_name.endsWith('.lua') ? plan.file_name : `${plan.file_name}.lua`;

  const kind = plan.level_source.kind;
  const route: Route = {
    levelSource: kind === 'job' ? { kind: 'job', jobId: plan.level_source.job_id ?? 2 } : kind === 'character' ? { kind: 'character' } : { kind: 'none' },
    brackets: [...plan.brackets].sort((a, b) => a.min_level - b.min_level).map(toBracket),
  };
  if (route.brackets[0]) route.brackets[0].minLevel = 1;
  // Un config:set… reste posé jusqu'au suivant (doc API, module config:) : si un palier règle une
  // valeur, chaque palier la règle explicitement, sinon le réglage d'un palier « fuirait » dans le suivant.
  const globalList = (key: string): number[] => (Array.isArray(p.globals[key]) ? (p.globals[key] as number[]).filter((v) => typeof v === 'number') : []);
  const globalNum = (key: string, fallback: number): number => (typeof p.globals[key] === 'number' ? p.globals[key] as number : fallback);
  const neutral = {
    gatherList: globalList('ELEMENTS_TO_GATHER'),
    minMonsters: plan.min_monsters ?? globalNum('MIN_MONSTERS', 1),
    maxMonsters: plan.max_monsters ?? globalNum('MAX_MONSTERS', 8),
    mandatoryMonsters: [] as number[],
    forbiddenMonsters: [] as number[],
  };
  for (const key of Object.keys(neutral) as (keyof typeof neutral)[]) {
    if (route.brackets.length > 1 && route.brackets.some((b) => b.config[key] !== undefined)) {
      for (const b of route.brackets) if (b.config[key] === undefined) (b.config as Record<string, unknown>)[key] = structuredClone(neutral[key]);
    }
  }
  p.move = route;
  // Un move() écrit à la main (gardé en Lua brut) est remplacé par celui du plan.
  p.sections = p.sections.filter((s) => !(s.kind === 'raw' && /^function move\b/.test(s.label)));

  if (plan.bank_map_id !== undefined) {
    p.bank = plan.bank_map_id === null ? null : presetBankRoute(plan.bank_map_id);
    p.sections = p.sections.filter((s) => !(s.kind === 'raw' && /^function bank\b/.test(s.label)));
  }

  const automation: Automation = structuredClone(p.automation ?? { equip: [], combat: {} });
  if (plan.equip) automation.equip = plan.equip.map((e) => ({ level: e.level, gid: e.gid }));
  if (plan.auto_stuff !== undefined) {
    if (plan.auto_stuff) automation.autoStuff = true;
    else delete automation.autoStuff;
  }
  if (plan.auto_stat) automation.autoStat = plan.auto_stat;
  if (plan.stop_at_level) {
    automation.stopAt = kind === 'job' ? { level: plan.stop_at_level, jobId: plan.level_source.job_id } : { level: plan.stop_at_level };
  }
  p.automation = automation;

  if (plan.max_pods !== undefined) p.globals.MAX_PODS = plan.max_pods;
  if (plan.min_monsters !== undefined) p.globals.MIN_MONSTERS = plan.min_monsters;
  if (plan.max_monsters !== undefined) p.globals.MAX_MONSTERS = plan.max_monsters;
  if (plan.open_bags_on_win !== undefined) p.onFightEnd = { ...(p.onFightEnd ?? { openBagsOnWin: false }), openBagsOnWin: plan.open_bags_on_win };

  const steps = route.brackets.flatMap((b) => b.steps);
  const fights = steps.some((s) => s.fight || s.forcefight);
  const gathers = steps.some((s) => s.gather || s.forcegather);
  p.mode = fights && gathers ? 'mixed' : fights ? 'fight' : 'gather';
  return p;
}

/** Plan équivalent au projet actuel (envoyé à l'assistant pour qu'il le modifie). Null si projet vide. */
export function projectToPlan(p: Project): Plan | null {
  const brackets = p.move?.brackets ?? [];
  if (!brackets.some((b) => b.steps.length)) return null;
  const ls = p.move!.levelSource;
  const plan: Plan = {
    name: p.name,
    file_name: p.fileName,
    level_source: ls.kind === 'job' ? { kind: 'job', job_id: ls.jobId } : { kind: ls.kind },
    brackets: brackets.map((b) => ({
      name: b.name,
      min_level: b.minLevel,
      ...(b.config.gatherList ? { gather_list: b.config.gatherList } : {}),
      ...(b.config.minMonsters !== undefined ? { min_monsters: b.config.minMonsters } : {}),
      ...(b.config.maxMonsters !== undefined ? { max_monsters: b.config.maxMonsters } : {}),
      ...(b.config.mandatoryMonsters ? { mandatory_monsters: b.config.mandatoryMonsters } : {}),
      ...(b.config.forbiddenMonsters ? { forbidden_monsters: b.config.forbiddenMonsters } : {}),
      steps: b.steps.map((s) => ({
        map: s.map,
        ...(s.fight ? { fight: true } : {}),
        ...(s.gather ? { gather: true } : {}),
        ...(s.forcefight ? { forcefight: true } : {}),
        ...(s.forcegather ? { forcegather: true } : {}),
        ...(s.npcBank ? { npc_bank: true } : {}),
        ...(s.comment ? { comment: s.comment } : {}),
      })),
    })),
  };
  const a = p.automation;
  if (a?.equip.length) plan.equip = a.equip;
  if (a?.autoStuff) plan.auto_stuff = true;
  if (a?.autoStat) plan.auto_stat = a.autoStat;
  if (a?.stopAt) plan.stop_at_level = a.stopAt.level;
  const bankStep = p.bank?.brackets[0]?.steps[0];
  if (bankStep?.npcBank && typeof bankStep.map === 'number') plan.bank_map_id = bankStep.map;
  if (typeof p.globals.MAX_PODS === 'number') plan.max_pods = p.globals.MAX_PODS;
  return plan;
}
