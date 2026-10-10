// Palette de commandes (⌘K) : toutes les actions de ScriptGen au clavier, avec recherche.
import { useEffect, useMemo, useRef, useState } from 'react';

export interface Command {
  id: string;
  label: string;
  group: string;
  /** Raccourci affiché (ex. « ⌘E », « R »). */
  keys?: string;
  run: () => void;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const results = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return commands.filter((c) => words.every((w) => fold(`${c.group} ${c.label}`).includes(w)));
  }, [commands, query]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          placeholder="Que veux-tu faire ? (exporter, palier suivant, mine, assistant…)"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === 'Enter') { e.preventDefault(); run(results[active]); }
            if (e.key === 'Escape') onClose();
          }}
        />
        <ul ref={listRef}>
          {results.map((c, i) => (
            <li key={c.id} className={i === active ? 'active' : ''} onMouseEnter={() => setActive(i)} onClick={() => run(c)}>
              <span className="muted small">{c.group}</span>
              <span className="grow">{c.label}</span>
              {c.keys && <kbd>{c.keys}</kbd>}
            </li>
          ))}
          {results.length === 0 && <li className="muted">Aucune commande.</li>}
        </ul>
      </div>
    </div>
  );
}

/** Aide des raccourcis (touche ?). */
export function ShortcutHelp({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const groups = [...new Set(commands.filter((c) => c.keys).map((c) => c.group))];
  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette help" onClick={(e) => e.stopPropagation()}>
        <h2>Raccourcis clavier</h2>
        <div className="help-grid">
          {groups.map((g) => (
            <section key={g}>
              <h4 className="subhead">{g}</h4>
              {commands.filter((c) => c.group === g && c.keys).map((c) => (
                <div key={c.id} className="help-row"><span>{c.label}</span><kbd>{c.keys}</kbd></div>
              ))}
            </section>
          ))}
        </div>
        <p className="muted small">Les touches simples (A, S, R, C…) ne s'appliquent pas pendant la saisie dans un champ. Échap ferme les fenêtres.</p>
        <div className="row end"><button type="button" onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  );
}
