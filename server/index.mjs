// Serveur local de ScriptGen : sert l'interface (Vite) et fait ce qu'un navigateur ne peut pas
// faire seul — écrire le .lua dans le dossier partagé, ouvrir ce dossier dans le Finder,
// enregistrer / relire les projets JSON. Écoute uniquement sur 127.0.0.1 (rien n'est exposé).
import express from 'express';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 5317);
const HOST = '127.0.0.1';
const CONFIG_DIR = join(homedir(), '.scriptgen');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  exportDir: join(homedir(), 'ScriptGen', 'export'),
  projectsDir: join(homedir(), 'ScriptGen', 'projets'),
};

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

/** Nom de fichier sûr : jamais de dossier, extension imposée. */
function safeName(name, ext) {
  const base = basename(String(name ?? '')).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  if (!base || base === '.' || base === '..') throw new Error('Nom de fichier invalide');
  return base.toLowerCase().endsWith(ext) ? base : base + ext;
}

function openInFileManager(path) {
  const cmd = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'explorer' : 'xdg-open';
  const child = spawn(cmd, [path], { detached: true, stdio: 'ignore' });
  child.on('error', () => console.log(`(ouvre ${path} à la main)`));
  child.unref();
}

const app = express();
app.use(express.json({ limit: '20mb' }));

const api = express.Router();

api.get('/config', (_req, res) => res.json(loadConfig()));

api.put('/config', (req, res) => {
  const current = loadConfig();
  const next = { ...current };
  for (const key of ['exportDir', 'projectsDir']) {
    if (typeof req.body?.[key] === 'string' && req.body[key].trim()) next[key] = resolve(req.body[key].trim());
  }
  saveConfig(next);
  res.json(next);
});

api.post('/export', async (req, res) => {
  const { exportDir } = loadConfig();
  if (!existsSync(exportDir)) {
    return res.status(400).json({ error: `Le dossier d'export n'existe pas : ${exportDir}` });
  }
  const fileName = safeName(req.body?.fileName, '.lua');
  const path = join(exportDir, fileName);
  await writeFile(path, String(req.body?.content ?? ''), 'utf8');
  res.json({ path });
});

api.post('/open-folder', (req, res) => {
  const config = loadConfig();
  const dir = req.body?.which === 'projects' ? config.projectsDir : config.exportDir;
  if (!existsSync(dir)) return res.status(400).json({ error: `Dossier introuvable : ${dir}` });
  openInFileManager(dir);
  res.json({ ok: true });
});

api.get('/projects', async (_req, res) => {
  const { projectsDir } = loadConfig();
  if (!existsSync(projectsDir)) return res.json([]);
  const names = (await readdir(projectsDir)).filter((n) => n.endsWith('.json'));
  const list = await Promise.all(names.map(async (name) => ({
    name, modified: (await stat(join(projectsDir, name))).mtimeMs,
  })));
  res.json(list.sort((a, b) => b.modified - a.modified));
});

api.get('/projects/:name', async (req, res) => {
  const path = join(loadConfig().projectsDir, safeName(req.params.name, '.json'));
  if (!existsSync(path)) return res.status(404).json({ error: 'Projet introuvable' });
  res.type('json').send(await readFile(path, 'utf8'));
});

api.put('/projects/:name', async (req, res) => {
  const { projectsDir } = loadConfig();
  mkdirSync(projectsDir, { recursive: true });
  const path = join(projectsDir, safeName(req.params.name, '.json'));
  await writeFile(path, JSON.stringify(req.body, null, 2) + '\n', 'utf8');
  res.json({ path });
});

/** Scripts d'exemple du dépôt (exemples/*.lua), pour les importer en un clic. */
api.get('/examples', async (_req, res) => {
  const dir = join(root, 'exemples');
  res.json(existsSync(dir) ? (await readdir(dir)).filter((n) => n.endsWith('.lua')) : []);
});

api.get('/examples/:name', async (req, res) => {
  const path = join(root, 'exemples', safeName(req.params.name, '.lua'));
  if (!existsSync(path)) return res.status(404).json({ error: 'Exemple introuvable' });
  res.type('text/plain').send(await readFile(path, 'utf8'));
});

app.use('/api', api);
app.use('/api', (err, _req, res, _next) => {
  res.status(500).json({ error: err?.message ?? String(err) });
});

const production = process.argv.includes('--prod') && existsSync(join(root, 'dist', 'index.html'));
if (production) {
  app.use(express.static(join(root, 'dist')));
  app.get('*', (_req, res) => res.sendFile(join(root, 'dist', 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`ScriptGen est prêt : ${url}`);
  console.log(`  Export .lua : ${loadConfig().exportDir}`);
  console.log(`  Projets     : ${loadConfig().projectsDir}`);
  if (!process.argv.includes('--no-open')) openInFileManager(url);
});
