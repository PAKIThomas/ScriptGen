// Coordonnées du monde Dofus : x augmente vers la droite, y vers le bas (« top » = y - 1).
import type { LuaValue, Step } from './types';

export interface Coords {
  x: number;
  y: number;
}

export function parseCoords(map: string | number): Coords | null {
  if (typeof map !== 'string') return null;
  const m = /^\s*(-?\d+)\s*[,;]\s*(-?\d+)\s*$/.exec(map.replace(/[‐-―−]/g, '-'));
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

export function coordsKey(c: Coords): string {
  return `${c.x},${c.y}`;
}

export type Direction = 'top' | 'bottom' | 'left' | 'right';

export const DIRECTIONS: { id: Direction; label: string; dx: number; dy: number }[] = [
  { id: 'top', label: 'Haut', dx: 0, dy: -1 },
  { id: 'right', label: 'Droite', dx: 1, dy: 0 },
  { id: 'bottom', label: 'Bas', dx: 0, dy: 1 },
  { id: 'left', label: 'Gauche', dx: -1, dy: 0 },
];

export function directionBetween(from: Coords, to: Coords): Direction | null {
  const d = DIRECTIONS.find((dir) => from.x + dir.dx === to.x && from.y + dir.dy === to.y);
  return d?.id ?? null;
}

/**
 * Sortie proposée quand on enchaîne deux cartes en cliquant.
 * - « coordonnées » (style des exemples) : path = "x,y" (adjacente = simple changement, lointaine = voyage) ;
 * - « directions » : "right"... si adjacente, sinon la coordonnée ;
 * - une carte par id : path = id (voyage).
 */
export type PathStyle = 'coords' | 'directions';

export function suggestPath(from: Step, to: Step, style: PathStyle): LuaValue {
  const a = parseCoords(from.map);
  const b = parseCoords(to.map);
  if (a && b) {
    const dir = style === 'directions' ? directionBetween(a, b) : null;
    return dir ?? coordsKey(b);
  }
  return to.map;
}

/** Destination d'une sortie, si on peut la déduire (pour dessiner le trajet sur la carte). */
export function pathTarget(step: Step): Coords | null {
  const from = parseCoords(step.map);
  const path = step.path;
  if (typeof path !== 'string') return null;
  const asCoords = parseCoords(path);
  if (asCoords) return asCoords;
  const dirName = /^(\w+)/.exec(path)?.[1]?.toLowerCase();
  const dir = DIRECTIONS.find((d) => d.id === DIRECTION_SYNONYMS[dirName ?? '']);
  if (from && dir && !path.includes('|')) return { x: from.x + dir.dx, y: from.y + dir.dy };
  return null;
}

const DIRECTION_SYNONYMS: Record<string, Direction> = {
  top: 'top', haut: 'top', nord: 'top', north: 'top', up: 'top',
  bottom: 'bottom', bas: 'bottom', sud: 'bottom', south: 'bottom', down: 'bottom',
  left: 'left', gauche: 'left', ouest: 'left', west: 'left',
  right: 'right', droite: 'right', est: 'right', east: 'right',
};
