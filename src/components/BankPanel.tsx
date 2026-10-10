// Onglet « Banque & Phénix » : banques prédéfinies (comme le Script Creator) et résurrection.
import { mapImageUrl, useMapIndex } from '../data/maps';
import { newId, newStep } from '../model/project';
import type { Project, Route } from '../model/types';
import type { ProjectStore } from '../state';
import type { RouteName } from './RouteEditor';

/** bank() d'une banque prédéfinie : une seule étape, le bot voyage seul jusqu'au banquier. */
export function presetBankRoute(mapId: number): Route {
  return {
    levelSource: { kind: 'none' },
    brackets: [{ id: newId(), name: 'Trajet principal', minLevel: 1, config: {}, steps: [newStep(mapId, { npcBank: true })] }],
  };
}

/** Id de la banque prédéfinie utilisée par bank(), si bank() est exactement une banque prédéfinie. */
export function presetBankId(project: Project, bankIds: number[]): number | null {
  const steps = project.bank?.brackets.flatMap((b) => b.steps) ?? [];
  if (project.bank?.brackets.length !== 1 || steps.length !== 1) return null;
  const s = steps[0];
  const keys = Object.keys(s).filter((k) => !['id', 'map', 'npcBank'].includes(k));
  return s.npcBank && keys.length === 0 && bankIds.includes(Number(s.map)) ? Number(s.map) : null;
}

export function BankPanel({ store, onOpenRoute }: { store: ProjectStore; onOpenRoute: (r: RouteName) => void }) {
  const { project, update } = store;
  const index = useMapIndex();
  const banks = index?.banks ?? [];
  const current = presetBankId(project, banks.map((b) => b.mapId));
  const custom = project.bank !== null && current === null;

  return (
    <div className="overlay-panel bank-panel">
      <section className="card">
        <h3>Retour en banque — bank()</h3>
        <p className="muted small">
          Quand les pods atteignent <code>MAX_PODS</code> (onglet Paramètres), le bot ouvre les sacs et détruit les objets
          choisis, puis, si le sac est encore plein, joue <code>bank()</code> : il voyage seul jusqu'au banquier
          (marche, zaap ou havre-sac), dépose selon le « Type de dépôt » de l'onglet Banque de MizanBot, puis reprend le trajet.
        </p>
        <div className="bank-grid">
          <button type="button" className={`bank-card${project.bank === null ? ' on' : ''}`} onClick={() => update((p) => { p.bank = null; })}>
            <strong>Pas de banque</strong>
            <span className="muted small">Pods pleins : avertissement, le trajet continue.</span>
          </button>
          {banks.map((b) => (
            <button
              key={b.mapId}
              type="button"
              className={`bank-card${current === b.mapId ? ' on' : ''}`}
              onClick={() => update((p) => { p.bank = presetBankRoute(b.mapId); })}
            >
              <img src={mapImageUrl(b.mapId)} alt="" loading="lazy" />
              <strong>{b.zone}</strong>
              <span className="muted small">[{b.x},{b.y}] · id {b.mapId}{b.interior ? ' · intérieur' : ''}</span>
            </button>
          ))}
          <button type="button" className={`bank-card${custom ? ' on' : ''}`} onClick={() => onOpenRoute('bank')}>
            <strong>Trajet sur mesure</strong>
            <span className="muted small">Coffre à code, maison, plusieurs cartes… dessiné sur la carte.</span>
          </button>
        </div>
        {current !== null && (
          <p className="small">Écrit dans le script : <code>{`{ map = ${current}, npcBank = true }`}</code></p>
        )}
      </section>

      <section className="card">
        <h3>Résurrection — phenix()</h3>
        <p className="muted small">
          Par défaut (recommandé), MizanBot ressuscite tout seul : à la mort, il voyage jusqu'au Phénix indiqué par le jeu,
          ressuscite et reprend le script (option « Résurrection auto » de l'onglet Combat). <code>phenix()</code> ne sert
          qu'à imposer une statue précise : une étape <code>{'{ map = …, phenix = cellule }'}</code>.
        </p>
        <p className="muted small">
          Aucune source publique fiable ne donne la carte et la cellule de chaque statue : je ne les ai donc pas prédéfinies
          (règle « ne rien inventer »). Pour en ajouter une : en jeu, sur la carte de la statue, tape <code>/mapid</code> et
          <code>/cellid</code> dans la console du bot, puis crée phenix() sur mesure.
        </p>
        <div className="row">
          <button type="button" className={project.phenix === null ? 'on' : ''} onClick={() => update((p) => { p.phenix = null; })}>
            Automatique (recommandé)
          </button>
          <button type="button" className={project.phenix !== null ? 'on' : ''} onClick={() => onOpenRoute('phenix')}>
            Statue sur mesure
          </button>
        </div>
      </section>
    </div>
  );
}
