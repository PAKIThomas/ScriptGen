import { describe, expect, it } from 'vitest';
// @ts-expect-error modules JS du serveur, sans déclarations de types
import { loadData, validatePlan } from '../server/ai.mjs';
// @ts-expect-error idem
import { buildLoop, enrichFromText, mergeIntent, repairIntent, resolveIntent } from '../server/planner.mjs';

const d = loadData(`${__dirname}/..`);

describe('IA locale : intention → plan (résolution sans IA)', () => {
  it('Incarnam puis Astrub, équipement, banque : plan valide et lisible', () => {
    const { plan, summary } = resolveIntent(d, {
      phases: [
        { from_level: 1, to_level: 10, zone: 'Pâturages', incarnam: true, activity: 'fight' },
        { from_level: 11, to_level: 20, zone: 'Astrub', activity: 'fight' },
      ],
      equip: [{ item: 'Coiffe du Bouftou', level: 18 }],
      auto_stuff: true,
      bank: 'Astrub',
    });
    expect(validatePlan(d, plan)).toEqual([]);
    expect(plan.level_source).toEqual({ kind: 'character' });
    expect(plan.brackets.map((b: { min_level: number }) => b.min_level)).toEqual([1, 11]);
    // Incarnam : cartes écrites par id ; Monde des Douze : « x,y ».
    expect(typeof plan.brackets[0].steps[0].map).toBe('number');
    expect(plan.brackets[1].steps[0].map).toMatch(/^-?\d+,-?\d+$/);
    expect(plan.equip).toEqual([{ level: 20, gid: 2411 }]); // l'objet demande le niveau 20
    expect(plan.bank_map_id).toBe(192415750);
    expect(plan.stop_at_level).toBe(20);
    expect(summary).toMatch(/Pâturages/);
  });

  it('métier + ressources : zone où elles poussent, liste de récolte, banque la plus proche', () => {
    const { plan } = resolveIntent(d, { job: 'Paysan', phases: [{ from_level: 1, to_level: 20, activity: 'gather', resources: ['Blé'] }], bank: 'proche' });
    expect(validatePlan(d, plan)).toEqual([]);
    expect(plan.level_source).toEqual({ kind: 'job', job_id: 28 });
    expect(plan.brackets[0].gather_list).toEqual([38]);
    expect(plan.brackets[0].name).toMatch(/Champs d'Astrub/);
    expect(plan.bank_map_id).toBe(192415750);
  });

  it('une longue tranche sans zone est découpée en paliers de 10 niveaux', () => {
    const { plan } = resolveIntent(d, { phases: [{ from_level: 1, to_level: 50, activity: 'fight' }] });
    expect(validatePlan(d, plan)).toEqual([]);
    expect(plan.brackets.map((b: { min_level: number }) => b.min_level)).toEqual([1, 11, 21, 31, 41]);
    expect(plan.to_validate.length).toBe(5);
  });

  it('la boucle relie des cartes voisines', () => {
    const { plan } = resolveIntent(d, { phases: [{ from_level: 1, to_level: 20, zone: 'Champs d\'Astrub', activity: 'gather' }] });
    const coords = plan.brackets[0].steps.map((s: { map: string }) => s.map.split(',').map(Number));
    const adjacent = coords.slice(1).filter(([x, y]: number[], i: number) => Math.abs(x - coords[i][0]) + Math.abs(y - coords[i][1]) === 1).length;
    expect(adjacent / (coords.length - 1)).toBeGreaterThan(0.7);
    expect(buildLoop({ outdoor: [] })).toEqual([]);
  });
});

describe('IA locale : modifications et garde-fous', () => {
  const base = { phases: [{ from_level: 1, to_level: 10, zone: 'Pâturages', incarnam: true, activity: 'fight' }, { from_level: 11, to_level: 20, zone: 'Astrub', activity: 'fight' }], auto_stuff: true };

  it('une modification ajoute un palier et garde le reste', () => {
    const out = mergeIntent(base, { phases: [{ from_level: 21, to_level: 30, zone: 'Forêt d\'Amakna', activity: 'fight' }], auto_stat: 'vitality' });
    expect(out.phases.map((p: { from_level: number }) => p.from_level)).toEqual([1, 11, 21]);
    expect(out).toMatchObject({ auto_stuff: true, auto_stat: 'vitality' });
  });

  it('même tranche = zone remplacée ; tranche qui recouvre = découpe', () => {
    expect(mergeIntent(base, { phases: [{ from_level: 11, to_level: 20, zone: 'Prairies d\'Astrub', activity: 'fight' }] }).phases[1].zone).toBe('Prairies d\'Astrub');
    const cut = mergeIntent(base, { phases: [{ from_level: 5, to_level: 15, zone: 'Lac', activity: 'fight' }] }).phases;
    expect(cut.map((p: { from_level: number; to_level: number }) => [p.from_level, p.to_level])).toEqual([[1, 4], [5, 15], [16, 20]]);
  });

  it('un métier ou une ressource cités mais oubliés par l\'IA sont repris de la demande', () => {
    const intent = enrichFromText(d, { phases: [{ from_level: 1, to_level: 20, activity: 'gather' }] }, 'Paysan de 1 à 20 : récolte du blé, banque proche.');
    expect(intent.job).toBe('Paysan');
    expect(intent.phases[0].resources).toEqual(['Blé']);
    expect(enrichFromText(d, { phases: [{ from_level: 1, to_level: 5, activity: 'gather' }] }, 'or si possible').phases[0].resources).toBeUndefined();
  });

  it('les tranches écrites dans la demande corrigent une lecture fausse de l\'IA', () => {
    expect(repairIntent({ phases: [{ from_level: 21, to_level: 10 }] }, 'ajoute 21 à 30 en forêt').phases[0].to_level).toBe(30);
    expect(repairIntent({ phases: [{ from_level: 5, to_level: 2 }] }, 'niveau 5').phases[0].to_level).toBe(14);
  });
});
