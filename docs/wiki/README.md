# TURBZ wiki sources

This folder is the source of the player wiki published to the repo's **GitHub Wiki**.

- `pages/*.md`: hand-written pages. A `<!-- gen:name -->` marker is replaced at build time with a table generated from the game's data (`src/game/*.ts`), so numbers never drift from the game. Generators live in `scripts/wiki/build-wiki.mjs` (`GEN[...]`).
- `terms.json`: glossary terms for mechanics. Every named thing in the game (verses, classes, items, monsters, enchantments, sets, NPCs, places…) is added to the Glossary automatically.
- `sidebar.md`: the wiki sidebar.

## Build

```bash
npm run wiki            # builds into wiki-out/
npm run wiki:check      # builds and fails on broken links or unknown markers (part of npm test)
```

## Publish

Pushing to `main` runs `.github/workflows/wiki.yml`, which rebuilds the wiki and pushes it to `<repo>.wiki.git`. The very first time, create any page in the GitHub Wiki tab so the wiki repository exists.

## In-game wiki

The build also publishes `wiki-index.json` to the wiki. It lists every page, every section anchor and every glossary term with its references. An in-game wiki can load it plus any page as raw markdown from:

```
https://raw.githubusercontent.com/wiki/keganacummings-source/V6-TURBZ/wiki-index.json
https://raw.githubusercontent.com/wiki/keganacummings-source/V6-TURBZ/<Page-Name>.md
```

Both URLs allow cross-origin requests, so the game can fetch them directly.
