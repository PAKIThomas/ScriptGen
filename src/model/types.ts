// Modèle d'un projet ScriptGen : tout ce qui sert à générer UN fichier .lua.
// Sauvegardé tel quel en JSON (voir server/index.mjs, /api/projects).

/** Valeur Lua littérale. `{ raw }` = expression Lua conservée telle quelle. */
export type LuaValue =
  | string
  | number
  | boolean
  | LuaValue[]
  | { [key: string]: LuaValue }
  | RawLua;

export interface RawLua {
  raw: string;
}

export function isRaw(v: unknown): v is RawLua {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as RawLua).raw === 'string'
    && Object.keys(v as object).length === 1;
}

/**
 * Une étape de trajet : une carte et ce qu'on y fait.
 * Champs = clés d'étape de l'API (« Trajet déclaratif (move() / bank()) »).
 */
export interface Step {
  id: string;
  /** "x,y" (extérieur), id de carte (intérieur) ou "havenbag". */
  map: string | number;
  regeneration?: number | true;
  gather?: boolean;
  forcegather?: boolean;
  fight?: boolean;
  forcefight?: boolean;
  npcBank?: boolean;
  /** "cellule|code[|skillId]" */
  lockedStorage?: string;
  /** "cellule|code[|propriétaire]" */
  lockedHouse?: string;
  cell?: number;
  /** Corps Lua d'une fonction (ex. `function() ... end`) ou nom de fonction. */
  custom?: RawLua;
  lockedCustom?: RawLua;
  door?: number | string;
  exitCell?: number;
  /** Cellule de la statue (seulement dans phenix()). */
  phenix?: number | string;
  /** Sortie vers la carte suivante. */
  path?: LuaValue;
  /** Nom de la clé utilisée pour la sortie (changeMap prime sur path). */
  pathKey?: 'path' | 'changeMap' | 'paths';
  /** Clés non reconnues, conservées dans l'ordre. */
  extra?: [string, LuaValue][];
  /** Commentaire en fin de ligne (sans le `--`). */
  comment?: string;
}

/** Réglages appliqués à l'entrée d'un palier (module config: de l'API). */
export interface BracketConfig {
  gatherList?: number[];
  minMonsters?: number;
  maxMonsters?: number;
  forbiddenMonsters?: number[];
  mandatoryMonsters?: number[];
}

/** Un palier de niveau (ou le trajet entier s'il n'y a pas de paliers). */
export interface Bracket {
  id: string;
  name: string;
  /** Niveau minimal (inclus). Le maximum est le min du palier suivant - 1. */
  minLevel: number;
  config: BracketConfig;
  steps: Step[];
}

export type LevelSource =
  | { kind: 'none' }
  | { kind: 'job'; jobId: number }
  | { kind: 'character' };

export interface Route {
  levelSource: LevelSource;
  brackets: Bracket[];
}

export interface FightEndHook {
  /** if result.won then openBags() end */
  openBagsOnWin: boolean;
}

/** Sections du fichier, dans l'ordre où elles sont écrites. */
export type Section =
  | { kind: 'globals' }
  | { kind: 'move' }
  | { kind: 'bank' }
  | { kind: 'phenix' }
  | { kind: 'onFightEnd' }
  | { kind: 'raw'; id: string; label: string; text: string };

export type ScriptMode = 'gather' | 'fight' | 'mixed';

export interface Project {
  format: 'scriptgen-project';
  version: 1;
  name: string;
  /** Nom du fichier exporté (sans dossier). */
  fileName: string;
  mode: ScriptMode;
  /** Lignes de commentaire en tête de fichier (sans le `-- `). */
  header: string[];
  /** Globals de configuration activés (clé = nom du global). */
  globals: Record<string, LuaValue>;
  /** null = move() est écrite à la main et conservée dans une section « Lua brut ». */
  move: Route | null;
  bank: Route | null;
  phenix: Route | null;
  onFightEnd: FightEndHook | null;
  sections: Section[];
}
