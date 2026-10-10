# ScriptGen — éditeur visuel de scripts Lua pour MizanBot

Application **locale** (sur ton Mac, ouverte dans le navigateur) pour construire des trajets
MizanBot à la souris, régler tous les paramètres documentés et générer un fichier `.lua`
au format des scripts « Mizan Script Creator » (voir `exemples/bucheron.lua`).
Rien n'est mis en ligne : le serveur n'écoute que sur `127.0.0.1`.

## Installer et lancer sur ton Mac

Le code est sur GitHub : **https://github.com/PAKIThomas/ScriptGen**.

1. Installer [Node.js](https://nodejs.org) (version LTS, 20 ou plus récent) — une seule fois.
2. Dans le Terminal :

```bash
git clone https://github.com/PAKIThomas/ScriptGen.git
cd ScriptGen
npm install          # une seule fois (et après chaque mise à jour)
npm start            # ouvre http://localhost:5317 dans le navigateur
```

Mettre à jour plus tard : `cd ScriptGen && git pull && npm install && npm start`.

Sur Mac, tu peux aussi double-cliquer sur **`Lancer ScriptGen.command`** (la première fois :
clic droit → Ouvrir, pour passer l'avertissement de macOS).

Au premier lancement, clique sur **Ouvrir… → Réglages (dossiers, clé IA)…** pour choisir :

- le **dossier d'export** : le dossier partagé avec la VM Windows (le `.lua` y est écrit par « Exporter ») ;
- le **dossier des projets** : où sont enregistrés les projets `.json` (« Enregistrer » / « Ouvrir… »).

Ces réglages sont gardés dans `~/.scriptgen/config.json`. Le dossier d'export doit déjà exister.

## Assistant IA (Claude)

Bouton **✨ Assistant** (ou ⌘J, ou /) : décris le script en français, par exemple
« monte mon personnage de 1 à 50 : de 1 à 10 à Incarnam, puis les Bouftous d'Astrub, équipe la Coiffe du Bouftou
au niveau 20, banque d'Astrub ». L'assistant :

1. cherche dans les données du jeu stockées en local (zones et leur niveau, monstres et leurs niveaux, cartes,
   équipements, ressources Dofus-Map, banques) ;
2. propose un **plan** (paliers de niveau, cartes, monstres visés, objets à équiper, banque…) que le serveur
   **vérifie** : chaque id doit exister, une carte une seule fois par palier, un objet équipé au bon niveau ;
   sinon le plan est renvoyé à l'IA pour correction ;
3. applique le plan au projet (**⌘Z pour annuler**) et dit en quelques lignes ce qu'il a fait et ce qu'il a choisi
   à ta place (« À valider »).

Tu continues ensuite la conversation : « ajoute un palier 30–40 aux Champs de Cania », « évite les Tofus »…
L'IA ne rédige jamais le Lua : le script est toujours écrit par le générateur de ScriptGen, avec les seules
fonctions de l'API MizanBot. Le plan remplace le trajet `move()` (portes, cellules et Lua `custom` posés à la main
sur les étapes ne sont pas conservés quand l'IA refait le trajet).

**Mise en place** : crée une clé API sur <https://console.anthropic.com> (API Keys) et colle-la dans le panneau de
l'assistant ou dans *Ouvrir… → Réglages*. Elle est enregistrée sur ton Mac dans `~/.scriptgen/config.json` (jamais
dans le dépôt, jamais renvoyée au navigateur). La variable d'environnement `ANTHROPIC_API_KEY` marche aussi.

**Confidentialité et coût** : c'est la seule fonction qui envoie des données à l'extérieur — ta demande, le plan du
projet en cours et les résultats des recherches partent chez Anthropic (modèle Claude Opus 5.5). Compte quelques
dizaines de centimes de dollar par demande, selon sa longueur (suivi sur console.anthropic.com).

## Raccourcis clavier

**⌘K** ouvre la palette de commandes (tout ScriptGen au clavier, avec recherche) ; **?** affiche tous les raccourcis.
Les principaux : ⌘J ou / assistant · ⌘E exporter · ⌘S enregistrer · ⌘O ouvrir · ⌘I importer · 1 à 5 onglets ·
A / S ajouter / sélectionner · F chercher une carte · ↑ ↓ (ou K / J) étape précédente / suivante · R récolter ·
C combattre · D dupliquer · Suppr supprimer · [ ] palier précédent / suivant · L boucler · ⌘Z / ⇧⌘Z annuler / rétablir.

## Utilisation

L'écran reprend le style du Script Creator (dépôt `limposteur/mizan_script` : or antique et émeraude,
polices Inter et Cinzel) : la **carte en plein écran**, avec des panneaux flottants et des onglets qui s'ouvrent par-dessus la carte.
**Chaque panneau se réduit avec « – »** (Trajets, Étapes, Atelier, barre d'outils, Calque) et se rouvre avec « + » ;
l'état ouvert / réduit est retenu d'une fois sur l'autre.

| Zone | Ce qu'on y fait |
|---|---|
| **Carte** | Clic sur une case = ajoute la carte au trajet (**une seule fois** : recliquer une carte déjà dans le trajet la sélectionne au lieu de la dupliquer). Glisser = se déplacer, molette = zoom. Carte « Calque » (bas droite) : choix du monde (Monde des Douze, **Incarnam**, souterrains…), fond officiel, grille, banques (B) et zaaps (Z). Survol = sous-zone et id. Hors du Monde des Douze, l'étape est écrite par son **id** (les coordonnées y sont ambiguës). |
| **Mines, grottes & souterrains** | Dans la liste « Calque » (partie *Mines, grottes & souterrains*) ou en cliquant une pastille ⛏ sur la carte : les 116 lieux souterrains de Dofus-Map, **avec leurs images**. Chaque salle se clique comme une case et s'écrit dans le script par son **id de carte**. ⛏ dans une mine = passage vers une autre grotte, ↑ = sortie (retour au calque). Une salle dont l'id n'est pas connu est signalée « id inconnu » : relève-le en jeu avec `/mapid` et ajoute-le par son id. |
| **Ressources** (carte Calque) | « ＋ Choisir » : comme sur Dofus-Map, choisis jusqu'à 6 ressources (blé, or, frêne, fer…, rangées par métier). Chaque carte où elles poussent reçoit une pastille de couleur avec l'icône et le nombre ; le survol d'une case les liste. Marche sur le Continent, à Incarnam et dans les mines. |
| **Panneau Trajets** (gauche) | `move()`, `bank()`, `phenix()`. *Trajet normal* (une boucle) ou *Trajet leveling* (un trajet par palier de niveau de métier ou de personnage), avec par palier la liste de récolte et les filtres de monstres (`config:set…`). |
| **Panneau Étapes** (droite) | Chaque ligne a ses raccourcis **Récolter** / **Combattre** (un clic, sans ouvrir l'étape), les repères DÉBUT / FIN et ✈ (carte non voisine = voyage), ⧉ dupliquer, ✕ supprimer, et **⋯** pour déplier toutes les options de l'étape (banque, coffre / maison à code, porte, cellule, sortie, régénération, Lua `custom`, fiche et image de la carte). En haut : Tout récolter / Tout combattre, ajout par id (intérieurs) ou havre-sac. Liste réordonnable en glissant ; survoler une ligne la montre sur la carte. En bas : **vérifications** (id inconnu, étape sans sortie, coffre mal formé…). |
| **Atelier du script** (bas gauche) | Aperçu du `.lua` en direct, coloré, bouton Copier. |
| **Barre d'outils** (haut) | Ajouter / Sélectionner (restent visibles quand la barre est réduite), ↶ / ↷ annuler / rétablir, 🔍 Chercher une carte (id, « x,y » ou sous-zone, avec image), Boucler (la dernière étape repart vers la première), Tout effacer. |

| Onglet | Ce qu'on y fait |
|---|---|
| **Paramètres** | Catégorie **Équipement** : « Équiper automatiquement les objets » (`inventory:stuff()` à chaque niveau gagné) et « Équiper un objet précis à partir d'un niveau ». Et tous les globals de l'API (`MAX_PODS`, `AUTO_DELETE`, `OPEN_BAGS`, `MIN/MAX_MONSTERS`, `FORBIDDEN/FORCE_MONSTERS`, `MONSTERS_AMOUNT`, régénération, verrous de combat, `FIGHT_KICK`, refus d'échanges / défis / guilde, modérateur, `PLANNING`, anti-blocage…), par catégorie, avec recherche. |
| **Automatismes** | Équipement (le même bloc que dans Paramètres), investir les points de caractéristiques, arrêter le script à un niveau (personnage ou métier), réglages de combat posés par le script (style d'IA, cible, vitesse, lancers par tour, kite, défis, placement auto…), statut privé, alertes (archimonstre, combat perdu, arrêt du script), ouverture des sacs après victoire. |
| **Banque & Phénix** | **Banques prédéfinies** (Astrub, Amakna, Bonta, Brâkmar, Otomai, Éleveurs, Pandala, Sarakech, Frigost, Sufokia) : un clic écrit `bank()` = `{ map = <banquier>, npcBank = true }`, le bot y voyage seul puis reprend le trajet. Ou un trajet de banque sur mesure. Phénix : automatique (recommandé) ou statue sur mesure. |
| **Script & Lua brut** | En-tête, ordre des blocs, et le code « Lua brut » conservé à l'import. |

- **Importer .lua** (ou *Ouvrir… → Scripts d'exemple*) : le script est relu avec un vrai parseur Lua.
  Ce qui est reconnu devient éditable ; **tout le reste est conservé à l'identique** en « Lua brut ».
  Les commentaires entre les étapes (y compris des étapes mises en commentaire) restent attachés à leur étape,
  et le code écrit avant le `return` d'un trajet est gardé dans un champ « Lua avant le trajet » du panneau Trajets.
- **Scripts SnowBot / Ankabot** : MizanBot les fait tourner tels quels ; à l'import, ScriptGen les convertit vers
  le format MizanBot, uniquement avec les équivalences écrites dans la doc API (« Compatibilité SnowBot ») :
  - `GATHER` → `ELEMENTS_TO_GATHER` ;
  - `config:setMaxMonsters(n)`, `setMinMonsters`, `setGatherList`, `setForbiddenMonsters`, `setMandatoryMonsters`,
    `setAmountOfSpecificMonsters` au niveau du fichier → `MAX_MONSTERS`, `MIN_MONSTERS`, `ELEMENTS_TO_GATHER`,
    `FORBIDDEN_MONSTERS`, `FORCE_MONSTERS`, `MONSTERS_AMOUNT` (min / max bornés à 1–8 comme les setters) ;
  - `forceGather` / `forceFight` → `forcegather` / `forcefight` ;
  - paliers écrits `if job:level(2) >= 20 then … elseif … else … end` (ou `character:level()`,
    `getCharacterLevel()`, `getJobLevel(id)`, `<`, `<=`, `>`, `>=`, avec ou sans `else` / `return` final)
    → trajet leveling éditable ;
  - `MAX_PODS = 90` et `MAX_MONSTERS = 8` ajoutés s'ils manquent (seuils SnowBot ; sans eux MizanBot banque à 95 %
    et attaque des groupes de toute taille).

  Le message d'import liste chaque conversion. Ce qui n'a pas d'équivalent (`fightManagement`, fonctions perso…)
  reste en Lua brut, que MizanBot exécute comme avant.
- **Exporter le .lua** écrit `nom_du_fichier.lua` dans le dossier d'export, 📁 l'ouvre dans le Finder.
- ⌘Z / ⇧⌘Z : annuler / rétablir. Le projet en cours est aussi sauvegardé automatiquement dans le navigateur.

### Comment marchent les automatismes

Ils ne font appel qu'à des fonctions de l'API. ScriptGen écrit, juste avant `move()`, un petit bloc encadré par
`-- ▶ ScriptGen : automatismes {…réglages…}` et `-- ■ ScriptGen : automatismes`, qui définit `scriptgenTick()`,
et ajoute en tête de `move()` : `if not scriptgenTick() then return false end`.

- Équipement : à chaque changement de niveau du personnage, pour chaque objet choisi dont le niveau est atteint et
  qui est dans le sac (`inventory:itemPosition(gid) == 63`) → `inventory:equip(gid)` ; puis, si « Équiper
  automatiquement » est coché, `inventory:stuff()` (emplacements vides seulement, niveau ≤ personnage, le plus haut d'abord).
- Caractéristiques : `character:upgradeStat("vitality", character:statPoints())` dès qu'il reste des points.
- Combat : `combat:setStyle`, `setTargetMode`, `setSpeed`, `setKiteRange`, `setMaxCasts`, `setFinishKill`,
  `setAutoPreFight`, `setChallengeMode`, `setAutoFight`, une seule fois au démarrage du script.
- Arrêt : `move()` renvoie `false` quand le niveau visé est atteint.

À l'import, le bloc est relu grâce aux réglages du commentaire d'ouverture ; s'il a été modifié à la main, il reste en Lua brut.

## Structure du projet

```
docs/                    Documentation MizanBot (guide + API en PDF) et listes d'identifiants
exemples/                Scripts de référence (bucheron.lua = format cible)
scripts/build-data.mjs   Convertit docs/*.txt en JSON (npm run data)
server/index.mjs         Serveur local : interface, export, projets, ouverture de dossier, assistant
server/ai.mjs            Assistant IA : outils de recherche, vérification du plan, conversation avec Claude
src/
  model/types.ts         Modèle d'un projet (étapes, paliers, trajets, sections)
  model/registry.ts      Registre des paramètres (globals) affichés dans l'onglet Paramètres
  model/geo.ts           Coordonnées, directions, sortie proposée entre deux cartes
  lua/generate.ts        Projet → .lua (format Mizan Script Creator)
  lua/import.ts          .lua → projet (luaparse ; conversions SnowBot ; le non-reconnu devient « Lua brut »)
  lua/serialize.ts       Écriture des valeurs Lua
  lua/automation.ts      Blocs générés : automatismes (scriptgenTick), onFightEnd, stopped
  model/checks.ts        Vérifications avant export
  data/                  Monstres, interactifs (JSON), métiers et ressources (Annexe du guide)
  components/            Interface React (carte, étapes, paramètres, sélecteurs)
  usePanelOpen.ts        Mémorise l'état ouvert / réduit des panneaux
  ai/plan.ts             Plan de l'assistant ⇄ projet ScriptGen
public/data/items.json   Objets (19 000 entrées, chargés à la demande)
public/data/maps.json    Référentiel des 15 000 cartes (id, x, y, monde, sous-zone, extérieur) — npm run maps
public/data/subareas.json, areas.json  Noms des sous-zones et zones
public/data/worlds.json  Géométrie des calques (pour placer les tuiles officielles du monde)
public/data/banks.json   Banques prédéfinies (carte du banquier)
public/data/zaaps.json   Zaaps affichés sur la carte
tests/                   Tests (npm test) ; tests/fixtures/snowbot.lua = script SnowBot de test
```

## Ajouter un nouveau paramètre

1. Vérifier qu'il existe dans l'API (`docs/api-*.pdf`, catégorie « Configuration & points d'entrée »).
2. Ajouter une entrée dans `PARAMS` (`src/model/registry.ts`) : `key`, `label`, `category`,
   `type` (`number`, `bool`, `string`, `resources`, `monsters`, `items`, `monsterAmounts`, `hours`),
   `engineDefault`, `initial`, `help`. **Sa position dans le tableau = sa position dans le `.lua`.**
3. C'est tout : l'onglet Paramètres, la génération et l'import (reconnaissance du global) l'utilisent automatiquement.

Pour une nouvelle **clé d'étape** : l'ajouter au type `Step` (`src/model/types.ts`), à `STEP_KEYS`
(`src/lua/generate.ts`, ordre d'écriture), au `switch` de `step()` (`src/lua/import.ts`) et à
`StepInspector.tsx`. Sans ça, une clé inconnue est quand même conservée à l'import (`extra`).

## Données en ligne utilisées

L'outil tourne en local mais le navigateur charge, si internet est disponible :
- les **images officielles du monde** (fond de carte, tous les calques) et les **images des cartes** depuis `api.dofusdb.fr`
  (même source que le Script Creator ; case « Fond » décochable) ;
- les **images des mines et souterrains** depuis les tuiles publiques de `dofus-map.com`.

Tout le reste est dans le dépôt et fonctionne sans internet :
- `maps.json`, `subareas.json`, `areas.json`, `zaaps.json` : API publique DofusDB, régénérés par `npm run maps` ;
- `worlds.json` (géométrie des calques) et `banks.json` (banques) : repris du projet Script Creator (`limposteur/mizan_script`) ;
- polices Inter et Cinzel (`public/fonts`, licence SIL Open Font License) : reprises du même projet ;
- `resources.json` + `dofusmap-resources.png` : ressources récoltables, leurs positions (nombre par carte sur le
  Continent et à Incarnam, nombre par salle dans les mines) et leurs icônes, récupérées une fois sur Dofus-Map par
  `npm run resources` (≈ 50 min : le script attend 3,5 s entre deux requêtes car Dofus-Map bloque au-delà de
  100 requêtes en 5 minutes ; il reprend là où il s'était arrêté après une coupure ; `-- --mines-only` ne refait que les mines) ;
- `ai/subareas.json`, `ai/monsters.json`, `ai/items.json`, `ai/item-types.json` : niveau et monstres de chaque
  sous-zone, niveaux des monstres, niveau et type des équipements (API publique DofusDB, `npm run gamedata`) —
  utilisés par l'assistant IA ;
- `mines.json` : mines, grottes et souterrains (salles, id de carte de chaque salle, ressources, entrées) tirés du
  catalogue Dofus-Map du Script Creator (`npm run mines -- <chemin>/mizan_script/public/worldmap/data/dofus-map-groups.json`).
  Les salles dont l'id est inconnu, ou rapproché d'une carte d'extérieur (douteux), sont écartées.

## Tests

```bash
npm test         # import puis génération de exemples/*.lua
npm run typecheck
```

Les tests vérifient que `exemples/bucheron.lua`, importé puis regénéré, est **identique à l'octet près**,
que `paysan.lua` / `mineur.lua` (écrits à la main) ne perdent aucune ligne, que les automatismes font
l'aller-retour génération → import → génération sans changement, et que les cartes des exemples existent.
