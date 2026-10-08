// Vérifications d'un projet avant export. Aucune n'empêche d'exporter : ce sont des alertes
// tirées des règles du guide / de l'API MizanBot (§7.5, §7.9, « Trajet déclaratif »).
import { MAIN_WORLD, coordsIndexKey, locateStepMap, type MapIndex } from '../data/maps';
import { parseCoords } from './geo';
import type { Project, Route, Step } from './types';

export type CheckLevel = 'error' | 'warning' | 'info';

export interface Check {
  level: CheckLevel;
  route: 'move' | 'bank' | 'phenix' | 'global';
  bracketIndex?: number;
  stepId?: string;
  message: string;
}

function mapKind(map: string | number): 'coords' | 'id' | 'havenbag' | 'invalid' {
  if (typeof map === 'number' || /^\d+$/.test(map)) return 'id';
  if (map === 'havenbag') return 'havenbag';
  return parseCoords(map) ? 'coords' : 'invalid';
}

/** L'étape reste-t-elle sur place ou change-t-elle de carte autrement que par sa sortie ? */
function hasOwnExit(step: Step): boolean {
  return step.path !== undefined || step.exitCell !== undefined || step.door !== undefined
    || !!step.forcegather || !!step.forcefight || step.lockedHouse !== undefined
    || step.custom !== undefined || step.lockedCustom !== undefined || step.phenix !== undefined;
}

function checkRoute(name: 'move' | 'bank' | 'phenix', route: Route, index: MapIndex | null, out: Check[]) {
  const levels = route.levelSource.kind !== 'none';
  route.brackets.forEach((bracket, bi) => {
    const at = (step: Step | undefined, level: CheckLevel, message: string) =>
      out.push({ level, route: name, bracketIndex: bi, stepId: step?.id, message });

    if (levels && bi > 0 && bracket.minLevel <= route.brackets[bi - 1].minLevel) {
      at(undefined, 'error', `Palier « ${bracket.name} » : son niveau minimal doit être supérieur à celui du palier précédent.`);
    }
    if (bracket.steps.length === 0) at(undefined, 'warning', `${levels ? `Palier « ${bracket.name} »` : name + '()'} : aucune étape.`);

    const seen = new Map<string, number>();
    const ids = new Set(bracket.steps.filter((s) => mapKind(s.map) === 'id').map((s) => String(s.map)));
    bracket.steps.forEach((step, si) => {
      const n = `Étape ${si + 1} (${step.map})`;
      const kind = mapKind(step.map);
      if (kind === 'invalid') at(step, 'error', `${n} : « map » doit être « x,y », un id de carte ou « havenbag ».`);
      if (index && kind === 'id' && !index.byId.has(Number(step.map))) {
        at(step, 'warning', `${n} : id de carte inconnu du référentiel. S'il est faux, le bot s'arrête (« cible HORS du world-graph »).`);
      }
      if (index && kind === 'coords') {
        const c = parseCoords(step.map)!;
        if (!index.byCoords.has(coordsIndexKey(MAIN_WORLD, c.x, c.y))) {
          at(step, 'warning', `${n} : aucune carte du Monde des Douze à ces coordonnées.`);
        }
      }
      const key = String(step.map);
      if (seen.has(key)) {
        at(step, 'info', `${n} : la même carte que l'étape ${seen.get(key)! + 1}. MizanBot fusionne les deux (pour chaque clé, la dernière écrite gagne).`);
      } else seen.set(key, si);
      if (kind === 'coords' && ids.size && index) {
        const loc = parseCoords(step.map)!;
        const shadow = [...ids].some((id) => {
          const info = index.byId.get(Number(id));
          return info && info.x === loc.x && info.y === loc.y;
        });
        if (shadow) at(step, 'info', `${n} : une autre étape vise l'id exact d'une carte à ces coordonnées ; sur cette carte-là, l'étape en « x,y » est ignorée.`);
      }
      if (!hasOwnExit(step) && !step.npcBank && !step.lockedStorage) {
        at(step, 'warning', `${n} : pas de sortie. Le bot ne saura pas où aller ensuite (il rejoindra la carte la plus proche du trajet).`);
      }
      if (step.lockedStorage !== undefined && !/^\d+[|;]/.test(step.lockedStorage)) {
        at(step, 'error', `${n} : coffre à code au format « cellule|code » (garder la barre même sans code, sinon le script s'arrête).`);
      }
      if (step.lockedHouse !== undefined && !/[|;]/.test(step.lockedHouse)) {
        at(step, 'error', `${n} : maison à code au format « cellule|code » ou « cellule|code|propriétaire ».`);
      }
      if (typeof step.path === 'string' && parseCoords(step.path) && index) {
        const target = parseCoords(step.path)!;
        const inRoute = bracket.steps.some((s) => {
          const loc = locateStepMap(index, s.map);
          return loc && loc.x === target.x && loc.y === target.y;
        });
        if (!inRoute && name === 'move') {
          at(step, 'info', `${n} : la sortie mène en ${step.path}, qui n'a pas d'étape dans ce palier (le bot rejoindra la carte la plus proche du trajet).`);
        }
      }
    });
  });

  if (name === 'bank') {
    const all = route.brackets.flatMap((b) => b.steps);
    if (all.length && !all.some((s) => s.npcBank || s.lockedStorage || s.custom || s.lockedCustom)) {
      out.push({ level: 'warning', route: 'bank', message: 'bank() : aucune étape ne dépose (banquier, coffre à code ou Lua custom).' });
    }
  }
  if (name === 'phenix') {
    const all = route.brackets.flatMap((b) => b.steps);
    if (all.length && !all.some((s) => s.phenix !== undefined)) {
      out.push({ level: 'warning', route: 'phenix', message: 'phenix() : aucune étape n\'indique la cellule de la statue (clé phenix).' });
    }
  }
}

export function checkProject(project: Project, index: MapIndex | null): Check[] {
  const out: Check[] = [];
  if (project.move) checkRoute('move', project.move, index, out);
  if (project.bank) checkRoute('bank', project.bank, index, out);
  if (project.phenix) checkRoute('phenix', project.phenix, index, out);

  if (!project.bank && project.move) {
    out.push({
      level: 'info', route: 'global',
      message: `Pas de bank() : à ${project.globals.MAX_PODS ?? 95} % de pods, le bot affiche « pods pleins » et continue son trajet.`,
    });
  }
  const steps = project.move?.brackets.flatMap((b) => b.steps) ?? [];
  if (steps.some((s) => s.fight || s.forcefight) && !('MAX_MONSTERS' in project.globals)) {
    out.push({ level: 'info', route: 'global', message: 'Combat sans MAX_MONSTERS : le bot attaque des groupes de toute taille (999 par défaut).' });
  }
  const pods = project.globals.MAX_PODS;
  if (typeof pods === 'number' && (pods < 1 || pods > 100)) {
    out.push({ level: 'error', route: 'global', message: 'MAX_PODS doit être un pourcentage entre 1 et 100.' });
  }
  const turn = project.globals.TURN_TIME_LIMIT;
  if (typeof turn === 'number' && (turn < 3000 || turn > 25000)) {
    out.push({ level: 'warning', route: 'global', message: 'TURN_TIME_LIMIT est borné par le bot entre 3000 et 25000 ms.' });
  }
  return out;
}
