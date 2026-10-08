// Télécharge le référentiel des cartes depuis l'API publique DofusDB (api.dofusdb.fr) :
//   public/data/maps.json      [[mapId, x, y, worldMap, subAreaId, outdoor(0/1)], ...]
//   public/data/subareas.json  [[subAreaId, "nom", areaId], ...]
//   public/data/areas.json     [[areaId, "nom"], ...]
// À relancer après une grosse mise à jour de Dofus : npm run maps
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.dofusdb.fr';
const PAGE = 50; // maximum accepté par l'API

async function getJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ScriptGen (outil local, usage personnel)' } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } catch (e) {
    if (attempt >= 5) throw e;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return getJson(url, attempt + 1);
  }
}

async function fetchAll(path, select, map) {
  const first = await getJson(`${API}/${path}?$limit=0`);
  const total = first.total;
  const pages = Math.ceil(total / PAGE);
  const selectQuery = select.map((f) => `&$select[]=${f}`).join('');
  const out = [];
  const CONCURRENCY = 4;
  let next = 0;
  async function worker() {
    while (next < pages) {
      const page = next++;
      const data = await getJson(`${API}/${path}?$limit=${PAGE}&$skip=${page * PAGE}&$sort[id]=1${selectQuery}`);
      out.push(...data.data.map(map));
      if (page % 50 === 0) process.stdout.write(`  ${path} : ${Math.min(total, (page + 1) * PAGE)}/${total}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out.sort((a, b) => a[0] - b[0]);
}

function write(file, data) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data) + '\n');
  console.log(`${file} : ${data.length} entrées`);
}

const frName = (n) => (n && typeof n === 'object' ? n.fr ?? n.en ?? '' : String(n ?? ''));

const maps = await fetchAll(
  'map-positions',
  ['id', 'posX', 'posY', 'worldMap', 'subAreaId', 'outdoor'],
  (m) => [m.id, m.posX, m.posY, m.worldMap, m.subAreaId, m.outdoor ? 1 : 0],
);
write('public/data/maps.json', maps);

const subareas = await fetchAll('subareas', ['id', 'name', 'areaId'], (s) => [s.id, frName(s.name), s.areaId]);
write('public/data/subareas.json', subareas);

const areas = await fetchAll('areas', ['id', 'name'], (a) => [a.id, frName(a.name)]);
write('public/data/areas.json', areas);
