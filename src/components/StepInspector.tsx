// Détail d'une étape : carte, actions, sortie. Chaque champ = une clé d'étape de l'API.
import { coordsIndexKey, locateStepMap, MAIN_WORLD, mapImageUrl, type MapIndex } from '../data/maps';
import { DIRECTIONS, parseCoords } from '../model/geo';
import { isRaw, type LuaValue, type Step } from '../model/types';
import { luaValue } from '../lua/serialize';

interface Props {
  index: MapIndex | null;
  step: Step;
  stepIndex: number;
  isPhenixRoute: boolean;
  onChange: (mutate: (s: Step) => void) => void;
}

type PathKind = 'none' | 'direction' | 'coords' | 'mapId' | 'zaap' | 'zaapi' | 'havenbag' | 'random' | 'advanced';

const PATH_KINDS: { id: PathKind; label: string }[] = [
  { id: 'none', label: 'Aucune (fin de trajet / reste sur place)' },
  { id: 'direction', label: 'Direction (bord de carte)' },
  { id: 'coords', label: 'Coordonnée x,y (adjacente ou voyage)' },
  { id: 'mapId', label: 'Id de carte (voyage)' },
  { id: 'zaap', label: 'Zaap vers…' },
  { id: 'zaapi', label: 'Zaapi vers…' },
  { id: 'havenbag', label: 'Havre-sac (entrer / sortir)' },
  { id: 'random', label: 'Au hasard parmi des directions' },
  { id: 'advanced', label: 'Avancé (Lua : liste pondérée…)' },
];

function pathKind(path: LuaValue | undefined): PathKind {
  if (path === undefined) return 'none';
  if (typeof path === 'number') return 'mapId';
  if (typeof path === 'string') {
    if (parseCoords(path)) return 'coords';
    if (/^\d+$/.test(path)) return 'mapId';
    if (/^zaap\(/i.test(path)) return 'zaap';
    if (/^zaapi\(/i.test(path)) return 'zaapi';
    if (path === 'havenbag') return 'havenbag';
    if (path.includes('|')) return 'random';
    if (/^(top|bottom|left|right)(\(\d+\))?$/.test(path)) return 'direction';
  }
  return 'advanced';
}

function defaultPath(kind: PathKind): LuaValue | undefined {
  switch (kind) {
    case 'none': return undefined;
    case 'direction': return 'right';
    case 'coords': return '0,0';
    case 'mapId': return 0;
    case 'zaap': return 'zaap(0)';
    case 'zaapi': return 'zaapi(0)';
    case 'havenbag': return 'havenbag';
    case 'random': return 'left|right';
    case 'advanced': return { raw: '{ { direction = "left", weight = 50 }, { direction = "right", weight = 50 } }' };
  }
}

function numberOrUndefined(v: string): number | undefined {
  return v.trim() === '' || Number.isNaN(Number(v)) ? undefined : Number(v);
}

function Check({ label, checked, onChange, title }: { label: string; checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <label className="check" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Deux champs « cellule | code [| 3e partie] » pour lockedStorage / lockedHouse. */
function PipeField({ value, onChange, third }: { value: string | undefined; onChange: (v: string | undefined) => void; third: string }) {
  const parts = (value ?? '').split(/[|;]/);
  const set = (i: number, v: string) => {
    const next = [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
    next[i] = v;
    while (next.length > 2 && !next[next.length - 1]) next.pop();
    onChange(next.join('|'));
  };
  return (
    <div className="row">
      <input placeholder="cellule" size={6} value={parts[0] ?? ''} onChange={(e) => set(0, e.target.value)} />
      <input placeholder="code (vide = sans)" size={12} value={parts[1] ?? ''} onChange={(e) => set(1, e.target.value)} />
      <input placeholder={third} size={12} value={parts[2] ?? ''} onChange={(e) => set(2, e.target.value)} />
      <button type="button" onClick={() => onChange(undefined)}>Retirer</button>
    </div>
  );
}

/** Fiche de la carte : sous-zone, ids aux mêmes coordonnées, image, bascule x,y ↔ id. */
function MapCard({ index, map, onSetMap }: { index: MapIndex | null; map: string | number; onSetMap: (m: string | number) => void }) {
  if (!index) return null;
  const at = locateStepMap(index, map);
  if (!at) return map === 'havenbag' ? <p className="muted small">Étape jouée dans le havre-sac.</p> : null;
  const sameCoords = (index.byCoords.get(coordsIndexKey(MAIN_WORLD, at.x, at.y)) ?? []);
  const shown = at.info ?? sameCoords.find((m) => m.outdoor) ?? sameCoords[0];
  return (
    <div className="map-card">
      {shown && <img src={mapImageUrl(shown.id)} alt="" loading="lazy" />}
      <div className="small">
        {shown ? <><strong>{index.subAreaName(shown.subAreaId)}</strong> · {index.areaName(shown.subAreaId)}<br /></> : null}
        [{at.x},{at.y}] {at.info && !at.info.outdoor ? '· intérieur' : ''}
        {at.info && at.info.worldMap === MAIN_WORLD && at.info.outdoor && (
          <div><button type="button" className="link-button" onClick={() => onSetMap(`${at.x},${at.y}`)}>écrire en « {at.x},{at.y} »</button></div>
        )}
        {!at.info && sameCoords.length > 0 && (
          <div>
            {sameCoords.length > 1 ? `${sameCoords.length} cartes ont ces coordonnées : ` : 'Id : '}
            {sameCoords.slice(0, 6).map((m) => (
              <button key={m.id} type="button" className="link-button" title={index.subAreaName(m.subAreaId)} onClick={() => onSetMap(m.id)}>
                {m.id}{m.outdoor ? '' : ' (int.)'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StepInspector({ index: mapIndex, step, stepIndex: index, isPhenixRoute, onChange }: Props) {
  const kind = pathKind(step.path);
  const path = typeof step.path === 'string' ? step.path : '';
  const dirMatch = /^(\w+)(?:\((\d+)\))?$/.exec(path);

  const setField = <K extends keyof Step>(key: K, value: Step[K] | undefined) => onChange((s) => {
    if (value === undefined || value === false) delete s[key];
    else s[key] = value as Step[K];
  });

  return (
    <div className="inspector">
      <h3>Étape {index + 1}</h3>

      <label className="field">
        <span>Carte</span>
        <input
          value={String(step.map)}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange((s) => { s.map = /^\d+$/.test(v) && v.length > 4 ? Number(v) : v; });
          }}
        />
        <small className="muted">« x,y » pour l'extérieur, id de carte pour un intérieur (mine, donjon…), ou « havenbag ».</small>
      </label>
      <MapCard index={mapIndex} map={step.map} onSetMap={(m) => onChange((s) => { s.map = m; })} />

      <fieldset>
        <legend>Actions sur la carte</legend>
        <div className="checks">
          <Check label="Récolter" checked={!!step.gather} onChange={(v) => setField('gather', v)}
            title="gather : récolte (filtrée par ELEMENTS_TO_GATHER) puis suit la sortie" />
          <Check label="Récolter et attendre les repousses" checked={!!step.forcegather} onChange={(v) => setField('forcegather', v)}
            title="forcegather : reste sur la carte (sortie ignorée)" />
          <Check label="Combattre" checked={!!step.fight} onChange={(v) => setField('fight', v)}
            title="fight : attaque le groupe éligible le plus proche avant de sortir" />
          <Check label="Combattre et attendre des groupes" checked={!!step.forcefight} onChange={(v) => setField('forcefight', v)}
            title="forcefight : reste sur la carte à attendre un groupe éligible" />
          <Check label="Banque (PNJ banquier)" checked={!!step.npcBank} onChange={(v) => setField('npcBank', v)}
            title="npcBank : dépôt de tout le sac chez le banquier de cette carte" />
        </div>
        <label className="field inline">
          <span>Régénérer si PV &lt;</span>
          <input
            type="number" min={0} max={100} size={4}
            value={typeof step.regeneration === 'number' ? step.regeneration : ''}
            placeholder={step.regeneration === true ? 'seuil global' : '—'}
            onChange={(e) => setField('regeneration', numberOrUndefined(e.target.value))}
          />
          <span>%</span>
          <Check label="seuil MIN_LIFE_PERCENT" checked={step.regeneration === true} onChange={(v) => setField('regeneration', v ? true : undefined)} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Sortie de la carte</legend>
        <select
          value={kind}
          onChange={(e) => onChange((s) => {
            const next = defaultPath(e.target.value as PathKind);
            if (next === undefined) {
              delete s.path;
              delete s.pathKey;
            } else s.path = next;
          })}
        >
          {PATH_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>

        {kind === 'direction' && (
          <div className="row">
            {DIRECTIONS.map((d) => (
              <button
                key={d.id} type="button"
                className={dirMatch?.[1] === d.id ? 'on' : ''}
                onClick={() => setField('path', dirMatch?.[2] ? `${d.id}(${dirMatch[2]})` : d.id)}
              >
                {d.label}
              </button>
            ))}
            <input
              placeholder="cellule (option)" size={10} value={dirMatch?.[2] ?? ''}
              onChange={(e) => {
                const cell = e.target.value.replace(/\D/g, '');
                setField('path', cell ? `${dirMatch?.[1] ?? 'right'}(${cell})` : (dirMatch?.[1] ?? 'right'));
              }}
            />
          </div>
        )}
        {kind === 'coords' && (
          <input value={path} onChange={(e) => setField('path', e.target.value)} placeholder="x,y" />
        )}
        {kind === 'mapId' && (
          <input
            value={String(step.path ?? '')}
            onChange={(e) => setField('path', /^\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value)}
            placeholder="id de carte"
          />
        )}
        {(kind === 'zaap' || kind === 'zaapi') && (
          <input
            value={/\((\d*)\)/.exec(path)?.[1] ?? ''}
            onChange={(e) => setField('path', `${kind}(${e.target.value.replace(/\D/g, '')})`)}
            placeholder="id de la carte de destination"
          />
        )}
        {kind === 'random' && (
          <input value={path} onChange={(e) => setField('path', e.target.value)} placeholder="left|right" />
        )}
        {kind === 'advanced' && (
          <textarea
            rows={3}
            value={step.path === undefined ? '' : isRaw(step.path) ? step.path.raw : luaValue(step.path)}
            onChange={(e) => setField('path', { raw: e.target.value })}
          />
        )}
        {kind !== 'none' && (
          <label className="field inline">
            <span>Clé</span>
            <select value={step.pathKey ?? 'path'} onChange={(e) => setField('pathKey', e.target.value as Step['pathKey'])}>
              <option value="path">path</option>
              <option value="changeMap">changeMap (prioritaire)</option>
              <option value="paths">paths (nom SnowBot)</option>
            </select>
          </label>
        )}
        <label className="field inline">
          <span>Sortir par la cellule de bord</span>
          <input type="number" size={5} value={step.exitCell ?? ''} onChange={(e) => setField('exitCell', numberOrUndefined(e.target.value))} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Cellules, portes &amp; maisons</legend>
        <label className="field inline">
          <span>Se placer d'abord sur la cellule</span>
          <input type="number" size={5} value={step.cell ?? ''} onChange={(e) => setField('cell', numberOrUndefined(e.target.value))} />
        </label>
        <label className="field inline">
          <span>Utiliser la porte / l'interactif en cellule</span>
          <input
            size={10} value={step.door ?? ''} placeholder="312 ou 312|420"
            onChange={(e) => {
              const v = e.target.value.trim();
              setField('door', v === '' ? undefined : /^\d+$/.test(v) ? Number(v) : v);
            }}
          />
        </label>
        <div className="field">
          <span>Coffre à code (dépôt)</span>
          {step.lockedStorage === undefined
            ? <button type="button" onClick={() => setField('lockedStorage', '|')}>Ajouter un coffre</button>
            : <PipeField value={step.lockedStorage} onChange={(v) => setField('lockedStorage', v)} third="skillId (option)" />}
        </div>
        <div className="field">
          <span>Maison à code (entrer)</span>
          {step.lockedHouse === undefined
            ? <button type="button" onClick={() => setField('lockedHouse', '|')}>Ajouter une maison</button>
            : <PipeField value={step.lockedHouse} onChange={(v) => setField('lockedHouse', v)} third="propriétaire (option)" />}
        </div>
        {isPhenixRoute && (
          <label className="field inline">
            <span>Statue du Phénix en cellule</span>
            <input
              size={10} value={step.phenix ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim();
                setField('phenix', v === '' ? undefined : /^\d+$/.test(v) ? Number(v) : v);
              }}
            />
          </label>
        )}
      </fieldset>

      <fieldset>
        <legend>Lua personnalisé (custom)</legend>
        <textarea
          rows={4}
          placeholder={'function()\n  -- actions sur cette carte\nend'}
          value={step.custom?.raw ?? ''}
          onChange={(e) => setField('custom', e.target.value.trim() ? { raw: e.target.value } : undefined)}
        />
        <small className="muted">Joué sur cette carte. S'il change de carte ou lance un combat, l'étape s'arrête là.</small>
      </fieldset>

      {step.extra && step.extra.length > 0 && (
        <fieldset>
          <legend>Autres clés (conservées)</legend>
          <code>{step.extra.map(([k, v]) => `${k} = ${luaValue(v)}`).join(', ')}</code>
        </fieldset>
      )}

      <label className="field">
        <span>Commentaire</span>
        <input value={step.comment ?? ''} onChange={(e) => setField('comment', e.target.value || undefined)} />
      </label>
    </div>
  );
}
