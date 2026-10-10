// Ressources sur la carte, comme sur Dofus-Map : on choisit des ressources (blé, or, frêne…) et la carte
// montre, case par case, combien il y en a. Données : public/data/resources.json (scripts/fetch-dofusmap.mjs).
import { useMemo, useState } from 'react';
import type { DmResource, ResourcesData } from '../data/dofusmap';

/** Une couleur par ressource choisie (ordre de sélection). */
export const RESOURCE_COLORS = ['#ff5a4f', '#4f9dff', '#ffd23d', '#c77dff', '#3ddc97', '#ff9f43'];
const MAX_SELECTED = RESOURCE_COLORS.length;
const JOBS = ['Paysan', 'Bûcheron', 'Mineur', 'Alchimiste', 'Pêcheur', 'Divers'];

/** Icône dans le SVG de la carte (découpe de l'image des icônes Dofus-Map). */
export function ResourceIcon({ data, resource, x, y, size }: { data: ResourcesData; resource: DmResource; x: number; y: number; size: number }) {
  const cell = data.spriteCell;
  return (
    <svg x={x} y={y} width={size} height={size} overflow="hidden" viewBox={`${-resource.sprite[0]} ${-resource.sprite[1]} ${cell} ${cell}`}>
      <image href={`/data/${data.sprite}`} width={cell * 16} height={cell * 5} />
    </svg>
  );
}

/** Icône HTML (sélecteur). */
function Icon({ data, resource, size = 26 }: { data: ResourcesData; resource: DmResource; size?: number }) {
  const k = size / data.spriteCell;
  return (
    <span
      className="res-icon"
      style={{
        width: size, height: size,
        backgroundImage: `url(/data/${data.sprite})`,
        backgroundSize: `${data.spriteCell * 16 * k}px ${data.spriteCell * 5 * k}px`,
        backgroundPosition: `${resource.sprite[0] * k}px ${resource.sprite[1] * k}px`,
      }}
    />
  );
}

export function ResourceChooser({ data, selected, counts, onChange }: {
  data: ResourcesData;
  selected: number[];
  /** Nombre de cartes de la vue courante où se trouve la ressource. */
  counts: (id: number) => number;
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const byJob = useMemo(() => {
    const q = query.trim().toLowerCase();
    return JOBS.map((job) => ({
      job,
      list: data.resources.filter((r) => r.job === job && (!q || r.name.toLowerCase().includes(q))),
    })).filter((g) => g.list.length);
  }, [data, query]);
  const toggle = (id: number) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < MAX_SELECTED) onChange([...selected, id]);
  };

  return (
    <div className="res-chooser">
      <div className="res-head">
        <span className="label-caps">Ressources</span>
        <button type="button" className="small" onClick={() => setOpen(!open)}>{open ? 'Fermer' : '＋ Choisir'}</button>
        {selected.length > 0 && <button type="button" className="small" onClick={() => onChange([])}>Tout retirer</button>}
      </div>
      {selected.length === 0 && !open && <p className="muted small">Choisis une ressource pour voir où elle se trouve (données Dofus-Map).</p>}
      <div className="res-chips">
        {selected.map((id, i) => {
          const r = data.resources.find((x) => x.id === id);
          if (!r) return null;
          return (
            <button key={id} type="button" className="res-chip" style={{ borderColor: RESOURCE_COLORS[i % RESOURCE_COLORS.length] }}
              onClick={() => toggle(id)} title="Retirer">
              <Icon data={data} resource={r} size={20} />
              {r.name} <span className="muted">{counts(id)} cartes</span> ✕
            </button>
          );
        })}
      </div>
      {open && (
        <div className="res-popover">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher (blé, or, frêne…)" />
          <p className="muted small">Jusqu'à {MAX_SELECTED} ressources à la fois, une couleur chacune.</p>
          {byJob.map(({ job, list }) => (
            <div key={job}>
              <h4 className="subhead">{job}</h4>
              <div className="res-grid">
                {list.map((r) => (
                  <button key={r.id} type="button" className={`res-pick${selected.includes(r.id) ? ' on' : ''}`}
                    disabled={!selected.includes(r.id) && selected.length >= MAX_SELECTED}
                    onClick={() => toggle(r.id)} title={r.name}>
                    <Icon data={data} resource={r} />
                    <span>{r.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
