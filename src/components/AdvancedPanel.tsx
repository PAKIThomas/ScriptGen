// Onglet « Script » : en-tête, hooks reconnus et blocs « Lua brut » conservés à l'import.
import { newId } from '../model/project';
import type { Section } from '../model/types';
import type { ProjectStore } from '../state';

const SECTION_LABELS: Record<Exclude<Section['kind'], 'raw'>, string> = {
  globals: 'Paramètres (globals)',
  move: 'move()',
  bank: 'bank()',
  phenix: 'phenix()',
  onFightEnd: 'onFightEnd()',
};

export function AdvancedPanel({ store }: { store: ProjectStore }) {
  const { project, update } = store;

  const move = (i: number, delta: number) => update((p) => {
    const j = i + delta;
    if (j < 0 || j >= p.sections.length) return;
    [p.sections[i], p.sections[j]] = [p.sections[j], p.sections[i]];
  });

  return (
    <div className="advanced-panel">
      <section className="card">
        <h3>En-tête du fichier</h3>
        <textarea
          rows={3}
          value={project.header.join('\n')}
          onChange={(e) => update((p) => { p.header = e.target.value === '' ? [] : e.target.value.split('\n'); })}
        />
        <small className="muted">Une ligne = un commentaire « -- » en haut du script.</small>
      </section>

      <section className="card">
        <h3>Après chaque combat — onFightEnd()</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={!!project.onFightEnd?.openBagsOnWin}
            onChange={(e) => update((p) => { p.onFightEnd = e.target.checked ? { openBagsOnWin: true } : null; })}
          />
          Ouvrir les sacs de ressources après une victoire (<code>if result.won then openBags() end</code>)
        </label>
      </section>

      <section className="card">
        <h3>Ordre des blocs &amp; Lua brut</h3>
        <p className="muted small">
          Ce que l'import n'a pas su transformer en formulaire est gardé ici, à l'identique, et réécrit à sa place dans le script.
          Tu peux aussi ajouter ton propre bloc Lua.
        </p>
        <ol className="sections">
          {project.sections.map((s, i) => (
            <li key={s.kind === 'raw' ? s.id : s.kind}>
              <div className="row">
                <strong>{s.kind === 'raw' ? `Lua brut : ${s.label}` : SECTION_LABELS[s.kind]}</strong>
                <span className="spacer" />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === project.sections.length - 1}>↓</button>
                {s.kind === 'raw' && (
                  <button type="button" className="danger" onClick={() => update((p) => { p.sections.splice(i, 1); })}>Supprimer</button>
                )}
              </div>
              {s.kind === 'raw' && (
                <textarea
                  className="code"
                  spellCheck={false}
                  rows={Math.min(20, s.text.split('\n').length + 1)}
                  value={s.text}
                  onChange={(e) => update((p) => {
                    const sec = p.sections[i];
                    if (sec.kind === 'raw') sec.text = e.target.value;
                  })}
                />
              )}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => update((p) => { p.sections.push({ kind: 'raw', id: newId(), label: 'bloc perso', text: '-- ton code Lua' }); })}
        >
          + Bloc Lua brut
        </button>
      </section>
    </div>
  );
}
