// Registre des globals de configuration exposés dans l'onglet « Paramètres ».
// Source : API Lua MizanBot, catégorie « Configuration & points d'entrée ».
// L'ordre de ce tableau est l'ordre d'écriture dans le .lua généré.
// Pour ajouter un paramètre : ajouter une entrée ici (voir README, « Ajouter un paramètre »).

export type ParamType =
  | 'number'
  | 'bool'
  | 'string'
  /** Liste d'ElementTypeId (ressources). */
  | 'resources'
  /** Liste de monstres : genericId ou nom. */
  | 'monsters'
  /** Liste de gid d'objets. */
  | 'items'
  /** { {genericId, min, max}, ... } */
  | 'monsterAmounts'
  /** Liste d'heures 0–23. */
  | 'hours';

export type CategoryId = 'bank' | 'gather' | 'fight' | 'regen' | 'security' | 'schedule';

export interface Category {
  id: CategoryId;
  label: string;
}

export const CATEGORIES: Category[] = [
  { id: 'bank', label: 'Poids & banque' },
  { id: 'gather', label: 'Récolte' },
  { id: 'fight', label: 'Combat' },
  { id: 'regen', label: 'Régénération' },
  { id: 'security', label: 'Sécurité' },
  { id: 'schedule', label: 'Horaires & anti-blocage' },
];

export interface ParamDef {
  key: string;
  label: string;
  category: CategoryId;
  type: ParamType;
  /** Valeur appliquée par le bot quand le global est absent (texte de l'API). */
  engineDefault: string;
  /** Valeur proposée quand on active le paramètre. */
  initial: unknown;
  min?: number;
  max?: number;
  unit?: string;
  help: string;
}

export const PARAMS: ParamDef[] = [
  {
    key: 'MAX_PODS', label: 'Seuil de passage en banque', category: 'bank', type: 'number',
    engineDefault: '95', initial: 90, min: 1, max: 100, unit: '% des pods',
    help: 'Au-dessus de ce remplissage, le bot joue bank() au lieu de move(). Lu au démarrage du script.',
  },
  {
    key: 'ELEMENTS_TO_GATHER', label: 'Ressources à récolter', category: 'gather', type: 'resources',
    engineDefault: '{} (toutes les vraies ressources)', initial: [],
    help: 'Liste d\'ElementTypeId. Vide = toutes les vraies ressources (jamais les portes, zaaps ou actions passives).',
  },
  {
    key: 'MIN_MONSTERS', label: 'Taille minimale d\'un groupe', category: 'fight', type: 'number',
    engineDefault: '1', initial: 1, min: 1, max: 8,
    help: 'Taille MIN d\'un groupe de monstres (somme des monstres) pour l\'attaquer.',
  },
  {
    key: 'MAX_MONSTERS', label: 'Taille maximale d\'un groupe', category: 'fight', type: 'number',
    engineDefault: '999 (aucune limite)', initial: 8, min: 1, max: 999,
    help: 'Taille MAX d\'un groupe de monstres pour l\'attaquer.',
  },
  {
    key: 'FORCE_MONSTERS', label: 'Monstres obligatoires', category: 'fight', type: 'monsters',
    engineDefault: '{}', initial: [],
    help: 'Non vide = n\'attaquer QUE les groupes contenant l\'un de ces monstres (noms ou genericId).',
  },
  {
    key: 'FORBIDDEN_MONSTERS', label: 'Monstres interdits', category: 'fight', type: 'monsters',
    engineDefault: '{}', initial: [],
    help: 'Noms ou genericId : un groupe qui contient l\'un d\'eux est ignoré.',
  },
  {
    key: 'MONSTERS_AMOUNT', label: 'Nombre min/max par monstre', category: 'fight', type: 'monsterAmounts',
    engineDefault: '{}', initial: [],
    help: '{ {genericId, min, max}, … } : un groupe qui contient ce monstre est écarté si son nombre est hors [min, max] ; un groupe qui n\'en contient pas n\'est pas concerné.',
  },
  {
    key: 'IGNORE_REQUEST_EXCHANGE', label: 'Refuser les échanges', category: 'security', type: 'bool',
    engineDefault: 'false', initial: true,
    help: 'Refus auto (~1 s) des demandes d\'échange des joueurs hors app ; jamais pendant un dialogue PNJ / banque / HDV / échange.',
  },
  {
    key: 'IGNORE_REQUEST_DUEL', label: 'Refuser les défis (duels)', category: 'security', type: 'bool',
    engineDefault: 'false', initial: true,
    help: 'Refus auto des défis (duels) des joueurs hors app.',
  },
  {
    key: 'IGNORE_REQUEST_GUILD', label: 'Refuser les invitations de guilde', category: 'security', type: 'bool',
    engineDefault: 'false', initial: true,
    help: 'Refus auto (~1–2 s) des invitations de guilde, sauf celles d\'un perso de tes comptes enregistrés.',
  },
  {
    key: 'OPEN_BAGS', label: 'Ouvrir les sacs de ressources', category: 'bank', type: 'bool',
    engineDefault: 'false', initial: true,
    help: 'Pods pleins → ouvre tous les sacs de ressources avant bank() (et même sans bank()).',
  },
  {
    key: 'AUTO_DELETE', label: 'Objets à détruire', category: 'bank', type: 'items',
    engineDefault: 'absent', initial: [],
    help: 'GID détruits quand les pods sont pleins, avant bank() (stacks du sac uniquement, jamais un objet équipé).',
  },
  {
    key: 'MIN_LIFE_PERCENT', label: 'PV minimum avant un combat', category: 'regen', type: 'number',
    engineDefault: '0 (désactivé)', initial: 50, min: 0, max: 100, unit: '%',
    help: 'Avant d\'engager un combat (fight, fightCell, étape fight/forcefight) : régénère si PV% < seuil.',
  },
  {
    key: 'REGEN_UP_TO_PERCENT', label: 'Régénérer jusqu\'à', category: 'regen', type: 'number',
    engineDefault: '100', initial: 100, min: 1, max: 100, unit: '%',
    help: 'Cible de la régénération automatique (jamais sous le seuil déclencheur).',
  },
  {
    key: 'REGEN_FOOD', label: 'Consommables de soin', category: 'regen', type: 'items',
    engineDefault: '{}', initial: [],
    help: 'GID de consommables utilisés d\'abord, dans l\'ordre de la liste (chacun confirmé par la hausse des PV).',
  },
  {
    key: 'REGEN_SIT', label: 'S\'asseoir pendant la régénération', category: 'regen', type: 'bool',
    engineDefault: 'true', initial: true,
    help: 'S\'asseoir pendant l\'attente de régénération (plus rapide).',
  },
  {
    key: 'REGEN_SIT_EMOTE', label: 'Emote pour s\'asseoir', category: 'regen', type: 'number',
    engineDefault: '1', initial: 1, min: 0,
    help: 'Id de l\'emote envoyée pour s\'asseoir.',
  },
  {
    key: 'REGEN_MAX_WAIT', label: 'Attente max de régénération', category: 'regen', type: 'number',
    engineDefault: '600', initial: 600, min: 15, unit: 's',
    help: 'Plafond d\'attente de la régénération automatique (min 15).',
  },
  {
    key: 'FIGHT_LOCK_SPEC', label: 'Bloquer les spectateurs', category: 'fight', type: 'bool',
    engineDefault: 'false', initial: true,
    help: 'À chaque combat : interdit les spectateurs (chef seulement).',
  },
  {
    key: 'FIGHT_LOCK_JOIN', label: 'Fermer le combat aux arrivants', category: 'fight', type: 'bool',
    engineDefault: 'false', initial: true,
    help: 'À chaque combat : ferme le combat aux arrivants (en équipe, attend d\'abord les followers, 8 s max).',
  },
  {
    key: 'FIGHT_LOCK_PARTY', label: 'Combat réservé au groupe', category: 'fight', type: 'bool',
    engineDefault: 'false', initial: true,
    help: 'À chaque combat : combat réservé au groupe.',
  },
  {
    key: 'FIGHT_KICK', label: 'Expulser les étrangers au placement', category: 'fight', type: 'number',
    engineDefault: 'absent (off)', initial: 3000, min: 0, unit: 'ms',
    help: 'Placement : expulse chaque joueur étranger à l\'équipe présent depuis ce délai (permission « Combat auto »).',
  },
  {
    key: 'TURN_TIME_LIMIT', label: 'Budget de onTurn / onPlacement', category: 'fight', type: 'number',
    engineDefault: '20000', initial: 20000, min: 3000, max: 25000, unit: 'ms',
    help: 'Dépassé : le tour est fini d\'office (ou « prêt » envoyé). Lu au démarrage.',
  },
  {
    key: 'MODERATOR_STOP', label: 'Arrêter si un modérateur écrit', category: 'security', type: 'bool',
    engineDefault: 'false', initial: true,
    help: 'Popup de modérateur reçu → arrêt du script à la prochaine itération + planning en pause pour ce perso.',
  },
  {
    key: 'MODERATOR_WEBHOOK', label: 'Webhook Discord (modérateur)', category: 'security', type: 'string',
    engineDefault: 'absent', initial: 'https://discord.com/api/webhooks/…',
    help: 'URL https:// de webhook Discord : tout popup de modérateur y est relayé (permission « Réponse automatique »).',
  },
  {
    key: 'PLANNING', label: 'Heures de déconnexion', category: 'schedule', type: 'hours',
    engineDefault: 'absent', initial: [],
    help: 'Heures (0–23, heure du PC) où le bot se déconnecte ; il se reconnecte à la 1re heure libre et reprend le script.',
  },
  {
    key: 'SNOWBOT_TIMEOUT', label: 'Seuil anti-blocage', category: 'schedule', type: 'number',
    engineDefault: 'réglage du bot (180 s)', initial: 50, min: 10, unit: '× 6 s',
    help: 'En TOURS de 6 s (50 ≈ 5 min). Remplace le réglage anti-blocage du bot le temps du run. Lu au démarrage.',
  },
];

export const PARAM_BY_KEY: Record<string, ParamDef> = Object.fromEntries(PARAMS.map((p) => [p.key, p]));
