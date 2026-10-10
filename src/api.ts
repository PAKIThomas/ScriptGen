// Appels au serveur local (server/index.mjs).

import type { Plan } from './ai/plan';

export interface AppConfig {
  exportDir: string;
  projectsDir: string;
  /** La clé elle-même ne revient jamais du serveur. */
  hasAnthropicKey?: boolean;
  /** Moteur de l'assistant : IA locale (Ollama) ou Claude (API Anthropic). */
  aiProvider?: 'ollama' | 'claude';
  ollamaUrl?: string;
  ollamaModel?: string;
  ollamaThink?: boolean;
}

export interface AiStatus {
  provider: 'ollama' | 'claude';
  model: string;
  ollama: { running: boolean; hasModel: boolean; models: { name: string; size: number; params?: string }[]; error?: string };
  hasAnthropicKey: boolean;
  pull: { model: string | null; status: string | null; completed: number; total: number; error: string | null; running: boolean };
}

export interface AiReply {
  reply: string;
  plan: Plan | null;
  activity: string[];
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `Erreur ${res.status}`);
  return data as T;
}

export const api = {
  getConfig: () => call<AppConfig>('GET', '/api/config'),
  setConfig: (config: Partial<AppConfig> & { anthropicApiKey?: string }) => call<AppConfig>('PUT', '/api/config', config),
  aiChat: (conversationId: string, message: string, plan: Plan | null) =>
    call<AiReply>('POST', '/api/ai/chat', { conversationId, message, plan }),
  aiStatus: () => call<AiStatus>('GET', '/api/ai/status'),
  aiPull: () => call<{ ok: true }>('POST', '/api/ai/pull'),
  aiReset: (conversationId: string) => call<{ ok: true }>('POST', '/api/ai/reset', { conversationId }),
  exportLua: (fileName: string, content: string) => call<{ path: string }>('POST', '/api/export', { fileName, content }),
  openFolder: (which: 'export' | 'projects') => call<{ ok: true }>('POST', '/api/open-folder', { which }),
  listProjects: () => call<{ name: string; modified: number }[]>('GET', '/api/projects'),
  loadProject: (name: string) => call<unknown>('GET', `/api/projects/${encodeURIComponent(name)}`),
  saveProject: (name: string, project: unknown) =>
    call<{ path: string }>('PUT', `/api/projects/${encodeURIComponent(name)}`, project),
  listExamples: () => call<string[]>('GET', '/api/examples'),
  loadExample: (name: string) => call<string>('GET', `/api/examples/${encodeURIComponent(name)}`),
};
