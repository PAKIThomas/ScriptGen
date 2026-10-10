import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mineOfMap, resourceKey, type MinesData } from '../src/data/dofusmap';
import { buildIndex, sameMap } from '../src/data/maps';

const data = (f: string) => JSON.parse(readFileSync(join(__dirname, '..', 'public', 'data', f), 'utf8'));
const index = buildIndex(data('maps.json'), data('subareas.json'), data('areas.json'));
const mines = data('mines.json') as MinesData;

describe('une carte n\'est ajoutée qu\'une fois', () => {
  it('reconnaît la même carte écrite en « x,y » ou par son id d\'extérieur', () => {
    const outdoor = index.byCoords.get('1:4,-18')!.find((m) => m.outdoor)!;
    expect(sameMap(index, '4,-18', ' 4,-18')).toBe(true);
    expect(sameMap(index, '4,-18', outdoor.id)).toBe(true);
    expect(sameMap(index, String(outdoor.id), outdoor.id)).toBe(true);
    expect(sameMap(index, '4,-18', '5,-18')).toBe(false);
  });

  it('un intérieur aux mêmes coordonnées reste une autre carte', () => {
    const room = mines.groups.flatMap((g) => g.rooms).find((r) => index.byId.get(r.mapId)?.worldMap === -1)!;
    const info = index.byId.get(room.mapId)!;
    expect(sameMap(index, `${info.x},${info.y}`, room.mapId)).toBe(false);
  });
});

describe('mines Dofus-Map', () => {
  it('chaque salle a un id de carte connu, jamais une carte d\'extérieur du Continent', () => {
    const rooms = mines.groups.flatMap((g) => g.rooms);
    expect(rooms.length).toBeGreaterThan(600);
    for (const r of rooms) {
      const info = index.byId.get(r.mapId);
      expect(info, `salle ${r.mapId}`).toBeDefined();
      expect(info!.worldMap === 1 && info!.outdoor).toBe(false);
    }
  });

  it('les salles sont sur des cases du groupe et chaque entrée mène à un groupe connu', () => {
    for (const g of mines.groups) {
      const cells = new Set(g.cells.map(([x, y]) => `${x},${y}`));
      for (const r of g.rooms) expect(cells.has(`${r.x},${r.y}`)).toBe(true);
    }
    const ids = new Set(mines.groups.map((g) => g.id));
    for (const e of mines.entrances) expect(ids.has(e.group)).toBe(true);
    expect(mineOfMap(mines, mines.groups[0].rooms[0]?.mapId ?? -1)?.id ?? mines.groups[0].id).toBe(mines.groups[0].id);
  });

  it('rapproche les noms Dofus-Map et ceux des objets du jeu', () => {
    expect(resourceKey('Frêne')).toBe(resourceKey('Bois de Frêne'));
    expect(resourceKey('Etain')).toBe(resourceKey('Étain'));
    expect(resourceKey('Perce-neige')).toBe(resourceKey('Perce-Neige'));
  });
});
