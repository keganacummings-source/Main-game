# MapAssets

DCSS-derived map-building tiles (from TURBZ2 `Map_Building_Asset_Catalog`).

- `catalog.json` — index used by Lets Build and the game
- Category folders `01_…`–`12_…` — PNG tiles

If tiles are missing locally, the Cloudflare build runs:

```bash
node scripts/fetch-map-assets.mjs
```

which downloads the catalog zip from TURBZ2 and rebuilds `catalog.json`.
