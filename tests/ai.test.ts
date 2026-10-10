import luaparse from 'luaparse';
import { describe, expect, it } from 'vitest';
// @ts-expect-error module JS du serveur, sans déclarations de types
import { loadData, runTool, validatePlan } from '../server/ai.mjs';
import { applyPlan, projectToPlan, type Plan } from '../src/ai/plan';
import { generate } from '../src/lua/generate';
import { newProject } from '../src/model/project';

const d = loadData(`${__dirname}/..`);
const plan: Plan = {
  name: 'Leveling', file_name: 'leveling', level_source: { kind: 'character' },
  brackets: [
    { name: 'Incarnam', min_level: 1, steps: [{ map: 153879300, fight: true }, { map: 153879813, fight: true }] },
    { name: 'Astrub', min_level: 11, mandatory_monsters: [101], steps: [{ map: '4,-18', fight: true }, { map: '5,-18', fight: true }] },
  ],
  equip: [{ level: 20, gid: 2411 }], auto_stuff: true, stop_at_level: 20, bank_map_id: 192415750,
};

describe('assistant IA : vérification du plan', () => {
  it('accepte un plan dont tous les ids existent', () => {
    expect(validatePlan(d, plan)).toEqual([]);
  });

  it('refuse les ids inventés, les doublons et un objet trop haut niveau', () => {
    const errors: string[] = validatePlan(d, {
      ...plan,
      brackets: [{ name: 'A', min_level: 1, mandatory_monsters: [99999999], steps: [{ map: '4,-18' }, { map: '4,-18' }, { map: 123 }] }],
      equip: [{ level: 5, gid: 2411 }],
      bank_map_id: 42,
    });
    expect(errors.join('\n')).toMatch(/deux fois/);
    expect(errors.join('\n')).toMatch(/id 123 inconnue/);
    expect(errors.join('\n')).toMatch(/monstre 99999999/);
    expect(errors.join('\n')).toMatch(/niveau 20, pas 5/);
    expect(errors.join('\n')).toMatch(/Banque 42/);
  });

  it('les outils cherchent dans les données locales', () => {
    expect(runTool(d, 'find_resources', { query: 'Blé' }).map((r: { name: string }) => r.name)).toEqual(['Blé']);
    expect(runTool(d, 'find_items', { query: 'Coiffe du Bouftou' })[0]).toMatchObject({ gid: 2411, level: 20 });
    expect(runTool(d, 'find_zones', { query: 'Pâturages' })[0]).toMatchObject({ world: 2 });
  });
});

describe('assistant IA : plan → projet → Lua', () => {
  const project = applyPlan(newProject(), plan);

  it('construit les paliers, les sorties en boucle, l\'équipement et la banque', () => {
    expect(project.move!.levelSource).toEqual({ kind: 'character' });
    const [incarnam, astrub] = project.move!.brackets;
    expect(incarnam.steps.map((s) => s.path)).toEqual([153879813, 153879300]);
    expect(astrub.steps.map((s) => s.path)).toEqual(['5,-18', '4,-18']);
    expect(project.automation).toMatchObject({ equip: [{ level: 20, gid: 2411 }], autoStuff: true, stopAt: { level: 20 } });
    expect(project.bank!.brackets[0].steps[0]).toMatchObject({ map: 192415750, npcBank: true });
  });

  it('un réglage de palier ne fuit pas dans les autres paliers', () => {
    expect(project.move!.brackets[0].config.mandatoryMonsters).toEqual([]);
    expect(project.move!.brackets[1].config.mandatoryMonsters).toEqual([101]);
  });

  it('génère du Lua valide et se relit en plan', () => {
    expect(() => luaparse.parse(generate(project), { luaVersion: '5.2' })).not.toThrow();
    expect(projectToPlan(project)?.brackets.map((b) => b.steps.length)).toEqual([2, 2]);
  });
});
