import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import luaparse from 'luaparse';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/lua/generate';
import { importLua } from '../src/lua/import';

const source = readFileSync(join(__dirname, 'fixtures', 'snowbot.lua'), 'utf8');

describe('import d\'un script SnowBot', () => {
  const { project, rawParts, translated } = importLua(source, 'snowbot.lua');

  it('traduit les globals et config:set… vers leurs équivalents documentés', () => {
    expect(project.globals).toMatchObject({
      ELEMENTS_TO_GATHER: [1, 33], MAX_MONSTERS: 5, FORBIDDEN_MONSTERS: [98], MAX_PODS: 90, OPEN_BAGS: true,
    });
    expect(translated).toContain('GATHER → ELEMENTS_TO_GATHER');
    expect(translated).toContain('forceGather → forcegather');
  });

  it('reconnaît les paliers décroissants job:level(2) >= N et garde le code avant le trajet', () => {
    const move = project.move!;
    expect(move.levelSource).toEqual({ kind: 'job', jobId: 2 });
    expect(move.preamble).toBe('global:printMessage("Trajet bûcheron")');
    expect(move.brackets.map((b) => b.minLevel)).toEqual([1, 10, 20]);
    expect(move.brackets[2].steps[0]).toMatchObject({ map: '4,-18', gather: true, notes: ['-- Forêt d\'Astrub'] });
    expect(move.brackets[2].steps[1]).toMatchObject({ forcegather: true, comment: 'repousse' });
    expect(move.brackets[2].tailNotes).toEqual(['--{ map = "6,-18", path = "left" },']);
    expect(project.bank!.brackets[0].steps[0].notes).toEqual(['-- Banque d\'Astrub']);
  });

  it('ne garde en Lua brut que ce qui n\'a pas d\'équivalent (fightManagement)', () => {
    expect(rawParts).toContain('function fightManagement');
    expect(rawParts.some((p) => /move|bank/.test(p))).toBe(false);
  });

  it('produit du Lua valide, stable à la réimportation', () => {
    const out = generate(project);
    expect(() => luaparse.parse(out, { luaVersion: '5.2' })).not.toThrow();
    expect(out).toContain('fightBasic:playTurn()');
    const again = importLua(out, 'snowbot.lua');
    expect(again.rawParts.filter((p) => /move|bank/.test(p))).toEqual([]);
    expect(generate(again.project)).toBe(out);
  });

  it('paliers croissants sans local et return final hors du if', () => {
    const lua = [
      'function move()',
      '  if character:level() <= 49 then',
      '    return { { map = "1,1", path = "left" } }',
      '  end',
      '  return { { map = "2,2", path = "right", fight = true } }',
      'end',
    ].join('\n');
    const { project: p, rawParts: raw } = importLua(lua);
    expect(raw).toEqual([]);
    expect(p.move!.levelSource).toEqual({ kind: 'character' });
    expect(p.move!.brackets.map((b) => b.minLevel)).toEqual([1, 50]);
  });
});
