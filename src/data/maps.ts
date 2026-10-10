// Référentiel des cartes (public/data/maps.json, tiré de l'API publique DofusDB par
// scripts/fetch-maps.mjs). Chargé à la demande : 15 000 cartes, ~400 Ko.
import { useEffect, useState } from 'react';

export interface MapInfo {
  id: number;
  x: number;
  y: number;
  /** 1 = Monde des Douze ; -1 = intérieurs (maisons, donjons…) ; autres = zones à part. */
  worldMap: number;
  subAreaId: number;
  outdoor: boolean;
}

export const MAIN_WORLD = 1;

/** Noms des mondes les plus courants (les autres sont affichés par leur numéro). */
export const WORLD_NAMES: Record<number, string> = {
  1: 'Monde des Douze',
  2: 'Incarnam',
  [-1]: 'Intérieurs',
};

/** Géométrie d'un calque (images officielles du monde servies par DofusDB). */
export interface WorldGeometry {
  id: number;
  name: string;
  totalWidth: number;
  totalHeight: number;
  origineX: number;
  origineY: number;
  mapWidth: number;
  mapHeight: number;
  startScale: number;
  visibleOnMap: boolean;
  customScales: { name: string; x: number; y: number }[];
}

export interface Bank {
  mapId: number;
  zone: string;
  x: number;
  y: number;
  interior: boolean;
}

export interface Zaap {
  mapId: number;
  x: number;
  y: number;
  worldMap: number;
  subAreaId: number;
}

export interface MapIndex {
  maps: MapInfo[];
  geometry: Map<number, WorldGeometry>;
  banks: Bank[];
  zaaps: Zaap[];
  byId: Map<number, MapInfo>;
  /** Clé `${worldMap}:${x},${y}` → cartes à ces coordonnées dans ce monde. */
  byCoords: Map<string, MapInfo[]>;
  subAreaName: (id: number) => string;
  areaName: (subAreaId: number) => string;
  worlds: { id: number; name: string; count: number }[];
}

type Row = [number, number, number, number, number, number];

let loading: Promise<MapIndex> | null = null;

export function coordsIndexKey(worldMap: number, x: number, y: number): string {
  return `${worldMap}:${x},${y}`;
}

export function buildIndex(
  rows: Row[],
  subareas: [number, string, number][],
  areas: [number, string][],
  geometry: WorldGeometry[] = [],
  banks: Bank[] = [],
  zaaps: Zaap[] = [],
): MapIndex {
  const maps = rows.map(([id, x, y, worldMap, subAreaId, outdoor]) => ({
    id, x, y, worldMap, subAreaId, outdoor: outdoor === 1,
  }));
  const byId = new Map(maps.map((m) => [m.id, m]));
  const byCoords = new Map<string, MapInfo[]>();
  const worldCount = new Map<number, number>();
  for (const m of maps) {
    const key = coordsIndexKey(m.worldMap, m.x, m.y);
    const list = byCoords.get(key);
    if (list) list.push(m);
    else byCoords.set(key, [m]);
    worldCount.set(m.worldMap, (worldCount.get(m.worldMap) ?? 0) + 1);
  }
  const sub = new Map(subareas.map(([id, name, areaId]) => [id, { name, areaId }]));
  const area = new Map(areas);
  const geo = new Map(geometry.map((g) => [g.id, g]));
  const worlds = [...worldCount.entries()]
    .map(([id, count]) => ({ id, count, name: geo.get(id)?.name ?? WORLD_NAMES[id] ?? `Monde ${id}` }))
    .sort((a, b) => (a.id === MAIN_WORLD ? -1 : b.id === MAIN_WORLD ? 1 : b.count - a.count));
  return {
    maps,
    geometry: geo,
    banks,
    zaaps,
    byId,
    byCoords,
    worlds,
    subAreaName: (id) => sub.get(id)?.name ?? `Sous-zone ${id}`,
    areaName: (subAreaId) => {
      const s = sub.get(subAreaId);
      return s ? area.get(s.areaId) ?? '' : '';
    },
  };
}

export function loadMapIndex(): Promise<MapIndex> {
  loading ??= Promise.all([
    fetch('/data/maps.json').then((r) => r.json()),
    fetch('/data/subareas.json').then((r) => r.json()),
    fetch('/data/areas.json').then((r) => r.json()),
    fetch('/data/worlds.json').then((r) => r.json()).catch(() => []),
    fetch('/data/banks.json').then((r) => r.json()).catch(() => []),
    fetch('/data/zaaps.json').then((r) => r.json()).catch(() => []),
  ]).then(([rows, subareas, areas, geometry, banks, zaaps]) => buildIndex(rows, subareas, areas, geometry, banks, zaaps));
  return loading;
}

export function useMapIndex(): MapIndex | null {
  const [index, setIndex] = useState<MapIndex | null>(null);
  useEffect(() => {
    let alive = true;
    loadMapIndex().then((i) => alive && setIndex(i)).catch(() => alive && setIndex(null));
    return () => { alive = false; };
  }, []);
  return index;
}

/** Tuile des images officielles du monde (même source que le Script Creator : DofusDB). */
export function worldTileUrl(world: number, scale: string, index: number): string {
  return `https://api.dofusdb.fr/img/worlds/${world}/${scale}/${index}.jpg`;
}

/** Image d'une carte (servie par DofusDB, chargée par le navigateur). */
export function mapImageUrl(mapId: number, scale: '0.25' | '0.5' | '1' = '0.25'): string {
  return `https://api.dofusdb.fr/img/maps/${scale}/${mapId}.jpg`;
}

/** Position d'une valeur `map` d'étape : coordonnées + monde, si on peut la situer. */
export function locateStepMap(index: MapIndex | null, map: string | number): { x: number; y: number; worldMap: number; info?: MapInfo } | null {
  if (typeof map === 'number' || /^\d+$/.test(String(map))) {
    const info = index?.byId.get(Number(map));
    return info ? { x: info.x, y: info.y, worldMap: info.worldMap, info } : null;
  }
  const m = /^\s*(-?\d+)\s*,\s*(-?\d+)\s*$/.exec(String(map));
  return m ? { x: Number(m[1]), y: Number(m[2]), worldMap: MAIN_WORLD } : null;
}

/**
 * Même carte ? Un « x,y » du Monde des Douze et l'id d'une carte d'extérieur à ces coordonnées désignent
 * la même carte ; un intérieur (même x,y, autre calque) est une autre carte.
 */
export function sameMap(index: MapIndex | null, a: string | number, b: string | number): boolean {
  if (String(a).trim() === String(b).trim()) return true;
  const la = locateStepMap(index, a);
  const lb = locateStepMap(index, b);
  if (!la || !lb || la.x !== lb.x || la.y !== lb.y || la.worldMap !== lb.worldMap) return false;
  if (la.info && lb.info) return la.info.id === lb.info.id;
  return la.worldMap === MAIN_WORLD && (la.info?.outdoor ?? true) && (lb.info?.outdoor ?? true);
}
