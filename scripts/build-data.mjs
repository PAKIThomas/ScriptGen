// Convertit les listes d'identifiants de docs/ en JSON utilisables par l'interface.
//   docs/monstres.txt      -> src/data/monsters.json      [[genericId, "nom"], ...]
//   docs/objets.txt        -> public/data/items.json      (gros fichier, chargé à la demande)
//   docs/interactives.txt  -> src/data/interactives.json  (accents réparés, voir repairAccents)
// Usage : npm run data
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPLACEMENT = '�';

function parseList(file) {
  const text = readFileSync(join(root, file), 'utf8').replace(/^﻿/, '');
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\d+) - (.*)$/.exec(line.trim());
    if (m) out.push([Number(m[1]), m[2].trim()]);
  }
  return out;
}

function write(file, data) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data) + '\n');
}

const monsters = parseList('docs/monstres.txt');
const items = parseList('docs/objets.txt');
const interactives = parseList('docs/interactives.txt');

// interactives.txt a perdu ses accents (caractère U+FFFD). On reconstruit chaque mot
// abîmé à partir du vocabulaire des objets et des monstres : on garde le mot le plus
// fréquent qui a la même forme (les U+FFFD acceptent n'importe quelle lettre accentuée).
const vocabulary = new Map();
for (const [, name] of [...items, ...monsters]) {
  for (const word of name.split(/[\s'’-]+/)) {
    if (!word) continue;
    vocabulary.set(word, (vocabulary.get(word) ?? 0) + 1);
  }
}
// Mots absents (ou ambigus) dans le vocabulaire des objets / monstres.
const MANUAL = {
  'B�cherons': 'Bûcherons',
  'b�cherons': 'bûcherons',
  'p�cheurs': 'pêcheurs',
  'Ar�ne': 'Arène',
  'Koliz�um': 'Kolizéum',
  'M�decin': 'Médecin',
  'H�tel': 'Hôtel',
  'm�tiers': 'métiers',
  '�tabli': 'Établi',
  '�peautre': 'Épeautre',
  '�glise': 'Église',
  '�picerie': 'Épicerie',
  'F�vre': 'Fèvre',
  'M�tier': 'Métier',
  'patin�': 'patiné',
  'h�tel': 'hôtel',
  'blind�e': 'blindée',
  'grin�ante': 'grinçante',
  'si�ge': 'siège',
  'aff�tage': 'affûtage',
  'm�ditative': 'méditative',
  'poss�d�s': 'possédés',
  'Alt�r�': 'Altéré',
  '�': 'à',
};

function repairWord(word) {
  if (!word.includes(REPLACEMENT)) return word;
  if (MANUAL[word]) return MANUAL[word];
  const pattern = new RegExp(
    '^' + word.split(REPLACEMENT).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^\\x00-\\x7F]') + '$',
  );
  let best = null;
  let bestCount = 0;
  for (const [candidate, count] of vocabulary) {
    if (candidate.length === word.length && pattern.test(candidate) && count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best ?? word;
}

let unresolved = 0;
const repairedInteractives = interactives.map(([id, name]) => {
  const fixed = name.replace(/[^\s'’-]+/g, repairWord);
  if (fixed.includes(REPLACEMENT)) unresolved++;
  return [id, fixed];
});

write('src/data/monsters.json', monsters);
write('src/data/interactives.json', repairedInteractives);
write('public/data/items.json', items);

console.log(`monstres : ${monsters.length}, objets : ${items.length}, interactifs : ${interactives.length}`);
if (unresolved) {
  console.warn(`${unresolved} interactif(s) gardent un caractère illisible :`);
  for (const [id, name] of repairedInteractives) if (name.includes(REPLACEMENT)) console.warn(`  ${id} - ${name}`);
}
