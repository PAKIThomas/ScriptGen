// Onglet « Trajet » : la carte en plein écran, avec les panneaux flottants Trajets / Étapes.
import React, { useMemo, useState } from 'react';
import { JOBS } from '../data/game';
import { locateStepMap, MAIN_WORLD, useMapIndex } from '../data/maps';
import { checkProject, type Check } from '../model/checks';
import { coordsKey, suggestPath, type PathStyle } from '../model/geo';
import { cloneBracket, cloneStep, newBracket, newRoute, newStep } from '../model/project';
import type { Bracket, Project, Route, Step } from '../model/types';
import type { ProjectStore } from '../state';
import { MapSearch } from './MapSearch';
import { MonsterPicker, ResourcePicker } from './pickers';
import { StepInspector } from './StepInspector';
import { canonicalMap, WorldMap } from './WorldMap';

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

interface RouteEditorProps {
  store: ProjectStore;
  routeName: RouteName;
  onRouteChange: (name: RouteName) => void;
  /** Panneau affiché en bas à gauche (l'atelier du script, géré par App). */
  atelier?: React.ReactNode;
}

export function RouteEditor({ store, routeName, onRouteChange, atelier }: RouteEditorProps) {
  const { project, update } = store;
  const [bracketIndex, setBracketIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'add' | 'select'>('add');
  const [pathStyle, setPathStyle] = useState<PathStyle>('coords');
  const [idInput, setIdInput] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [world, setWorld] = useState(MAIN_WORLD);
  const [searching, setSearching] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const index = useMapIndex();
  const checks = useMemo(() => checkProject(project, index), [project, index]);
  const selectRoute = (n: RouteName) => { onRouteChange(n); setBracketIndex(0); setSelectedId(null); };

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
      const hit = steps.find((s) => { const at = locateStepMap(index, s.map); return at && at.x === c.x && at.y === c.y; });
      setSelectedId(hit?.id ?? null);
      return;
    }
    if (world === MAIN_WORLD) {
      addStep(coordsKey(c));
      return;
    }
    // Hors du Monde des Douze (Incarnam…), les coordonnées sont ambiguës : on écrit l'id de la carte.
    const main = canonicalMap(index?.byCoords.get(`${world}:${c.x},${c.y}`), c.x, c.y);
    if (main) addStep(main.id);
  };

  const levels = route ? route.levelSource.kind !== 'none' : false;
  const allGather = steps.length > 0 && steps.every((s) => s.gather);
  const allFight = steps.length > 0 && steps.every((s) => s.fight);

  return (
    <div className={`stage${leftOpen ? ' left-open' : ''}${rightOpen ? ' right-open' : ''}`}>
      <WorldMap
        steps={steps} ghostSteps={ghostSteps} selectedId={selectedId} mode={mapMode}
        index={index} world={world} onWorldChange={setWorld} onCellClick={onCellClick}
      />

      <div className="floating toolbar-card">
        <div className="segmented">
          <button type="button" className={mapMode === 'add' ? 'on' : ''} onClick={() => setMapMode('add')}>＋ Ajouter</button>
          <button type="button" className={mapMode === 'select' ? 'on' : ''} onClick={() => setMapMode('select')}>Sélectionner</button>
        </div>
        <button type="button" onClick={store.undo} disabled={!store.canUndo} title="Annuler (⌘Z)">↶ Annuler</button>
        <button type="button" onClick={store.redo} disabled={!store.canRedo} title="Rétablir (⇧⌘Z)">↷ Rétablir</button>
        <button type="button" onClick={() => setSearching(true)}>🔍 Chercher une carte</button>
        <button
          type="button" disabled={steps.length < 2}
          title="La dernière étape repart vers la première"
          onClick={() => editBracket((b) => {
            const last = b.steps[b.steps.length - 1];
            last.path = suggestPath(last, b.steps[0], pathStyle);
          })}
        >⟲ Boucler</button>
        <button
          type="button" className="danger" disabled={!steps.length}
          onClick={() => { if (confirm('Effacer toutes les étapes de ce palier ?')) { editBracket((b) => { b.steps = []; }); setSelectedId(null); } }}
        >Tout effacer</button>
      </div>

      <aside className={`floating panel left-panel${leftOpen ? '' : ' collapsed'}`}>
        <header className="panel-header">
          <h2>Trajets</h2>
          <button type="button" className="icon-button" onClick={() => setLeftOpen(!leftOpen)} title={leftOpen ? 'Réduire' : 'Ouvrir'}>{leftOpen ? '–' : '+'}</button>
        </header>
        {leftOpen && (
          <div className="panel-body">
            <RouteTabs current={routeName} project={project} onSelect={selectRoute} />
            {!route ? (
              <div className="empty-state">
                {routeName === 'move' ? (
                  <p className="muted">Le move() de ce script est écrit à la main : il est conservé tel quel dans « Script &amp; Lua brut ».</p>
                ) : (
                  <p className="muted">
                    {routeName === 'bank'
                      ? 'Pas de bank() : à MAX_PODS, le bot affiche « pods pleins » et continue. Choisis une banque dans l\'onglet « Banque & Phénix » ou crée un trajet sur mesure.'
                      : 'Pas de phenix() : à la mort, le bot ressuscite tout seul au Phénix indiqué par le jeu (recommandé).'}
                  </p>
                )}
                <button type="button" className="primary" onClick={() => update((p) => { p[routeName] = newRoute(); })}>
                  Créer {routeName}() sur mesure
                </button>
              </div>
            ) : (
              <>
                {routeName !== 'move' && (
                  <button type="button" className="danger small" onClick={() => update((p) => { p[routeName] = null; })}>
                    Supprimer {routeName}()
                  </button>
                )}
                <div className="choice-cards">
                  <button type="button" className={!levels ? 'choice on' : 'choice'}
                    onClick={() => editRoute((r) => { r.levelSource = { kind: 'none' }; })}>
                    <strong>Trajet normal</strong>
                    <span>Un seul trajet, rejoué en boucle.</span>
                  </button>
                  <button type="button" className={levels ? 'choice on' : 'choice'}
                    onClick={() => editRoute((r) => { if (r.levelSource.kind === 'none') r.levelSource = { kind: 'job', jobId: 2 }; })}>
                    <strong>Trajet leveling</strong>
                    <span>Un trajet par palier de niveau.</span>
                  </button>
                </div>
                {levels && (
                  <label className="field">
                    <span>Niveau utilisé pour les paliers</span>
                    <select
                      value={route.levelSource.kind === 'job' ? `job:${route.levelSource.jobId}` : route.levelSource.kind}
                      onChange={(e) => editRoute((r) => {
                        const v = e.target.value;
                        r.levelSource = v === 'character' ? { kind: 'character' } : { kind: 'job', jobId: Number(v.slice(4)) };
                      })}
                    >
                      <option value="character">Niveau du personnage</option>
                      {JOBS.map((j) => <option key={j.id} value={`job:${j.id}`}>Métier : {j.name}</option>)}
                    </select>
                  </label>
                )}
                {levels && (
                  <ol className="bracket-list">
                    {route.brackets.map((b, i) => (
                      <li key={b.id} className={i === bIndex ? 'active' : ''} onClick={() => { setBracketIndex(i); setSelectedId(null); }}>
                        <strong>{b.name}</strong>
                        <span className="muted">
                          {i === route.brackets.length - 1 ? `niv. ${b.minLevel}+` : `niv. ${b.minLevel}–${route.brackets[i + 1].minLevel - 1}`}
                          {` · ${b.steps.length} cartes`}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                {levels && (
                  <div className="row">
                    <button type="button" onClick={() => {
                      editRoute((r) => {
                        const last = r.brackets[r.brackets.length - 1];
                        r.brackets.push(newBracket(`Étape ${r.brackets.length + 1}`, (last?.minLevel ?? 0) + 20));
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
                {bracket && <BracketSettings bracket={bracket} withLevels={levels} onChange={editBracket} />}
              </>
            )}
          </div>
        )}
      </aside>

      {atelier}

      <aside className={`floating panel right-panel${rightOpen ? '' : ' collapsed'}`}>
        <header className="panel-header">
          <h2>Étapes <span className="count">{steps.length}</span></h2>
          <button type="button" className="icon-button" onClick={() => setRightOpen(!rightOpen)} title={rightOpen ? 'Réduire' : 'Ouvrir'}>{rightOpen ? '–' : '+'}</button>
        </header>
        {rightOpen && (
          <div className="panel-body">
            <div className="row bulk">
              <button type="button" className={allGather ? 'on' : ''} disabled={!steps.length}
                onClick={() => editBracket((b) => { for (const s of b.steps) { if (allGather) delete s.gather; else s.gather = true; } })}>
                🌾 Tout récolter
              </button>
              <button type="button" className={allFight ? 'on' : ''} disabled={!steps.length}
                onClick={() => editBracket((b) => { for (const s of b.steps) { if (allFight) delete s.fight; else s.fight = true; } })}>
                ⚔️ Tout combattre
              </button>
            </div>
            <div className="row">
              <form className="row grow" onSubmit={(e) => {
                e.preventDefault();
                const v = idInput.trim();
                if (v) addStep(/^\d+$/.test(v) ? Number(v) : v);
                setIdInput('');
              }}
              >
                <input className="grow" value={idInput} onChange={(e) => setIdInput(e.target.value)} placeholder="Id de carte (intérieur) ou x,y" />
                <button type="submit">Ajouter</button>
              </form>
              <button type="button" onClick={() => addStep('havenbag')} title="Étape jouée dans le havre-sac">Havre-sac</button>
            </div>
            <label className="field inline" title="Valeur de sortie proposée quand on enchaîne deux cartes">
              <span>Sortie auto</span>
              <select value={pathStyle} onChange={(e) => setPathStyle(e.target.value as PathStyle)}>
                <option value="coords">coordonnée « x,y » (comme les exemples)</option>
                <option value="directions">direction si carte voisine</option>
              </select>
            </label>
            <div className="step-list">
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
                    onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
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
              {steps.length === 0 && <p className="muted pad">Clique une case de la carte pour commencer le trajet.</p>}
            </div>
            <ChecksPanel
              checks={checks}
              onSelect={(c) => {
                if (c.route !== 'global' && c.route !== routeName) selectRoute(c.route);
                if (c.bracketIndex !== undefined) setBracketIndex(c.bracketIndex);
                if (c.stepId) setSelectedId(c.stepId);
              }}
            />
            {selected && (
              <StepInspector
                index={index}
                step={selected}
                stepIndex={selectedIndex}
                isPhenixRoute={routeName === 'phenix'}
                onChange={(mutate) => editStep(selected.id, mutate)}
              />
            )}
          </div>
        )}
      </aside>

      {searching && (
        <MapSearch index={index} onClose={() => setSearching(false)} onAdd={(map) => { addStep(map); setSearching(false); }} />
      )}
    </div>
  );
}

const LEVEL_ICON: Record<Check['level'], string> = { error: '⛔', warning: '⚠️', info: 'ℹ️' };

function ChecksPanel({ checks, onSelect }: { checks: Check[]; onSelect: (c: Check) => void }) {
  const errors = checks.filter((c) => c.level === 'error').length;
  const warnings = checks.filter((c) => c.level === 'warning').length;
  return (
    <details className="checks-panel" open={errors > 0}>
      <summary>
        Vérifications : {errors ? `${errors} erreur(s)` : ''}{errors && warnings ? ', ' : ''}
        {warnings ? `${warnings} alerte(s)` : ''}{!errors && !warnings ? 'rien de bloquant ✓' : ''}
        <span className="muted"> · {checks.length} au total</span>
      </summary>
      <ul>
        {checks.map((c, i) => (
          <li key={i} className={c.level} onClick={() => onSelect(c)}>
            {LEVEL_ICON[c.level]} <span className="muted">{c.route === 'global' ? 'script' : `${c.route}()`}</span> {c.message}
          </li>
        ))}
      </ul>
    </details>
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
