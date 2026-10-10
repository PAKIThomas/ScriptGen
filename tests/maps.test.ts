import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { searchMaps } from '../src/components/MapSearch';
import { buildIndex, locateStepMap } from '../src/data/maps';
import { importLua } from '../src/lua/import';
import { checkProject } from '../src/model/checks';
import { newProject, newStep } from '../src/model/project';

const data = (f: string) => JSON.parse(readFileSync(join(__dirname, '..', 'public', 'data', f), 'utf8'));
const index = buildIndex(data('maps.json'), data('subareas.json'), data('areas.json'));
const example = (name: string) => readFileSync(join(__dirname, '..', 'exemples', name), 'utf8');

describe('référentiel des cartes', () => {
  it('situe une carte par id et par coordonnées', () => {
    expect(locateStepMap(index, 192415750)).toMatchObject({ x: 4, y: -18, worldMap: -1 }); // banque d'Astrub (intérieur)
    expect(locateStepMap(index, '5,7')).toMatchObject({ x: 5, y: 7, worldMap: 1 });
    expect(index.byId.get(88082704)).toMatchObject({ x: 5, y: 7, outdoor: true });
  });

  it('cherche par id, coordonnées et sous-zone', () => {
    expect(searchMaps(index, '192415750', false).map((m) => m.id)).toContain(192415750);
    expect(searchMaps(index, '4,-18', true).every((m) => m.x === 4 && m.y === -18)).toBe(true);
    expect(searchMaps(index, 'astrub', false).length).toBeGreaterThan(0);
  });

  it('toutes les cartes des exemples existent dans le référentiel', () => {
    for (const name of ['bucheron.lua']) {
      const { project } = importLua(example(name), name);
      const checks = checkProject(project, index).filter((c) => c.level !== 'info');
      expect(checks.filter((c) => /inconnu|aucune carte/.test(c.message))).toEqual([]);
    }
  });
});

describe('vérifications', () => {
  it('signale un id inconnu, une étape sans sortie et un coffre mal formé', () => {
    const p = newProject();
    p.move!.brackets[0].steps = [
      newStep('5,7', { gather: true }),
      newStep(999999999, { lockedStorage: '312' }),
    ];
    const messages = checkProject(p, index).map((c) => `${c.level}: ${c.message}`);
    expect(messages.some((m) => m.startsWith('warning') && m.includes('id de carte inconnu'))).toBe(true);
    expect(messages.some((m) => m.startsWith('warning') && m.includes('pas de sortie'))).toBe(true);
    expect(messages.some((m) => m.startsWith('error') && m.includes('coffre'))).toBe(true);
  });
});
