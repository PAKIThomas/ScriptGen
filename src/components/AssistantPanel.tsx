// Panneau « Assistant IA » : on décrit le script en français, Claude (via le serveur local) cherche
// dans les données du jeu et renvoie un plan, appliqué au projet (annulable avec ⌘Z).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { api, type AiStatus } from '../api';
import { applyPlan, projectToPlan, type Plan } from '../ai/plan';
import type { ProjectStore } from '../state';

interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  text: string;
  activity?: string[];
  plan?: Plan | null;
}

const STORE_KEY = 'scriptgen.assistant';
const EXAMPLES = [
  'Monte mon personnage du niveau 1 au niveau 50 : de 1 à 10 à Incarnam, puis Astrub. Équipe automatiquement les objets du sac.',
  'Bûcheron 1 à 40 autour d\'Astrub : frêne puis châtaignier et noyer, banque d\'Astrub.',
  'Paysan : récolte du blé dans les Champs d\'Astrub, puis de l\'orge à partir du niveau 20.',
];

function newConversationId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function loadState(): { id: string; messages: ChatMessage[] } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved?.id && Array.isArray(saved.messages)) return saved;
  } catch { /* stockage indisponible */ }
  return { id: newConversationId(), messages: [] };
}

export interface AssistantHandle {
  focus: () => void;
}

export const AssistantPanel = forwardRef<AssistantHandle, {
  store: ProjectStore;
  status: AiStatus | null;
  onStatusChange: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
  onApplied: (text: string) => void;
}>(({ store, status, onStatusChange, onOpenSettings, onClose, onApplied }, ref) => {
  const [state, setState] = useState(loadState);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const local = status?.provider !== 'claude';
  // Prêt à répondre ? IA locale : Ollama lancé et modèle téléchargé ; Claude : clé réglée.
  const ready = status === null ? true : local ? status.ollama.running && status.ollama.hasModel : status.hasAnthropicKey;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* confort seulement */ }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [state]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  // Pendant un téléchargement de modèle, on relit la progression toutes les 2 s.
  useEffect(() => {
    if (!status?.pull.running) return undefined;
    const timer = window.setInterval(onStatusChange, 2000);
    return () => window.clearInterval(timer);
  }, [status?.pull.running, onStatusChange]);

  const push = (m: ChatMessage) => setState((s) => ({ ...s, messages: [...s.messages, m] }));

  const send = async (text = input) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    push({ role: 'user', text: message });
    setBusy(true);
    try {
      const res = await api.aiChat(state.id, message, projectToPlan(store.project));
      if (res.plan) {
        store.replace(applyPlan(store.project, res.plan));
        onApplied('Projet mis à jour par l\'assistant (⌘Z pour annuler).');
      }
      push({ role: 'assistant', text: res.reply || (res.plan ? 'Plan appliqué.' : '…'), activity: res.activity, plan: res.plan });
    } catch (e) {
      push({ role: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const reset = () => {
    api.aiReset(state.id).catch(() => undefined);
    setState({ id: newConversationId(), messages: [] });
  };

  return (
    <aside className="floating panel assistant-panel">
      <header className="panel-header">
        <h2>✨ Assistant <small className="muted">{local ? `IA locale · ${status?.model ?? ''}` : 'Claude (API)'}</small></h2>
        <span className="row">
          <button type="button" className="small" onClick={reset} disabled={busy} title="Nouvelle conversation">Nouvelle</button>
          <button type="button" className="icon-button" onClick={onClose} title="Fermer (Échap)">✕</button>
        </span>
      </header>

      {status && local && !status.ollama.running && (
        <div className="assistant-key">
          <p className="small">
            <strong>L'IA locale ne répond pas.</strong> Installe <strong>Ollama</strong> (ollama.com/download → macOS), ouvre
            l'application Ollama (icône de lama dans la barre des menus), puis clique « Vérifier ».
          </p>
          <div className="row">
            <button type="button" className="primary" onClick={onStatusChange}>Vérifier</button>
            <button type="button" onClick={onOpenSettings}>Réglages de l'IA…</button>
          </div>
        </div>
      )}
      {status && local && status.ollama.running && !status.ollama.hasModel && (
        <div className="assistant-key">
          <p className="small">
            Ollama est lancé, mais le modèle <code>{status.model}</code> n'est pas encore sur ton Mac. Téléchargement unique
            (quelques Go, plusieurs minutes) — ou dans le Terminal : <code>ollama pull {status.model}</code>.
          </p>
          {status.pull.running && (
            <div className="pull-progress">
              <span className="spinner" /> {status.pull.status}
              {status.pull.total > 0 && ` — ${Math.round((status.pull.completed / status.pull.total) * 100)} % de ${(status.pull.total / 1e9).toFixed(1)} Go`}
              {status.pull.total > 0 && <progress max={status.pull.total} value={status.pull.completed} />}
            </div>
          )}
          {status.pull.error && !status.pull.running && <p className="small" style={{ color: 'var(--danger)' }}>{status.pull.error}</p>}
          <div className="row">
            <button type="button" className="primary" disabled={status.pull.running} onClick={async () => {
              await api.aiPull().catch(() => undefined);
              onStatusChange();
            }}>{status.pull.running ? 'Téléchargement…' : `Télécharger ${status.model}`}</button>
            <button type="button" onClick={onOpenSettings}>Choisir un autre modèle…</button>
          </div>
        </div>
      )}
      {status && !local && !status.hasAnthropicKey && (
        <form className="assistant-key" onSubmit={async (e) => {
          e.preventDefault();
          if (!key.trim()) return;
          await api.setConfig({ anthropicApiKey: key.trim() });
          setKey('');
          onStatusChange();
        }}>
          <p className="small">Mode Claude (API) : colle ta clé API Anthropic (console.anthropic.com → API Keys), ou repasse sur l'IA locale dans les réglages.</p>
          <div className="row">
            <input type="password" className="grow" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" />
            <button type="submit" className="primary">Enregistrer</button>
          </div>
        </form>
      )}

      <div className="assistant-messages" ref={listRef}>
        {state.messages.length === 0 && (
          <div className="assistant-empty">
            <p className="muted small">
              Décris le script voulu : niveaux, zones, monstres, ressources, objets à équiper, banque… L'assistant cherche
              dans les données du jeu, remplit le projet, puis te dit ce qu'il a choisi à ta place. Tu peux ensuite demander
              des modifications (« ajoute un palier 30–40 aux Champs de Cania »).
            </p>
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="assistant-example" onClick={() => send(ex)} disabled={busy || !ready}>{ex}</button>
            ))}
          </div>
        )}
        {state.messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <div className="bubble-text">{m.text}</div>
            {m.plan && (
              <div className="bubble-plan">
                ✔ Projet mis à jour : {m.plan.brackets.length} palier(s), {m.plan.brackets.reduce((n, b) => n + b.steps.length, 0)} cartes
                {m.plan.equip?.length ? `, ${m.plan.equip.length} objet(s) à équiper` : ''}.
              </div>
            )}
            {m.plan?.to_validate?.length ? (
              <div className="bubble-validate">
                <strong>À valider</strong>
                <ul>{m.plan.to_validate.map((v, k) => <li key={k}>{v}</li>)}</ul>
              </div>
            ) : null}
            {m.activity?.length ? (
              <details className="bubble-activity">
                <summary>{m.activity.length} recherche(s) dans les données</summary>
                <ul>{m.activity.map((a, k) => <li key={k}><code>{a}</code></li>)}</ul>
              </details>
            ) : null}
          </div>
        ))}
        {busy && <div className="bubble assistant pending"><span className="spinner" /> L'assistant cherche et construit le script… ({local ? 'IA locale : quelques minutes' : '1 à 3 min'})</div>}
      </div>

      <form className="assistant-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea
          ref={inputRef}
          rows={3}
          value={input}
          disabled={!ready}
          placeholder="Ex. : de 1 à 10 à Incarnam, puis les Bouftous d'Astrub jusqu'au niveau 20, équipe la Coiffe du Bouftou au niveau 20…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="row end">
          <span className="muted small grow">Entrée = envoyer · Maj+Entrée = nouvelle ligne</span>
          <button type="submit" className="primary" disabled={busy || !input.trim() || !ready}>Envoyer</button>
        </div>
      </form>
    </aside>
  );
});
AssistantPanel.displayName = 'AssistantPanel';
