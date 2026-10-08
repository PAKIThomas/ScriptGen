import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import luaparse from 'luaparse';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/lua/generate';
import { importLua } from '../src/lua/import';

const example = (name: string) => readFileSync(join(__dirname, '..', 'exemples', name), 'utf8');

describe('format Mizan Script Creator (bucheron.lua)', () => {
  it('import puis génération redonne le fichier à l\'octet près', () => {
    const source = example('bucheron.lua');
    const { project, rawParts } = importLua(source, 'bucheron.lua');
    expect(rawParts).toEqual([]);
    expect(generate(project)).toBe(source);
  });

  it('reconnaît les 16 paliers du métier Bûcheron', () => {
    const { project } = importLua(example('bucheron.lua'));
    expect(project.move?.levelSource).toEqual({ kind: 'job', jobId: 2 });
    const brackets = project.move!.brackets;
    expect(brackets).toHaveLength(16);
    expect(brackets[0]).toMatchObject({ name: 'Trajet principal', minLevel: 1, config: { gatherList: [1] } });
    expect(brackets[15]).toMatchObject({ name: 'Étape 16', minLevel: 180, config: { gatherList: [30] } });
    expect(brackets.reduce((n, b) => n + b.steps.length, 0)).toBe(1284);
    expect(project.bank?.brackets[0].steps).toMatchObject([{ map: 192415750, npcBank: true }]);
    expect(project.onFightEnd).toEqual({ openBagsOnWin: true });
  });
});

describe('scripts écrits à la main : rien n\'est perdu', () => {
  for (const name of ['paysan.lua', 'mineur.lua']) {
    it(`${name} : le Lua brut est conservé et le résultat reste du Lua valide`, () => {
      const source = example(name);
      const { project } = importLua(source, name);
      const output = generate(project);
      expect(() => luaparse.parse(output, { luaVersion: '5.2' })).not.toThrow();
      for (const section of project.sections) {
        if (section.kind === 'raw') expect(source).toContain(section.text);
      }
      // Aucune fonction n'est écrite deux fois (ex. un move() vide en plus du move() brut).
      for (const fn of ['move', 'bank', 'phenix', 'onFightEnd']) {
        const count = (text: string) => (text.match(new RegExp(`^function ${fn}\\(`, 'gm')) ?? []).length;
        expect(count(output)).toBe(count(source));
      }
      // Les globals reconnus gardent leur valeur.
      expect(project.globals.MAX_PODS).toBe(90);
      // Le code non reconnu (fonctions, tables locales…) ressort intact.
      const code = (s: string) => s.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--')).map((l) => l.trim());
      const outLines = new Set(code(output));
      const missing = code(source).filter((l) => !outLines.has(l) && !/^[A-Z_]+ = /.test(l));
      expect(missing).toEqual([]);
    });
  }
});
