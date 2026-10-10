import luaparse from 'luaparse';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/lua/generate';
import { importLua } from '../src/lua/import';
import { newProject, newStep } from '../src/model/project';

function projectWithAutomation() {
  const p = newProject();
  p.move!.brackets[0].steps = [newStep('4,-18', { gather: true, path: '5,-18' }), newStep('5,-18', { gather: true, path: '4,-18' })];
  p.bank = { levelSource: { kind: 'none' }, brackets: [{ id: 'b', name: 'Trajet principal', minLevel: 1, config: {}, steps: [newStep(192415750, { npcBank: true })] }] };
  p.automation = {
    equip: [{ level: 20, gid: 2414 }, { level: 1, gid: 8243 }],
    autoStat: 'vitality',
    autoStuff: true,
    combat: { style: 'agressif', target: 'pv', maxCasts: 4, finishKill: true, challengeMode: 'auto' },
    privateStatus: true,
    archNotify: true,
    stopAt: { level: 100, jobId: 2 },
  };
  p.onFightEnd = { openBagsOnWin: true, notifyOnLoss: true };
  p.stopped = { notify: true };
  return p;
}

describe('automatismes', () => {
  it('génère du Lua valide qui appelle scriptgenTick en tête de move()', () => {
    const lua = generate(projectWithAutomation());
    expect(() => luaparse.parse(lua, { luaVersion: '5.2' })).not.toThrow();
    expect(lua).toContain('inventory:equip(e.gid)');
    expect(lua).toContain('    inventory:stuff()');
    expect(lua).toContain('{ level = 1, gid = 8243 }, { level = 20, gid = 2414 }');
    expect(lua).toContain('combat:setStyle("agressif")');
    expect(lua).toContain('character:upgradeStat("vitality", character:statPoints())');
    expect(lua).toContain('if getJobLevel(2) >= 100 then');
    expect(lua.indexOf('local function scriptgenTick()')).toBeLessThan(lua.indexOf('function move()'));
    expect(lua).toMatch(/function move\(\)\n  if not scriptgenTick\(\) then return false end/);
  });

  it('import puis génération redonne exactement le même fichier', () => {
    const lua = generate(projectWithAutomation());
    const { project, rawParts } = importLua(lua, 'auto.lua');
    expect(rawParts).toEqual([]);
    expect(project.automation?.equip).toHaveLength(2);
    expect(project.onFightEnd).toEqual({ openBagsOnWin: true, notifyOnLoss: true });
    expect(project.stopped).toEqual({ notify: true });
    expect(generate(project)).toBe(lua);
  });

  it('un bloc modifié à la main reste en Lua brut', () => {
    const lua = generate(projectWithAutomation()).replace('return true\nend\n-- ■', 'print("x")\n  return true\nend\n-- ■');
    const { project } = importLua(lua, 'auto.lua');
    expect(project.automation ?? null).toBeNull();
    expect(generate(project)).toContain('print("x")');
  });
});
