// Carte du monde : grille des cartes cliquable + fond officiel du calque (tuiles DofusDB, comme le
// Script Creator), marqueurs des banques / zaaps, et tracé du trajet.
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePanelOpen } from '../usePanelOpen';
import {
  coordsIndexKey, locateStepMap, MAIN_WORLD, worldTileUrl, type MapIndex, type MapInfo, type WorldGeometry,
} from '../data/maps';
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
  onCellClick: (coords: Coords) => void;
}

const TILE = 250;
const MIN_ZOOM = 6;
const MAX_ZOOM = 220;
const PREFS_KEY = 'scriptgen.map';
/** Proportions d'une carte quand la géométrie du calque est inconnue (Monde des Douze). */
const DEFAULT_GEO = { mapWidth: 69.5, mapHeight: 49.7 };

interface Prefs { tiles: boolean; opacity: number; grid: boolean; markers: boolean }

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
  const defaults: Prefs = { tiles: true, opacity: 1, grid: true, markers: true };
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
  const ratio = (geo?.mapHeight ?? DEFAULT_GEO.mapHeight) / (geo?.mapWidth ?? DEFAULT_GEO.mapWidth);

  const located = useMemo(() => steps.map((step, i) => ({ step, i, at: locateStepMap(index, step.map) })), [steps, index]);

  // Recentre sur la première carte quand on change de palier / de trajet.
  const firstKey = steps.length ? String(steps[0].map) : '';
  useEffect(() => {
    const first = located.find((l) => l.at);
    if (first?.at) {
      setCenter({ x: first.at.x, y: first.at.y });
      if (first.at.worldMap !== world && first.at.worldMap !== -1) onWorldChange(first.at.worldMap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, index]);

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
      const at = locateStepMap(index, s.map);
      if (at && (at.worldMap === world || (world === MAIN_WORLD && at.worldMap === -1))) set.add(`${at.x},${at.y}`);
    }
    return set;
  }, [ghostSteps, index, world]);

  const links = useMemo(() => {
    const out: { from: Coords; to: Coords; travel: boolean }[] = [];
    located.forEach(({ step, at }, i) => {
      if (!at) return;
      const explicit = pathTarget(step);
      const nextAt = located[i + 1]?.at ?? located[0]?.at ?? null;
      const target = explicit ?? (nextAt ? { x: nextAt.x, y: nextAt.y } : null);
      if (!target || (target.x === at.x && target.y === at.y)) return;
      out.push({ from: at, to: target, travel: Math.abs(target.x - at.x) + Math.abs(target.y - at.y) > 1 });
    });
    return out;
  }, [located]);

  // ── Fond : images officielles du calque (DofusDB), découpées en tuiles de 250 px ──
  const tiles: JSX.Element[] = [];
  if (prefs.tiles && geo && geo.customScales.length) {
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
      const exists = !index || index.byCoords.has(coordsIndexKey(world, x, y));
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
  if (prefs.markers && index && cw >= 14) {
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

  const axisLabels: JSX.Element[] = [];
  if (cw >= 24 && prefs.grid) {
    for (let x = visible.x0; x <= visible.x1; x++) {
      axisLabels.push(<text key={`ax${x}`} x={toScreen({ x, y: 0 }).x} y={size.h - 6} className="axis-label">{x}</text>);
    }
    for (let y = visible.y0; y <= visible.y1; y++) {
      axisLabels.push(<text key={`ay${y}`} x={size.w - 14} y={toScreen({ x: 0, y }).y + 4} className="axis-label">{y}</text>);
    }
  }

  const hoverMaps = hover && index ? index.byCoords.get(coordsIndexKey(world, hover.x, hover.y)) ?? [] : [];
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
            onCellClick(toMap(e.clientX - r.left, e.clientY - r.top));
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
            <select value={world} onChange={(e) => onWorldChange(Number(e.target.value))}>
              {(index?.worlds ?? [{ id: MAIN_WORLD, name: 'Monde des Douze', count: 0 }]).filter((w) => w.id !== -1).map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
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
              <label className="check"><input type="checkbox" checked={prefs.markers} onChange={(e) => setPrefs({ ...prefs, markers: e.target.checked })} /> Banques &amp; zaaps</label>
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
          </>
        )}
      </div>

      <div className="floating map-hover-card">
        <strong>{hover ? `${hover.x},${hover.y}` : '—'}</strong>
        {hoverMain && (
          <span className="muted">
            {index!.subAreaName(hoverMain.subAreaId)} · id {hoverMain.id}
            {hoverMaps.length > 1 ? ` (+${hoverMaps.length - 1})` : ''}
          </span>
        )}
        {hover && index && !hoverMain && <span className="muted">aucune carte</span>}
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
