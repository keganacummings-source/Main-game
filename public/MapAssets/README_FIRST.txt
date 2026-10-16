MAP BUILDING ASSET CATALOG
=========================

Purpose
-------
A standalone library of the worldbuilding/terrain assets extracted from the organized Dungeon Crawl Stone Soup asset pack. It is intended for world-map and area construction.

Folders
-------
01_Floor_and_Ground_Tiles       Floor and ground surfaces
02_Walls_and_Cliffs             Walls, stone boundaries and cliff-like tiles
03_Water_and_Liquid_Tiles       Water and liquid terrain
04_Trees_and_Vegetation         Trees and vegetation
05_Doors_and_Entrances          Doors and entry pieces
06_Gates_and_Portals            Gates, gateways and portal pieces
07_Altars_and_Shrines           Altars and shrine props
08_Statues_and_Landmarks        Statues and landmark props
09_Traps_and_Hazards            Traps and hazard objects
10_Shops_and_Buildings          Shop/building-related props
11_Vaults_and_Special_Areas     Vault/special-area assets
12_Dungeon_Tiles_Other          Dungeon tiles or items not covered by the above categories

Catalog files
-------------
map_asset_catalog.csv: one row per copied asset, including the catalog location and original source path, filename, extension, byte size and image dimensions where readable.
category_summary.csv: number of assets in each folder.

Notes
-----
- Original image contents are preserved; assets are copied, not recolored or edited.
- Files are grouped by the existing curated category. Original source paths are recorded in the CSV for traceability.
- The source pack is primarily dungeon-crawler tiles and props. A category name does not guarantee that every tile is suitable for a large overworld; preview tiles and check their edges/variants before using them in a connected map.
- No assets have been invented or generated.
