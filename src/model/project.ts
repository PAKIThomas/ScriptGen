import type { Bracket, Project, Route, Step } from './types';

let counter = 0;
export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newBracket(name = 'Trajet principal', minLevel = 1): Bracket {
  return { id: newId(), name, minLevel, config: {}, steps: [] };
}

export function newRoute(): Route {
  return { levelSource: { kind: 'none' }, brackets: [newBracket()] };
}

export function newStep(map: string | number, partial: Partial<Step> = {}): Step {
  return { id: newId(), map, ...partial };
}

export function newProject(): Project {
  return {
    format: 'scriptgen-project',
    version: 1,
    name: 'Nouveau trajet',
    fileName: 'nouveau_trajet.lua',
    mode: 'gather',
    header: ['Généré par ScriptGen'],
    globals: {
      MAX_PODS: 90,
      ELEMENTS_TO_GATHER: [],
      MIN_MONSTERS: 1,
      MAX_MONSTERS: 8,
      OPEN_BAGS: true,
    },
    move: newRoute(),
    bank: null,
    phenix: null,
    onFightEnd: null,
    sections: [{ kind: 'globals' }, { kind: 'move' }],
  };
}

/** Copie profonde avec de nouveaux identifiants (duplication d'étape / de palier). */
export function cloneStep(step: Step): Step {
  return { ...structuredClone(step), id: newId() };
}

export function cloneBracket(bracket: Bracket): Bracket {
  return { ...structuredClone(bracket), id: newId(), steps: bracket.steps.map(cloneStep) };
}
