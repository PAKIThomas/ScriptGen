import { useEffect, useMemo, useRef, useState } from 'react';
import { coordsKey, parseCoords, pathTarget, type Coords } from '../model/geo';
import type { Step } from '../model/types';

interface Props {
  steps: Step[];
  /** Étapes des autres paliers / trajets, affichées en fond pour se repérer. */
  ghostSteps: Step[];
  selectedId: string | null;
  mode: 'add' | 'select';
  onCellClick: (coords: Coords) => void;
}

const MIN_ZOOM = 8;
const MAX_ZOOM = 90;

function stepColor(step: Step): string {
  if (step.npcBank || step.lockedStorage) return 'var(--bank)';
  const gather = step.gather || step.forcegather;
  const fight = step.fight || step.forcefight;
  if (gather && fight) return 'var(--mixed)';
  if (fight) return 'var(--fight)';
  if (gather) return 'var(--gather)';
  return 'var(--travel)';
}

export function WorldMap({ steps, ghostSteps, selectedId, mode, onCellClick }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(36);
  const [center, setCenter] = useState<Coords>(() => {
    const first = steps.map((s) => parseCoords(s.map)).find(Boolean);
    return first ?? { x: 0, y: 0 };
  });
  const [hover, setHover] = useState<Coords | null>(null);
  const [goto, setGoto] = useState('');
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recentre quand on change de palier (première carte du trajet).
  const firstKey = steps.length ? String(steps[0].map) : '';
  useEffect(() => {
    const c = parseCoords(firstKey);
    if (c) setCenter(c);
  }, [firstKey]);

  const toScreen = (c: Coords) => ({
    x: size.w / 2 + (c.x - center.x) * zoom,
    y: size.h / 2 + (c.y - center.y) * zoom,
  });
  const toMap = (px: number, py: number): Coords => ({
    x: Math.round(center.x + (px - size.w / 2) / zoom),
    y: Math.round(center.y + (py - size.h / 2) / zoom),
  });

  const visible = {
    x0: Math.floor(center.x - size.w / 2 / zoom) - 1,
    x1: Math.ceil(center.x + size.w / 2 / zoom) + 1,
    y0: Math.floor(center.y - size.h / 2 / zoom) - 1,
    y1: Math.ceil(center.y + size.h / 2 / zoom) + 1,
  };

  const byCell = useMemo(() => {
    const map = new Map<string, { step: Step; index: number }[]>();
    steps.forEach((step, index) => {
      const c = parseCoords(step.map);
      if (!c) return;
      const key = coordsKey(c);
      map.set(key, [...(map.get(key) ?? []), { step, index }]);
    });
    return map;
  }, [steps]);

  const ghostCells = useMemo(() => {
    const set = new Set<string>();
    for (const s of ghostSteps) {
      const c = parseCoords(s.map);
      if (c) set.add(coordsKey(c));
    }
    return set;
  }, [ghostSteps]);

  const links = useMemo(() => {
    const out: { from: Coords; to: Coords; travel: boolean }[] = [];
    steps.forEach((step, i) => {
      const from = parseCoords(step.map);
      if (!from) return;
      const target = pathTarget(step) ?? parseCoords(steps[i + 1]?.map ?? '');
      if (target) {
        const travel = Math.abs(target.x - from.x) + Math.abs(target.y - from.y) > 1;
        out.push({ from, to: target, travel });
      }
    });
    return out;
  }, [steps]);

  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  };

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const cells: JSX.Element[] = [];
  for (let y = visible.y0; y <= visible.y1; y++) {
    for (let x = visible.x0; x <= visible.x1; x++) {
      const key = `${x},${y}`;
      const p = toScreen({ x, y });
      const entries = byCell.get(key);
      const selected = entries?.some((e) => e.step.id === selectedId);
      cells.push(
        <rect
          key={key}
          x={p.x - zoom / 2}
          y={p.y - zoom / 2}
          width={zoom}
          height={zoom}
          className={`cell${ghostCells.has(key) ? ' ghost' : ''}`}
          style={entries ? { fill: stepColor(entries[0].step), fillOpacity: 0.55 } : undefined}
          stroke={selected ? 'var(--accent)' : undefined}
          strokeWidth={selected ? 3 : undefined}
        />,
      );
      if (entries && zoom >= 18) {
        cells.push(
          <text key={`t${key}`} x={p.x} y={p.y + 4} className="cell-label">
            {entries.map((e) => e.index + 1).join(',')}
          </text>,
        );
      }
    }
  }

  const axisLabels: JSX.Element[] = [];
  if (zoom >= 24) {
    for (let x = visible.x0; x <= visible.x1; x++) {
      const p = toScreen({ x, y: visible.y0 });
      axisLabels.push(<text key={`ax${x}`} x={p.x} y={12} className="axis-label">{x}</text>);
    }
    for (let y = visible.y0; y <= visible.y1; y++) {
      const p = toScreen({ x: visible.x0, y });
      axisLabels.push(<text key={`ay${y}`} x={14} y={p.y + 4} className="axis-label">{y}</text>);
    }
  }

  const jump = () => {
    const c = parseCoords(goto);
    if (c) setCenter(c);
  };

  return (
    <div className="world-map">
      <svg
        ref={ref}
        onWheel={onWheel}
        onPointerDown={(e) => {
          const p = local(e);
          drag.current = { x: p.x, y: p.y, cx: center.x, cy: center.y, moved: false };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = local(e);
          setHover(toMap(p.x, p.y));
          const d = drag.current;
          if (!d) return;
          const dx = p.x - d.x;
          const dy = p.y - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          if (d.moved) setCenter({ x: d.cx - dx / zoom, y: d.cy - dy / zoom });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const p = local(e);
            onCellClick(toMap(p.x, p.y));
          }
        }}
        onPointerLeave={() => setHover(null)}
      >
        <g>{cells}</g>
        <g className="links">
          {links.map((l, i) => {
            const a = toScreen(l.from);
            const b = toScreen(l.to);
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={l.travel ? 'link travel' : 'link'}
                markerEnd="url(#arrow)"
              />
            );
          })}
        </g>
        {hover && (
          <rect
            x={toScreen(hover).x - zoom / 2}
            y={toScreen(hover).y - zoom / 2}
            width={zoom}
            height={zoom}
            className="cell-hover"
          />
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
        <span className="muted">{mode === 'add' ? 'Clic = ajouter la carte' : 'Clic = sélectionner'} · glisser = déplacer · molette = zoom</span>
        <form onSubmit={(e) => { e.preventDefault(); jump(); }}>
          <input value={goto} onChange={(e) => setGoto(e.target.value)} placeholder="Aller à x,y" size={9} />
        </form>
      </div>
      <div className="map-legend">
        <span><i style={{ background: 'var(--gather)' }} />Récolte</span>
        <span><i style={{ background: 'var(--fight)' }} />Combat</span>
        <span><i style={{ background: 'var(--mixed)' }} />Les deux</span>
        <span><i style={{ background: 'var(--bank)' }} />Banque</span>
        <span><i style={{ background: 'var(--travel)' }} />Passage</span>
      </div>
    </div>
  );
}
