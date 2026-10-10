// Assistant IA de ScriptGen : transforme une demande en français en « plan » de projet (paliers,
// étapes, monstres, équipement…). L'IA — locale via Ollama par défaut, ou Claude (API Anthropic) en
// option — ne rédige jamais le Lua : elle cherche dans les données
// locales (cartes, zones, monstres, objets, ressources, banques) via des outils, propose un plan
// que le serveur VÉRIFIE (chaque id doit exister), puis l'interface le convertit en projet et le
// générateur habituel écrit le script — seules des fonctions de l'API MizanBot peuvent donc y apparaître.
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  enrichFromText, INTENT_SCHEMA, INTENT_SYSTEM, matches, mergeIntent, repairIntent, resolveIntent, resourceKey, zoneWorld,
} from './planner.mjs';

const MODEL = 'claude-opus-5-5';

// ── Données locales (chargées une fois) ─────────────────────────────────────
let data = null;
function loadData(root) {
  if (data) return data;
  const read = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
  const maps = read('public', 'data', 'maps.json'); // [id, x, y, world, subArea, outdoor]
  const subNames = new Map(read('public', 'data', 'subareas.json').map(([id, name, area]) => [id, { name, area }]));
  const areaNames = new Map(read('public', 'data', 'areas.json').map(([id, name]) => [id, name]));
  const subInfo = new Map(read('public', 'data', 'ai', 'subareas.json').map(([id, level, monsters, neighbors]) => [id, { level, monsters, neighbors }]));
  const monsterNames = new Map(read('src', 'data', 'monsters.json'));
  const monsterInfo = new Map(read('public', 'data', 'ai', 'monsters.json').map(([id, min, max, boss]) => [id, { min, max, boss: !!boss }]));
  const itemNames = new Map(read('public', 'data', 'items.json'));
  const itemTypes = new Map(read('public', 'data', 'ai', 'item-types.json'));
  const equipment = read('public', 'data', 'ai', 'items.json').map(([gid, level, type]) => ({ gid, level, type: itemTypes.get(type) ?? '', name: itemNames.get(gid) ?? '' }))
    .filter((i) => i.name);
  const interactives = read('src', 'data', 'interactives.json'); // [elementTypeId, nom]
  const banks = read('public', 'data', 'banks.json');
  let resources = null;
  try { resources = read('public', 'data', 'resources.json'); } catch { /* facultatif */ }

  const byId = new Map(maps.map((m) => [m[0], m]));
  const outdoorByCoords = new Map();
  const mapsBySub = new Map();
  for (const m of maps) {
    if (m[3] === 1 && m[5] === 1) outdoorByCoords.set(`${m[1]},${m[2]}`, m);
    if (!mapsBySub.has(m[4])) mapsBySub.set(m[4], []);
    mapsBySub.get(m[4]).push(m);
  }
  const subsByMonster = new Map();
  for (const [sub, info] of subInfo) {
    for (const mon of info.monsters) {
      if (!subsByMonster.has(mon)) subsByMonster.set(mon, []);
      subsByMonster.get(mon).push(sub);
    }
  }
  data = {
    maps, byId, outdoorByCoords, mapsBySub, subNames, areaNames, subInfo, monsterNames, monsterInfo,
    subsByMonster, equipment, equipByGid: new Map(equipment.map((i) => [i.gid, i])), interactives,
    interactiveIds: new Set(interactives.map(([id]) => id)), banks, resources,
  };
  return data;
}


function zoneSummary(d, id) {
  const n = d.subNames.get(id);
  const info = d.subInfo.get(id);
  const maps = d.mapsBySub.get(id) ?? [];
  return {
    subarea_id: id,
    name: n?.name ?? `#${id}`,
    area: d.areaNames.get(n?.area) ?? '',
    level: info?.level ?? null,
    world: zoneWorld(maps),
    map_count: maps.length,
    outdoor_maps: maps.filter((m) => m[5] === 1).length,
    monsters: (info?.monsters ?? []).slice(0, 10).map((m) => monsterSummary(d, m, false)),
  };
}

function monsterSummary(d, id, withZones = true) {
  const info = d.monsterInfo.get(id);
  const out = { monster_id: id, name: d.monsterNames.get(id) ?? `#${id}`, level_min: info?.min ?? null, level_max: info?.max ?? null };
  if (info?.boss) out.boss = true;
  if (withZones) out.zones = (d.subsByMonster.get(id) ?? []).slice(0, 12).map((s) => ({ subarea_id: s, name: d.subNames.get(s)?.name, level: d.subInfo.get(s)?.level }));
  return out;
}

// ── Outils proposés à Claude ────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'find_zones',
    description: 'Cherche des sous-zones du jeu (par nom et/ou par niveau). Renvoie id, nom, zone, niveau conseillé, monde (1 = Monde des Douze, 2 = Incarnam), nombre de cartes et monstres présents (avec leurs niveaux). Sers-t\'en pour choisir où combattre ou récolter.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nom ou partie du nom (ex. « Astrub », « Champs », « Incarnam »). Vide = toutes.' },
        min_level: { type: 'integer' },
        max_level: { type: 'integer' },
        world: { type: 'integer', description: '1 = Monde des Douze, 2 = Incarnam.' },
      },
    },
  },
  {
    name: 'zone_maps',
    description: 'Liste les cartes d\'une sous-zone, chacune sous la forme [valeur à écrire dans "map", x, y, extérieur 1/0] : "x,y" pour l\'extérieur du Monde des Douze, id numérique pour le reste (Incarnam, intérieurs, mines). Deux cartes voisines ont des x,y qui diffèrent de 1.',
    input_schema: {
      type: 'object',
      properties: { subarea_id: { type: 'integer' }, outdoor_only: { type: 'boolean' } },
      required: ['subarea_id'],
    },
  },
  {
    name: 'find_monsters',
    description: 'Cherche des monstres par nom : id, niveaux, sous-zones où ils vivent.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'find_items',
    description: 'Cherche des équipements (chapeau, cape, amulette, anneau, ceinture, bottes, arme, bouclier, familier, dofus…) par nom : gid, niveau requis, type.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' }, max_level: { type: 'integer' }, type: { type: 'string', description: 'Ex. « Chapeau », « Cape ».' } },
      required: ['query'],
    },
  },
  {
    name: 'find_resources',
    description: 'Cherche une ressource récoltable (blé, frêne, fer…) : id à mettre dans gather_list (ELEMENTS_TO_GATHER), et les sous-zones où elle pousse le plus (données Dofus-Map).',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'list_banks',
    description: 'Banques prédéfinies (carte du banquier) utilisables pour bank_map_id.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'submit_plan',
    description: 'Propose le plan complet du script (remplace le précédent). Le serveur vérifie chaque id : en cas d\'erreur, corrige et renvoie le plan. Appelle-le une fois par demande, puis résume en français ce que tu as fait et ce que l\'utilisateur doit valider.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nom du projet.' },
        file_name: { type: 'string', description: 'Nom du fichier .lua (snake_case).' },
        level_source: {
          type: 'object',
          description: 'Paliers selon le niveau : none (un seul trajet), character (niveau du personnage) ou job (niveau d\'un métier).',
          properties: { kind: { type: 'string', enum: ['none', 'character', 'job'] }, job_id: { type: 'integer' } },
          required: ['kind'],
        },
        brackets: {
          type: 'array',
          description: 'Paliers dans l\'ordre croissant ; le premier commence au niveau 1. Chaque palier = un trajet en boucle.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              min_level: { type: 'integer' },
              gather_list: { type: 'array', items: { type: 'integer' }, description: 'Ids de find_resources (ELEMENTS_TO_GATHER) ; absent = garder le réglage global.' },
              min_monsters: { type: 'integer' },
              max_monsters: { type: 'integer' },
              mandatory_monsters: { type: 'array', items: { type: 'integer' }, description: 'N\'attaquer que les groupes contenant l\'un de ces monstres.' },
              forbidden_monsters: { type: 'array', items: { type: 'integer' } },
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    map: { type: ['string', 'integer'], description: '"x,y" (extérieur du Monde des Douze) ou id de carte.' },
                    fight: { type: 'boolean' },
                    gather: { type: 'boolean' },
                    forcefight: { type: 'boolean', description: 'Combat puis reste sur la carte à attendre des groupes.' },
                    forcegather: { type: 'boolean' },
                    npc_bank: { type: 'boolean' },
                    comment: { type: 'string' },
                  },
                  required: ['map'],
                },
              },
            },
            required: ['name', 'min_level', 'steps'],
          },
        },
        equip: {
          type: 'array',
          description: 'Objets à équiper dès qu\'un niveau du personnage est atteint (gid de find_items).',
          items: { type: 'object', properties: { level: { type: 'integer' }, gid: { type: 'integer' } }, required: ['level', 'gid'] },
        },
        auto_stuff: { type: 'boolean', description: 'inventory:stuff() à chaque niveau : remplit les emplacements vides avec le meilleur équipement du sac.' },
        auto_stat: { type: 'string', enum: ['vitality', 'wisdom', 'strength', 'intelligence', 'chance', 'agility'] },
        stop_at_level: { type: 'integer', description: 'Arrête le script à ce niveau (du personnage, ou du métier si level_source = job).' },
        bank_map_id: { type: ['integer', 'null'], description: 'Banque prédéfinie (list_banks) ou null = pas de banque.' },
        max_pods: { type: 'integer' },
        min_monsters: { type: 'integer', description: 'Global MIN_MONSTERS.' },
        max_monsters: { type: 'integer', description: 'Global MAX_MONSTERS.' },
        open_bags_on_win: { type: 'boolean' },
        to_validate: { type: 'array', items: { type: 'string' }, description: 'Choix faits à ta place que l\'utilisateur doit valider (zones, monstres, objets…).' },
      },
      required: ['name', 'level_source', 'brackets'],
    },
  },
];

const SYSTEM = `Tu es l'assistant de ScriptGen, un éditeur de scripts Lua pour MizanBot (bot pour Dofus).
L'utilisateur décrit en français ce que doit faire son personnage ; tu construis le PLAN du script avec l'outil submit_plan. Tu n'écris jamais de Lua : ScriptGen convertit le plan et génère le script avec les seules fonctions de l'API MizanBot.

Règles :
- Ne jamais inventer un id (carte, sous-zone, monstre, objet, ressource, banque) : utilise toujours les outils de recherche. Si quelque chose est introuvable, dis-le au lieu de deviner.
- Quand la demande ne précise pas une zone, des monstres ou un objet, choisis toi-même d'après les données (niveau conseillé des sous-zones, niveaux des monstres, niveau requis des objets) et liste ces choix dans to_validate.
- Leveling : level_source = character ; un palier par phase (ex. 1–10 à Incarnam, 11–20 à Astrub…). Le premier palier commence au niveau 1 ; le niveau maximum demandé se règle avec stop_at_level.
- Un palier = une boucle de 6 à 25 cartes VOISINES (l'ordre des étapes est l'ordre de passage ; ScriptGen ajoute les sorties entre deux cartes). Prends les cartes d'extérieur de la zone avec zone_maps et forme un circuit compact qui revient près du départ.
- Cartes : "x,y" pour l'extérieur du Monde des Douze ; id numérique pour Incarnam (monde 2), les intérieurs et les mines.
- Combat : fight = true sur les cartes où combattre ; pour viser des monstres précis, mets leurs ids dans mandatory_monsters du palier ; pour en éviter, forbidden_monsters.
- Récolte : gather = true et gather_list (ids de find_resources).
- Équipement : equip [{ level, gid }] avec le gid de find_items ; vérifie que le niveau requis de l'objet ≤ niveau d'équipement. auto_stuff si l'utilisateur veut équiper automatiquement.
- Changement de zone : le bot voyage seul (marche, zaap, havre-sac — jamais de havre-sac à Incarnam) jusqu'aux cartes du nouveau palier ; pas besoin d'étapes de liaison.
- Banque : propose bank_map_id d'une banque prédéfinie proche si le script récolte ou si l'utilisateur le demande.
- Le plan actuel du projet est fourni à chaque message : pour une modification, repars de ce plan et ne change que ce qui est demandé.
- Après submit_plan accepté, réponds en français, en quelques lignes : ce que fait le script, palier par palier, puis les points à valider. Pose une question seulement si la demande est vraiment ambiguë (dans ce cas, n'appelle pas submit_plan).`;

// ── Exécution des outils ────────────────────────────────────────────────────
function runTool(d, name, input) {
  switch (name) {
    case 'find_zones': {
      const out = [];
      for (const [id, n] of d.subNames) {
        const info = d.subInfo.get(id);
        const maps = d.mapsBySub.get(id) ?? [];
        if (!maps.length) continue;
        if (input.query && !matches(n.name, input.query) && !matches(d.areaNames.get(n.area), input.query)) continue;
        if (input.min_level !== undefined && (info?.level ?? 0) < input.min_level) continue;
        if (input.max_level !== undefined && (info?.level ?? 0) > input.max_level) continue;
        if (input.world !== undefined && zoneWorld(maps) !== input.world) continue;
        out.push(zoneSummary(d, id));
      }
      return out.sort((a, b) => (a.level ?? 0) - (b.level ?? 0)).slice(0, 25);
    }
    case 'zone_maps': {
      const maps = (d.mapsBySub.get(input.subarea_id) ?? []).filter((m) => !input.outdoor_only || m[5] === 1);
      const info = d.subInfo.get(input.subarea_id);
      return {
        zone: zoneSummary(d, input.subarea_id),
        neighbors: (info?.neighbors ?? []).map((s) => ({ subarea_id: s, name: d.subNames.get(s)?.name, level: d.subInfo.get(s)?.level })),
        // [à écrire dans le plan, x, y, extérieur(0/1)] — format compact (contexte limité des IA locales).
        maps: maps.slice(0, 200).map(([id, x, y, world, , outdoor]) => [world === 1 && outdoor ? `${x},${y}` : id, x, y, outdoor]),
      };
    }
    case 'find_monsters': {
      const out = [];
      for (const [id, n] of d.monsterNames) if (matches(n, input.query)) out.push(monsterSummary(d, id));
      return out.slice(0, 20);
    }
    case 'find_items':
      return d.equipment
        .filter((i) => matches(i.name, input.query) && (input.max_level === undefined || i.level <= input.max_level) && (!input.type || matches(i.type, input.type)))
        .sort((a, b) => a.level - b.level).slice(0, 25);
    case 'find_resources': {
      const out = [];
      for (const [id, n] of d.interactives) {
        if (!matches(n, input.query)) continue;
        const entry = { gather_id: id, name: n };
        const res = d.resources?.resources.find((r) => resourceKey(r.name) === resourceKey(n));
        if (res) {
          const counts = new Map();
          for (const [world, cells] of Object.entries(d.resources.positions[res.id] ?? {})) {
            for (const [x, y, k] of cells) {
              const m = Number(world) === 1 ? d.outdoorByCoords.get(`${x},${y}`) : d.maps.find((mm) => mm[3] === Number(world) && mm[1] === x && mm[2] === y);
              if (m) counts.set(m[4], (counts.get(m[4]) ?? 0) + k);
            }
          }
          entry.job = res.job;
          entry.best_zones = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([sub, count]) => ({ subarea_id: sub, name: d.subNames.get(sub)?.name, level: d.subInfo.get(sub)?.level, count }));
        }
        out.push(entry);
      }
      return out.slice(0, 15);
    }
    case 'list_banks':
      return d.banks.map((b) => ({ bank_map_id: b.mapId, zone: b.zone, x: b.x, y: b.y }));
    default:
      throw new Error(`Outil inconnu : ${name}`);
  }
}

/** Vérifie le plan : chaque id doit exister. Renvoie la liste des problèmes (vide = accepté). */
export function validatePlan(d, plan) {
  const errors = [];
  const brackets = Array.isArray(plan?.brackets) ? plan.brackets : [];
  if (!brackets.length) errors.push('Aucun palier.');
  const kind = plan?.level_source?.kind;
  if (!['none', 'character', 'job'].includes(kind)) errors.push('level_source.kind invalide.');
  if (kind === 'job' && !Number.isInteger(plan.level_source.job_id)) errors.push('level_source.job_id manquant.');
  let previous = 0;
  brackets.forEach((b, i) => {
    const label = `Palier ${i + 1} (${b?.name ?? '?'})`;
    if (!Number.isInteger(b?.min_level)) errors.push(`${label} : min_level manquant.`);
    else {
      if (i === 0 && b.min_level !== 1) errors.push(`${label} : le premier palier doit commencer au niveau 1.`);
      if (i > 0 && b.min_level <= previous) errors.push(`${label} : min_level doit être croissant.`);
      previous = b.min_level;
    }
    if (!Array.isArray(b?.steps) || !b.steps.length) errors.push(`${label} : aucune étape.`);
    const seen = new Set();
    for (const s of b?.steps ?? []) {
      const key = String(s?.map).trim();
      if (seen.has(key)) errors.push(`${label} : la carte ${key} apparaît deux fois (une seule fois par trajet).`);
      seen.add(key);
      if (typeof s?.map === 'number' || /^\d+$/.test(key)) {
        if (!d.byId.has(Number(key))) errors.push(`${label} : carte id ${key} inconnue.`);
      } else if (/^-?\d+,-?\d+$/.test(key.replace(/\s/g, ''))) {
        if (!d.outdoorByCoords.has(key.replace(/\s/g, ''))) errors.push(`${label} : aucune carte d'extérieur en ${key} (Monde des Douze) — utilise l'id pour les autres mondes.`);
      } else errors.push(`${label} : carte « ${key} » illisible.`);
    }
    for (const id of b?.gather_list ?? []) if (!d.interactiveIds.has(id)) errors.push(`${label} : ressource ${id} inconnue (find_resources).`);
    for (const id of [...(b?.mandatory_monsters ?? []), ...(b?.forbidden_monsters ?? [])]) {
      if (!d.monsterNames.has(id)) errors.push(`${label} : monstre ${id} inconnu (find_monsters).`);
    }
  });
  for (const e of plan?.equip ?? []) {
    const item = d.equipByGid.get(e?.gid);
    if (!item) errors.push(`Équipement : objet ${e?.gid} inconnu (find_items).`);
    else if (item.level > e.level) errors.push(`Équipement : ${item.name} demande le niveau ${item.level}, pas ${e.level}.`);
  }
  if (plan?.bank_map_id != null && !d.banks.some((b) => b.mapId === plan.bank_map_id)) errors.push(`Banque ${plan.bank_map_id} inconnue (list_banks).`);
  return errors;
}

/** Journal de l'assistant dans le Terminal (SCRIPTGEN_AI_DEBUG=1 npm start) : utile pour comprendre un plan raté. */
const debug = (...args) => { if (process.env.SCRIPTGEN_AI_DEBUG) console.log('[assistant]', ...args); };

// ── Conversations (en mémoire, ajout seulement) ─────────────────────────────
const conversations = new Map();

/** Exécute les appels d'outils d'un tour ; renvoie [{ id, name, content, isError }] et met à jour state.plan. */
function handleToolCalls(d, calls, state) {
  return calls.map(({ id, name, input }) => {
    try {
      if (name === 'submit_plan') {
        const errors = validatePlan(d, input);
        state.activity.push(errors.length ? `Plan à corriger (${errors.length} problème(s))` : 'Plan vérifié');
        if (errors.length) return { id, name, isError: true, content: `Plan refusé :\n- ${errors.join('\n- ')}\nCorrige et rappelle submit_plan.` };
        state.plan = input;
        return { id, name, content: 'Plan accepté et appliqué au projet. Résume maintenant en français ce que fait le script et ce qu\'il faut valider.' };
      }
      state.activity.push(`${name} ${JSON.stringify(input)}`);
      return { id, name, content: JSON.stringify(runTool(d, name, input ?? {})) };
    } catch (e) {
      return { id, name, isError: true, content: String(e.message ?? e) };
    }
  });
}

// ── IA locale : Ollama (http://127.0.0.1:11434) ─────────────────────────────
export const OLLAMA_DEFAULTS = { url: 'http://127.0.0.1:11434', model: 'qwen3:8b' };

async function ollama(url, path, body) {
  let res;
  try {
    res = await fetch(`${url}${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Ollama ne répond pas : installe-le (ollama.com/download) et lance l\'application Ollama.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ? `Ollama : ${data.error}` : `Ollama : erreur ${res.status}`);
  return data;
}

export async function ollamaStatus(url) {
  try {
    const tags = await ollama(url, '/api/tags');
    return { running: true, models: (tags.models ?? []).map((m) => ({ name: m.name, size: m.size, params: m.details?.parameter_size })) };
  } catch (e) {
    return { running: false, models: [], error: e.message };
  }
}

/** Téléchargement d'un modèle en tâche de fond (plusieurs Go) ; progression lue par /api/ai/status. */
export const pullState = { model: null, status: null, completed: 0, total: 0, error: null, running: false };

export function ollamaPull(url, model) {
  if (pullState.running) return;
  Object.assign(pullState, { model, status: 'démarrage', completed: 0, total: 0, error: null, running: true });
  (async () => {
    const res = await fetch(`${url}/api/pull`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: true }) });
    if (!res.ok) throw new Error(`Ollama : erreur ${res.status}`);
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const part of res.body) {
      buffer += decoder.decode(part, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line);
        if (chunk.error) throw new Error(`Ollama : ${chunk.error}`);
        pullState.status = chunk.status;
        if (chunk.total) { pullState.total = chunk.total; pullState.completed = chunk.completed ?? 0; }
      }
    }
  })().catch((e) => {
    pullState.error = /fetch failed/.test(e.message) ? 'Ollama ne répond pas : lance l\'application Ollama.' : e.message;
  }).finally(() => {
    pullState.running = false;
  });
}

/**
 * /api/chat en continu (NDJSON) : les premiers octets arrivent tout de suite, donc pas de coupure au bout
 * de 5 min quand l'IA réfléchit longtemps sur un Mac modeste. Renvoie le message complet de l'assistant.
 */
async function ollamaChat(url, body) {
  let res;
  try {
    res = await fetch(`${url}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, stream: true }) });
  } catch {
    throw new Error('Ollama ne répond pas : installe-le (ollama.com/download) et lance l\'application Ollama.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ? `Ollama : ${data.error}` : `Ollama : erreur ${res.status}`);
  }
  const message = { role: 'assistant', content: '', tool_calls: [] };
  const decoder = new TextDecoder();
  let buffer = '';
  const handle = (line) => {
    if (!line.trim()) return;
    const chunk = JSON.parse(line);
    if (chunk.error) throw new Error(`Ollama : ${chunk.error}`);
    message.content += chunk.message?.content ?? '';
    if (chunk.message?.tool_calls) message.tool_calls.push(...chunk.message.tool_calls);
  };
  for await (const part of res.body) {
    buffer += decoder.decode(part, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach(handle);
  }
  handle(buffer);
  if (!message.tool_calls.length) delete message.tool_calls;
  return message;
}

/**
 * IA locale : un seul appel qui traduit la demande en intention JSON (schéma imposé), puis résolution
 * déterministe (planner.mjs) et vérification. Le fil garde la dernière intention pour les modifications.
 */
async function chatOllama({ d, url, model, think: thinkSetting = true, conversationId, message }) {
  const key = `local:${conversationId}`;
  const conv = conversations.get(key) ?? { intent: null };
  conversations.set(key, conv);
  // Modification : un simple rappel des paliers (une IA locale recopierait une intention JSON complète
  // au lieu de la modifier) ; elle ne renvoie que le changement, fusionné ensuite par mergeIntent.
  const recap = conv.intent?.phases?.map((p, i) => `palier ${i + 1} : niveaux ${p.from_level}–${p.to_level}${p.zone ? ` ${p.zone}` : ''}`).join(' ; ');
  const user = conv.intent
    ? `Script actuel : ${recap}.\nModification demandée : ${message}\nRenvoie UNIQUEMENT ce que cette modification ajoute ou change (n'inclus pas les paliers inchangés).`
    : `Demande : ${message}`;
  const call = (think) => ollamaChat(url, {
    model, think, format: INTENT_SCHEMA,
    messages: [{ role: 'system', content: INTENT_SYSTEM }, { role: 'user', content: user }],
    options: { num_ctx: 8192, temperature: 0.1 },
  });
  let reply;
  try {
    reply = await call(thinkSetting);
  } catch (e) {
    if (!(thinkSetting && /think/i.test(e.message))) throw e;
    reply = await call(false); // modèle sans mode « réflexion »
  }
  let intent;
  try {
    intent = mergeIntent(conv.intent, enrichFromText(d, repairIntent(JSON.parse(reply.content), message), message));
  } catch {
    debug('réponse illisible', reply.content.slice(0, 400));
    return { reply: 'Je n\'ai pas compris la demande (réponse de l\'IA illisible). Reformule-la plus simplement.', plan: null, activity: [] };
  }
  debug('réponse', reply.content, '→ intention', JSON.stringify(intent));
  const activity = [`Intention comprise : ${JSON.stringify(intent)}`];
  let resolved;
  try {
    resolved = resolveIntent(d, intent);
  } catch (e) {
    return { reply: e.message, plan: null, activity };
  }
  const errors = validatePlan(d, resolved.plan);
  if (errors.length) {
    debug('plan refusé', errors);
    return { reply: `Le plan obtenu n'est pas valide :\n- ${errors.join('\n- ')}`, plan: null, activity };
  }
  conv.intent = intent;
  activity.push('Plan vérifié');
  return { reply: `Voici le script :\n${resolved.summary}`, plan: resolved.plan, activity };
}

// ── Claude (API Anthropic, en option) ───────────────────────────────────────
async function chatClaude({ d, apiKey, conversationId, message, currentPlan }) {
  const client = new Anthropic({ apiKey });
  const key = `claude:${conversationId}`;
  if (!conversations.has(key)) conversations.set(key, []);
  const messages = conversations.get(key);
  const context = currentPlan ? `Plan actuel du projet (JSON) :\n${JSON.stringify(currentPlan)}` : 'Le projet actuel est vide.';
  messages.push({ role: 'user', content: [{ type: 'text', text: context }, { type: 'text', text: message }] });

  const state = { plan: null, activity: [] };
  for (let turn = 0; turn < 40; turn++) {
    const response = await client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high' },
      cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      tools: TOOLS,
      messages,
    }).finalMessage();
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'refusal') {
      conversations.delete(key); // l'historique peut finir sur un appel d'outil coupé : on repart de zéro
      return { reply: 'La demande a été refusée par le modèle. Reformule-la (la conversation repart de zéro).', plan: state.plan, activity: state.activity };
    }
    if (response.stop_reason === 'pause_turn') continue;
    const uses = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason === 'max_tokens' && uses.length) {
      // Entrée d'outil tronquée : on ne l'exécute pas.
      messages.push({ role: 'user', content: uses.map((u) => ({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'Réponse coupée (trop longue) : propose un plan plus compact.' })) });
      continue;
    }
    if (!uses.length) {
      const reply = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { reply, plan: state.plan, activity: state.activity };
    }
    const results = handleToolCalls(d, uses.map((u) => ({ id: u.id, name: u.name, input: u.input })), state);
    messages.push({ role: 'user', content: results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })) });
  }
  return { reply: 'Trop d\'étapes de recherche : reformule la demande plus simplement.', plan: state.plan, activity: state.activity };
}

/**
 * Un tour de conversation : ajoute la demande (avec le plan actuel), laisse l'IA chercher et
 * proposer, renvoie { reply, plan, activity }. provider = 'ollama' (local, par défaut) ou 'claude'.
 */
export async function chat({ root, provider = 'ollama', apiKey, ollamaUrl, ollamaModel, ollamaThink, conversationId, message, currentPlan }) {
  const d = loadData(root);
  if (provider === 'claude') return chatClaude({ d, apiKey, conversationId, message, currentPlan });
  return chatOllama({
    d, url: ollamaUrl || OLLAMA_DEFAULTS.url, model: ollamaModel || OLLAMA_DEFAULTS.model, think: ollamaThink !== false,
    conversationId, message, currentPlan,
  });
}

export function resetConversation(conversationId) {
  conversations.delete(conversationId);
  conversations.delete(`local:${conversationId}`);
  conversations.delete(`claude:${conversationId}`);
}

export { loadData, runTool };
