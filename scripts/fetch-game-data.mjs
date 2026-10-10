// Données de jeu utilisées par l'assistant IA (API publique DofusDB), en local :
//   public/data/ai/subareas.json  [[subAreaId, niveau, [monstres], [voisines]], ...]
//   public/data/ai/monsters.json  [[monsterId, niveau min, niveau max, boss(0/1)], ...]
//   public/data/ai/items.json     [[gid, niveau, typeId], ...]   (équipements seulement)
//   public/data/ai/item-types.json [[typeId, "nom"], ...]
// Usage : npm run gamedata (quelques minutes).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.dofusdb.fr';
const PAGE = 50;
/** Super-types d'objets équipables (DofusDB) : amulette, arme, anneau, ceinture, bottes, bouclier, chapeau, cape, familier, dofus, compagnon. */
const EQUIP_SUPERTYPES = new Set([1, 2, 3, 4, 5, 7, 10, 11, 12, 13, 23]);

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

async function fetchAll(path, select, map, extra = '') {
  const total = (await getJson(`${API}/${path}?$limit=0${extra}`)).total;
  const pages = Math.ceil(total / PAGE);
  const selectQuery = select.map((f) => `&$select[]=${f}`).join('');
  const out = [];
  let next = 0;
  async function worker() {
    while (next < pages) {
      const page = next++;
      const data = await getJson(`${API}/${path}?$limit=${PAGE}&$skip=${page * PAGE}&$sort[id]=1${selectQuery}${extra}`);
      out.push(...data.data.map(map).filter(Boolean));
      if (page % 50 === 0) console.log(`  ${path} : ${Math.min(total, (page + 1) * PAGE)}/${total}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return out.sort((a, b) => a[0] - b[0]);
}

function write(file, data) {
  const path = join(root, 'public', 'data', 'ai', file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data) + '\n');
  console.log(`${file} : ${data.length} entrées`);
}

const types = await fetchAll('item-types', ['id', 'name', 'superTypeId'], (t) => [t.id, t.name?.fr ?? '', t.superTypeId]);
const equipTypes = new Set(types.filter((t) => EQUIP_SUPERTYPES.has(t[2])).map((t) => t[0]));
write('item-types.json', types.filter((t) => equipTypes.has(t[0])).map(([id, name]) => [id, name]));

write('subareas.json', await fetchAll('subareas', ['id', 'level', 'monsters', 'neighbors'],
  (s) => [s.id, s.level ?? 0, s.monsters ?? [], s.neighbors ?? []]));

write('monsters.json', await fetchAll('monsters', ['id', 'grades', 'isBoss'], (m) => {
  const levels = (m.grades ?? []).map((g) => g.level).filter((l) => typeof l === 'number');
  return levels.length ? [m.id, Math.min(...levels), Math.max(...levels), m.isBoss ? 1 : 0] : null;
}));

write('items.json', await fetchAll('items', ['id', 'level', 'typeId'],
  (i) => (equipTypes.has(i.typeId) ? [i.id, i.level ?? 0, i.typeId] : null)));
