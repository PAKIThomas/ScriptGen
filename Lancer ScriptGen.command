#!/bin/bash
# Double-clic sur Mac : installe les dépendances la première fois, puis lance ScriptGen.
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js n'est pas installé : https://nodejs.org"
  read -r -p "Entrée pour fermer…"
  exit 1
fi
[ -d node_modules ] || npm install
npm start
