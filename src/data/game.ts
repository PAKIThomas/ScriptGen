// Données de référence recopiées du guide MizanBot (Annexe A.1 à A.3).

export interface Job {
  id: number;
  name: string;
}

/** A.2 Identifiants des métiers (JobID). */
export const JOBS: Job[] = [
  { id: 2, name: 'Bûcheron' },
  { id: 24, name: 'Mineur' },
  { id: 26, name: 'Alchimiste' },
  { id: 28, name: 'Paysan' },
  { id: 36, name: 'Pêcheur' },
  { id: 41, name: 'Chasseur' },
  { id: 11, name: 'Forgeron' },
  { id: 13, name: 'Sculpteur' },
  { id: 15, name: 'Cordonnier' },
  { id: 16, name: 'Bijoutier' },
  { id: 27, name: 'Tailleur' },
  { id: 60, name: 'Façonneur' },
  { id: 65, name: 'Bricoleur' },
  { id: 44, name: 'Forgemage' },
  { id: 48, name: 'Sculptemage' },
  { id: 62, name: 'Cordomage' },
  { id: 63, name: 'Joaillomage' },
  { id: 64, name: 'Costumage' },
  { id: 74, name: 'Façomage' },
];

export interface ResourceGroup {
  /** JobID du métier de récolte (null = autres). */
  jobId: number | null;
  label: string;
  resources: [number, string][];
}

/** A.1 Ressources récoltables par métier (ElementTypeId). */
export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    jobId: 28, label: 'Paysan', resources: [
      [38, 'Blé'], [43, 'Orge'], [45, 'Avoine'], [39, 'Houblon'], [42, 'Lin'], [44, 'Seigle'],
      [289, 'Quisnoa'], [111, 'Riz'], [47, 'Malt'], [46, 'Chanvre'], [260, 'Maïs'], [261, 'Millet'],
      [134, 'Frostiz'],
    ],
  },
  {
    jobId: 26, label: 'Alchimiste', resources: [
      [254, 'Ortie'], [255, 'Sauge'], [67, 'Trèfle à 5 feuilles'], [66, 'Menthe Sauvage'],
      [68, 'Orchidée Freyesque'], [61, 'Edelweiss'], [112, 'Pandouille'], [256, 'Ginseng'],
      [257, 'Belladone'], [258, 'Mandragore'], [131, 'Perce-neige'], [288, 'Salikrone'],
    ],
  },
  {
    jobId: 24, label: 'Mineur', resources: [
      [17, 'Fer'], [53, 'Cuivre'], [55, 'Bronze'], [37, 'Kobalte'], [54, 'Manganèse'], [52, 'Étain'],
      [24, 'Argent'], [114, 'Silicate'], [26, 'Bauxite'], [25, 'Or'], [113, 'Dolomite'],
      [135, 'Obsidienne'], [291, 'Écume de mer'],
    ],
  },
  {
    jobId: 2, label: 'Bûcheron', resources: [
      [1, 'Frêne'], [33, 'Châtaignier'], [34, 'Noyer'], [8, 'Chêne'], [98, 'Bombu'], [31, 'Érable'],
      [101, 'Oliviolet'], [401, 'Pin'], [28, 'If'], [108, 'Bambou'], [35, 'Merisier'],
      [259, 'Noisetier'], [29, 'Ébène'], [121, 'Kaliptus'], [32, 'Charme'], [109, 'Bambou sombre'],
      [30, 'Orme'], [110, 'Bambou sacré'], [294, 'Aquajou'], [133, 'Tremble'],
    ],
  },
  {
    jobId: 36, label: 'Pêcheur', resources: [
      [75, 'Goujon'], [71, 'Greuvette'], [74, 'Truite'], [77, 'Crabe'], [78, 'Poisson pané'],
      [76, 'Poisson-Chaton'], [79, 'Carpe d\'Iem'], [81, 'Sardine Brillante'], [263, 'Brochet'],
      [264, 'Kralamoure'], [265, 'Anguille'], [266, 'Dorade Grise'], [267, 'Perche'], [268, 'Raie'],
      [269, 'Lotte'], [271, 'Bar Rikain'], [272, 'Morue'], [273, 'Tanche'], [274, 'Espadon'],
      [297, 'Patelle'], [132, 'Poisskaille'], [365, 'Pichon d\'encre'], [270, 'Requin Marteau-Faucille'],
    ],
  },
  { jobId: null, label: 'Autres', resources: [[84, 'Puits']] },
];

const RESOURCE_NAMES = new Map<number, string>(
  RESOURCE_GROUPS.flatMap((g) => g.resources.map(([id, name]) => [id, name] as [number, string])),
);

export function resourceName(id: number): string | undefined {
  return RESOURCE_NAMES.get(id);
}

export function jobName(id: number): string | undefined {
  return JOBS.find((j) => j.id === id)?.name;
}
