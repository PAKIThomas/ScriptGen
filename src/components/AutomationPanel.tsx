// Onglet « Automatismes » : ce que le script fait tout seul en plus du trajet. Tout passe par des
// fonctions de l'API MizanBot (voir src/lua/automation.ts pour le Lua généré).
import { useMemo, useState } from 'react';
import { JOBS } from '../data/game';
import type { Automation, CombatProfile, Project, StatName } from '../model/types';
import type { ProjectStore } from '../state';
import { useItems } from './pickers';

const STATS: { id: StatName; label: string }[] = [
  { id: 'vitality', label: 'Vitalité' },
  { id: 'wisdom', label: 'Sagesse' },
  { id: 'strength', label: 'Force' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'chance', label: 'Chance' },
  { id: 'agility', label: 'Agilité' },
];

function emptyAutomation(): Automation {
  return { equip: [], combat: {} };
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {hint && <small className="muted">{hint}</small>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function EquipEditor({ automation, onChange }: { automation: Automation; onChange: (mutate: (a: Automation) => void) => void }) {
  const items = useItems();
  const names = useMemo(() => new Map(items ?? []), [items]);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState(1);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!items || !q) return [];
    return items.filter(([id, name]) => String(id) === q || name.toLowerCase().includes(q)).slice(0, 30);
  }, [items, query]);
  return (
    <div>
      {automation.equip.length > 0 && (
        <table className="amounts">
          <thead><tr><th>À partir du niveau</th><th>Objet</th><th /></tr></thead>
          <tbody>
            {[...automation.equip].map((e, i) => (
              <tr key={i}>
                <td>
                  <input type="number" min={1} max={200} value={e.level}
                    onChange={(ev) => onChange((a) => { a.equip[i].level = Math.max(1, Number(ev.target.value) || 1); })} />
                </td>
                <td>{names.get(e.gid) ?? '?'} <span className="muted">({e.gid})</span></td>
                <td><button type="button" onClick={() => onChange((a) => { a.equip.splice(i, 1); })}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row">
        <label className="field inline"><span>Niveau</span>
          <input type="number" min={1} max={200} value={level} onChange={(e) => setLevel(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <div className="search-add grow">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={items ? 'Chercher l\'objet à équiper (nom ou gid)…' : 'Chargement des objets…'} />
          {results.length > 0 && (
            <ul className="search-results">
              {results.map(([id, name]) => (
                <li key={id}>
                  <button type="button" onClick={() => { onChange((a) => { a.equip.push({ level, gid: id }); }); setQuery(''); }}>
                    <span className="muted">{id}</span> {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="muted small">
        À chaque changement de niveau du personnage, le script équipe chaque objet dont le niveau requis est atteint
        s'il est dans le sac (<code>inventory:itemPosition(gid) == 63</code> puis <code>inventory:equip(gid)</code>).
        L'objet prend le premier emplacement libre ; l'équipement est refusé en combat.
      </p>
    </div>
  );
}

/** Carte « Équipement » (onglets Paramètres et Automatismes). */
export function EquipmentCard({ store }: { store: ProjectStore }) {
  const { project, update } = store;
  const a = project.automation ?? emptyAutomation();
  const edit = (mutate: (a: Automation) => void) => update((p: Project) => {
    const next = p.automation ?? emptyAutomation();
    mutate(next);
    p.automation = next;
  });
  return (
    <section className="card">
      <h3>Équipement</h3>
      <Toggle
        label="Équiper automatiquement les objets"
        hint="inventory:stuff() à chaque niveau gagné : remplit les emplacements vides avec l'équipement du sac (niveau ≤ personnage, le plus haut d'abord). Ne remplace jamais un objet déjà porté."
        checked={!!a.autoStuff}
        onChange={(v) => edit((x) => { if (v) x.autoStuff = true; else delete x.autoStuff; })}
      />
      <h4 className="subhead">Équiper un objet précis à partir d'un niveau</h4>
      <EquipEditor automation={a} onChange={edit} />
    </section>
  );
}

export function AutomationPanel({ store }: { store: ProjectStore }) {
  const { project, update } = store;
  const a = project.automation ?? emptyAutomation();
  const edit = (mutate: (a: Automation) => void) => update((p: Project) => {
    const next = p.automation ?? emptyAutomation();
    mutate(next);
    p.automation = next;
  });
  const setCombat = <K extends keyof CombatProfile>(key: K, value: CombatProfile[K] | undefined) => edit((x) => {
    if (value === undefined) delete x.combat[key];
    else x.combat[key] = value;
  });
  const c = a.combat;

  return (
    <div className="overlay-panel automation-panel">
      <EquipmentCard store={store} />

      <section className="card">
        <h3>Caractéristiques &amp; arrêt</h3>
        <label className="field inline">
          <span>Investir les points dans</span>
          <select value={a.autoStat ?? ''} onChange={(e) => edit((x) => { if (e.target.value) x.autoStat = e.target.value as StatName; else delete x.autoStat; })}>
            <option value="">— ne rien investir —</option>
            {STATS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <p className="muted small"><code>character:upgradeStat(…, character:statPoints())</code> — permission « Combat auto ».</p>
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={!!a.stopAt} onChange={(e) => edit((x) => { if (e.target.checked) x.stopAt = { level: 200 }; else delete x.stopAt; })} />
            Arrêter le script au niveau
          </label>
          {a.stopAt && (
            <>
              <input type="number" min={1} max={200} value={a.stopAt.level}
                onChange={(e) => edit((x) => { x.stopAt!.level = Math.max(1, Number(e.target.value) || 1); })} />
              <select value={a.stopAt.jobId ?? ''} onChange={(e) => edit((x) => {
                if (e.target.value) x.stopAt!.jobId = Number(e.target.value);
                else delete x.stopAt!.jobId;
              })}>
                <option value="">du personnage</option>
                {JOBS.map((j) => <option key={j.id} value={j.id}>du métier {j.name}</option>)}
              </select>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Combat (réglages posés par le script)</h3>
        <p className="muted small">Ils s'appliquent au-dessus de l'onglet Combat de MizanBot, le temps du script (module <code>combat:</code>). Laisse « — » pour garder le réglage du bot.</p>
        <div className="grid-2">
          <label className="field"><span>Jouer les tours automatiquement</span>
            <select value={c.autoFight === undefined ? '' : String(c.autoFight)} onChange={(e) => setCombat('autoFight', e.target.value === '' ? undefined : e.target.value === 'true')}>
              <option value="">—</option><option value="true">Oui</option><option value="false">Non</option>
            </select>
          </label>
          <label className="field"><span>Style d'IA</span>
            <select value={c.style ?? ''} onChange={(e) => setCombat('style', (e.target.value || undefined) as CombatProfile['style'])}>
              <option value="">—</option><option value="agressif">Agressif</option><option value="fuyard">Fuyard (kite)</option><option value="passif">Passif</option>
            </select>
          </label>
          <label className="field"><span>Cible</span>
            <select value={c.target ?? ''} onChange={(e) => setCombat('target', (e.target.value || undefined) as CombatProfile['target'])}>
              <option value="">—</option><option value="proche">La plus proche</option><option value="pv">PV les plus bas</option><option value="loin">La plus loin</option>
            </select>
          </label>
          <label className="field"><span>Vitesse</span>
            <select value={c.speed ?? ''} onChange={(e) => setCombat('speed', (e.target.value || undefined) as CombatProfile['speed'])}>
              <option value="">—</option><option value="Instant">Instantané</option><option value="rapide">Rapide</option><option value="lent">Lent</option>
            </select>
          </label>
          <label className="field"><span>Lancers max par tour (1–99)</span>
            <input type="number" min={1} max={99} value={c.maxCasts ?? ''} placeholder="—"
              onChange={(e) => setCombat('maxCasts', e.target.value === '' ? undefined : Math.min(99, Math.max(1, Number(e.target.value))))} />
          </label>
          <label className="field"><span>Défis</span>
            <select value={c.challengeMode ?? ''} onChange={(e) => setCombat('challengeMode', (e.target.value || undefined) as CombatProfile['challengeMode'])}>
              <option value="">—</option><option value="auto">Valider le 1er défi proposé</option><option value="off">Aucun défi</option>
            </select>
          </label>
          <label className="field"><span>Distance de kite min / max (0 = ∞)</span>
            <div className="row">
              <input type="number" min={0} max={20} value={c.kiteMin ?? ''} placeholder="—"
                onChange={(e) => setCombat('kiteMin', e.target.value === '' ? undefined : Math.min(20, Math.max(0, Number(e.target.value))))} />
              <input type="number" min={0} max={20} value={c.kiteMax ?? ''} placeholder="0" disabled={c.kiteMin === undefined}
                onChange={(e) => setCombat('kiteMax', e.target.value === '' ? undefined : Math.min(20, Math.max(0, Number(e.target.value))))} />
            </div>
          </label>
          <label className="field"><span>Achever les cibles tuables / pré-combat auto</span>
            <div className="row">
              <select value={c.finishKill === undefined ? '' : String(c.finishKill)} onChange={(e) => setCombat('finishKill', e.target.value === '' ? undefined : e.target.value === 'true')}>
                <option value="">—</option><option value="true">Achever : oui</option><option value="false">Achever : non</option>
              </select>
              <select value={c.autoPreFight === undefined ? '' : String(c.autoPreFight)} onChange={(e) => setCombat('autoPreFight', e.target.value === '' ? undefined : e.target.value === 'true')}>
                <option value="">—</option><option value="true">Placement auto : oui</option><option value="false">Placement auto : non</option>
              </select>
            </div>
          </label>
        </div>
      </section>

      <section className="card">
        <h3>Alertes &amp; statut</h3>
        <Toggle label="Statut privé au démarrage" hint="setPrivate(true) — les autres joueurs ne peuvent plus t'écrire."
          checked={!!a.privateStatus} onChange={(v) => edit((x) => { if (v) x.privateStatus = true; else delete x.privateStatus; })} />
        <Toggle label="Prévenir quand un archimonstre est sur la carte" hint="notify() dans MizanBot, une fois par carte."
          checked={!!a.archNotify} onChange={(v) => edit((x) => { if (v) x.archNotify = true; else delete x.archNotify; })} />
        <Toggle label="Ouvrir les sacs de ressources après une victoire" hint="onFightEnd : if result.won then openBags() end"
          checked={!!project.onFightEnd?.openBagsOnWin}
          onChange={(v) => update((p) => { p.onFightEnd = { ...(p.onFightEnd ?? { openBagsOnWin: false }), openBagsOnWin: v }; })} />
        <Toggle label="Prévenir en cas de combat perdu" hint="onFightEnd : notify(&quot;Combat perdu&quot;)"
          checked={!!project.onFightEnd?.notifyOnLoss}
          onChange={(v) => update((p) => { p.onFightEnd = { ...(p.onFightEnd ?? { openBagsOnWin: false }), notifyOnLoss: v || undefined }; })} />
        <Toggle label="Prévenir quand le script s'arrête" hint="stopped(reason) : notify(&quot;Script arrêté : &quot; .. reason)"
          checked={!!project.stopped?.notify} onChange={(v) => update((p) => { p.stopped = v ? { notify: true } : null; })} />
      </section>
    </div>
  );
}
