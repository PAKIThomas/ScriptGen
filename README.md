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

Au premier lancement, clique sur **Ouvrir… → Dossiers d'export et des projets…** pour choisir :

- le **dossier d'export** : le dossier partagé avec la VM Windows (le `.lua` y est écrit par « Exporter ») ;
- le **dossier des projets** : où sont enregistrés les projets `.json` (« Enregistrer » / « Ouvrir… »).

Ces réglages sont gardés dans `~/.scriptgen/config.json`. Le dossier d'export doit déjà exister.

## Utilisation

L'écran reprend le style du Script Creator (dépôt `limposteur/mizan_script` : or antique et émeraude,
polices Inter et Cinzel) : la **carte en plein écran**, avec des panneaux flottants et des onglets qui s'ouvrent par-dessus la carte.
**Chaque panneau se réduit avec « – »** (Trajets, Étapes, Atelier, barre d'outils, Calque) et se rouvre avec « + » ;
l'état ouvert / réduit est retenu d'une fois sur l'autre.

| Zone | Ce qu'on y fait |
|---|---|
| **Carte** | Clic sur une case = ajoute la carte au trajet. Glisser = se déplacer, molette = zoom. Carte « Calque » (bas droite) : choix du monde (Monde des Douze, **Incarnam**, souterrains…), fond officiel, grille, banques (B) et zaaps (Z). Survol = sous-zone et id. Hors du Monde des Douze, l'étape est écrite par son **id** (les coordonnées y sont ambiguës). |
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
server/index.mjs         Serveur local : interface, export, projets, ouverture de dossier
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
  (même source que le Script Creator ; case « Fond » décochable).

Tout le reste est dans le dépôt et fonctionne sans internet :
- `maps.json`, `subareas.json`, `areas.json`, `zaaps.json` : API publique DofusDB, régénérés par `npm run maps` ;
- `worlds.json` (géométrie des calques) et `banks.json` (banques) : repris du projet Script Creator (`limposteur/mizan_script`) ;
- polices Inter et Cinzel (`public/fonts`, licence SIL Open Font License) : reprises du même projet.

## Tests

```bash
npm test         # import puis génération de exemples/*.lua
npm run typecheck
```

Les tests vérifient que `exemples/bucheron.lua`, importé puis regénéré, est **identique à l'octet près**,
que `paysan.lua` / `mineur.lua` (écrits à la main) ne perdent aucune ligne, que les automatismes font
l'aller-retour génération → import → génération sans changement, et que les cartes des exemples existent.
