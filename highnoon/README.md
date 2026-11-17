# HIGH NOON — Web + LÖVE Source

## Play in the browser
1. Upload this whole folder to your website (or any static host).
2. Open `index.html` in a browser.
3. Works offline once loaded. Uses `localStorage` for high scores.

**Controls**
- Move: WASD / Arrow keys  
- Shot: Space / Z  
- High shot: A / X / Shift  
- Duck: S / Down  
- Jump: W / Up  
- On phones: on-screen buttons appear automatically  

## What’s included
| Path | Description |
|------|-------------|
| `index.html` | Full HTML5 port (canvas). Upload this to play on the web. |
| `love_source/` | Original LÖVE 11.4 game source (`main.lua`, `conf.lua`, font) |
| `love_source` → zip as `.love` | See below |

## Build a `.love` from source
```bash
cd love_source
zip -r ../HighNoon.love main.lua conf.lua assets/
```
Run with [LÖVE 11.4+](https://love2d.org/).

## Note on “web love”
LÖVE does not run natively in browsers. This package uses a **1:1 HTML5 rewrite** of the game systems (village → approach → pyramid, duels, gangs, lives, undead, XP/skills) so you can host it with zero server setup.

## Progression
1. **Village** — 8 kills → Muerte Gang → clear → +1 life  
2. **Approach** — 8 kills → Sand Vipers → clear → +1 life  
3. **Pyramid** — undead cowboys, deeper floors  
