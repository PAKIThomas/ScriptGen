// Planificateur de l'IA locale. Une petite IA locale traduit très bien une phrase en « intention »
// (paliers, noms de zones, de monstres, d'objets…) mais mène mal une longue enquête outil par outil.
// Donc : l'IA ne produit que l'intention (un seul appel, sortie JSON imposée par schéma), et ce module
// la résout de façon déterministe avec les données locales : noms → ids, zone choisie selon le niveau,
// boucle de cartes voisines, banque la plus proche. Le plan obtenu passe ensuite la même vérification.

export const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const words = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
/** La recherche doit commencer un mot (« blé » ne trouve pas « taBLE »). */
export const matches = (name, query) => {
  const q = words(query);
  return !q || ` ${words(name)}`.includes(` ${q}`);
};
export const resourceKey = (name) => fold(name).replace(/^bois d(e |')/, '');
/** Monde d'une sous-zone : celui de ses cartes d'extérieur (les intérieurs sont rangés à part, monde -1). */
export const zoneWorld = (maps) => {
  const counts = new Map();
  for (const m of maps) if (m[5] === 1 || m[3] > 0) counts.set(m[3], (counts.get(m[3]) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? maps[0]?.[3] ?? null;
};

const JOBS = [
  [2, 'Bûcheron'], [24, 'Mineur'], [26, 'Alchimiste'], [28, 'Paysan'], [36, 'Pêcheur'], [41, 'Chasseur'],
];
const STATS = ['vitality', 'wisdom', 'strength', 'intelligence', 'chance', 'agility'];

// ── Ce que l'IA locale doit produire ────────────────────────────────────────
export const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    job: { type: 'string', description: 'Métier à monter (Bûcheron, Mineur, Paysan, Alchimiste, Pêcheur) ; vide pour monter le personnage.' },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from_level: { type: 'integer' },
          to_level: { type: 'integer' },
          zone: { type: 'string', description: 'Nom de zone tel que l\'utilisateur l\'a écrit (ex. « Pâturages », « Astrub », « Champs d\'Astrub ») ; vide s\'il n\'en donne pas.' },
          incarnam: { type: 'boolean', description: 'true si la phase se passe à Incarnam.' },
          activity: { type: 'string', enum: ['fight', 'gather', 'both'] },
          monsters: { type: 'array', items: { type: 'string' } },
          avoid_monsters: { type: 'array', items: { type: 'string' } },
          resources: { type: 'array', items: { type: 'string' } },
        },
        required: ['from_level', 'to_level', 'activity'],
      },
    },
    equip: {
      type: 'array',
      items: { type: 'object', properties: { item: { type: 'string' }, level: { type: 'integer' } }, required: ['item'] },
    },
    auto_stuff: { type: 'boolean' },
    auto_stat: { type: 'string', enum: ['', ...STATS] },
    bank: { type: 'string', description: 'Ville de la banque (Astrub, Amakna, Bonta…), « proche » pour la plus proche, vide sinon.' },
  },
  required: ['phases'],
};

export const INTENT_SYSTEM = `Tu traduis la demande d'un joueur de Dofus en une intention JSON pour un générateur de scripts MizanBot.
Réponds UNIQUEMENT avec le JSON demandé, sans texte autour. Recopie les noms (zones, monstres, objets, ressources) tels que le joueur les écrit ; n'invente rien qu'il n'a pas dit.

- phases : une phase par tranche de niveaux, dans l'ordre (la première commence au niveau 1). « de 1 à 10 à Incarnam puis Astrub jusqu'à 20 » → deux phases : 1–10 (zone "Incarnam", incarnam true) et 11–20 (zone "Astrub").
- activity : "fight" pour combattre, "gather" pour récolter, "both" pour les deux.
- monsters : monstres à combattre en priorité ; avoid_monsters : monstres à éviter ; resources : ressources à récolter (blé, frêne, fer…).
- job : le métier s'il s'agit de monter un métier (les niveaux sont alors ceux du métier), sinon vide.
- equip : objets à équiper, avec le niveau du personnage à partir duquel les équiper s'il est donné.
- auto_stuff : true si le joueur veut équiper automatiquement les objets du sac / le meilleur équipement.
- auto_stat : caractéristique où investir les points si demandé (vitality = vitalité, wisdom = sagesse, strength = force, intelligence, chance, agility = agilité).
- bank : ville de la banque si demandée, "proche" s'il veut une banque sans préciser.
Pour une modification d'un script existant, renvoie SEULEMENT ce qu'elle ajoute ou change : par exemple « ajoute 21 à 30 en Forêt d'Amakna et investis en vitalité » → {"phases":[{"from_level":21,"to_level":30,"zone":"Forêt d'Amakna","activity":"fight"}],"auto_stat":"vitality"} ; « investis en sagesse » → {"phases":[],"auto_stat":"wisdom"}.

Exemple : « Monte mon perso de 1 à 20 : Incarnam jusqu'à 10 dans les Pâturages, puis les Bouftous d'Astrub. Équipe la Coiffe du Bouftou au niveau 20 et le reste automatiquement. »
→ {"name":"Leveling 1-20","phases":[{"from_level":1,"to_level":10,"zone":"Pâturages","incarnam":true,"activity":"fight"},{"from_level":11,"to_level":20,"zone":"Astrub","activity":"fight","monsters":["Bouftou"]}],"equip":[{"item":"Coiffe du Bouftou","level":20}],"auto_stuff":true}`;

// ── Résolution déterministe ─────────────────────────────────────────────────
const zoneInfo = (d, id) => {
  const maps = d.mapsBySub.get(id) ?? [];
  return {
    id,
    name: d.subNames.get(id)?.name ?? `#${id}`,
    area: d.areaNames.get(d.subNames.get(id)?.area) ?? '',
    level: d.subInfo.get(id)?.level ?? 0,
    world: zoneWorld(maps),
    // Cartes d'extérieur, une par coordonnée (certaines zones empilent plusieurs cartes au même x,y).
    outdoor: [...new Map(maps.filter((m) => m[5] === 1).map((m) => [`${m[1]},${m[2]}`, m])).values()],
    monsters: d.subInfo.get(id)?.monsters ?? [],
  };
};

/** Zone la mieux adaptée : nom exact > début de nom > zone (area) ; départage par niveau conseillé. */
function findZone(d, name, { level, world, fight, monsters = [] }) {
  const all = [...d.subNames.keys()].map((id) => zoneInfo(d, id)).filter((z) => z.outdoor.length >= 2 && (world === undefined || z.world === world));
  // Plus petit = mieux : niveau proche, monstres demandés présents, zone assez grande pour une boucle.
  const fit = (z) => Math.abs(z.level - level) + (fight && !z.monsters.length ? 100 : 0) + (z.outdoor.length < 6 ? 20 : 0)
    - (monsters.some((id) => z.monsters.includes(id)) ? 50 : 0);
  const best = (list) => [...list].sort((a, b) => fit(a) - fit(b))[0];
  if (name) {
    const exact = all.filter((z) => fold(z.name) === fold(name));
    if (exact.length) return { zone: best(exact) };
    const byName = all.filter((z) => matches(z.name, name));
    if (byName.length) return { zone: best(byName) };
    const byArea = all.filter((z) => matches(z.area, name));
    if (byArea.length) return { zone: best(byArea), chosen: true };
    return { zone: null };
  }
  // Sans nom : une vraie zone de jeu (assez de cartes d'extérieur, des monstres si on combat) du bon niveau.
  const byLevel = all.filter((z) => z.outdoor.length >= 8 && buildLoop(z).length >= 6 && z.level >= 1 && z.level <= Math.max(level, 1) + 5 && (!fight || z.monsters.length) && (world !== undefined || z.world === 1));
  return { zone: best(byLevel.length ? byLevel : all.filter((z) => buildLoop(z).length >= 6)), chosen: true };
}

/** Boucle compacte de cartes voisines (au plus `max`), en partant du centre de la zone. */
export function buildLoop(zone, max = 16) {
  const byCoords = new Map();
  for (const m of zone.outdoor) if (!byCoords.has(`${m[1]},${m[2]}`)) byCoords.set(`${m[1]},${m[2]}`, m);
  const maps = [...byCoords.values()];
  if (!maps.length) return [];
  const cx = maps.reduce((s, m) => s + m[1], 0) / maps.length;
  const cy = maps.reduce((s, m) => s + m[2], 0) / maps.length;
  const start = [...maps].sort((a, b) => Math.hypot(a[1] - cx, a[2] - cy) - Math.hypot(b[1] - cx, b[2] - cy))[0];
  // Ensemble connexe autour du départ (parcours en largeur).
  const chosen = new Map([[`${start[1]},${start[2]}`, start]]);
  const queue = [start];
  while (queue.length && chosen.size < max) {
    const m = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${m[1] + dx},${m[2] + dy}`;
      if (byCoords.has(k) && !chosen.has(k) && chosen.size < max) {
        chosen.set(k, byCoords.get(k));
        queue.push(byCoords.get(k));
      }
    }
  }
  // Ordre de passage : toujours vers une carte voisine non visitée si possible, sinon la plus proche.
  const left = new Map(chosen);
  const order = [start];
  left.delete(`${start[1]},${start[2]}`);
  while (left.size) {
    const cur = order[order.length - 1];
    const next = [...left.values()].sort((a, b) => (Math.abs(a[1] - cur[1]) + Math.abs(a[2] - cur[2])) - (Math.abs(b[1] - cur[1]) + Math.abs(b[2] - cur[2])))[0];
    order.push(next);
    left.delete(`${next[1]},${next[2]}`);
  }
  return order;
}

const monsterIds = (d, name) => [...d.monsterNames].filter(([, n]) => fold(n) === fold(name)).map(([id]) => id)
  .concat([...d.monsterNames].filter(([, n]) => fold(n) !== fold(name) && matches(n, name)).map(([id]) => id));

function findItem(d, name) {
  const exact = d.equipment.filter((i) => fold(i.name) === fold(name));
  if (exact.length) return exact.sort((a, b) => a.level - b.level)[0];
  const q = words(name).split(' ');
  return d.equipment.filter((i) => q.every((w) => ` ${words(i.name)}`.includes(` ${w}`))).sort((a, b) => a.level - b.level)[0];
}

/** Intention (sortie de l'IA locale) → plan ScriptGen + résumé + points à valider. */
export function resolveIntent(d, intent) {
  const notes = [];
  const summary = [];
  const jobEntry = intent.job ? JOBS.find(([, n]) => matches(n, intent.job) || matches(intent.job, n)) : null;
  if (intent.job && !jobEntry) notes.push(`Métier « ${intent.job} » non reconnu : paliers sur le niveau du personnage.`);
  const raw = [...(intent.phases ?? [])].filter((p) => p && Number.isFinite(p.from_level)).sort((a, b) => a.from_level - b.from_level);
  // Une longue tranche sans zone ni cible (« de 1 à 50 ») : un palier tous les 10 niveaux, zone choisie à chaque fois.
  const phases = raw.flatMap((p) => {
    const open = !p.zone && !p.incarnam && !p.monsters?.length && !p.resources?.length && !intent.job;
    if (!open || !(p.to_level - p.from_level > 15)) return [p];
    const out = [];
    for (let from = p.from_level; from <= p.to_level; from += 10) out.push({ ...p, from_level: from, to_level: Math.min(p.to_level, from + 9) });
    return out;
  });
  if (!phases.length) throw new Error('Je n\'ai pas compris quels niveaux ou quelles zones tu veux : précise par exemple « de 1 à 10 à Incarnam ».');

  const brackets = [];
  let firstZone = null;
  let anyGather = false;
  phases.forEach((ph, i) => {
    const from = i === 0 ? 1 : Math.max(ph.from_level, (brackets[i - 1]?.min_level ?? 0) + 1);
    const fight = ph.activity !== 'gather';
    const gather = ph.activity !== 'fight';
    anyGather ||= gather;
    const incarnam = ph.incarnam || matches(ph.zone ?? '', 'incarnam');
    const world = incarnam ? 2 : undefined;
    const zoneName = incarnam && matches(ph.zone ?? '', 'incarnam') ? '' : ph.zone;

    // Ressources → ids de récolte ; sans zone donnée, la zone où elles poussent le plus.
    const gatherIds = [];
    const resourceZones = new Map();
    for (const r of ph.resources ?? []) {
      const it = d.interactives.find(([, n]) => fold(n) === fold(r)) ?? d.interactives.find(([, n]) => matches(n, r));
      if (!it) { notes.push(`Ressource « ${r} » introuvable.`); continue; }
      gatherIds.push(it[0]);
      const res = d.resources?.resources.find((x) => resourceKey(x.name) === resourceKey(it[1]));
      for (const [w, cells] of Object.entries(d.resources?.positions[res?.id] ?? {})) {
        if (world !== undefined && Number(w) !== world) continue;
        for (const [x, y, n] of cells) {
          const m = Number(w) === 1 ? d.outdoorByCoords.get(`${x},${y}`) : null;
          if (m) resourceZones.set(m[4], (resourceZones.get(m[4]) ?? 0) + n);
        }
      }
    }

    // Monstres demandés : sans zone donnée, la zone où ils vivent qui correspond le mieux au niveau.
    const wanted = (ph.monsters ?? []).map((n) => ({ name: n, ids: monsterIds(d, n) }));
    for (const w of wanted) if (!w.ids.length) notes.push(`Monstre « ${w.name} » introuvable.`);

    let zone = null;
    if (zoneName || world !== undefined) {
      const r = findZone(d, zoneName, { level: from, world, fight, monsters: wanted.flatMap((w) => w.ids) });
      zone = r.zone;
      if (!zone) notes.push(`Zone « ${zoneName} » introuvable : choisie d'après le niveau.`);
      else if (r.chosen) notes.push(`Palier ${i + 1} : zone choisie dans « ${zoneName || 'Incarnam'} » : ${zone.name} (niveau ${zone.level}).`);
    }
    if (!zone && wanted.some((w) => w.ids.length)) {
      const subs = new Set(wanted.flatMap((w) => w.ids.flatMap((id) => d.subsByMonster.get(id) ?? [])));
      const cands = [...subs].map((id) => zoneInfo(d, id)).filter((z) => z.outdoor.length >= 2 && (world === undefined || z.world === world));
      zone = cands.sort((a, b) => Math.abs(a.level - from) - Math.abs(b.level - from))[0] ?? null;
      if (zone) notes.push(`Palier ${i + 1} : zone choisie où vivent ces monstres : ${zone.name} (niveau ${zone.level}).`);
    }
    if (!zone && resourceZones.size) {
      const best = [...resourceZones].sort((a, b) => b[1] - a[1]).map(([id]) => zoneInfo(d, id)).find((z) => z.outdoor.length >= 2);
      if (best) { zone = best; notes.push(`Palier ${i + 1} : zone choisie où ces ressources sont les plus nombreuses : ${zone.name}.`); }
    }
    if (!zone) {
      zone = findZone(d, '', { level: from, world, fight }).zone;
      if (zone) notes.push(`Palier ${i + 1} : aucune zone précisée, choisie pour le niveau ${from} : ${zone.name} (niveau ${zone.level}).`);
    }
    if (!zone) throw new Error(`Aucune zone trouvée pour le palier ${from}–${ph.to_level}.`);
    firstZone ??= zone;

    const mandatory = [];
    for (const w of wanted) {
      const inZone = w.ids.filter((id) => zone.monsters.includes(id));
      if (inZone.length) mandatory.push(...inZone);
      else if (w.ids.length) notes.push(`« ${w.name} » ne vit pas dans ${zone.name} : non ciblé dans ce palier.`);
    }
    const forbidden = (ph.avoid_monsters ?? []).flatMap((n) => {
      const ids = monsterIds(d, n).filter((id) => zone.monsters.includes(id));
      return ids.length ? ids : monsterIds(d, n).slice(0, 3);
    });

    const loop = buildLoop(zone);
    const steps = loop.map((m) => ({
      map: zone.world === 1 ? `${m[1]},${m[2]}` : m[0],
      ...(fight ? { fight: true } : {}),
      ...(gather ? { gather: true } : {}),
    }));
    const name = `${zone.name} (${from}–${ph.to_level})`;
    brackets.push({
      name,
      min_level: from,
      steps,
      ...(gatherIds.length ? { gather_list: [...new Set(gatherIds)] } : {}),
      ...(mandatory.length ? { mandatory_monsters: [...new Set(mandatory)] } : {}),
      ...(forbidden.length ? { forbidden_monsters: [...new Set(forbidden)] } : {}),
    });
    const what = [fight && (mandatory.length ? `combat (${wanted.map((w) => w.name).join(', ')})` : 'combat'), gather && 'récolte'].filter(Boolean).join(' + ');
    summary.push(`• Niveaux ${from}–${ph.to_level} : ${zone.name}${zone.area ? ` (${zone.area})` : ''}, ${steps.length} cartes en boucle, ${what}.`);
  });

  const equip = [];
  for (const e of intent.equip ?? []) {
    const item = findItem(d, e.item);
    if (!item) { notes.push(`Objet « ${e.item} » introuvable.`); continue; }
    let level = Number.isInteger(e.level) ? e.level : item.level;
    if (item.level > level) { notes.push(`${item.name} demande le niveau ${item.level} : équipé au niveau ${item.level}.`); level = item.level; }
    equip.push({ level: Math.max(1, level), gid: item.gid });
    summary.push(`• Équiper ${item.name} au niveau ${Math.max(1, level)}.`);
  }
  if (intent.auto_stuff) summary.push('• À chaque niveau : équipe automatiquement le meilleur équipement du sac.');

  let bank;
  const bankWish = fold(intent.bank ?? '');
  if (bankWish && !/^(aucune?|non|pas)$/.test(bankWish)) {
    const named = /proche|auto/.test(bankWish) ? null : d.banks.find((b) => matches(b.zone, intent.bank) || fold(b.zone).includes(bankWish));
    const near = () => {
      const ref = firstZone?.world === 1 ? firstZone.outdoor : d.outdoorByCoords.get('4,-18') ? [d.outdoorByCoords.get('4,-18')] : [];
      const cx = ref.reduce((s, m) => s + m[1], 0) / (ref.length || 1);
      const cy = ref.reduce((s, m) => s + m[2], 0) / (ref.length || 1);
      return [...d.banks].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    };
    const b = named ?? near();
    if (!named && !/proche|auto/.test(bankWish)) notes.push(`Banque « ${intent.bank} » introuvable : banque la plus proche (${b.zone}).`);
    bank = b.mapId;
    summary.push(`• Banque : ${b.zone}.`);
  } else if (anyGather) {
    notes.push('Pas de banque : quand les pods sont pleins, le script continue sans déposer (ajoute « banque d\'Astrub » par exemple).');
  }

  const maxLevel = Math.max(...phases.map((p) => p.to_level ?? 0));
  const plan = {
    name: intent.name || (jobEntry ? `${jobEntry[1]} ${1}-${maxLevel}` : `Leveling 1-${maxLevel}`),
    level_source: jobEntry ? { kind: 'job', job_id: jobEntry[0] } : brackets.length > 1 || maxLevel < 200 ? { kind: 'character' } : { kind: 'none' },
    brackets,
    ...(equip.length ? { equip } : {}),
    ...(intent.auto_stuff ? { auto_stuff: true } : {}),
    ...(STATS.includes(intent.auto_stat) ? { auto_stat: intent.auto_stat } : {}),
    ...(maxLevel > 0 && maxLevel < 200 ? { stop_at_level: maxLevel } : {}),
    ...(bank !== undefined ? { bank_map_id: bank } : {}),
    to_validate: notes,
  };
  plan.file_name = fold(plan.name).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'script';
  if (plan.stop_at_level) summary.push(`• Arrêt du script au niveau ${plan.stop_at_level}${jobEntry ? ` de ${jobEntry[1]}` : ''}.`);
  return { plan, summary: summary.join('\n') };
}

/**
 * Applique une modification (intention partielle renvoyée par l'IA) à l'intention actuelle :
 * une phase nouvelle remplace la partie des phases existantes qu'elle recouvre ; même tranche = champs fusionnés ;
 * équipements ajoutés ou remplacés par nom ; les autres champs ne changent que s'ils sont donnés.
 */
export function mergeIntent(current, change) {
  if (!current) return change;
  const out = structuredClone(current);
  for (const [k, v] of Object.entries(change ?? {})) {
    if (k === 'phases' || k === 'equip' || v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  let phases = out.phases ?? [];
  for (const p of change?.phases ?? []) {
    if (!Number.isFinite(p?.from_level) || !Number.isFinite(p?.to_level)) continue;
    const same = phases.find((q) => q.from_level === p.from_level && q.to_level === p.to_level);
    if (same) { Object.assign(same, Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== ''))); continue; }
    phases = phases.flatMap((q) => {
      if (q.to_level < p.from_level || q.from_level > p.to_level) return [q];
      const parts = [];
      if (q.from_level < p.from_level) parts.push({ ...q, to_level: p.from_level - 1 });
      if (q.to_level > p.to_level) parts.push({ ...q, from_level: p.to_level + 1 });
      return parts;
    });
    phases.push(p);
  }
  out.phases = phases.sort((a, b) => a.from_level - b.from_level);
  for (const e of change?.equip ?? []) {
    out.equip = (out.equip ?? []).filter((x) => fold(x.item) !== fold(e.item));
    out.equip.push(e);
  }
  return out;
}

/**
 * Garde-fou : les tranches de niveaux écrites dans la demande (« 21 à 30 », « 1-10 », « du niveau 5 au niveau 15 »)
 * priment sur la lecture de l'IA, qui se trompe parfois sur un nombre. Corrige aussi une tranche à l'envers.
 */
export function repairIntent(intent, text) {
  const ranges = [...String(text).matchAll(/(\d{1,3})\s*(?:à|a|-|–|—|au(?: niveau)?|jusqu'(?:à|au)(?: niveau)?)\s*(?:niveau\s*)?(\d{1,3})/gi)]
    .map((m) => [Number(m[1]), Number(m[2])]).filter(([a, b]) => a < b && b <= 200);
  for (const p of intent?.phases ?? []) {
    const r = ranges.find(([a]) => a === p.from_level);
    if (r && p.to_level !== r[1]) p.to_level = r[1];
    if (Number.isFinite(p.to_level) && p.to_level < p.from_level) p.to_level = p.from_level + 9;
  }
  return intent;
}

/**
 * Garde-fou : un métier ou une ressource récoltable cités dans la demande mais oubliés par l'IA sont ajoutés
 * (les petites IA locales en perdent parfois). « Or » et « If » sont ignorés : ce sont aussi des mots courants.
 */
export function enrichFromText(d, intent, text) {
  const t = ` ${fold(text).replace(/[^a-z0-9]+/g, ' ')} `;
  if (!intent.job) {
    const job = JOBS.find(([, n]) => t.includes(` ${fold(n)} `));
    if (job) intent.job = job[1];
  }
  const names = (d.resources?.resources ?? []).map((r) => r.name).filter((n) => !['or', 'if'].includes(fold(n)));
  const cited = names.filter((n) => t.includes(` ${fold(n).replace(/[^a-z0-9]+/g, ' ')} `));
  if (cited.length) {
    const phases = intent.phases ?? [];
    const known = new Set(phases.flatMap((p) => p.resources ?? []).map(fold));
    const missing = cited.filter((n) => !known.has(fold(n)));
    const gathering = phases.filter((p) => p.activity !== 'fight');
    if (missing.length && gathering.length && !gathering.some((p) => p.resources?.length)) {
      for (const p of gathering) p.resources = [...missing];
    }
  }
  return intent;
}
