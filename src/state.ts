import { useCallback, useEffect, useRef, useState } from 'react';
import { newProject } from './model/project';
import type { Project } from './model/types';

const AUTOSAVE_KEY = 'scriptgen.autosave';
const HISTORY_LIMIT = 100;

function loadAutosave(): Project {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Project;
      if (p?.format === 'scriptgen-project') return p;
    }
  } catch {
    // stockage indisponible : on repart d'un projet vide
  }
  return newProject();
}

export interface ProjectStore {
  project: Project;
  /** Modifie une copie du projet (enregistrée dans l'historique). */
  update: (mutate: (draft: Project) => void) => void;
  replace: (project: Project) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useProjectStore(): ProjectStore {
  const [project, setProject] = useState<Project>(loadAutosave);
  // Le ref suit l'état courant pour que plusieurs modifications rapides s'enchaînent correctement.
  const current = useRef(project);
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);

  const set = useCallback((next: Project) => {
    current.current = next;
    setProject(next);
  }, []);

  const replace = useCallback((next: Project) => {
    past.current.push(current.current);
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
    set(next);
  }, [set]);

  const update = useCallback((mutate: (draft: Project) => void) => {
    const draft = structuredClone(current.current);
    mutate(draft);
    replace(draft);
  }, [replace]);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(current.current);
    set(previous);
  }, [set]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(current.current);
    set(next);
  }, [set]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
      } catch {
        // quota dépassé ou stockage bloqué : la sauvegarde automatique est un confort, pas une garantie
      }
    }, 400);
    return () => clearTimeout(t);
  }, [project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return {
    project, update, replace, undo, redo,
    canUndo: past.current.length > 0, canRedo: future.current.length > 0,
  };
}
