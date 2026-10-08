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

| Onglet | Ce qu'on y fait |
|---|---|
| **Trajet** | `move()`, `bank()` et `phenix()`. Clic sur la carte = ajoute la carte (`"x,y"`) au trajet ; un intérieur (mine, donjon) s'ajoute par son **id de carte**. Paliers de niveau (métier ou personnage) avec, par palier, la liste de récolte et les filtres de monstres (`config:set…`). Liste des étapes réordonnable (glisser), duplication, suppression ; détail d'une étape à droite (récolte, combat, banque, coffre / maison à code, porte, cellule, sortie, Lua `custom`). |
| **Paramètres** | Tous les globals de l'API (`MAX_PODS`, `AUTO_DELETE`, `MIN/MAX_MONSTERS`, `FORBIDDEN/FORCE_MONSTERS`, `MONSTERS_AMOUNT`, régénération, verrous de combat, sécurité, `PLANNING`…), par catégorie, avec recherche et sélecteurs de monstres / objets / ressources. |
| **Script & Lua brut** | En-tête, `onFightEnd`, ordre des blocs, et le code « Lua brut » conservé à l'import. |

- **Importer .lua** (ou *Ouvrir… → Scripts d'exemple*) : le script est relu avec un vrai parseur Lua.
  Ce qui est reconnu devient éditable ; **tout le reste est conservé à l'identique** en « Lua brut ».
- L'**aperçu Lua** à droite se met à jour en direct. **Exporter** écrit `nom_du_fichier.lua` dans le dossier d'export, 📁 l'ouvre dans le Finder.
- **Carte** : fond de carte de dofus-map.com (case « Fond », opacité réglable), survol = sous-zone et id de la carte.
  Les cartes en id (intérieurs) sont placées à leurs coordonnées, en pointillés (⌂).
  **🔍 Chercher une carte** : par id, par « x,y » ou par nom de sous-zone, avec l'image de la carte (DofusDB) ;
  « + par x,y » pour l'extérieur, « + par id » pour un intérieur.
- **Vérifications** (sous la liste des étapes) : id de carte inconnu, coordonnées sans carte, étape sans sortie,
  coffre / maison mal formés, bank() qui ne dépose rien… Clic sur une alerte = aller à l'étape.
- ⌘Z / ⇧⌘Z : annuler / rétablir. Le projet en cours est aussi sauvegardé automatiquement dans le navigateur.

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
  data/                  Monstres, interactifs (JSON), métiers et ressources (Annexe du guide)
  components/            Interface React (carte, étapes, paramètres, sélecteurs)
public/data/items.json   Objets (19 000 entrées, chargés à la demande)
public/data/maps.json    Référentiel des 15 000 cartes (id, x, y, monde, sous-zone, extérieur) — npm run maps
public/data/subareas.json, areas.json  Noms des sous-zones et zones
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
- les **tuiles du fond de carte** depuis `dofus-map.com` (case « Fond » décochable) ;
- les **images des cartes** depuis `api.dofusdb.fr`.

Le référentiel des cartes (`public/data/maps.json`) est déjà dans le dépôt : il ne faut internet que pour le
mettre à jour après une grosse mise à jour de Dofus (`npm run maps`). Sans internet, tout le reste fonctionne.

## Tests

```bash
npm test         # import puis génération de exemples/*.lua
npm run typecheck
```

Le test principal vérifie que `exemples/bucheron.lua`, importé puis regénéré, est **identique à l'octet près**,
et que `paysan.lua` / `mineur.lua` (écrits à la main) ne perdent aucune ligne.
