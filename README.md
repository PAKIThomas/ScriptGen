# ScriptGen — éditeur visuel de scripts Lua pour MizanBot

Application **locale** (sur ton Mac, ouverte dans le navigateur) pour construire des trajets
MizanBot à la souris, régler tous les paramètres documentés et générer un fichier `.lua`
au format des scripts « Mizan Script Creator » (voir `exemples/bucheron.lua`).
Rien n'est mis en ligne : le serveur n'écoute que sur `127.0.0.1`.

## Lancer

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
git clone <ce dépôt> && cd ScriptGen
npm install          # une seule fois
npm start            # ouvre http://localhost:5317 dans le navigateur
```

Sur Mac, tu peux aussi double-cliquer sur **`Lancer ScriptGen.command`** (la première fois :
clic droit → Ouvrir, pour passer l'avertissement de macOS).

Au premier lancement, clique sur **⚙** pour choisir :

- le **dossier d'export** : le dossier partagé avec la VM Windows (le `.lua` y est écrit par « Exporter ») ;
- le **dossier des projets** : où sont enregistrés les projets `.json` (« Enregistrer » / « Ouvrir… »).

Ces réglages sont gardés dans `~/.scriptgen/config.json`. Le dossier d'export doit déjà exister.

## Utilisation

L'écran ressemble au Script Creator : la **carte en plein écran**, avec des panneaux flottants
(réductibles avec « – ») et des onglets qui s'ouvrent par-dessus la carte.

| Zone | Ce qu'on y fait |
|---|---|
| **Carte** | Clic sur une case = ajoute la carte au trajet. Glisser = se déplacer, molette = zoom. Carte « Calque » : choix du monde (Monde des Douze, **Incarnam**, souterrains…), fond officiel, grille, banques (B) et zaaps (Z). Survol = sous-zone et id. Hors du Monde des Douze, l'étape est écrite par son **id** (les coordonnées y sont ambiguës). |
| **Panneau Trajets** (gauche) | `move()`, `bank()`, `phenix()`. *Trajet normal* (une boucle) ou *Trajet leveling* (un trajet par palier de niveau de métier ou de personnage), avec par palier la liste de récolte et les filtres de monstres (`config:set…`). |
| **Panneau Étapes** (droite) | Tout récolter / tout combattre, ajout par id (intérieurs) ou havre-sac, liste réordonnable (glisser), duplication, suppression, détail de l'étape (récolte, combat, banque, coffre / maison à code, porte, cellule, sortie, Lua `custom`, fiche et image de la carte) et **vérifications** (id inconnu, étape sans sortie, coffre mal formé…). |
| **Atelier du script** (bas gauche) | Aperçu du `.lua` en direct, coloré, bouton Copier. |
| **Barre d'outils** (haut) | Ajouter / Sélectionner, Annuler / Rétablir, 🔍 Chercher une carte (id, « x,y » ou sous-zone, avec image), Boucler (la dernière étape repart vers la première), Tout effacer. |

| Onglet | Ce qu'on y fait |
|---|---|
| **Paramètres** | Tous les globals de l'API (`MAX_PODS`, `AUTO_DELETE`, `OPEN_BAGS`, `MIN/MAX_MONSTERS`, `FORBIDDEN/FORCE_MONSTERS`, `MONSTERS_AMOUNT`, régénération, verrous de combat, `FIGHT_KICK`, refus d'échanges / défis / guilde, modérateur, `PLANNING`, anti-blocage…), par catégorie, avec recherche. |
| **Automatismes** | **Équiper un objet à partir d'un niveau**, investir les points de caractéristiques, arrêter le script à un niveau (personnage ou métier), réglages de combat posés par le script (style d'IA, cible, vitesse, lancers par tour, kite, défis, placement auto…), statut privé, alertes (archimonstre, combat perdu, arrêt du script), ouverture des sacs après victoire. |
| **Banque & Phénix** | **Banques prédéfinies** (Astrub, Amakna, Bonta, Brâkmar, Otomai, Éleveurs, Pandala, Sarakech, Frigost, Sufokia) : un clic écrit `bank()` = `{ map = <banquier>, npcBank = true }`, le bot y voyage seul puis reprend le trajet. Ou un trajet de banque sur mesure. Phénix : automatique (recommandé) ou statue sur mesure. |
| **Script & Lua brut** | En-tête, ordre des blocs, et le code « Lua brut » conservé à l'import. |

- **Importer .lua** (ou *Ouvrir… → Scripts d'exemple*) : le script est relu avec un vrai parseur Lua.
  Ce qui est reconnu devient éditable ; **tout le reste est conservé à l'identique** en « Lua brut ».
- **Exporter le .lua** écrit `nom_du_fichier.lua` dans le dossier d'export, 📁 l'ouvre dans le Finder.
- ⌘Z / ⇧⌘Z : annuler / rétablir. Le projet en cours est aussi sauvegardé automatiquement dans le navigateur.

### Comment marchent les automatismes

Ils ne font appel qu'à des fonctions de l'API. ScriptGen écrit, juste avant `move()`, un petit bloc encadré par
`-- ▶ ScriptGen : automatismes {…réglages…}` et `-- ■ ScriptGen : automatismes`, qui définit `scriptgenTick()`,
et ajoute en tête de `move()` : `if not scriptgenTick() then return false end`.

- Équipement : à chaque changement de niveau du personnage, pour chaque objet dont le niveau est atteint et qui est
  dans le sac (`inventory:itemPosition(gid) == 63`) → `inventory:equip(gid)`.
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
  lua/import.ts          .lua → projet (luaparse ; le non-reconnu devient « Lua brut »)
  lua/serialize.ts       Écriture des valeurs Lua
  lua/automation.ts      Blocs générés : automatismes (scriptgenTick), onFightEnd, stopped
  model/checks.ts        Vérifications avant export
  data/                  Monstres, interactifs (JSON), métiers et ressources (Annexe du guide)
  components/            Interface React (carte, étapes, paramètres, sélecteurs)
public/data/items.json   Objets (19 000 entrées, chargés à la demande)
public/data/maps.json    Référentiel des 15 000 cartes (id, x, y, monde, sous-zone, extérieur) — npm run maps
public/data/subareas.json, areas.json  Noms des sous-zones et zones
public/data/worlds.json  Géométrie des calques (pour placer les tuiles officielles du monde)
public/data/banks.json   Banques prédéfinies (carte du banquier)
public/data/zaaps.json   Zaaps affichés sur la carte
tests/                   Tests (npm test)
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
- `worlds.json` (géométrie des calques) et `banks.json` (banques) : repris du projet Script Creator (`limposteur/mizan_script`).

## Tests

```bash
npm test         # import puis génération de exemples/*.lua
npm run typecheck
```

Les tests vérifient que `exemples/bucheron.lua`, importé puis regénéré, est **identique à l'octet près**,
que `paysan.lua` / `mineur.lua` (écrits à la main) ne perdent aucune ligne, que les automatismes font
l'aller-retour génération → import → génération sans changement, et que les cartes des exemples existent.
