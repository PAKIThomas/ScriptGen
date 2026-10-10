// Sélecteurs avec recherche : ressources, monstres, objets, heures.
import { useEffect, useMemo, useState } from 'react';
import { RESOURCE_GROUPS, resourceName } from '../data/game';
import monstersData from '../data/monsters.json';

type Entry = [number, string];

const MONSTERS = monstersData as Entry[];
const MONSTER_NAMES = new Map<number, string>(MONSTERS);

export function monsterName(id: number): string | undefined {
  return MONSTER_NAMES.get(id);
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function search(list: Entry[], query: string, limit = 40): Entry[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const out: Entry[] = [];
  for (const entry of list) {
    if (String(entry[0]) === q || normalize(entry[1]).includes(q)) {
      out.push(entry);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function Chip({ label, title, onRemove }: { label: string; title?: string; onRemove: () => void }) {
  return (
    <span className="chip" title={title}>
      {label}
      <button type="button" onClick={onRemove} aria-label="Retirer">×</button>
    </span>
  );
}

/** Liste d'ElementTypeId, rangés par métier (Annexe A.1). */
export function ResourcePicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [extra, setExtra] = useState('');
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const unknown = value.filter((id) => !resourceName(id));
  return (
    <div className="resource-picker">
      {RESOURCE_GROUPS.map((group) => {
        const ids = group.resources.map(([id]) => id);
        const all = ids.every((id) => value.includes(id));
        return (
          <fieldset key={group.label}>
            <legend>
              {group.label}
              <button
                type="button"
                className="link-button"
                onClick={() => onChange(all ? value.filter((v) => !ids.includes(v)) : [...value, ...ids.filter((id) => !value.includes(id))])}
              >
                {all ? 'aucune' : 'toutes'}
              </button>
            </legend>
            {group.resources.map(([id, name]) => (
              <label key={id} className={`toggle-chip${value.includes(id) ? ' on' : ''}`} title={`ElementTypeId ${id}`}>
                <input type="checkbox" checked={value.includes(id)} onChange={() => toggle(id)} />
                {name}
              </label>
            ))}
          </fieldset>
        );
      })}
      <div className="row">
        {unknown.map((id) => <Chip key={id} label={`#${id}`} onRemove={() => toggle(id)} />)}
        <form onSubmit={(e) => {
          e.preventDefault();
          const id = Number(extra);
          if (Number.isInteger(id) && id > 0 && !value.includes(id)) onChange([...value, id]);
          setExtra('');
        }}
        >
          <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Autre id" size={8} />
        </form>
        <span className="muted">Liste vide = toutes les vraies ressources. Ordre conservé.</span>
      </div>
    </div>
  );
}

/** Recherche dans une liste (id, nom) et ajout en un clic. */
function SearchAdd({ list, onAdd, placeholder, allowText }: {
  list: Entry[] | null;
  onAdd: (v: number | string) => void;
  placeholder: string;
  allowText?: boolean;
}) {
  const [q, setQ] = useState('');
  const results = useMemo(() => (list ? search(list, q) : []), [list, q]);
  return (
    <div className="search-add">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={list ? placeholder : 'Chargement de la liste…'}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (results[0]) onAdd(results[0][0]);
          else if (/^\d+$/.test(q.trim())) onAdd(Number(q.trim()));
          else if (allowText && q.trim()) onAdd(q.trim());
          setQ('');
        }}
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map(([id, name]) => (
            <li key={id}>
              <button type="button" onClick={() => { onAdd(id); setQ(''); }}>
                <span className="muted">{id}</span> {name}
              </button>
            </li>
          ))}
          {allowText && (
            <li>
              <button type="button" onClick={() => { onAdd(q.trim()); setQ(''); }}>
                Ajouter le nom « {q.trim()} » (sans tenir compte de la casse)
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Monstres : genericId (écrit en nombre) ou nom (écrit entre guillemets). */
export function MonsterPicker({ value, onChange, allowNames = true }: {
  value: (number | string)[];
  onChange: (v: (number | string)[]) => void;
  allowNames?: boolean;
}) {
  return (
    <div className="list-picker">
      <div className="chips">
        {value.length === 0 && <span className="muted">Aucun</span>}
        {value.map((v, i) => (
          <Chip
            key={`${v}-${i}`}
            label={typeof v === 'number' ? `${monsterName(v) ?? '?'} (${v})` : `« ${v} »`}
            title={typeof v === 'number' ? `genericId ${v}` : 'Par nom'}
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
          />
        ))}
      </div>
      <SearchAdd
        list={MONSTERS}
        placeholder="Chercher un monstre (nom ou id)…"
        allowText={allowNames}
        onAdd={(v) => { if (!value.includes(v)) onChange([...value, v]); }}
      />
    </div>
  );
}

let itemsCache: Promise<Entry[]> | null = null;
export function loadItems(): Promise<Entry[]> {
  itemsCache ??= fetch('/data/items.json').then((r) => r.json());
  return itemsCache;
}

export function useItems(): Entry[] | null {
  const [items, setItems] = useState<Entry[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadItems().then((list) => alive && setItems(list)).catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, []);
  return items;
}

/** Objets (gid), liste complète chargée à la demande (19 000 entrées). */
export function ItemPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const items = useItems();
  const names = useMemo(() => new Map(items ?? []), [items]);
  return (
    <div className="list-picker">
      <div className="chips">
        {value.length === 0 && <span className="muted">Aucun</span>}
        {value.map((gid, i) => (
          <Chip
            key={`${gid}-${i}`}
            label={`${names.get(gid) ?? '?'} (${gid})`}
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
          />
        ))}
      </div>
      <SearchAdd
        list={items}
        placeholder="Chercher un objet (nom ou gid)…"
        onAdd={(v) => { if (typeof v === 'number' && !value.includes(v)) onChange([...value, v]); }}
      />
    </div>
  );
}

export function HoursPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="hours">
      {Array.from({ length: 24 }, (_, h) => (
        <label key={h} className={`toggle-chip${value.includes(h) ? ' on' : ''}`}>
          <input
            type="checkbox"
            checked={value.includes(h)}
            onChange={() => onChange(value.includes(h) ? value.filter((v) => v !== h) : [...value, h].sort((a, b) => a - b))}
          />
          {String(h).padStart(2, '0')}h
        </label>
      ))}
    </div>
  );
}

export function MonsterAmountsEditor({ value, onChange }: {
  value: number[][];
  onChange: (v: number[][]) => void;
}) {
  const set = (i: number, j: number, n: number) => onChange(value.map((row, k) => (k === i ? row.map((x, l) => (l === j ? n : x)) : row)));
  return (
    <div className="list-picker">
      {value.length > 0 && (
        <table className="amounts">
          <thead><tr><th>Monstre</th><th>Min</th><th>Max</th><th /></tr></thead>
          <tbody>
            {value.map((row, i) => (
              <tr key={i}>
                <td>{monsterName(row[0]) ?? '?'} <span className="muted">({row[0]})</span></td>
                <td><input type="number" min={0} max={8} value={row[1]} onChange={(e) => set(i, 1, Number(e.target.value))} /></td>
                <td><input type="number" min={0} max={8} value={row[2]} onChange={(e) => set(i, 2, Number(e.target.value))} /></td>
                <td><button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <SearchAdd
        list={MONSTERS}
        placeholder="Ajouter un monstre (nom ou id)…"
        onAdd={(v) => { if (typeof v === 'number') onChange([...value, [v, 0, 8]]); }}
      />
    </div>
  );
}
