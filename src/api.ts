// Appels au serveur local (server/index.mjs).

export interface AppConfig {
  exportDir: string;
  projectsDir: string;
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
  setConfig: (config: Partial<AppConfig>) => call<AppConfig>('PUT', '/api/config', config),
  exportLua: (fileName: string, content: string) => call<{ path: string }>('POST', '/api/export', { fileName, content }),
  openFolder: (which: 'export' | 'projects') => call<{ ok: true }>('POST', '/api/open-folder', { which }),
  listProjects: () => call<{ name: string; modified: number }[]>('GET', '/api/projects'),
  loadProject: (name: string) => call<unknown>('GET', `/api/projects/${encodeURIComponent(name)}`),
  saveProject: (name: string, project: unknown) =>
    call<{ path: string }>('PUT', `/api/projects/${encodeURIComponent(name)}`, project),
  listExamples: () => call<string[]>('GET', '/api/examples'),
  loadExample: (name: string) => call<string>('GET', `/api/examples/${encodeURIComponent(name)}`),
};
