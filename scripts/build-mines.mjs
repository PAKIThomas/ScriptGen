// Construit public/data/mines.json (mines, grottes et souterrains) à partir du catalogue Dofus-Map du
// dépôt de référence limposteur/mizan_script (public/worldmap/data/dofus-map-groups.json) :
// salles de chaque groupe Dofus-Map, id de carte de chaque salle (graphe du monde DDC), ressources,
// entrées depuis le Continent / Incarnam et sorties. Les images restent sur les tuiles publiques Dofus-Map.
// Usage : node scripts/build-mines.mjs <chemin/vers/dofus-map-groups.json>
import fs from 'node:fs';
import path from 'node:path';

const [, , source] = process.argv;
if (!source) {
  console.error('Usage : node scripts/build-mines.mjs <dofus-map-groups.json>');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(source, 'utf8'));
/** Groupes Dofus-Map → calque ScriptGen (id du monde DofusDB). Les groupes 2 à 5 sont des dimensions (calques). */
const PARENT_WORLD = { 0: 1, 1: 2 };
const round = (v) => Math.round(v * 100) / 100;
// Référentiel des cartes (npm run maps) : [id, x, y, monde, sous-zone, extérieur].
const maps = new Map(JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'public', 'data', 'maps.json'), 'utf8')).map((m) => [m[0], m]));
/** Une salle n'est gardée que si son id existe et n'est pas une carte d'extérieur du Continent (rapprochement douteux). */
const trusted = (mapId) => maps.has(mapId) && !(maps.get(mapId)[3] === 1 && maps.get(mapId)[5] === 1);
let dropped = 0;

const groups = data.groups.filter((g) => g.id > 5 && g.cells.length);
const ids = new Set(groups.map((g) => g.id));
const entrances = [];
for (const parent of data.groups.filter((g) => g.id in PARENT_WORLD)) {
  for (const m of parent.markers) {
    if (ids.has(m.groupId)) entrances.push({ world: PARENT_WORLD[parent.id], x: round(m.x), y: round(m.y), group: m.groupId });
  }
}
const out = {
  source: `${data.source} — via limposteur/mizan_script (salles → id de carte : ${data.mapIdSource ?? 'graphe du monde'})`,
  tileTemplate: data.tileTemplate,
  mapWidth: data.mapWidth,
  mapHeight: data.mapHeight,
  maxZoom: data.maxZoom,
  entrances,
  groups: groups.map((g) => ({
    id: g.id,
    name: g.name,
    parent: g.parentId,
    minZoom: g.minZoom,
    lastChanged: g.lastChanged,
    cells: g.cells,
    rooms: (g.rooms ?? []).filter((r) => trusted(r.mapId) || (dropped++, false)).map((r) => ({
      x: r.cellX, y: r.cellY, mapId: r.mapId,
      res: (r.resources ?? []).map((x) => [x.name?.fr ?? String(x.id), x.n]),
    })),
    // Liens visibles sur l'image : vers une autre grotte (type 1) ou la sortie (vers le groupe parent).
    links: g.markers.map((m) => ({ x: round(m.x), y: round(m.y), group: m.groupId, title: m.title })),
  })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
};
const file = path.resolve(import.meta.dirname, '..', 'public', 'data', 'mines.json');
fs.writeFileSync(file, `${JSON.stringify(out)}\n`);
console.log(`${file} : ${out.groups.length} groupes, ${out.entrances.length} entrées, ${dropped} salles écartées (id inconnu ou douteux).`);
