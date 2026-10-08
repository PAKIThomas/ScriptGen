// Onglet « Trajet » : paliers à gauche, carte au centre, étapes + détail à droite.
import { useMemo, useState } from 'react';
import { JOBS } from '../data/game';
import { coordsKey, parseCoords, suggestPath, type PathStyle } from '../model/geo';
import { cloneBracket, cloneStep, newBracket, newRoute, newStep } from '../model/project';
import type { Bracket, Project, Route, Step } from '../model/types';
import type { ProjectStore } from '../state';
import { MonsterPicker, ResourcePicker } from './pickers';
import { StepInspector } from './StepInspector';
import { WorldMap } from './WorldMap';

export type RouteName = 'move' | 'bank' | 'phenix';

const ROUTE_LABELS: Record<RouteName, string> = {
  move: 'Trajet principal — move()',
  bank: 'Retour banque — bank()',
  phenix: 'Résurrection — phenix()',
};

function stepBadges(step: Step): string {
  const out: string[] = [];
  if (step.gather) out.push('🌾');
  if (step.forcegather) out.push('🌾⏳');
  if (step.fight) out.push('⚔️');
  if (step.forcefight) out.push('⚔️⏳');
  if (step.npcBank) out.push('🏦');
  if (step.lockedStorage) out.push('🔒📦');
  if (step.lockedHouse) out.push('🏠');
  if (step.door !== undefined) out.push('🚪');
  if (step.custom) out.push('ƒ');
  if (step.regeneration !== undefined) out.push('❤');
  return out.join(' ');
}

function pathLabel(step: Step): string {
  if (step.path === undefined) return '—';
  if (typeof step.path === 'string' || typeof step.path === 'number') return `→ ${step.path}`;
  return '→ (avancé)';
}

export function RouteEditor({ store }: { store: ProjectStore }) {
  const { project, update } = store;
  const [routeName, setRouteName] = useState<RouteName>('move');
  const [bracketIndex, setBracketIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'add' | 'select'>('add');
  const [pathStyle, setPathStyle] = useState<PathStyle>('coords');
  const [idInput, setIdInput] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const route: Route | null = project[routeName];
  const bracket: Bracket | undefined = route?.brackets[Math.min(bracketIndex, (route?.brackets.length ?? 1) - 1)];
  const bIndex = route ? route.brackets.indexOf(bracket!) : 0;
  const steps = bracket?.steps ?? [];
  const selectedIndex = steps.findIndex((s) => s.id === selectedId);
  const selected = selectedIndex >= 0 ? steps[selectedIndex] : null;

  const ghostSteps = useMemo(() => {
    const out: Step[] = [];
    for (const name of ['move', 'bank', 'phenix'] as RouteName[]) {
      project[name]?.brackets.forEach((b) => { if (b !== bracket) out.push(...b.steps); });
    }
    return out;
  }, [project, bracket]);

  const editRoute = (mutate: (r: Route, p: Project) => void) => update((p) => {
    const r = p[routeName];
    if (r) mutate(r, p);
  });
  const editBracket = (mutate: (b: Bracket) => void) => editRoute((r) => mutate(r.brackets[bIndex]));
  const editStep = (id: string, mutate: (s: Step) => void) => editBracket((b) => {
    const s = b.steps.find((x) => x.id === id);
    if (s) mutate(s);
  });

  const defaultFlags = (): Partial<Step> => {
    if (routeName !== 'move') return {};
    if (project.mode === 'fight') return { fight: true };
    if (project.mode === 'mixed') return { gather: true, fight: true };
    return { gather: true };
  };

  const addStep = (map: string | number) => {
    const step = newStep(map, defaultFlags());
    editBracket((b) => {
      const at = selectedIndex >= 0 ? selectedIndex + 1 : b.steps.length;
      const prev = b.steps[at - 1];
      if (prev && prev.path === undefined) prev.path = suggestPath(prev, step, pathStyle);
      const next = b.steps[at];
      if (next && step.path === undefined) step.path = suggestPath(step, next, pathStyle);
      b.steps.splice(at, 0, step);
    });
    setSelectedId(step.id);
  };

  const onCellClick = (c: { x: number; y: number }) => {
    if (!bracket) return;
    if (mapMode === 'select') {
      const hit = steps.find((s) => { const sc = parseCoords(s.map); return sc && coordsKey(sc) === coordsKey(c); });
      setSelectedId(hit?.id ?? null);
      return;
    }
    addStep(coordsKey(c));
  };

  if (!route) {
    return (
      <div className="route-editor empty-route">
        <RouteTabs current={routeName} project={project} onSelect={(n) => { setRouteName(n); setBracketIndex(0); setSelectedId(null); }} />
        <div className="empty-state">
          {routeName === 'move' ? (
            <p>Le move() de ce script est écrit à la main : il est conservé tel quel dans l'onglet « Lua brut ».</p>
          ) : (
            <p>
              {routeName === 'bank'
                ? 'Pas de bank() : quand les pods atteignent MAX_PODS, le bot affiche « pods pleins » et continue.'
                : 'Pas de phenix() : à la mort, le bot ressuscite tout seul au Phénix indiqué par le jeu.'}
            </p>
          )}
          <button type="button" className="primary" onClick={() => update((p) => { p[routeName] = newRoute(); })}>
            Créer {routeName}()
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="route-editor">
      <aside className="brackets">
        <RouteTabs current={routeName} project={project} onSelect={(n) => { setRouteName(n); setBracketIndex(0); setSelectedId(null); }} />
        {routeName !== 'move' && (
          <button type="button" className="danger small" onClick={() => update((p) => { p[routeName] = null; })}>
            Supprimer {routeName}()
          </button>
        )}

        <label className="field">
          <span>Paliers selon le niveau</span>
          <select
            value={route.levelSource.kind === 'job' ? `job:${route.levelSource.jobId}` : route.levelSource.kind}
            onChange={(e) => editRoute((r) => {
              const v = e.target.value;
              r.levelSource = v === 'none' ? { kind: 'none' } : v === 'character' ? { kind: 'character' }
                : { kind: 'job', jobId: Number(v.slice(4)) };
            })}
          >
            <option value="none">Aucun (un seul trajet)</option>
            <option value="character">Niveau du personnage</option>
            {JOBS.map((j) => <option key={j.id} value={`job:${j.id}`}>Métier : {j.name}</option>)}
          </select>
        </label>

        {route.levelSource.kind !== 'none' && (
          <ol className="bracket-list">
            {route.brackets.map((b, i) => (
              <li key={b.id} className={i === bIndex ? 'active' : ''} onClick={() => { setBracketIndex(i); setSelectedId(null); }}>
                <strong>{b.name}</strong>
                <span className="muted">
                  {i === route.brackets.length - 1 ? ` niv. ${b.minLevel}+` : ` niv. ${b.minLevel}–${route.brackets[i + 1].minLevel - 1}`}
                  {` · ${b.steps.length} cartes`}
                </span>
              </li>
            ))}
          </ol>
        )}
        {route.levelSource.kind !== 'none' && (
          <div className="row">
            <button type="button" onClick={() => {
              editRoute((r) => {
                const last = r.brackets[r.brackets.length - 1];
                r.brackets.push(newBracket(`Palier ${r.brackets.length + 1}`, (last?.minLevel ?? 0) + 20));
              });
              setBracketIndex(route.brackets.length);
            }}
            >+ Palier</button>
            <button type="button" onClick={() => editRoute((r) => { r.brackets.splice(bIndex + 1, 0, cloneBracket(r.brackets[bIndex])); })}>Dupliquer</button>
            <button type="button" disabled={route.brackets.length <= 1} onClick={() => {
              editRoute((r) => { r.brackets.splice(bIndex, 1); });
              setBracketIndex(Math.max(0, bIndex - 1));
            }}
            >Supprimer</button>
          </div>
        )}

        {bracket && (
          <BracketSettings
            bracket={bracket}
            withLevels={route.levelSource.kind !== 'none'}
            onChange={editBracket}
          />
        )}
      </aside>

      <section className="map-column">
        <div className="toolbar">
          <div className="segmented">
            <button type="button" className={mapMode === 'add' ? 'on' : ''} onClick={() => setMapMode('add')}>Ajouter</button>
            <button type="button" className={mapMode === 'select' ? 'on' : ''} onClick={() => setMapMode('select')}>Sélectionner</button>
          </div>
          <label className="field inline" title="Valeur de sortie proposée quand on enchaîne deux cartes">
            <span>Sortie auto</span>
            <select value={pathStyle} onChange={(e) => setPathStyle(e.target.value as PathStyle)}>
              <option value="coords">coordonnée « x,y » (comme les exemples)</option>
              <option value="directions">direction si carte voisine</option>
            </select>
          </label>
          <form className="row" onSubmit={(e) => {
            e.preventDefault();
            const v = idInput.trim();
            if (v) addStep(/^\d+$/.test(v) ? Number(v) : v);
            setIdInput('');
          }}
          >
            <input value={idInput} onChange={(e) => setIdInput(e.target.value)} placeholder="Intérieur : id de carte" size={16} />
            <button type="submit">Ajouter</button>
            <button type="button" onClick={() => addStep('havenbag')}>+ Havre-sac</button>
          </form>
          <button
            type="button" disabled={steps.length < 2}
            title="La dernière étape repart vers la première"
            onClick={() => editBracket((b) => {
              const last = b.steps[b.steps.length - 1];
              last.path = suggestPath(last, b.steps[0], pathStyle);
            })}
          >Boucler</button>
        </div>
        <WorldMap steps={steps} ghostSteps={ghostSteps} selectedId={selectedId} mode={mapMode} onCellClick={onCellClick} />
      </section>

      <aside className="steps-column">
        <div className="step-list">
          <div className="step-list-header">
            <strong>{steps.length} étape(s)</strong>
            <span className="muted">glisser pour réordonner</span>
          </div>
          <ol>
            {steps.map((s, i) => (
              <li
                key={s.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null || dragIndex === i) return;
                  editBracket((b) => {
                    const [moved] = b.steps.splice(dragIndex, 1);
                    b.steps.splice(i, 0, moved);
                  });
                  setDragIndex(null);
                }}
                className={s.id === selectedId ? 'active' : ''}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="num">{i + 1}</span>
                <span className="map">{String(s.map)}</span>
                <span className="badges">{stepBadges(s)}</span>
                <span className="path muted">{pathLabel(s)}</span>
                <span className="actions">
                  <button type="button" title="Dupliquer" onClick={(e) => {
                    e.stopPropagation();
                    editBracket((b) => { b.steps.splice(i + 1, 0, cloneStep(b.steps[i])); });
                  }}
                  >⧉</button>
                  <button type="button" title="Supprimer" onClick={(e) => {
                    e.stopPropagation();
                    editBracket((b) => { b.steps.splice(i, 1); });
                    if (s.id === selectedId) setSelectedId(null);
                  }}
                  >✕</button>
                </span>
              </li>
            ))}
          </ol>
          {steps.length === 0 && <p className="muted pad">Clique sur la carte pour ajouter la première étape.</p>}
        </div>
        {selected && (
          <StepInspector
            step={selected}
            index={selectedIndex}
            isPhenixRoute={routeName === 'phenix'}
            onChange={(mutate) => editStep(selected.id, mutate)}
          />
        )}
      </aside>
    </div>
  );
}

function RouteTabs({ current, project, onSelect }: { current: RouteName; project: Project; onSelect: (n: RouteName) => void }) {
  return (
    <div className="route-tabs">
      {(['move', 'bank', 'phenix'] as RouteName[]).map((n) => (
        <button key={n} type="button" className={n === current ? 'on' : ''} onClick={() => onSelect(n)}>
          {ROUTE_LABELS[n]}{project[n] ? '' : ' (absent)'}
        </button>
      ))}
    </div>
  );
}

function BracketSettings({ bracket, withLevels, onChange }: {
  bracket: Bracket;
  withLevels: boolean;
  onChange: (mutate: (b: Bracket) => void) => void;
}) {
  const c = bracket.config;
  return (
    <div className="bracket-settings">
      {withLevels && (
        <>
          <label className="field">
            <span>Nom du palier</span>
            <input value={bracket.name} onChange={(e) => onChange((b) => { b.name = e.target.value; })} />
          </label>
          <label className="field inline">
            <span>À partir du niveau</span>
            <input type="number" min={1} max={200} value={bracket.minLevel}
              onChange={(e) => onChange((b) => { b.minLevel = Number(e.target.value) || 1; })} />
          </label>
        </>
      )}
      <details open={!!c.gatherList}>
        <summary>Ressources de ce palier <span className="muted">config:setGatherList</span></summary>
        <label className="check">
          <input type="checkbox" checked={!!c.gatherList}
            onChange={(e) => onChange((b) => { if (e.target.checked) b.config.gatherList = []; else delete b.config.gatherList; })} />
          Changer la liste de récolte en entrant dans ce palier
        </label>
        {c.gatherList && <ResourcePicker value={c.gatherList} onChange={(v) => onChange((b) => { b.config.gatherList = v; })} />}
      </details>
      <details open={c.minMonsters !== undefined || c.maxMonsters !== undefined || !!c.forbiddenMonsters || !!c.mandatoryMonsters}>
        <summary>Combat de ce palier <span className="muted">config:set…Monsters</span></summary>
        <p className="muted small">Reste appliqué jusqu'au prochain palier qui le change (API : « un set* reste posé »).</p>
        {(['minMonsters', 'maxMonsters'] as const).map((key) => (
          <label key={key} className="field inline">
            <input type="checkbox" checked={c[key] !== undefined}
              onChange={(e) => onChange((b) => { if (e.target.checked) b.config[key] = key === 'minMonsters' ? 1 : 8; else delete b.config[key]; })} />
            <span>{key === 'minMonsters' ? 'Taille min. de groupe' : 'Taille max. de groupe'}</span>
            {c[key] !== undefined && (
              <input type="number" min={1} max={8} value={c[key]}
                onChange={(e) => onChange((b) => { b.config[key] = Math.min(8, Math.max(1, Number(e.target.value) || 1)); })} />
            )}
          </label>
        ))}
        {(['mandatoryMonsters', 'forbiddenMonsters'] as const).map((key) => (
          <div key={key} className="field">
            <label className="check">
              <input type="checkbox" checked={!!c[key]}
                onChange={(e) => onChange((b) => { if (e.target.checked) b.config[key] = []; else delete b.config[key]; })} />
              {key === 'mandatoryMonsters' ? 'Monstres obligatoires' : 'Monstres interdits'}
            </label>
            {c[key] && (
              <MonsterPicker
                allowNames={false}
                value={c[key]!}
                onChange={(v) => onChange((b) => { b.config[key] = v.filter((x): x is number => typeof x === 'number'); })}
              />
            )}
          </div>
        ))}
      </details>
    </div>
  );
}
