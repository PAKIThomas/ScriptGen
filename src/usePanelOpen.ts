// État ouvert / réduit d'un panneau flottant, retenu d'une session à l'autre (confort seulement).
import { useEffect, useState } from 'react';

const KEY = 'scriptgen.panels';

function read(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function usePanelOpen(name: string, initial = true): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => read()[name] ?? initial);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...read(), [name]: open }));
    } catch { /* stockage indisponible : l'état n'est simplement pas retenu */ }
  }, [name, open]);
  return [open, setOpen];
}
