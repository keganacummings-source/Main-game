# Quality of life and bugfixes

## Easier controls and menus

- **V** opens Verses; **H** opens Hardcore Survival. The pause menu lists controls.
- Typing in chat/search, selecting fields, and editing text stop movement. Held
  movement keys, the touch stick, pointer drag and click destinations reset on
  focus loss. Holding a menu key no longer repeatedly opens/closes that menu.
- **E** can gather rebuilt-world resource trees or collect nearby water when no
  keeper, landmark or portal takes priority. Repeated gathering does not restart
  the active progress bar.
- Inventory search matches names, gear slots and qualities. Filter Everything,
  Items or Gear; worn gear appears first. Empty results are explained.
- Crafting shows available materials and disables recipes when ingredients are
  missing. Survival includes quick meals and drinking water. Quick meals choose
  a portion that fits your missing hunger where possible.
- The map shows water tiles and saved world campfires; changes to a dungeon's
  cleared status refresh its map marker.

## Fixed

- Buff draughts consume exactly one item. Hardcore Warmth Tonic gives its fire
  buff without healing injuries. Empty stacks cannot provide free buffs.
- Full health, hunger or thirst no longer waste healing items, food or water.
  Crafting resources and uncooked Hardcore food show why they cannot be used.
- Smoke bombs respect walls and persist their consumption. Cleansing salt also
  saves immediately.
- Enemy deaths award XP, money and loot once, even when multiple hits land.
- Worn gear cannot be sold until a replacement is equipped. Selling selected
  spare gear clears its selection.
- Hardcore bulk selling sells hides and ore while retaining meat, fish,
  mushrooms, logs and other survival supplies.
- Continue in the same session uses the newest saved progress. Hiding/leaving
  the page saves progress. Local-storage failures no longer crash gameplay.
- Standard-mode death also survives reload. Escape, menu controls and incoming
  trade requests cannot dismiss the rebirth screen.
- Saved positions inside blocked dungeon terrain relocate on the overworld.
- Stopping/remounting the game cleans up input listeners and music, preventing
  duplicate hotkeys or overlapping tracks.

These changes preserve the previous class, sprite, builder, progression, dungeon
and survival updates. Multiplayer still requires live two-player verification;
this pass verifies individual engine operations and local UI behavior.


## Smoother rendering and animation

- Static terrain now uses one bounded camera-window bitmap instead of repainting
  every visible tile on every frame. It refreshes near the edge, on resize, and
  when tile images finish loading; distant zooms avoid oversized allocations.
- Canvas dimensions are read on resize instead of forcing a layout read each frame.
- Walking sprites use the center/left/center/right cycle at the existing movement
  beat rate, rather than multiplying that rate again. Stopped, blocked and rooted
  players display the standing pose.
