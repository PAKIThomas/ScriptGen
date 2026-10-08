import { useEffect, useMemo, useRef, useState } from 'react';
import { locateStepMap, MAIN_WORLD, coordsIndexKey, type MapIndex } from '../data/maps';
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

// Proportions d'une carte Dofus (et des tuiles de dofus-map.com, groupe 0 = Monde des Douze).
const MAP_W = 1204;
const MAP_H = 859;
const RATIO = MAP_H / MAP_W;
const TILE = 256;
const TILE_MAX_ZOOM = 7;
/** Tuiles existantes au zoom 2 (getGroupData.php?groupId=0), extrapolées aux autres zooms. */
const TILE_BOUNDS_Z2 = { minX: -14, maxX: 7, minY: -11, maxY: 6 };
const MIN_ZOOM = 8;
const MAX_ZOOM = 160;
const PREFS_KEY = 'scriptgen.map';

function stepColor(step: Step): string {
  if (step.npcBank || step.lockedStorage) return 'var(--bank)';
  const gather = step.gather || step.forcegather;
  const fight = step.fight || step.forcefight;
  if (gather && fight) return 'var(--mixed)';
  if (fight) return 'var(--fight)';
  if (gather) return 'var(--gather)';
  return 'var(--travel)';
}

function loadPrefs(): { tiles: boolean; opacity: number } {
  try {
    return { tiles: true, opacity: 0.85, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { tiles: true, opacity: 0.85 };
  }
}

export function WorldMap({ steps, ghostSteps, selectedId, mode, index, world, onWorldChange, onCellClick }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(48);
  const [center, setCenter] = useState<Coords>({ x: 0, y: 0 });
  const [hover, setHover] = useState<Coords | null>(null);
  const [goto, setGoto] = useState('');
  const [prefs, setPrefs] = useState(loadPrefs);
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
  const ch = zoom * RATIO;
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

  // Étapes de ce monde (ou intérieurs, dessinés en pointillés aux coordonnées du bâtiment).
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
      if (at && at.worldMap === world) set.add(`${at.x},${at.y}`);
    }
    return set;
  }, [ghostSteps, index, world]);

  const links = useMemo(() => {
    const out: { from: Coords; to: Coords; travel: boolean }[] = [];
    located.forEach(({ step, at }, i) => {
      if (!at) return;
      const explicit = pathTarget(step);
      const nextAt = located[i + 1]?.at ?? null;
      const target = explicit ?? (nextAt ? { x: nextAt.x, y: nextAt.y } : null);
      if (!target || (target.x === at.x && target.y === at.y)) return;
      out.push({ from: at, to: target, travel: Math.abs(target.x - at.x) + Math.abs(target.y - at.y) > 1 });
    });
    return out;
  }, [located]);

  // Tuiles de fond (dofus-map.com) : seulement pour le Monde des Douze.
  const tiles: JSX.Element[] = [];
  if (prefs.tiles && world === MAIN_WORLD) {
    let z = Math.ceil(Math.log2(cw / MAP_W) + TILE_MAX_ZOOM);
    z = Math.max(0, Math.min(TILE_MAX_ZOOM, z));
    const nativeW = MAP_W / 2 ** (TILE_MAX_ZOOM - z);
    const s = cw / nativeW;
    const origin = { x: toScreen({ x: 0, y: 0 }).x - cw / 2, y: toScreen({ x: 0, y: 0 }).y - ch / 2 };
    const step = TILE * s;
    const f = 2 ** (z - 2);
    const bounds = {
      minX: Math.floor(TILE_BOUNDS_Z2.minX * f), maxX: Math.ceil((TILE_BOUNDS_Z2.maxX + 1) * f) - 1,
      minY: Math.floor(TILE_BOUNDS_Z2.minY * f), maxY: Math.ceil((TILE_BOUNDS_Z2.maxY + 1) * f) - 1,
    };
    const tx0 = Math.max(bounds.minX, Math.floor(-origin.x / step));
    const tx1 = Math.min(bounds.maxX, Math.floor((size.w - origin.x) / step));
    const ty0 = Math.max(bounds.minY, Math.floor(-origin.y / step));
    const ty1 = Math.min(bounds.maxY, Math.floor((size.h - origin.y) / step));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        tiles.push(
          <image
            key={`${z}/${tx}/${ty}`}
            href={`https://dofus-map.com/tiles/0/${z}/${tx}/${ty}.jpg`}
            x={origin.x + tx * step}
            y={origin.y + ty * step}
            width={step + 0.5}
            height={step + 0.5}
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
      const p = toScreen({ x, y });
      const entries = byCell.get(key);
      const exists = !index || index.byCoords.has(coordsIndexKey(world, x, y));
      const selected = entries?.some((e) => e.step.id === selectedId);
      const interiorOnly = entries?.every((e) => e.interior);
      cells.push(
        <rect
          key={key}
          x={p.x - cw / 2}
          y={p.y - ch / 2}
          width={cw}
          height={ch}
          className={`cell${ghostCells.has(key) ? ' ghost' : ''}${exists ? '' : ' void'}${interiorOnly ? ' interior' : ''}`}
          style={entries && !interiorOnly ? { fill: stepColor(entries[0].step), fillOpacity: 0.55 } : undefined}
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

  const axisLabels: JSX.Element[] = [];
  if (cw >= 24) {
    for (let x = visible.x0; x <= visible.x1; x++) {
      axisLabels.push(<text key={`ax${x}`} x={toScreen({ x, y: 0 }).x} y={12} className="axis-label">{x}</text>);
    }
    for (let y = visible.y0; y <= visible.y1; y++) {
      axisLabels.push(<text key={`ay${y}`} x={14} y={toScreen({ x: 0, y }).y + 4} className="axis-label">{y}</text>);
    }
  }

  const hoverMaps = hover && index ? index.byCoords.get(coordsIndexKey(world, hover.x, hover.y)) ?? [] : [];
  const hoverInfo = hover
    ? hoverMaps.length
      ? `${index!.subAreaName(hoverMaps[0].subAreaId)} (${index!.areaName(hoverMaps[0].subAreaId)})${hoverMaps.length > 1 ? ` · ${hoverMaps.length} cartes` : ` · id ${hoverMaps[0].id}`}`
      : index ? 'aucune carte' : ''
    : '';

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
      <div className="map-overlay">
        <span className="map-coords">{hover ? `${hover.x},${hover.y}` : '—'}</span>
        <span className="map-hover-info">{hoverInfo}</span>
      </div>
      <div className="map-controls">
        <select value={world} onChange={(e) => onWorldChange(Number(e.target.value))} title="Monde affiché">
          {(index?.worlds ?? [{ id: MAIN_WORLD, name: 'Monde des Douze', count: 0 }]).filter((w) => w.id !== -1).map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <label className="check" title="Fond de carte dofus-map.com (connexion internet)">
          <input type="checkbox" checked={prefs.tiles} onChange={(e) => setPrefs({ ...prefs, tiles: e.target.checked })} />
          Fond <span className="muted">(dofus-map.com)</span>
        </label>
        {prefs.tiles && world === MAIN_WORLD && (
          <input type="range" min={0.2} max={1} step={0.05} value={prefs.opacity}
            onChange={(e) => setPrefs({ ...prefs, opacity: Number(e.target.value) })} title="Opacité du fond" />
        )}
        <form onSubmit={(e) => {
          e.preventDefault();
          const m = /^\s*(-?\d+)\s*[,; ]\s*(-?\d+)\s*$/.exec(goto);
          if (m) setCenter({ x: Number(m[1]), y: Number(m[2])});
        }}>
          <input value={goto} onChange={(e) => setGoto(e.target.value)} placeholder="Aller à x,y" size={9} />
        </form>
      </div>
      <div className="map-legend">
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
