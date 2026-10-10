// Carte du monde : grille des cartes cliquable + fond officiel du calque (tuiles DofusDB, comme le
// Script Creator), marqueurs des banques / zaaps, et tracé du trajet.
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePanelOpen } from '../usePanelOpen';
import {
  coordsIndexKey, locateStepMap, MAIN_WORLD, worldTileUrl, type MapIndex, type MapInfo, type WorldGeometry,
} from '../data/maps';
import {
  mineOfMap, mineTileUrl, PARENT_WORLD, resourceKey, useMines, useResources, type MineGroup, type MineRoom,
} from '../data/dofusmap';
import { ResourceChooser, RESOURCE_COLORS, ResourceIcon } from './ResourceLayer';
import { pathTarget, type Coords } from '../model/geo';
import type { Step } from '../model/types';

interface Props {
  steps: Step[];
  /** Étapes des autres paliers / trajets, affichées en fond pour se repérer. */
  ghostSteps: Step[];
  selectedId: string | null;
  mode: 'add' | 'select';
  index: MapIndex | null;
  world: number;
  onWorldChange: (world: number) => void;
  /** Clic sur une case ; mapId est fourni dans une mine (l'étape s'écrit alors par son id). */
  onCellClick: (coords: Coords, mapId?: number) => void;
}

const TILE = 250;
const MIN_ZOOM = 6;
const MAX_ZOOM = 220;
const PREFS_KEY = 'scriptgen.map';
/** Proportions d'une carte quand la géométrie du calque est inconnue (Monde des Douze). */
const DEFAULT_GEO = { mapWidth: 69.5, mapHeight: 49.7 };

interface Prefs {
  tiles: boolean; opacity: number; grid: boolean; markers: boolean;
  /** Ressources Dofus-Map affichées sur la carte (ids Dofus-Map). */
  resources: number[];
}

function stepColor(step: Step): string {
  if (step.npcBank || step.lockedStorage) return 'var(--bank)';
  const gather = step.gather || step.forcegather;
  const fight = step.fight || step.forcefight;
  if (gather && fight) return 'var(--mixed)';
  if (fight) return 'var(--fight)';
  if (gather) return 'var(--gather)';
  return 'var(--travel)';
}

function loadPrefs(): Prefs {
  const defaults: Prefs = { tiles: true, opacity: 1, grid: true, markers: true, resources: [] };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

/**
 * Carte « principale » à des coordonnées : plusieurs cartes peuvent partager un x,y sur un calque
 * (intérieurs garés là). On préfère celle dont l'id encode ses coordonnées, puis une carte d'extérieur.
 */
export function canonicalMap(maps: MapInfo[] | undefined, x: number, y: number): MapInfo | undefined {
  if (!maps?.length) return undefined;
  const encodes = (id: number) => {
    const r = id % 262144;
    const ax = (r >> 9) & 0xff;
    const ay = r & 0xff;
    return (r & 0x20000 ? -ax : ax) === x && (r & 0x100 ? -ay : ay) === y;
  };
  return maps.find((m) => encodes(m.id)) ?? maps.find((m) => m.outdoor) ?? [...maps].sort((a, b) => a.id - b.id)[0];
}

export function WorldMap({ steps, ghostSteps, selectedId, mode, index, world, onWorldChange, onCellClick }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(48);
  const [center, setCenter] = useState<Coords>({ x: 0, y: 0 });
  const [hover, setHover] = useState<Coords | null>(null);
  const [goto, setGoto] = useState('');
  const [prefs, setPrefs] = useState(loadPrefs);
  const [layerOpen, setLayerOpen] = usePanelOpen('calques');
  const [mineId, setMineId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mines = useMines();
  const resData = useResources();
  const mine = mineId === null ? null : mines?.groups.find((g) => g.id === mineId) ?? null;
  const rooms = useMemo(() => {
    const byCell = new Map<string, MineRoom>();
    const byId = new Map<number, MineRoom>();
    for (const r of mine?.rooms ?? []) { byCell.set(`${r.x},${r.y}`, r); byId.set(r.mapId, r); }
    return { byCell, byId, cells: new Set((mine?.cells ?? []).map(([x, y]) => `${x},${y}`)) };
  }, [mine]);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* confort seulement */ }
  }, [prefs]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo: WorldGeometry | undefined = index?.geometry.get(world);
  const ratio = mine && mines
    ? mines.mapHeight / mines.mapWidth
    : (geo?.mapHeight ?? DEFAULT_GEO.mapHeight) / (geo?.mapWidth ?? DEFAULT_GEO.mapWidth);

  /** Position d'une étape sur la vue courante (dans une mine : la salle de cette carte). */
  const locate = (map: string | number) => {
    if (!mine) return locateStepMap(index, map);
    const room = /^\d+$/.test(String(map)) ? rooms.byId.get(Number(map)) : undefined;
    return room ? { x: room.x, y: room.y, worldMap: world } : null;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const located = useMemo(() => steps.map((step, i) => ({ step, i, at: locate(step.map) })), [steps, index, mine, rooms]);

  /** Ouvre une mine et cadre la vue sur ses salles. */
  const openMine = (group: MineGroup | null, focus?: Coords) => {
    setMineId(group?.id ?? null);
    if (!group) {
      if (focus) setCenter(focus);
      return;
    }
    const xs = group.cells.map(([x]) => x);
    const ys = group.cells.map(([, y]) => y);
    setCenter({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 });
    const r = mines ? mines.mapHeight / mines.mapWidth : 0.7;
    const fit = Math.min(size.w / (Math.max(...xs) - Math.min(...xs) + 3), size.h / ((Math.max(...ys) - Math.min(...ys) + 3) * r));
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fit)));
  };

  // Recentre sur la première carte quand on change de palier / de trajet.
  const firstKey = steps.length ? String(steps[0].map) : '';
  useEffect(() => {
    const firstId = steps.length && /^\d+$/.test(String(steps[0].map)) ? Number(steps[0].map) : null;
    const firstMine = firstId !== null ? mineOfMap(mines, firstId) : undefined;
    if (firstMine) {
      if (firstMine.id !== mineId) openMine(firstMine);
      return;
    }
    if (mine) setMineId(null);
    const first = steps.map((step) => locateStepMap(index, step.map)).find(Boolean);
    if (first) {
      setCenter({ x: first.x, y: first.y });
      if (first.worldMap !== world && first.worldMap !== -1) onWorldChange(first.worldMap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, index, mines]);

  const cw = zoom;
  const ch = zoom * ratio;
  const toScreen = (c: Coords) => ({ x: size.w / 2 + (c.x - center.x) * cw, y: size.h / 2 + (c.y - center.y) * ch });
  const toMap = (px: number, py: number): Coords => ({
    x: Math.round(center.x + (px - size.w / 2) / cw),
    y: Math.round(center.y + (py - size.h / 2) / ch),
  });

  const visible = {
    x0: Math.floor(center.x - size.w / 2 / cw) - 1,
    x1: Math.ceil(center.x + size.w / 2 / cw) + 1,
    y0: Math.floor(center.y - size.h / 2 / ch) - 1,
    y1: Math.ceil(center.y + size.h / 2 / ch) + 1,
  };

  // Étapes de ce calque (ou intérieurs, dessinés en pointillés aux coordonnées du bâtiment).
  const byCell = useMemo(() => {
    const map = new Map<string, { step: Step; index: number; interior: boolean }[]>();
    for (const { step, i, at } of located) {
      if (!at) continue;
      const interior = at.worldMap !== world;
      if (interior && !(world === MAIN_WORLD && at.worldMap === -1)) continue;
      const key = `${at.x},${at.y}`;
      map.set(key, [...(map.get(key) ?? []), { step, index: i, interior }]);
    }
    return map;
  }, [located, world]);

  const ghostCells = useMemo(() => {
    const set = new Set<string>();
    for (const s of ghostSteps) {
      const at = locate(s.map);
      if (at && (at.worldMap === world || (world === MAIN_WORLD && at.worldMap === -1))) set.add(`${at.x},${at.y}`);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostSteps, index, world, mine, rooms]);

  const links = useMemo(() => {
    const out: { from: Coords; to: Coords; travel: boolean }[] = [];
    located.forEach(({ step, at }, i) => {
      if (!at) return;
      // Dans une mine, les sorties « x,y » ne correspondent pas à la disposition des salles : on relie les étapes.
      const explicit = mine ? null : pathTarget(step);
      const nextAt = located[i + 1]?.at ?? located[0]?.at ?? null;
      const target = explicit ?? (nextAt ? { x: nextAt.x, y: nextAt.y } : null);
      if (!target || (target.x === at.x && target.y === at.y)) return;
      out.push({ from: at, to: target, travel: Math.abs(target.x - at.x) + Math.abs(target.y - at.y) > 1 });
    });
    return out;
  }, [located, mine]);

  // ── Fond : images officielles du calque (DofusDB), découpées en tuiles de 250 px ──
  const tiles: JSX.Element[] = [];
  if (prefs.tiles && mine && mines) {
    // Images Dofus-Map : pyramide de tuiles 256 px (au zoom max, une carte = son image en pleine taille). Case x,y = [x, x+1[.
    const perCell = (z: number) => mines.mapWidth / 2 ** (mines.maxZoom - z);
    let z = mines.maxZoom;
    while (z > (mine.minZoom || 0) && perCell(z - 1) >= cw) z--;
    const tx = 256 / perCell(z); // largeur d'une tuile, en cases
    const ty = 256 / (mines.mapHeight / 2 ** (mines.maxZoom - z));
    const xs = mine.cells.map(([x]) => x);
    const ys = mine.cells.map(([, y]) => y);
    const screen = (fx: number, fy: number) => toScreen({ x: fx - 0.5, y: fy - 0.5 });
    for (let j = Math.floor(Math.min(...ys) / ty); j <= Math.floor((Math.max(...ys) + 1) / ty); j++) {
      for (let i = Math.floor(Math.min(...xs) / tx); i <= Math.floor((Math.max(...xs) + 1) / tx); i++) {
        const a = screen(i * tx, j * ty);
        const b = screen((i + 1) * tx, (j + 1) * ty);
        if (b.x < 0 || b.y < 0 || a.x > size.w || a.y > size.h) continue;
        tiles.push(
          <image
            key={`m${mine.id}/${z}/${i}/${j}`}
            href={mineTileUrl(mines, mine, z, i, j)}
            x={a.x} y={a.y} width={b.x - a.x + 0.6} height={b.y - a.y + 0.6}
            preserveAspectRatio="none"
            onError={(e) => { (e.target as SVGImageElement).style.display = 'none'; }}
          />,
        );
      }
    }
  } else if (prefs.tiles && geo && geo.customScales.length) {
    const k = cw / geo.mapWidth; // pixels écran par pixel de l'image à l'échelle 1
    const scales = [...geo.customScales].sort((a, b) => a.x - b.x);
    const scale = scales.find((s) => s.x >= k) ?? scales[scales.length - 1];
    const topLeft00 = { x: toScreen({ x: 0, y: 0 }).x - cw / 2, y: toScreen({ x: 0, y: 0 }).y - ch / 2 };
    const origin = { x: topLeft00.x - geo.origineX * k, y: topLeft00.y - geo.origineY * (ch / geo.mapHeight) };
    const tw = (TILE / scale.x) * k;
    const th = (TILE / scale.y) * (ch / geo.mapHeight);
    const cols = Math.ceil((geo.totalWidth * scale.x) / TILE);
    const rows = Math.ceil((geo.totalHeight * scale.y) / TILE);
    const c0 = Math.max(0, Math.floor(-origin.x / tw));
    const c1 = Math.min(cols - 1, Math.floor((size.w - origin.x) / tw));
    const r0 = Math.max(0, Math.floor(-origin.y / th));
    const r1 = Math.min(rows - 1, Math.floor((size.h - origin.y) / th));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        tiles.push(
          <image
            key={`${scale.name}/${r}/${c}`}
            href={worldTileUrl(world, scale.name, r * cols + c + 1)}
            x={origin.x + c * tw}
            y={origin.y + r * th}
            width={tw + 0.6}
            height={th + 0.6}
            preserveAspectRatio="none"
            onError={(e) => { (e.target as SVGImageElement).style.display = 'none'; }}
          />,
        );
      }
    }
  }

  const cells: JSX.Element[] = [];
  for (let y = visible.y0; y <= visible.y1; y++) {
    for (let x = visible.x0; x <= visible.x1; x++) {
      const key = `${x},${y}`;
      const entries = byCell.get(key);
      const ghost = ghostCells.has(key);
      if (mine && !rooms.cells.has(key)) continue;
      const unknownRoom = !!mine && !rooms.byCell.has(key);
      const exists = mine ? !unknownRoom : !index || index.byCoords.has(coordsIndexKey(world, x, y));
      if (!entries && !ghost && !prefs.grid && exists) continue;
      const p = toScreen({ x, y });
      const selected = entries?.some((e) => e.step.id === selectedId);
      const interiorOnly = entries?.every((e) => e.interior);
      cells.push(
        <rect
          key={key}
          x={p.x - cw / 2}
          y={p.y - ch / 2}
          width={cw}
          height={ch}
          className={`cell${prefs.grid ? ' grid' : ''}${ghost ? ' ghost' : ''}${exists ? '' : ' void'}${interiorOnly ? ' interior' : ''}`}
          style={entries && !interiorOnly ? { fill: stepColor(entries[0].step), fillOpacity: 0.5 } : undefined}
          stroke={selected ? 'var(--accent)' : interiorOnly ? stepColor(entries![0].step) : undefined}
          strokeWidth={selected || interiorOnly ? 3 : undefined}
        />,
      );
      if (entries && cw >= 18) {
        cells.push(
          <text key={`t${key}`} x={p.x} y={p.y + 4} className="cell-label">
            {entries.map((e) => e.index + 1).join(',')}{interiorOnly ? ' ⌂' : ''}
          </text>,
        );
      }
    }
  }

  // Marqueurs : banques prédéfinies et zaaps de ce calque.
  const markers: JSX.Element[] = [];
  /** Repère Dofus-Map (case x,y = [x, x+1[) → écran. */
  const dmScreen = (fx: number, fy: number) => toScreen({ x: fx - 0.5, y: fy - 0.5 });
  /** Pastille cliquable (entrée de mine, lien entre grottes, sortie). */
  const portal = (key: string, at: { x: number; y: number }, label: string, title: string, onOpen: () => void, cls = '') => (
    <g key={key} className={`marker portal-marker ${cls}`} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
      onClick={onOpen}>
      <title>{title}</title>
      <circle cx={at.x} cy={at.y} r={11} />
      <text x={at.x} y={at.y + 4}>{label}</text>
    </g>
  );
  if (prefs.markers && mines && cw >= 10) {
    if (mine) {
      for (const l of mine.links) {
        const target = mines.groups.find((g) => g.id === l.group);
        const exit = l.group in PARENT_WORLD;
        if (!exit && !target) continue;
        markers.push(portal(`l${l.group}-${l.x}-${l.y}`, dmScreen(l.x, l.y), exit ? '↑' : '⛏',
          exit ? `Sortie vers ${l.title}` : `Vers ${target!.name}`,
          () => {
            if (exit) {
              onWorldChange(PARENT_WORLD[l.group]);
              openMine(null, { x: l.x - 0.5, y: l.y - 0.5 });
            } else openMine(target!);
          }, exit ? 'exit' : ''));
      }
    } else {
      for (const e of mines.entrances) {
        if (e.world !== world) continue;
        const g = mines.groups.find((x) => x.id === e.group);
        if (!g || e.x < visible.x0 || e.x > visible.x1 + 1 || e.y < visible.y0 || e.y > visible.y1 + 1) continue;
        markers.push(portal(`e${e.group}-${e.x}-${e.y}`, dmScreen(e.x, e.y), '⛏', `${g.name} — cliquer pour entrer`, () => openMine(g)));
      }
    }
  }
  if (!mine && prefs.markers && index && cw >= 14) {
    const inView = (x: number, y: number) => x >= visible.x0 && x <= visible.x1 && y >= visible.y0 && y <= visible.y1;
    if (world === MAIN_WORLD) {
      for (const b of index.banks) {
        if (!inView(b.x, b.y)) continue;
        const p = toScreen(b);
        markers.push(
          <g key={`b${b.mapId}`} className="marker bank-marker">
            <title>{`Banque — ${b.zone} [${b.x},${b.y}] · id ${b.mapId}`}</title>
            <circle cx={p.x - cw / 2 + 9} cy={p.y - ch / 2 + 9} r={8} />
            <text x={p.x - cw / 2 + 9} y={p.y - ch / 2 + 12.5}>B</text>
          </g>,
        );
      }
    }
    for (const z of index.zaaps) {
      if (z.worldMap !== world || !inView(z.x, z.y)) continue;
      const p = toScreen(z);
      markers.push(
        <g key={`z${z.mapId}`} className="marker zaap-marker">
          <title>{`Zaap — ${index.subAreaName(z.subAreaId)} [${z.x},${z.y}] · id ${z.mapId}`}</title>
          <circle cx={p.x + cw / 2 - 9} cy={p.y - ch / 2 + 9} r={8} />
          <text x={p.x + cw / 2 - 9} y={p.y - ch / 2 + 12.5}>Z</text>
        </g>,
      );
    }
  }

  // ── Ressources choisies (Dofus-Map) : où les trouver sur la vue courante ──
  const resourceMarks: JSX.Element[] = [];
  const shownResources = (resData?.resources ?? []).filter((r) => prefs.resources.includes(r.id));
  /** Ressources présentes par case : « x,y » → [ressource, nombre][] */
  const resourceCells = useMemo(() => {
    const out = new Map<string, [number, number][]>();
    const add = (key: string, id: number, n: number) => out.set(key, [...(out.get(key) ?? []), [id, n]]);
    for (const r of shownResources) {
      if (mine && resData?.minePositions?.[mine.id]) {
        // Comptes exacts Dofus-Map, salle par salle.
        for (const [x, y, n] of resData.minePositions[mine.id][r.id] ?? []) add(`${x},${y}`, r.id, n);
      } else if (mine) {
        // Repli : ressources connues des salles (catalogue du Script Creator).
        const k = resourceKey(r.name);
        for (const room of mine.rooms) {
          const hit = room.res.find(([name]) => resourceKey(name) === k);
          if (hit) add(`${room.x},${room.y}`, r.id, hit[1]);
        }
      } else {
        for (const [x, y, n] of resData?.positions[r.id]?.[world] ?? []) add(`${x},${y}`, r.id, n);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resData, prefs.resources, world, mine]);
  if (resData && cw >= 6) {
    for (const [key, list] of resourceCells) {
      const [x, y] = key.split(',').map(Number);
      if (x < visible.x0 || x > visible.x1 || y < visible.y0 || y > visible.y1) continue;
      const p = toScreen({ x, y });
      list.forEach(([id, n], k) => {
        const color = RESOURCE_COLORS[prefs.resources.indexOf(id) % RESOURCE_COLORS.length];
        const res = resData.resources.find((r) => r.id === id)!;
        // Une pastille par ressource, côte à côte dans la case.
        const size = Math.min(26, Math.max(7, cw / 3));
        const cx = p.x - cw / 2 + size / 2 + 2 + k * (size + 2);
        const cy = p.y + ch / 2 - size / 2 - 2;
        resourceMarks.push(
          <g key={`r${key}-${id}`} className="res-mark" pointerEvents="none">
            <circle cx={cx} cy={cy} r={size / 2 + 1.5} fill="rgba(0,0,0,.65)" stroke={color} strokeWidth={2} />
            {size >= 16 && <ResourceIcon data={resData} resource={res} x={cx - size / 2 + 1} y={cy - size / 2 + 1} size={size - 2} />}
            {size >= 12 && (
              <text x={cx + size / 2} y={cy - size / 2 + 3} className="res-count" fill={color}>{n}</text>
            )}
          </g>,
        );
      });
    }
  }

  const axisLabels: JSX.Element[] = [];
  if (cw >= 24 && prefs.grid) {
    for (let x = visible.x0; x <= visible.x1; x++) {
      axisLabels.push(<text key={`ax${x}`} x={toScreen({ x, y: 0 }).x} y={size.h - 6} className="axis-label">{x}</text>);
    }
    for (let y = visible.y0; y <= visible.y1; y++) {
      axisLabels.push(<text key={`ay${y}`} x={size.w - 14} y={toScreen({ x: 0, y }).y + 4} className="axis-label">{y}</text>);
    }
  }

  const hoverRoom = hover && mine ? rooms.byCell.get(`${hover.x},${hover.y}`) : undefined;
  const hoverMaps = hover && index && !mine ? index.byCoords.get(coordsIndexKey(world, hover.x, hover.y)) ?? [] : [];
  const hoverMain = hover ? canonicalMap(hoverMaps, hover.x, hover.y) : undefined;
  const hoverBank = hover && world === MAIN_WORLD ? index?.banks.find((b) => b.x === hover.x && b.y === hover.y) : undefined;

  return (
    <div className="world-map">
      <svg
        ref={ref}
        onWheel={(e) => {
          const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
          setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
        }}
        onPointerDown={(e) => {
          const r = ref.current!.getBoundingClientRect();
          drag.current = { x: e.clientX - r.left, y: e.clientY - r.top, cx: center.x, cy: center.y, moved: false };
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const r = ref.current!.getBoundingClientRect();
          const p = { x: e.clientX - r.left, y: e.clientY - r.top };
          setHover(toMap(p.x, p.y));
          const d = drag.current;
          if (!d) return;
          const dx = p.x - d.x;
          const dy = p.y - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          if (d.moved) setCenter({ x: d.cx - dx / cw, y: d.cy - dy / ch });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const r = ref.current!.getBoundingClientRect();
            const c = toMap(e.clientX - r.left, e.clientY - r.top);
            if (!mine) onCellClick(c);
            else if (rooms.byCell.has(`${c.x},${c.y}`)) onCellClick(c, rooms.byCell.get(`${c.x},${c.y}`)!.mapId);
            else if (rooms.cells.has(`${c.x},${c.y}`)) {
              setNotice('Id de cette salle inconnu : relève-le en jeu (/mapid) et ajoute-le par son id.');
              window.setTimeout(() => setNotice(null), 4000);
            }
          }
        }}
        onPointerLeave={() => setHover(null)}
      >
        <g style={{ opacity: prefs.opacity }}>{tiles}</g>
        <g>{cells}</g>
        <g className="links">
          {links.map((l, i) => {
            const a = toScreen(l.from);
            const b = toScreen(l.to);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={l.travel ? 'link travel' : 'link'} markerEnd="url(#arrow)" />;
          })}
        </g>
        <g>{resourceMarks}</g>
        <g>{markers}</g>
        {hover && (
          <rect x={toScreen(hover).x - cw / 2} y={toScreen(hover).y - ch / 2} width={cw} height={ch} className="cell-hover" />
        )}
        <g>{axisLabels}</g>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--link)" />
          </marker>
        </defs>
      </svg>

      <div className={`floating map-layer-card${layerOpen ? '' : ' collapsed'}`}>
        <div className="layer-head">
          <label className="field inline">
            <span>Calque</span>
            <select
              value={mine ? `m:${mine.id}` : String(world)}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('m:')) openMine(mines?.groups.find((g) => g.id === Number(v.slice(2))) ?? null);
                else { setMineId(null); onWorldChange(Number(v)); }
              }}
            >
              <optgroup label="Calques">
                {(index?.worlds ?? [{ id: MAIN_WORLD, name: 'Monde des Douze', count: 0 }]).filter((w) => w.id !== -1).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </optgroup>
              {mines && (
                <optgroup label="Mines, grottes & souterrains (Dofus-Map)">
                  {mines.groups.map((g) => <option key={g.id} value={`m:${g.id}`}>{g.name}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          <button type="button" className="icon-button" onClick={() => setLayerOpen(!layerOpen)} title={layerOpen ? 'Réduire' : 'Afficher les options de la carte'}>{layerOpen ? '–' : '+'}</button>
        </div>
        {layerOpen && (
          <>
            <div className="row">
              <label className="check" title="Images officielles du monde (DofusDB, connexion internet)">
                <input type="checkbox" checked={prefs.tiles} onChange={(e) => setPrefs({ ...prefs, tiles: e.target.checked })} /> Fond
              </label>
              <label className="check"><input type="checkbox" checked={prefs.grid} onChange={(e) => setPrefs({ ...prefs, grid: e.target.checked })} /> Grille</label>
              <label className="check"><input type="checkbox" checked={prefs.markers} onChange={(e) => setPrefs({ ...prefs, markers: e.target.checked })} /> Banques, zaaps &amp; mines</label>
            </div>
            {prefs.tiles && (
              <input type="range" min={0.2} max={1} step={0.05} value={prefs.opacity}
                onChange={(e) => setPrefs({ ...prefs, opacity: Number(e.target.value) })} title="Opacité du fond" />
            )}
            <form onSubmit={(e) => {
              e.preventDefault();
              const m = /^\s*(-?\d+)\s*[,; ]\s*(-?\d+)\s*$/.exec(goto);
              if (m) setCenter({ x: Number(m[1]), y: Number(m[2]) });
            }}>
              <input value={goto} onChange={(e) => setGoto(e.target.value)} placeholder="Aller à x,y" />
            </form>
            {resData && (
              <ResourceChooser
                data={resData}
                selected={prefs.resources}
                counts={(id) => (mine ? [...resourceCells.values()].filter((l) => l.some(([r]) => r === id)).length
                  : resData.positions[id]?.[world]?.length ?? 0)}
                onChange={(ids) => setPrefs({ ...prefs, resources: ids })}
              />
            )}
          </>
        )}
      </div>

      <div className="floating map-hover-card">
        {mine ? <strong>{mine.name}</strong> : <strong>{hover ? `${hover.x},${hover.y}` : '—'}</strong>}
        {mine && hoverRoom && (
          <span className="muted">
            id {hoverRoom.mapId}{hoverRoom.res.length ? ` · ${hoverRoom.res.map(([n, k]) => `${n} ×${k}`).join(', ')}` : ''}
          </span>
        )}
        {mine && hover && !hoverRoom && rooms.cells.has(`${hover.x},${hover.y}`) && <span className="muted">id inconnu</span>}
        {!mine && hover && resData && resourceCells.get(`${hover.x},${hover.y}`)?.map(([id, n]) => (
          <span key={id} className="tag">{resData.resources.find((r) => r.id === id)?.name} ×{n}</span>
        ))}
        {notice && <span className="tag warn">{notice}</span>}
        {hoverMain && (
          <span className="muted">
            {index!.subAreaName(hoverMain.subAreaId)} · id {hoverMain.id}
            {hoverMaps.length > 1 ? ` (+${hoverMaps.length - 1})` : ''}
          </span>
        )}
        {hover && index && !mine && !hoverMain && <span className="muted">aucune carte</span>}
        {hoverBank && <span className="tag">Banque {hoverBank.zone}</span>}
      </div>

      <div className="floating map-legend">
        <span className="muted">{mode === 'add' ? 'Clic = ajouter' : 'Clic = sélectionner'} · glisser · molette</span>
        <span><i style={{ background: 'var(--gather)' }} />Récolte</span>
        <span><i style={{ background: 'var(--fight)' }} />Combat</span>
        <span><i style={{ background: 'var(--mixed)' }} />Les deux</span>
        <span><i style={{ background: 'var(--bank)' }} />Banque</span>
        <span><i style={{ background: 'var(--travel)' }} />Passage</span>
        <span>⌂ intérieur</span>
      </div>
    </div>
  );
}
