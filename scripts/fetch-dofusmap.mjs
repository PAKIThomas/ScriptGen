// Récupère une fois, depuis Dofus-Map (https://dofus-map.com), la liste des ressources récoltables et
// leurs positions (nombre par carte) sur le Continent Amaknien et Incarnam → public/data/resources.json,
// plus l'image des icônes ; puis les positions dans les mines (salle par salle).
// Usage : npm run resources (≈ 50 min : Dofus-Map bloque au-delà de 100 requêtes en 5 minutes, on attend
// donc 3,5 s entre deux requêtes). `npm run resources -- --mines-only` ne refait que les mines.
// Mines : on n'interroge que les couples (ressource, mine) où les données du Continent / d'Incarnam
// signalent cette ressource sur une case de la mine (public/data/mines.json, npm run mines).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'https://dofus-map.com';
const out = path.resolve(import.meta.dirname, '..', 'public', 'data');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const headers = { Referer: `${ROOT}/`, 'User-Agent': 'ScriptGen (outil local, import ponctuel)' };

/** Groupes Dofus-Map → calque ScriptGen (id du monde DofusDB). */
const GROUPS = [{ group: 0, world: 1 }, { group: 1, world: 2 }];

// Ordre et métiers du sélecteur de Dofus-Map (ids Dofus-Map, pas les ids du jeu).
const JOB_OF = (id) => (id >= 1 && id <= 22 ? 'Pêcheur'
  : id >= 23 && id <= 35 ? 'Paysan'
    : (id >= 36 && id <= 46) || id === 80 ? 'Alchimiste'
      : id >= 47 && id <= 65 ? 'Bûcheron'
        : id >= 67 && id <= 79 ? 'Mineur' : 'Divers');

/** "4*0:24+-29:-40_1*3:22 27" → [[0,24,4],[-29,-40,4],[3,22,1],[3,27,1]] */
export function parsePositions(text) {
  const body = String(text).replace(/^"|"$/g, '').split('&').slice(2).join('&');
  const cells = [];
  for (const part of body.split('_')) {
    const [count, list] = part.split('*');
    if (!list) continue;
    for (const column of list.split('+')) {
      const [x, ys] = column.split(':');
      for (const y of (ys ?? '').split(' ')) {
        if (y !== '' && Number.isFinite(Number(x)) && Number.isFinite(Number(y))) cells.push([Number(x), Number(y), Number(count)]);
      }
    }
  }
  return cells;
}

const minesOnly = process.argv.includes('--mines-only');
let resources;
let positions;
if (minesOnly) {
  ({ resources, positions } = JSON.parse(fs.readFileSync(path.join(out, 'resources.json'), 'utf8')));
} else {
  const page = await (await fetch(`${ROOT}/`, { headers })).text();
  resources = [...page.matchAll(/data-ressourceId="(\d+)"><div style="background-position:(-?\d+)px (-?\d+)px;"><\/div>([^<]+)</g)]
    .map(([, id, bx, by, name]) => ({ id: Number(id), name: name.trim(), job: JOB_OF(Number(id)), sprite: [Number(bx), Number(by)] }));
  if (!resources.length) throw new Error('Liste des ressources introuvable sur la page Dofus-Map.');

  const sprite = await fetch(`${ROOT}/images/ressourcesSprite.png`, { headers });
  if (sprite.ok) fs.writeFileSync(path.join(out, 'dofusmap-resources.png'), Buffer.from(await sprite.arrayBuffer()));

  positions = {};
  for (const r of resources) {
    positions[r.id] = {};
    for (const { group, world } of GROUPS) {
      await sleep(3500);
      const res = await fetch(`${ROOT}/getRessourceData.php?ressourceId=${r.id}&groupId=${group}`, { headers });
      if (!res.ok) throw new Error(`${r.name} (groupe ${group}) : HTTP ${res.status}`);
      const cells = parsePositions(await res.text());
      if (cells.length) positions[r.id][world] = cells;
    }
    console.log(`${r.name} : ${Object.values(positions[r.id]).reduce((n, c) => n + c.length, 0)} cartes`);
  }
}

// Mines : positions salle par salle.
const minePositions = {};
const minesFile = path.join(out, 'mines.json');
if (fs.existsSync(minesFile)) {
  const mines = JSON.parse(fs.readFileSync(minesFile, 'utf8'));
  const pairs = [];
  for (const g of mines.groups) {
    const cells = new Set(g.cells.map(([x, y]) => `${x},${y}`));
    const world = g.parent === 1 ? 2 : 1;
    for (const r of resources) {
      if ((positions[r.id]?.[world] ?? []).some(([x, y]) => cells.has(`${x},${y}`))) pairs.push([g, r]);
    }
  }
  console.log(`Mines : ${pairs.length} requêtes.`);
  for (const [i, [g, r]] of pairs.entries()) {
    await sleep(3500);
    const res = await fetch(`${ROOT}/getRessourceData.php?ressourceId=${r.id}&groupId=${g.id}`, { headers });
    if (!res.ok) throw new Error(`${r.name} (${g.name}) : HTTP ${res.status}`);
    const cells = parsePositions(await res.text());
    if (cells.length) (minePositions[g.id] ??= {})[r.id] = cells;
    if (i % 25 === 0) console.log(`  ${i + 1}/${pairs.length} ${g.name} · ${r.name} : ${cells.length}`);
  }
}

fs.writeFileSync(path.join(out, 'resources.json'), `${JSON.stringify({
  source: 'https://dofus-map.com/ (getRessourceData)',
  importedAt: new Date().toISOString(),
  sprite: 'dofusmap-resources.png',
  spriteCell: 52,
  resources,
  positions,
  /** id du groupe Dofus-Map (mine) → id ressource → [x, y, nombre] */
  minePositions,
})}\n`);
console.log(`resources.json : ${resources.length} ressources.`);
