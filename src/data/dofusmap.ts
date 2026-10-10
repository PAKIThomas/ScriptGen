// Données Dofus-Map (https://dofus-map.com), stockées en local :
// - public/data/mines.json : mines, grottes et souterrains (salles, id de carte, entrées) — scripts/build-mines.mjs ;
// - public/data/resources.json : ressources récoltables et leurs positions — scripts/fetch-dofusmap.mjs.
// Seules les images des mines sont chargées en ligne (tuiles publiques Dofus-Map).
import { useEffect, useState } from 'react';

export interface MineRoom {
  x: number;
  y: number;
  mapId: number;
  /** [nom de la ressource, nombre] */
  res: [string, number][];
}

export interface MineLink {
  /** Position sur l'image (repère Dofus-Map : la case x,y couvre [x, x+1[). */
  x: number;
  y: number;
  /** Groupe visé (0 = Continent, 1 = Incarnam, sinon une autre grotte). */
  group: number;
  title: string;
}

export interface MineGroup {
  id: number;
  name: string;
  parent: number;
  minZoom: number;
  lastChanged: number;
  cells: [number, number][];
  rooms: MineRoom[];
  links: MineLink[];
}

export interface MinesData {
  source: string;
  tileTemplate: string;
  mapWidth: number;
  mapHeight: number;
  maxZoom: number;
  entrances: { world: number; x: number; y: number; group: number }[];
  groups: MineGroup[];
}

export interface DmResource {
  id: number;
  name: string;
  job: string;
  /** Position de l'icône dans l'image des icônes (background-position). */
  sprite: [number, number];
}

export interface ResourcesData {
  source: string;
  sprite: string;
  spriteCell: number;
  resources: DmResource[];
  /** id ressource → monde → [x, y, nombre] */
  positions: Record<string, Record<string, [number, number, number][]>>;
  /** id du groupe Dofus-Map (mine) → id ressource → [x, y, nombre] (salle par salle). */
  minePositions?: Record<string, Record<string, [number, number, number][]>>;
}

/** Groupe Dofus-Map parent → calque ScriptGen. */
export const PARENT_WORLD: Record<number, number> = { 0: 1, 1: 2 };

const cache: Record<string, Promise<unknown>> = {};

function useJson<T>(url: string): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    cache[url] ??= fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    cache[url].then((d) => alive && setData(d as T | null));
    return () => { alive = false; };
  }, [url]);
  return data;
}

export const useMines = () => useJson<MinesData>('/data/mines.json');
export const useResources = () => useJson<ResourcesData>('/data/resources.json');

export function mineTileUrl(data: MinesData, group: MineGroup, z: number, x: number, y: number): string {
  return data.tileTemplate
    .replace('{groupId}', String(group.id)).replace('{lastChanged}', String(group.lastChanged || 0))
    .replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

/** Groupe (mine) qui contient cette carte. */
export function mineOfMap(data: MinesData | null, mapId: number): MineGroup | undefined {
  return data?.groups.find((g) => g.rooms.some((r) => r.mapId === mapId));
}

/** Nom comparable entre Dofus-Map (« Frêne ») et les objets du jeu (« Bois de Frêne »). */
export function resourceKey(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/^bois d(e |')/, '').trim();
}
