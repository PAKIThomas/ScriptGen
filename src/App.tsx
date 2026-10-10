import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type AppConfig } from './api';
import { AdvancedPanel } from './components/AdvancedPanel';
import { AssistantPanel, type AssistantHandle } from './components/AssistantPanel';
import { CommandPalette, ShortcutHelp, type Command } from './components/CommandPalette';
import { AutomationPanel } from './components/AutomationPanel';
import { BankPanel } from './components/BankPanel';
import { ParamsPanel } from './components/ParamsPanel';
import { RouteEditor, type RouteName } from './components/RouteEditor';
import { generate } from './lua/generate';
import { importLua } from './lua/import';
import { newProject } from './model/project';
import type { Project, ScriptMode } from './model/types';
import { useProjectStore } from './state';
import { usePanelOpen } from './usePanelOpen';

type Tab = 'route' | 'params' | 'automation' | 'bank' | 'script';

const TABS: { id: Tab; label: string }[] = [
  { id: 'route', label: 'Trajet' },
  { id: 'params', label: 'Paramètres' },
  { id: 'automation', label: 'Automatismes' },
  { id: 'bank', label: 'Banque & Phénix' },
  { id: 'script', label: 'Script & Lua brut' },
];

/** Coloration minimale de l'aperçu Lua (mots-clés et commentaires). */
function highlight(line: string): JSX.Element {
  const comment = line.indexOf('--');
  const code = comment >= 0 ? line.slice(0, comment) : line;
  const parts = code.split(/(\bfunction\b|\breturn\b|\bend\b|\bif\b|\belseif\b|\belse\b|\bthen\b|\blocal\b|\btrue\b|\bfalse\b|"[^"]*")/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('"') ? <span key={i} className="tok-str">{p}</span>
        : /^(true|false)$/.test(p) ? <span key={i} className="tok-bool">{p}</span>
          : /^(function|return|end|if|elseif|else|then|local)$/.test(p) ? <span key={i} className="tok-kw">{p}</span> : p))}
      {comment >= 0 && <span className="tok-comment">{line.slice(comment)}</span>}
    </>
  );
}

const MODES: { id: ScriptMode; label: string }[] = [
  { id: 'gather', label: 'Récolte' },
  { id: 'fight', label: 'Combat' },
  { id: 'mixed', label: 'Les deux' },
];

function projectFileName(p: Project): string {
  return p.fileName.replace(/\.lua$/i, '') + '.json';
}

export function App() {
  const store = useProjectStore();
  const { project, update, replace } = store;
  const [tab, setTab] = useState<Tab>('route');
  const [routeName, setRouteName] = useState<RouteName>('move');
  const [showPreview, setShowPreview] = usePanelOpen('atelier');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [dialog, setDialog] = useState<'open' | 'settings' | null>(null);
  const [overlay, setOverlay] = useState<'palette' | 'help' | null>(null);
  const [assistantOpen, setAssistantOpen] = usePanelOpen('assistant', false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const assistant = useRef<AssistantHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const refreshConfig = () => api.getConfig().then((c) => setHasKey(!!c.hasAnthropicKey)).catch(() => setHasKey(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshConfig(); }, []);

  const lua = useMemo(() => {
    try {
      return generate(project);
    } catch (e) {
      return `-- Erreur de génération : ${(e as Error).message}`;
    }
  }, [project]);

  const notify = (text: string, error = false) => {
    setMessage({ text, error });
    window.setTimeout(() => setMessage((m) => (m?.text === text ? null : m)), error || text.length > 120 ? 10000 : 4000);
  };

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  const saveProject = () => run(async () => {
    const { path } = await api.saveProject(projectFileName(project), project);
    notify(`Projet enregistré : ${path}`);
  });
  const exportProject = () => run(async () => {
    const { path } = await api.exportLua(project.fileName, lua);
    notify(`Exporté : ${path}`);
  });
  const openAssistant = () => {
    setAssistantOpen(true);
    window.setTimeout(() => assistant.current?.focus(), 0);
  };
  const routeCommand = (id: string) => window.dispatchEvent(new CustomEvent('scriptgen:command', { detail: id }));

  const commands: Command[] = [
    { id: 'assistant', group: 'Assistant', label: 'Ouvrir l\'assistant IA', keys: '⌘J ou /', run: openAssistant },
    { id: 'export', group: 'Fichier', label: 'Exporter le .lua', keys: '⌘E', run: exportProject },
    { id: 'save', group: 'Fichier', label: 'Enregistrer le projet', keys: '⌘S', run: saveProject },
    { id: 'open', group: 'Fichier', label: 'Ouvrir un projet…', keys: '⌘O', run: () => setDialog('open') },
    { id: 'import', group: 'Fichier', label: 'Importer un .lua', keys: '⌘I', run: () => fileInput.current?.click() },
    { id: 'new', group: 'Fichier', label: 'Nouveau projet', run: () => { if (confirm('Créer un nouveau projet vide ?')) replace(newProject()); } },
    { id: 'copy', group: 'Fichier', label: 'Copier le Lua', run: () => navigator.clipboard.writeText(lua).then(() => notify('Lua copié')) },
    { id: 'settings', group: 'Fichier', label: 'Réglages (dossiers, clé IA)', run: () => setDialog('settings') },
    ...TABS.map((t, i) => ({ id: `tab-${t.id}`, group: 'Onglets', label: t.label, keys: String(i + 1), run: () => setTab(t.id) })),
    { id: 'route-move', group: 'Trajets', label: 'Trajet principal — move()', run: () => { setRouteName('move'); setTab('route'); } },
    { id: 'route-bank', group: 'Trajets', label: 'Retour banque — bank()', run: () => { setRouteName('bank'); setTab('route'); } },
    { id: 'route-phenix', group: 'Trajets', label: 'Résurrection — phenix()', run: () => { setRouteName('phenix'); setTab('route'); } },
    { id: 'mode-add', group: 'Carte', label: 'Mode Ajouter', keys: 'A', run: () => routeCommand('mode-add') },
    { id: 'mode-select', group: 'Carte', label: 'Mode Sélectionner', keys: 'S', run: () => routeCommand('mode-select') },
    { id: 'search', group: 'Carte', label: 'Chercher une carte', keys: 'F', run: () => routeCommand('search') },
    { id: 'loop', group: 'Carte', label: 'Boucler (la dernière étape repart vers la première)', keys: 'L', run: () => routeCommand('loop') },
    { id: 'next-step', group: 'Étapes', label: 'Étape suivante', keys: '↓ ou J', run: () => routeCommand('next-step') },
    { id: 'prev-step', group: 'Étapes', label: 'Étape précédente', keys: '↑ ou K', run: () => routeCommand('prev-step') },
    { id: 'gather', group: 'Étapes', label: 'Récolter oui / non (étape choisie)', keys: 'R', run: () => routeCommand('gather') },
    { id: 'fight', group: 'Étapes', label: 'Combattre oui / non (étape choisie)', keys: 'C', run: () => routeCommand('fight') },
    { id: 'duplicate', group: 'Étapes', label: 'Dupliquer l\'étape choisie', keys: 'D', run: () => routeCommand('duplicate') },
    { id: 'delete', group: 'Étapes', label: 'Supprimer l\'étape choisie', keys: 'Suppr', run: () => routeCommand('delete') },
    { id: 'next-bracket', group: 'Paliers', label: 'Palier suivant', keys: ']', run: () => routeCommand('next-bracket') },
    { id: 'prev-bracket', group: 'Paliers', label: 'Palier précédent', keys: '[', run: () => routeCommand('prev-bracket') },
    { id: 'undo', group: 'Édition', label: 'Annuler', keys: '⌘Z', run: store.undo },
    { id: 'redo', group: 'Édition', label: 'Rétablir', keys: '⇧⌘Z', run: store.redo },
    { id: 'palette', group: 'Aide', label: 'Palette de commandes', keys: '⌘K', run: () => setOverlay('palette') },
    { id: 'help', group: 'Aide', label: 'Liste des raccourcis', keys: '?', run: () => setOverlay('help') },
  ];
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  useEffect(() => {
    const byId = (id: string) => commandsRef.current.find((c) => c.id === id)?.run();
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && !e.shiftKey && !e.altKey) {
        const map: Record<string, string> = { k: 'palette', j: 'assistant', s: 'save', e: 'export', o: 'open', i: 'import' };
        if (map[k]) { e.preventDefault(); byId(map[k]); }
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'Escape') { setOverlay(null); setDialog(null); return; }
      if (e.altKey || document.querySelector('.dialog-backdrop, .palette-backdrop')) return;
      if (e.key === '/') { e.preventDefault(); byId('assistant'); }
      else if (e.key === '?') { e.preventDefault(); byId('help'); }
      else if (/^[1-5]$/.test(e.key)) byId(`tab-${TABS[Number(e.key) - 1].id}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const importText = (text: string, fileName: string) => {
    try {
      const { project: p, rawParts, translated } = importLua(text, fileName);
      replace(p);
      setTab('route');
      const kept = rawParts.length
        ? `${fileName} importé. Conservé en Lua brut : ${rawParts.join(', ')}.`
        : `${fileName} importé entièrement dans l'éditeur.`;
      notify(translated.length ? `${kept} Converti (script SnowBot) : ${translated.join(' · ')}.` : kept);
    } catch (e) {
      notify(`Import impossible (${fileName}) : ${(e as Error).message}`, true);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Script<span>Gen</span></strong>
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => update((p) => { p.name = e.target.value; })}
          title="Nom du projet"
        />
        <label className="field inline">
          <span>Fichier</span>
          <input
            value={project.fileName}
            size={18}
            onChange={(e) => update((p) => { p.fileName = e.target.value; })}
          />
        </label>
        <div className="segmented" title="Valeurs proposées pour les nouvelles étapes">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={project.mode === m.id ? 'on' : ''}
              onClick={() => update((p) => { p.mode = m.id; })}>{m.label}</button>
          ))}
        </div>
        <span className="spacer" />
        <button type="button" className={`assistant-button${assistantOpen ? ' on' : ''}`} onClick={() => (assistantOpen ? setAssistantOpen(false) : openAssistant())} title="Assistant IA (⌘J ou /)">✨ Assistant</button>
        <button type="button" className="kbd-button" onClick={() => setOverlay('palette')} title="Palette de commandes">⌘K</button>
        <button type="button" onClick={() => { if (confirm('Créer un nouveau projet vide ?')) replace(newProject()); }}>Nouveau</button>
        <button type="button" onClick={() => setDialog('open')} title="⌘O">Ouvrir…</button>
        <button type="button" onClick={saveProject} title="⌘S">Enregistrer</button>
        <button type="button" onClick={() => fileInput.current?.click()} title="⌘I">Importer .lua</button>
        <input
          ref={fileInput}
          type="file"
          accept=".lua,text/plain"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) importText(await file.text(), file.name);
          }}
        />
        <button type="button" className="primary" onClick={exportProject} title="⌘E">⬇ Exporter le .lua</button>
        <button type="button" onClick={() => run(() => api.openFolder('export').then(() => undefined))} title="Ouvrir le dossier d'export">📁</button>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      <main>
        <RouteEditor
          store={store}
          routeName={routeName}
          onRouteChange={setRouteName}
          atelier={(
            <aside className={`floating panel atelier${showPreview ? '' : ' collapsed'}`}>
              <header className="panel-header">
                <h2>Atelier du script <small className="muted">{project.fileName} · {lua.split('\n').length - 1} lignes</small></h2>
                <span className="row">
                  <button type="button" onClick={() => navigator.clipboard.writeText(lua).then(() => notify('Lua copié'))}>Copier</button>
                  <button type="button" className="icon-button" onClick={() => setShowPreview(!showPreview)}>{showPreview ? '–' : '+'}</button>
                </span>
              </header>
              {showPreview && <pre className="lua">{lua.split('\n').map((l, i) => <div key={i}>{l ? highlight(l) : '\u00a0'}</div>)}</pre>}
            </aside>
          )}
        />
        {assistantOpen && (
          <AssistantPanel
            ref={assistant}
            store={store}
            hasKey={hasKey}
            onKeySaved={() => { refreshConfig(); notify('Clé API enregistrée sur ce Mac.'); }}
            onClose={() => setAssistantOpen(false)}
            onApplied={(text) => { setTab('route'); setRouteName('move'); notify(text); }}
          />
        )}
        {tab !== 'route' && (
          <div className="overlay-backdrop" onClick={() => setTab('route')}>
            <div className="overlay-sheet" onClick={(e) => e.stopPropagation()}>
              <header className="panel-header">
                <h2>{TABS.find((t) => t.id === tab)?.label}</h2>
                <button type="button" className="icon-button" onClick={() => setTab('route')} title="Revenir à la carte">✕</button>
              </header>
              {tab === 'params' && <ParamsPanel store={store} />}
              {tab === 'automation' && <AutomationPanel store={store} />}
              {tab === 'bank' && <BankPanel store={store} onOpenRoute={(r) => { setRouteName(r); setTab('route'); }} />}
              {tab === 'script' && <AdvancedPanel store={store} />}
            </div>
          </div>
        )}
      </main>

      {overlay === 'palette' && <CommandPalette commands={commands} onClose={() => setOverlay(null)} />}
      {overlay === 'help' && <ShortcutHelp commands={commands} onClose={() => setOverlay(null)} />}
      {message && <div className={`toast${message.error ? ' error' : ''}`} onClick={() => setMessage(null)}>{message.text}</div>}
      {dialog === 'open' && (
        <OpenDialog
          onClose={() => setDialog(null)}
          onProject={(p) => { replace(p); setDialog(null); notify(`Projet « ${p.name} » ouvert`); }}
          onExample={(text, name) => { importText(text, name); setDialog(null); }}
          onError={(m) => notify(m, true)}
          onSettings={() => setDialog('settings')}
        />
      )}
      {dialog === 'settings' && <SettingsDialog onClose={() => setDialog(null)} onSaved={() => { refreshConfig(); notify('Réglages enregistrés'); }} onError={(m) => notify(m, true)} />}
    </div>
  );
}

function OpenDialog({ onClose, onProject, onExample, onError, onSettings }: {
  onClose: () => void;
  onSettings: () => void;
  onProject: (p: Project) => void;
  onExample: (text: string, name: string) => void;
  onError: (message: string) => void;
}) {
  const [projects, setProjects] = useState<{ name: string; modified: number }[] | null>(null);
  const [examples, setExamples] = useState<string[]>([]);
  useEffect(() => {
    api.listProjects().then(setProjects).catch((e) => { setProjects([]); onError(e.message); });
    api.listExamples().then(setExamples).catch(() => setExamples([]));
    // Chargement une seule fois à l'ouverture de la fenêtre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Ouvrir</h2>
        <h3>Mes projets</h3>
        {projects === null && <p className="muted">Chargement…</p>}
        {projects?.length === 0 && <p className="muted">Aucun projet enregistré pour l'instant.</p>}
        <ul className="file-list">
          {projects?.map((p) => (
            <li key={p.name}>
              <button type="button" onClick={async () => {
                try {
                  const data = (await api.loadProject(p.name)) as Project;
                  if (data?.format !== 'scriptgen-project') throw new Error('Ce fichier n\'est pas un projet ScriptGen');
                  onProject(data);
                } catch (e) {
                  onError((e as Error).message);
                }
              }}
              >{p.name}</button>
              <span className="muted">{new Date(p.modified).toLocaleString('fr-FR')}</span>
            </li>
          ))}
        </ul>
        <h3>Scripts d'exemple (import)</h3>
        <ul className="file-list">
          {examples.map((name) => (
            <li key={name}>
              <button type="button" onClick={async () => {
                try {
                  onExample(await api.loadExample(name), name);
                } catch (e) {
                  onError((e as Error).message);
                }
              }}
              >{name}</button>
            </li>
          ))}
        </ul>
        <div className="row end">
          <button type="button" onClick={onSettings}>Réglages (dossiers, clé IA)…</button>
          <button type="button" onClick={() => api.openFolder('projects').catch((e) => onError(e.message))}>Ouvrir le dossier des projets</button>
          <button type="button" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

function SettingsDialog({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { api.getConfig().then(setConfig).catch((e) => onError(e.message)); }, []);
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Réglages</h2>
        {!config ? <p className="muted">Chargement…</p> : (
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              setConfig(await api.setConfig({ exportDir: config.exportDir, projectsDir: config.projectsDir, ...(apiKey.trim() ? { anthropicApiKey: apiKey.trim() } : {}) }));
              onSaved();
              onClose();
            } catch (err) {
              onError((err as Error).message);
            }
          }}
          >
            <label className="field">
              <span>Dossier d'export des .lua (dossier partagé avec la VM Windows)</span>
              <input className="wide" value={config.exportDir} onChange={(e) => setConfig({ ...config, exportDir: e.target.value })} />
            </label>
            <label className="field">
              <span>Dossier des projets (.json)</span>
              <input className="wide" value={config.projectsDir} onChange={(e) => setConfig({ ...config, projectsDir: e.target.value })} />
            </label>
            <label className="field">
              <span>Clé API Anthropic (assistant IA) — {config.hasAnthropicKey ? 'déjà réglée ; en coller une autre pour la remplacer' : 'pas encore réglée'}</span>
              <input className="wide" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-…" />
            </label>
            {config.hasAnthropicKey && (
              <button type="button" className="small danger" onClick={async () => { setConfig(await api.setConfig({ anthropicApiKey: '' })); onSaved(); }}>Supprimer la clé</button>
            )}
            <p className="muted small">Dans MizanBot (onglet Lua → Charger, ou bibliothèque du Planning), ouvre le .lua depuis ce dossier partagé.
              Un script ajouté au Planning est relu depuis le fichier au début de chaque plage.</p>
            <div className="row end">
              <button type="button" onClick={onClose}>Annuler</button>
              <button type="submit" className="primary">Enregistrer</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
