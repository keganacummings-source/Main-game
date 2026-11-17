-- HIGH NOON — Reaction-based cowboy shooter
-- v3: Village → Muerte Gang → Pyramid floor progression

math.randomseed(os.time())

-- ─── PALETTE ────────────────────────────────────────────────────────────────
local C = {
  sky        = {0.87, 0.80, 0.55, 1},
  sky2       = {0.95, 0.70, 0.35, 1},
  ground     = {0.65, 0.48, 0.28, 1},
  sand       = {0.80, 0.68, 0.42, 1},
  dark       = {0.12, 0.08, 0.05, 1},
  white      = {1,    1,    1,    1},
  red        = {0.90, 0.18, 0.12, 1},
  yellow     = {1.00, 0.88, 0.10, 1},
  green      = {0.20, 0.72, 0.22, 1},
  blood      = {0.65, 0.05, 0.05, 1},
  shadow     = {0.00, 0.00, 0.00, 0.35},
  flash      = {1,    1,    1,    0.9},
  hud_bg     = {0.10, 0.07, 0.03, 0.88},
  cactus     = {0.26, 0.52, 0.18, 1},
  wood       = {0.55, 0.36, 0.18, 1},
  roof       = {0.72, 0.42, 0.20, 1},
  gold       = {1.00, 0.78, 0.10, 1},
  smoke      = {0.70, 0.65, 0.55, 0.6},
  bounty     = {0.85, 0.20, 0.08, 1},
  gang_bg    = {0.10, 0.04, 0.02, 1},
  wanted     = {0.95, 0.88, 0.60, 1},
  -- pyramid
  stone      = {0.55, 0.48, 0.38, 1},
  stone2     = {0.42, 0.36, 0.28, 1},
  stoneDark  = {0.22, 0.18, 0.14, 1},
  torch      = {1.00, 0.70, 0.25, 1},
  hieroglyph = {0.75, 0.62, 0.35, 1},
}

-- ─── FONTS ──────────────────────────────────────────────────────────────────
local fonts = {}
local function Font(sz)
  if not fonts[sz] then
    local ok, f = pcall(love.graphics.newFont, "assets/fonts/PressStart2P.ttf", sz)
    fonts[sz] = ok and f or love.graphics.newFont(sz)
    fonts[sz]:setFilter("nearest","nearest")
  end
  return fonts[sz]
end

-- ─── CANVAS ─────────────────────────────────────────────────────────────────
local W, H = 320, 320
local canvas

-- ─── GAME STATE ─────────────────────────────────────────────────────────────
local SCREEN = "title"

local highscores = {}
local SCORES_FILE = "highnoon_scores.txt"
local function saveScores()
  local lines = {}
  for _, s in ipairs(highscores) do lines[#lines+1] = tostring(s) end
  love.filesystem.write(SCORES_FILE, table.concat(lines, "\n"))
end
local function loadScores()
  highscores = {}
  if love.filesystem.getInfo(SCORES_FILE) then
    local data = love.filesystem.read(SCORES_FILE)
    for line in (data.."\n"):gmatch("([^\n]*)\n") do
      local n = tonumber(line)
      if n then highscores[#highscores+1] = n end
    end
    table.sort(highscores, function(a,b) return a > b end)
  end
end

-- ─── WORLD MAP ──────────────────────────────────────────────────────────────
local MAP_W, MAP_H = 40, 30
local TILE = 8
local T_GROUND, T_ROAD, T_STONE, T_FLOOR = 1, 2, 3, 4
local world, decor = {}, {}
local cam = {x=0, y=0}
local player = {}
local npcs = {}

-- ─── STAGE / AREA PROGRESSION ───────────────────────────────────────────────
-- village  → 8 kills → Muerte Gang → clear
-- approach → road to pyramid, 8 kills → Sand Viper Gang → clear
-- pyramid  → Floor 1, 2, 3... clear floor to go deeper
local BOUNTY_THRESHOLD = 8
local stage = {
  id           = "village",  -- village | approach | pyramid | transition | floorclear
  floor        = 1,
  areaKills    = 0,          -- kills in current outdoor area (resets per area)
  floorKills   = 0,          -- kills on current pyramid floor
  floorGoal    = 8,          -- kills to clear a pyramid floor
  transitionT  = 0,
  transitionTo = nil,        -- next stage id after transition
  bannerTimer  = 0,
  bannerText   = "",
}

-- ─── BOUNTY SYSTEM ──────────────────────────────────────────────────────────
local bounty = {
  active   = false,
  wantedFlash = 0,
  warned   = false,
  kills_at_trigger = 0,
  gangType = "muerte",       -- "muerte" | "viper"
}

-- ─── GANG BATTLE STATE ──────────────────────────────────────────────────────
-- gangBattle holds state for the 3-man sequential gang fight
local gangBattle = {
  active    = false,
  members   = {},     -- {name, hat, coat, react, alive}
  current   = 1,      -- index of current fighter (1,2,3)
  phase     = "intro",-- intro | duel_wait | duel_draw | duel_shot | between | complete
  timer     = 0,
  countdown = 0,
  waitTime  = 0,
  win       = false,
  flashAlpha= 0,
  flashColor= C.flash,
  beepTimer = 0,
  shotSmoke = 0,
  earlyShot = false,
  playerShot= false,
  npcShot   = false,
  resultTimer=0,
  introTimer= 0,
}

-- Gang definitions by type
local GANGS = {
  muerte = {
    title = "THE MUERTE GANG",
    names = { "Rattler", "Coyote", "El Diablo" },
    coats = { 4, 3, 2 },
    hats  = { 1, 1, 2 },
    reacts = { {0.45,0.65}, {0.28,0.45}, {0.16,0.30} },
  },
  viper = {
    title = "THE SAND VIPERS",
    names = { "Asp", "Sidewinder", "King Cobra" },
    coats = { 3, 4, 4 },
    hats  = { 2, 1, 1 },
    reacts = { {0.38,0.55}, {0.22,0.38}, {0.12,0.24} },  -- harder
  },
}

-- ─── DUEL STATE (normal 1v1) ─────────────────────────────────────────────────
-- Multi-exchange combat: Shoot / Shoot High / Duck / Jump
-- Up to MAX_ROUNDS exchanges; if nobody is hit → STANDOFF (draw)
local MAX_ROUNDS = 6
local duel = {
  active    = false,
  npc       = nil,
  phase     = "wait",
  waitMin   = 1.1,
  waitMax   = 3.2,
  timer     = 0,
  countdown = 0,
  flashAlpha= 0,
  flashColor= C.flash,
  beepTimer = 0,
  playerShot= false,
  npcShot   = false,
  resultTimer=0,
  win       = false,
  shotSmoke = 0,
  earlyShot = false,
  waitTime  = 0,
  -- new multi-round fields
  round     = 1,
  playerAction = nil,   -- "shoot" | "shoot_high" | "duck" | "jump"
  npcAction    = nil,
  playerActTime= 0,
  npcActTime   = 0,
  resultText   = "",
  standoff     = false, -- true when 6 rounds with no hit
}

-- ─── HELPERS ────────────────────────────────────────────────────────────────
local function rnd(a,b)  return a + math.random()*(b-a) end
local function rndi(a,b) return math.random(a,b) end
local function setColor(c) love.graphics.setColor(c) end
local function lerp(a,b,t) return a+(b-a)*t end

-- ─── WORLD GEN: VILLAGE ─────────────────────────────────────────────────────
local function genVillage()
  world = {}
  for y=1,MAP_H do world[y]={} for x=1,MAP_W do world[y][x]=T_GROUND end end
  for x=1,MAP_W do
    for dy=-1,1 do local y=math.floor(MAP_H/2)+dy; if y>=1 and y<=MAP_H then world[y][x]=T_ROAD end end
  end
  for y=1,MAP_H do
    for dx=-1,1 do local x=math.floor(MAP_W/2)+dx; if x>=1 and x<=MAP_W then world[y][x]=T_ROAD end end
  end
  decor={}
  local function isRoad(x,y)
    if x<1 or y<1 or x>MAP_W or y>MAP_H then return true end
    return world[y][x]==T_ROAD
  end
  for _=1,40 do
    local x,y=rndi(2,MAP_W-1),rndi(2,MAP_H-1)
    if not isRoad(x,y) and not isRoad(x-1,y) and not isRoad(x+1,y) then
      decor[#decor+1]={x=x,y=y,kind="cactus",h=rndi(1,3)}
    end
  end
  local buildZones={{2,2,10,8},{28,2,38,8},{2,20,12,28},{28,20,38,28}}
  for _,bz in ipairs(buildZones) do
    for _=1,rndi(2,4) do
      local x=rndi(bz[1]+1,bz[3]-2); local y=rndi(bz[2]+1,bz[4]-2)
      if not isRoad(x,y) then decor[#decor+1]={x=x,y=y,kind="building",w=rndi(2,4),h_tiles=rndi(2,3)} end
    end
  end
end

-- ─── WORLD GEN: PYRAMID FLOOR ───────────────────────────────────────────────
local function genPyramidFloor(floorNum)
  floorNum = floorNum or 1
  world = {}
  -- fill with solid stone
  for y=1,MAP_H do
    world[y]={}
    for x=1,MAP_W do world[y][x]=T_STONE end
  end
  -- carve cross corridors + chambers as walkable floor
  local midY, midX = math.floor(MAP_H/2), math.floor(MAP_W/2)
  local function carve(x1,y1,x2,y2)
    for y=math.max(1,y1),math.min(MAP_H,y2) do
      for x=math.max(1,x1),math.min(MAP_W,x2) do
        world[y][x]=T_FLOOR
      end
    end
  end
  -- main halls (cross)
  carve(2, midY-1, MAP_W-1, midY+1)
  carve(midX-1, 2, midX+1, MAP_H-1)
  -- side chambers
  carve(4, 4, 12, 10)                         -- NW
  carve(MAP_W-12, 4, MAP_W-3, 10)              -- NE
  carve(4, MAP_H-10, 12, MAP_H-3)              -- SW
  carve(MAP_W-12, MAP_H-10, MAP_W-3, MAP_H-3)  -- SE
  -- connect each chamber to the main cross (no isolated rooms)
  carve(7, 10, 9, midY)                       -- NW down to hall
  carve(MAP_W-9, 10, MAP_W-7, midY)           -- NE down to hall
  carve(7, midY, 9, MAP_H-10)                 -- SW up to hall
  carve(MAP_W-9, midY, MAP_W-7, MAP_H-10)     -- SE up to hall
  carve(12, 6, midX, 8)                       -- NW across to vertical hall
  carve(midX, 6, MAP_W-12, 8)                 -- NE across to vertical hall
  carve(12, MAP_H-8, midX, MAP_H-6)           -- SW across
  carve(midX, MAP_H-8, MAP_W-12, MAP_H-6)     -- SE across
  -- central chamber (overlaps halls)
  carve(midX-5, midY-5, midX+5, midY+5)

  decor={}
  -- pillars along halls
  for x=6,MAP_W-5,6 do
    if world[midY-3] and world[midY-3][x]==T_STONE then
      decor[#decor+1]={x=x,y=midY-3,kind="pillar"}
    end
    if world[midY+3] and world[midY+3][x]==T_STONE then
      decor[#decor+1]={x=x,y=midY+3,kind="pillar"}
    end
  end
  -- torches on floor edges
  for _=1,18 do
    local x,y=rndi(3,MAP_W-2),rndi(3,MAP_H-2)
    if world[y][x]==T_FLOOR then
      decor[#decor+1]={x=x,y=y,kind="torch"}
    end
  end
  -- hieroglyph wall marks
  for _=1,12 do
    local x,y=rndi(2,MAP_W-1),rndi(2,MAP_H-1)
    if world[y][x]==T_STONE then
      decor[#decor+1]={x=x,y=y,kind="glyph"}
    end
  end
end

-- Road / dunes leading to the Pyramid (between village and interior)
local function genApproach()
  world = {}
  for y=1,MAP_H do world[y]={} for x=1,MAP_W do world[y][x]=T_GROUND end end
  -- single long road east toward the pyramid
  local roadY = math.floor(MAP_H/2)
  for x=1,MAP_W do
    for dy=-1,1 do
      local y=roadY+dy
      if y>=1 and y<=MAP_H then world[y][x]=T_ROAD end
    end
  end
  decor={}
  -- sparse cacti
  for _=1,28 do
    local x,y=rndi(2,MAP_W-8),rndi(2,MAP_H-1)
    if world[y][x]~=T_ROAD then
      decor[#decor+1]={x=x,y=y,kind="cactus",h=rndi(1,3)}
    end
  end
  -- a few ruined shacks
  for _=1,4 do
    local x,y=rndi(4,MAP_W-12),rndi(3,MAP_H-6)
    if world[y][x]~=T_ROAD then
      decor[#decor+1]={x=x,y=y,kind="building",w=rndi(2,3),h_tiles=rndi(1,2)}
    end
  end
  -- pyramid silhouette markers on the far east edge
  for i=0,5 do
    decor[#decor+1]={x=MAP_W-2, y=roadY-3+i, kind="glyph"}
  end
  decor[#decor+1]={x=MAP_W-1, y=roadY, kind="pillar"}
  decor[#decor+1]={x=MAP_W-1, y=roadY-2, kind="pillar"}
  decor[#decor+1]={x=MAP_W-1, y=roadY+2, kind="pillar"}
end

local function genWorld()
  if stage.id == "pyramid" or stage.id == "floorclear" then
    genPyramidFloor(stage.floor)
  elseif stage.id == "approach" then
    genApproach()
  else
    genVillage()
  end
end

-- Forward-declare so enterArea can call spawnNPCs (Lua local visibility)
local spawnNPCs

local function resetStageToVillage()
  stage.id = "village"
  stage.floor = 1
  stage.areaKills = 0
  stage.floorKills = 0
  stage.floorGoal = 8
  stage.transitionT = 0
  stage.transitionTo = nil
  stage.bannerTimer = 0
  stage.bannerText = ""
  bounty = {active=false, wantedFlash=0, warned=false, kills_at_trigger=0, gangType="muerte"}
end

local function startTransition(toId, banner)
  stage.id = "transition"
  stage.transitionTo = toId
  stage.transitionT = 0
  stage.bannerText = banner or ""
  stage.bannerTimer = 3.2
  SCREEN = "transition"
end

local function enterArea(id)
  stage.id = id
  stage.areaKills = 0
  stage.floorKills = 0
  bounty.active = false
  bounty.warned = false
  bounty.wantedFlash = 0
  if id == "village" then
    bounty.gangType = "muerte"
    genVillage()
  elseif id == "approach" then
    bounty.gangType = "viper"
    genApproach()
  elseif id == "pyramid" then
    genPyramidFloor(stage.floor)
  end
  -- place player on road / floor center
  local roadY = math.floor(MAP_H/2)
  player.tx = math.floor(MAP_W/2)
  player.ty = roadY
  if id == "approach" then player.tx = 4 end
  if id == "pyramid" then
    player.tx = math.floor(MAP_W/2)
    player.ty = math.floor(MAP_H/2)
  end
  player.px = (player.tx-1)*TILE
  player.py = (player.ty-1)*TILE
  cam.x = player.tx - W/(TILE*2)
  cam.y = player.ty - H/(TILE*2)
  spawnNPCs()
  SCREEN = "explore"
end

-- ─── NPC SPAWN ──────────────────────────────────────────────────────────────
local NPC_NAMES   = {"Kid","Buck","Doc","Hank","Cole","Slim","Rex","Zeke","Ace","Ike"}
local APP_NAMES   = {"Dust","Mirage","Cinder","Bone","Hawk","Drift","Scorp","Dune"}
local PYR_NAMES   = {"Bone","Grim","Rotjaw","Dust","Skull","Coffin","Shade","Wight","Hollow","Rattle"}
local NPC_REACT_MIN = 0.22
local NPC_REACT_MAX = 0.90

spawnNPCs = function()
  npcs={}
  local roadY=math.floor(MAP_H/2); local roadX=math.floor(MAP_W/2)
  local placed={}
  local function notNear(x,y)
    local dx=x-player.tx; local dy=y-player.ty
    return math.sqrt(dx*dx+dy*dy)>5
  end
  local count, names, rMin, rMax = 8, NPC_NAMES, NPC_REACT_MIN, NPC_REACT_MAX
  if stage.id == "approach" then
    count, names, rMin, rMax = 8, APP_NAMES, 0.20, 0.80
  elseif stage.id == "pyramid" then
    -- deeper floors: more enemies, faster
    count = 6 + math.min(4, stage.floor)
    names = PYR_NAMES
    rMin = math.max(0.12, 0.20 - stage.floor * 0.015)
    rMax = math.max(0.40, 0.75 - stage.floor * 0.04)
  end

  for i=1,count do
    for _=1,60 do
      local x,y
      local valid = true
      if stage.id == "pyramid" then
        x,y = rndi(2,MAP_W-1), rndi(2,MAP_H-1)
        if not world[y] or world[y][x] ~= T_FLOOR then valid = false end
      else
        local r=math.random(4)
        if r==1 then x=rndi(2,MAP_W-1);y=roadY+rndi(-1,1)
        elseif r==2 then x=roadX+rndi(-1,1);y=rndi(2,MAP_H-1)
        elseif r==3 then x=rndi(2,10);y=rndi(2,MAP_H-1)
        else x=rndi(MAP_W-10,MAP_W-1);y=rndi(2,MAP_H-1) end
      end
      if valid then
        local key=x..","..y
        if not placed[key] and notNear(x,y) then
          placed[key]=true
          npcs[#npcs+1]={
            tx=x,ty=y,px=(x-1)*TILE,py=(y-1)*TILE,
            name=names[((i-1)%#names)+1],
            react=rnd(rMin,rMax),
            alive=true,dir=1,moveTimer=rnd(1,3),
            hat=rndi(1,3),
            coat=(stage.id=="pyramid") and rndi(3,4) or rndi(1,4),
            isUndead=(stage.id=="pyramid"),
          }
          break
        end
      end
    end
  end
end

-- ─── PLAYER INIT + PROGRESSION ──────────────────────────────────────────────
-- Skills scale with level and directly affect duel mechanics:
--   quickdraw : head-start after DRAW + lightning-draw bonus window
--   presence  : makes NPCs hesitate (higher effective react time)
--   focus     : late-wait shots are forgiven (almost-DRAW grace)
local function initPlayer()
  local roadY=math.floor(MAP_H/2)
  player={
    tx=math.floor(MAP_W/2),ty=roadY,
    px=0,py=0,dir=1,
    moveTimer=0,alive=true,score=0,
    hat=2,coat=1,
    walkFrame=0,walkTimer=0,
    engageRange=4,
    lives=1,              -- start with 1 life; each bounty claim grants +1
    maxLives=9,
    lifeFlash=0,          -- banner timer when gaining/losing a life
    lifeFlashText="",
    -- progression
    level=1,
    xp=0,
    xpToNext=40,
    skills={ quickdraw=1, presence=1, focus=1 },
    levelUpTimer=0,
    lastXpGain=0,
    lastXpReason="",
  }
  player.px=(player.tx-1)*TILE; player.py=(player.ty-1)*TILE
  cam.x=player.tx-W/(TILE*2); cam.y=player.ty-H/(TILE*2)
  bounty={active=false,wantedFlash=0,warned=false,kills_at_trigger=0,gangType="muerte"}
end

-- Returns true if the run is over (no lives left)
local function loseLife(reason)
  player.lives = (player.lives or 1) - 1
  if player.lives <= 0 then
    player.alive = false
    player.lives = 0
    highscores[#highscores+1] = player.score
    table.sort(highscores, function(a,b) return a > b end)
    while #highscores > 10 do table.remove(highscores) end
    saveScores()
    SCREEN = "dead"; deadTimer = 0; deadFlash = 1.0
    return true
  end
  -- still have lives: snap back to explore
  player.alive = true
  player.lifeFlash = 2.0
  player.lifeFlashText = "LOST A LIFE  ("..player.lives.." LEFT)"
  if duel then duel.active = false end
  if gangBattle then gangBattle.active = false end
  bounty.active = false
  bounty.warned = false
  bounty.wantedFlash = 0
  -- clear the NPC that killed you if still referenced
  if duel and duel.npc then duel.npc.alive = true end
  SCREEN = "explore"
  return false
end

local function gainLife(amount)
  amount = amount or 1
  local before = player.lives or 1
  player.lives = math.min(player.maxLives or 9, before + amount)
  if player.lives > before then
    player.lifeFlash = 2.2
    player.lifeFlashText = "+1 LIFE  (BOUNTY)  x"..player.lives
  end
end

local function skillVal(name)
  return (player.skills and player.skills[name]) or 1
end

-- Head-start seconds the player gets after DRAW before NPC timer truly starts
local function getHeadstart()
  return skillVal("quickdraw") * 0.014
end

-- How many seconds early (before waitTime ends) still counts as a valid draw
local function getFocusGrace()
  return 0.06 + skillVal("focus") * 0.04
end

-- Presence makes the outlaw hesitate (effective react time goes up)
local function getEffectiveReact(base)
  local mult = 1 + skillVal("presence") * 0.018
  return math.min(base * mult, 1.35)  -- soft cap so bosses stay scary
end

local function checkLevelUp()
  while player.xp >= player.xpToNext do
    player.xp = player.xp - player.xpToNext
    player.level = player.level + 1
    player.xpToNext = math.floor(28 + player.level * 14 + player.level * player.level * 0.8)
    -- auto-improve skills
    player.skills.quickdraw = player.skills.quickdraw + 1
    player.skills.presence  = player.skills.presence  + 1
    if player.level % 2 == 0 then
      player.skills.focus = player.skills.focus + 1
    end
    -- engage range grows slowly
    player.engageRange = 4 + math.floor((player.level - 1) / 3)
    player.levelUpTimer = 2.4
  end
end

local function gainXP(amount, reason)
  if amount <= 0 then return end
  player.xp = player.xp + amount
  player.lastXpGain = amount
  player.lastXpReason = reason or "KILL"
  checkLevelUp()
end

-- XP formula: faster (lower react) enemies are worth more
local function xpForEnemy(react, isGang)
  local base = isGang and 28 or 14
  local speedBonus = math.floor((NPC_REACT_MAX - react) * 22)
  return base + speedBonus + (player.level - 1) * 2
end

-- ─── COMBAT ACTION SYSTEM ───────────────────────────────────────────────────
-- Actions: "shoot" (normal/mid), "shoot_high", "duck", "jump"
-- Duck avoids normal shot. Jump avoids high shot.
-- Both shooting → faster actor wins.
-- Matching dodge → continue. Wrong dodge or standing → hit.

local function pickNpcAction(isGang, round)
  -- Aggressive NPCs (and later rounds) prefer shooting
  local roll = math.random()
  local shootBias = isGang and 0.55 or 0.42
  shootBias = shootBias + (round - 1) * 0.04
  if roll < shootBias then
    return (math.random() < 0.55) and "shoot" or "shoot_high"
  elseif roll < shootBias + 0.28 then
    return "duck"
  else
    return "jump"
  end
end

local function isOffensive(act)
  return act == "shoot" or act == "shoot_high"
end

-- Returns: "player_win" | "npc_win" | "continue" | "double"
local function resolveExchange(pAct, nAct, pTime, nTime)
  pAct = pAct or "stand"
  nAct = nAct or "stand"
  local pOff = isOffensive(pAct)
  local nOff = isOffensive(nAct)

  if pOff and nOff then
    -- both fired: whoever was faster hits
    if pTime < nTime - 0.015 then return "player_win"
    elseif nTime < pTime - 0.015 then return "npc_win"
    else return "double" end
  end

  if pOff and not nOff then
    -- player shot, NPC tried to dodge or stood
    if (pAct == "shoot" and nAct == "duck") or (pAct == "shoot_high" and nAct == "jump") then
      return "continue"
    end
    return "player_win"
  end

  if nOff and not pOff then
    if (nAct == "shoot" and pAct == "duck") or (nAct == "shoot_high" and pAct == "jump") then
      return "continue"
    end
    return "npc_win"
  end

  -- both defensive or standing
  return "continue"
end

local function actionLabel(act)
  if act == "shoot" then return "SHOT"
  elseif act == "shoot_high" then return "HIGH"
  elseif act == "duck" then return "DUCK"
  elseif act == "jump" then return "JUMP"
  else return "..." end
end

-- Unified input map — multiple keys per action so it feels easy under pressure
local function actionFromKey(key)
  if key == "space" or key == "z" or key == "return" or key == "kpenter" then
    return "shoot"
  elseif key == "x" or key == "c" or key == "a" or key == "left"
      or key == "lshift" or key == "rshift" then
    return "shoot_high"
  elseif key == "s" or key == "down" then
    return "duck"
  elseif key == "w" or key == "up" then
    return "jump"
  end
  return nil
end

-- ─── DRAWING HELPERS ────────────────────────────────────────────────────────
local function drawRect(x,y,w,h,c)
  setColor(c); love.graphics.rectangle("fill",x,y,w,h)
end

-- ═══════════════════════════════════════════════════════════════════════════
-- REFINED COWBOY SPRITE
-- 10px wide × 18px tall at scale=1
-- Origin = bottom-center
-- ═══════════════════════════════════════════════════════════════════════════
local COAT_COLORS = {
  {0.82,0.65,0.40,1},   -- 1 tan
  {0.50,0.32,0.15,1},   -- 2 brown
  {0.52,0.52,0.50,1},   -- 3 grey
  {0.18,0.14,0.12,1},   -- 4 black
}
local HAT_COLORS = {
  {0.20,0.14,0.08,1},   -- 1 dark brown (tall)
  {0.48,0.32,0.14,1},   -- 2 tan (wide)
  {0.30,0.22,0.14,1},   -- 3 worn grey-brown
}
local SKIN = {0.88,0.70,0.52,1}
local LEATHER = {0.22,0.14,0.07,1}
local GUNMETAL = {0.55,0.55,0.58,1}
local GUNWOOD  = {0.45,0.26,0.10,1}

-- pose: "stand" | "shoot" | "shoot_high" | "duck" | "jump"
-- IMPORTANT: always draw in RIGHT-facing local coords. R() mirrors when dir==-1.
-- isUndead: pyramid enemies — bone skin, hollow glow eyes, tattered coat
local function drawCowboy(px, py, dir, hat, coat, dead, walkFrame, pose, isGang, isUndead)
  pose = pose or "stand"
  local isShooting = (pose == "shoot" or pose == "shoot_high")
  local isDuck = (pose == "duck")
  local isJump = (pose == "jump")

  local bx = math.floor(px - 5)
  local by = math.floor(py - 18)
  if isJump then by = by - 6 end
  if isDuck then by = by + 5 end
  local flip = (dir == -1)

  local function LX(x, w)
    w = w or 1
    return flip and (10 - x - w) or x
  end
  local function R(x, y, w, h, c)
    setColor(c)
    love.graphics.rectangle("fill", bx + LX(x, w), by + y, w, h)
  end

  -- palette overrides for undead
  local skin = SKIN
  local coatCol = COAT_COLORS[coat] or COAT_COLORS[1]
  local leather = LEATHER
  if isUndead then
    skin = {0.78, 0.82, 0.72, 1}           -- bone / sickly green-white
    coatCol = {0.28, 0.30, 0.26, 1}         -- moldy dark grey-green coat
    leather = {0.18, 0.16, 0.12, 1}
  end

  -- ── Dead ────────────────────────────────────────────────────────────────
  if dead then
    setColor(C.shadow)
    love.graphics.ellipse("fill", bx+5, by+18, 7, 2)
    setColor(coatCol)
    love.graphics.rectangle("fill", bx, by+15, 12, 3)
    setColor(HAT_COLORS[hat])
    love.graphics.rectangle("fill", bx + LX(10, 4), by+13, 4, 2)
    setColor(skin)
    love.graphics.rectangle("fill", bx + LX(-3, 3), by+15, 3, 2)
    if isUndead then
      setColor({0.45, 0.55, 0.35, 0.7})  -- dusty bone pile
      love.graphics.ellipse("fill", bx+5, by+18, 6, 2)
    else
      setColor(C.blood); love.graphics.ellipse("fill", bx+5, by+18, 6, 2)
    end
    return
  end

  -- ── Shadow ──────────────────────────────────────────────────────────────
  local shadowY = isJump and (by + 24) or (by + 18)
  setColor(C.shadow)
  love.graphics.ellipse("fill", bx+5, shadowY, isJump and 4 or 5, isJump and 1 or 1.5)

  -- ── LEGS & BOOTS ────────────────────────────────────────────────────────
  local boot = {0.12, 0.08, 0.05, 1}
  if isUndead then boot = {0.22, 0.20, 0.16, 1} end
  if isDuck then
    R(1, 13, 3, 4, leather); R(1, 16, 3, 1, boot)
    R(6, 13, 3, 4, leather); R(6, 16, 3, 1, boot)
  elseif isJump then
    R(0, 12, 3, 5, leather); R(0, 16, 3, 1, boot)
    R(7, 11, 3, 6, leather); R(7, 16, 3, 1, boot)
  else
    local loff = (walkFrame % 2 == 0) and 2 or 0
    R(1, 11+loff,     3, 7-loff,     leather); R(1, 17, 3, 1, boot)
    R(6, 11+(2-loff), 3, 7-(2-loff), leather); R(6, 17, 3, 1, boot)
    R(1, 17, 1, 1, isUndead and {0.55, 0.55, 0.5, 1} or C.gold)
  end

  -- ── BODY / COAT ─────────────────────────────────────────────────────────
  local bodyY = isDuck and 8 or 5
  local bodyH = isDuck and 5 or 7
  R(1, bodyY, 8, bodyH, coatCol)
  R(2, bodyY, 2, bodyH-2, {coatCol[1]*0.7, coatCol[2]*0.7, coatCol[3]*0.7, 1})
  if isUndead then
    -- exposed ribs / torn shirt
    R(4, bodyY+1, 3, 1, skin)
    R(4, bodyY+3, 3, 1, skin)
    R(4, bodyY+5, 2, 1, {skin[1]*0.85, skin[2]*0.85, skin[3]*0.8, 1})
  else
    R(3, bodyY, 4, 2, {0.90, 0.88, 0.82, 1})
  end

  -- ── BELT ────────────────────────────────────────────────────────────────
  local beltY = isDuck and 12 or 11
  R(1, beltY, 8, 1, leather)
  R(4, beltY, 2, 1, isUndead and {0.5, 0.45, 0.3, 1} or C.gold)

  -- ── ARMS / HOLSTER / GUN ────────────────────────────────────────────────
  if not isShooting then
    R(7, beltY, 2, isDuck and 3 or 4, leather)
    R(7, beltY, 2, 2, GUNWOOD)
    R(7, beltY+2, 2, 1, GUNMETAL)
    R(7, beltY+3, 1, 1, {0.4,0.4,0.42,1})

    R(1, isDuck and 9 or 6, 2, isDuck and 4 or 5, coatCol)
    if isDuck then
      R(6, 9, 3, 3, coatCol)
    elseif isJump then
      R(8, 6, 2, 4, coatCol)
      R(7, 7, 2, 4, coatCol)
    else
      R(6, 7, 3, 4, coatCol)
    end
  else
    local gunY = (pose == "shoot_high") and 2 or 5
    R(1, 6, 2, 5, coatCol)
    R(8, gunY+1, 3, 2, coatCol)
    R(11, gunY+1, 2, 2, skin)

    R(10, gunY+3, 2, 3, GUNWOOD)
    R(9,  gunY+4, 2, 2, GUNWOOD)
    R(11, gunY+1, 3, 3, GUNMETAL)
    setColor({0.45, 0.45, 0.48, 1})
    love.graphics.rectangle("fill", bx + LX(12, 2), by + gunY + 1, 2, 3)
    setColor({0.30, 0.30, 0.33, 1})
    love.graphics.rectangle("fill", bx + LX(12, 1), by + gunY + 2, 1, 1)
    R(14, gunY+1, 5, 2, GUNMETAL)
    R(14, gunY+1, 5, 1, {0.65, 0.65, 0.68, 1})
    R(18, gunY, 1, 1, {0.35, 0.35, 0.38, 1})
    R(11, gunY, 1, 1, {0.4, 0.4, 0.42, 1})

    local mfx = bx + LX(19, 1)
    local mfy = by + gunY + 1
    -- undead muzzle flash is colder / greener
    if isUndead then
      setColor({0.55, 1.00, 0.45, 1}); love.graphics.circle("fill", mfx, mfy, 2.5)
      setColor({0.30, 0.85, 0.35, 0.7}); love.graphics.circle("fill", mfx, mfy, 4)
    else
      setColor({1.00, 0.95, 0.35, 1}); love.graphics.circle("fill", mfx, mfy, 2.5)
      setColor({1.00, 0.55, 0.10, 0.75}); love.graphics.circle("fill", mfx, mfy, 4)
    end
    setColor({1.00, 1.00, 0.85, 0.55})
    love.graphics.rectangle("fill", mfx + (flip and -2 or 0), mfy, 3, 1)
  end

  -- ── HEAD ────────────────────────────────────────────────────────────────
  local headY = isDuck and 3 or 0
  R(4, headY+2, 2, 3, skin)
  R(2, headY, 6, 5, skin)
  if isUndead then
    -- hollow skull look
    R(2, headY+1, 1, 3, {skin[1]*0.75, skin[2]*0.75, skin[3]*0.7, 1})
    -- glowing eye sockets
    R(5, headY+1, 2, 2, {0.05, 0.08, 0.05, 1})
    R(6, headY+1, 1, 1, {0.45, 1.0, 0.35, 1})   -- green glow
    R(5, headY+1, 1, 1, {0.2, 0.55, 0.15, 1})
    -- nasal cavity
    R(6, headY+2, 1, 1, {0.15, 0.18, 0.12, 1})
    -- jaw teeth line
    R(4, headY+3, 3, 1, {0.9, 0.92, 0.85, 1})
    R(4, headY+4, 3, 1, {0.2, 0.22, 0.18, 1})
  else
    R(2, headY+1, 1, 3, {skin[1]*0.82, skin[2]*0.78, skin[3]*0.70, 1})
    R(6, headY+1, 1, 1, C.dark)
    R(5, headY, 2, 1, {0.30, 0.20, 0.10, 1})
    R(6, headY+2, 1, 1, {skin[1]*0.88, skin[2]*0.82, skin[3]*0.72, 1})
    R(4, headY+3, 2, 1, {0.35, 0.22, 0.14, 1})
  end

  -- ── HAT ─────────────────────────────────────────────────────────────────
  local hcol = HAT_COLORS[hat]
  if isUndead then
    hcol = {0.25, 0.22, 0.18, 1}  -- dusty black/brown hat
  end
  R(0, headY, 10, 1, hcol)
  local crownH = (hat==1) and 5 or (hat==2) and 3 or 4
  R(2, headY-crownH, 6, crownH, hcol)
  if isUndead then
    R(2, headY, 6, 1, {0.35, 0.4, 0.25, 1})  -- moldy band
  elseif isGang then
    R(2, headY, 6, 1, C.red)
    R(4, headY-crownH+1, 2, 2, {0.9, 0.9, 0.9, 1})
  else
    R(2, headY, 6, 1, C.gold)
  end
  R(2, headY-crownH+1, 1, crownH-1, {hcol[1]*0.6, hcol[2]*0.6, hcol[3]*0.6, 1})
  R(2, headY-crownH, 6, 1, {hcol[1]*0.75, hcol[2]*0.75, hcol[3]*0.75, 1})
end

-- ─── DRAW CACTUS ────────────────────────────────────────────────────────────
local function drawCactus(cx, cy, h)
  local bh = h * 7
  local cc = C.cactus
  -- trunk
  setColor(cc); love.graphics.rectangle("fill", cx-2, cy-bh, 4, bh)
  -- trunk highlight
  setColor({cc[1]*1.2,cc[2]*1.2,cc[3]*1.0,1})
  love.graphics.rectangle("fill", cx-1, cy-bh+1, 1, bh-2)
  if h >= 2 then
    -- left arm
    love.graphics.setColor(cc)
    love.graphics.rectangle("fill", cx-6, cy-bh+5, 4, 3)   -- horiz
    love.graphics.rectangle("fill", cx-6, cy-bh+2, 3, 6)   -- vert up
    -- right arm
    love.graphics.rectangle("fill", cx+2, cy-bh+8, 4, 3)
    love.graphics.rectangle("fill", cx+3, cy-bh+5, 3, 6)
  end
  if h == 3 then
    -- small top knob
    love.graphics.rectangle("fill", cx-1, cy-bh-3, 3, 4)
  end
end

-- ─── DRAW BUILDING ──────────────────────────────────────────────────────────
local function drawBuilding(bx, by, bw, bh_tiles)
  local pw = bw*TILE; local ph = bh_tiles*TILE
  -- shadow
  setColor({0,0,0,0.25}); love.graphics.rectangle("fill", bx+3, by-ph+3, pw, ph)
  -- wall planks
  setColor(C.wood); love.graphics.rectangle("fill", bx, by-ph, pw, ph)
  for i=0,bh_tiles*2 do
    setColor({C.wood[1]*0.88,C.wood[2]*0.88,C.wood[3]*0.80,1})
    love.graphics.rectangle("fill", bx, by-ph+i*4, pw, 1)
  end
  -- roof false-front
  setColor(C.roof); love.graphics.rectangle("fill", bx-2, by-ph-5, pw+4, 6)
  setColor({C.roof[1]*0.75,C.roof[2]*0.75,C.roof[3]*0.75,1})
  love.graphics.rectangle("fill", bx-2, by-ph-5, pw+4, 2)
  -- door
  setColor({0.08,0.05,0.03,1}); love.graphics.rectangle("fill", bx+math.floor(pw/2)-2, by-7, 5, 7)
  setColor({0.35,0.22,0.10,1}); love.graphics.rectangle("fill", bx+math.floor(pw/2)-1, by-6, 3, 5)
  -- window
  setColor({0.65,0.80,0.90,1}); love.graphics.rectangle("fill", bx+2, by-ph+3, 4, 4)
  setColor({0.4,0.6,0.75,0.4}); love.graphics.rectangle("fill", bx+4, by-ph+3, 1, 4)
  love.graphics.rectangle("fill", bx+2, by-ph+5, 4, 1)
end

-- ─── DRAW WORLD ─────────────────────────────────────────────────────────────
local function drawWorld()
  local offX = math.floor(-cam.x*TILE)
  local offY = math.floor(-cam.y*TILE)
  local tx0=math.max(1,math.floor(cam.x))
  local ty0=math.max(1,math.floor(cam.y))
  local tx1=math.min(MAP_W,tx0+math.ceil(W/TILE)+1)
  local ty1=math.min(MAP_H,ty0+math.ceil(H/TILE)+1)
  local isPyr = (stage.id == "pyramid" or stage.id == "floorclear")

  if isPyr then
    setColor(C.stoneDark); love.graphics.rectangle("fill",0,0,W,H)
  else
    setColor(C.ground); love.graphics.rectangle("fill",0,0,W,H)
    setColor({C.ground[1]*0.9,C.ground[2]*0.88,C.ground[3]*0.80,1})
    for ty=ty0,ty1 do for tx=tx0,tx1 do
      if world[ty] and world[ty][tx]==T_GROUND and (tx+ty)%3==0 then
        local px2=(tx-1)*TILE+offX; local py2=(ty-1)*TILE+offY
        love.graphics.rectangle("fill",px2+2,py2+3,2,2)
      end
    end end
  end

  for ty=ty0,ty1 do for tx=tx0,tx1 do
    local t=world[ty] and world[ty][tx]
    local px2=(tx-1)*TILE+offX; local py2=(ty-1)*TILE+offY
    if t==T_ROAD then
      setColor(C.sand); love.graphics.rectangle("fill",px2,py2,TILE,TILE)
      local roadMidY=math.floor(MAP_H/2)
      if ty==roadMidY then
        setColor({C.sand[1]*0.90,C.sand[2]*0.88,C.sand[3]*0.80,1})
        love.graphics.rectangle("fill",px2,py2+2,TILE,2)
        love.graphics.rectangle("fill",px2,py2+5,TILE,2)
      end
      if ty==roadMidY and tx%2==0 then
        setColor({0.90,0.84,0.60,0.7})
        love.graphics.rectangle("fill",px2+1,py2+TILE/2-1,TILE-2,2)
      end
    elseif t==T_FLOOR then
      -- sandstone walkway
      setColor(C.stone); love.graphics.rectangle("fill",px2,py2,TILE,TILE)
      if (tx+ty)%2==0 then
        setColor(C.stone2); love.graphics.rectangle("fill",px2+1,py2+1,TILE-2,TILE-2)
      end
      -- subtle edge
      setColor({C.stone[1]*0.7,C.stone[2]*0.7,C.stone[3]*0.7,0.5})
      love.graphics.rectangle("line",px2,py2,TILE,TILE)
    elseif t==T_STONE and isPyr then
      setColor(C.stoneDark); love.graphics.rectangle("fill",px2,py2,TILE,TILE)
      if (tx*3+ty)%7==0 then
        setColor({0.28,0.24,0.18,1})
        love.graphics.rectangle("fill",px2+2,py2+2,3,2)
      end
    end
  end end

  -- Decor
  for _,d in ipairs(decor) do
    local dx=(d.x-1)*TILE+offX+TILE/2
    local dy=(d.y-1)*TILE+offY+TILE
    if d.kind=="cactus" then drawCactus(dx,dy,d.h)
    elseif d.kind=="building" then
      drawBuilding((d.x-1)*TILE+offX,(d.y-1)*TILE+offY+TILE,d.w,d.h_tiles)
    elseif d.kind=="pillar" then
      local bx,by = (d.x-1)*TILE+offX, (d.y-1)*TILE+offY
      setColor(C.stone2); love.graphics.rectangle("fill",bx+1,by-6,TILE-2,TILE+6)
      setColor(C.gold); love.graphics.rectangle("fill",bx+2,by-7,TILE-4,2)
      setColor(C.stone); love.graphics.rectangle("fill",bx,by+TILE-2,TILE,2)
    elseif d.kind=="torch" then
      local bx,by = (d.x-1)*TILE+offX+3, (d.y-1)*TILE+offY+1
      setColor({0.35,0.22,0.1,1}); love.graphics.rectangle("fill",bx+1,by+3,2,4)
      local flicker = 0.75 + 0.25*math.sin(love.timer.getTime()*9 + d.x)
      setColor({C.torch[1],C.torch[2]*flicker,C.torch[3]*0.5,1})
      love.graphics.rectangle("fill",bx,by,4,3)
      setColor({1,1,0.7,0.5}); love.graphics.rectangle("fill",bx+1,by,2,2)
    elseif d.kind=="glyph" then
      local bx,by = (d.x-1)*TILE+offX, (d.y-1)*TILE+offY
      setColor(C.hieroglyph)
      love.graphics.rectangle("fill",bx+2,by+1,2,2)
      love.graphics.rectangle("fill",bx+5,by+3,2,3)
      love.graphics.rectangle("fill",bx+2,by+5,4,1)
    end
  end

  -- Dead NPCs
  for _,npc in ipairs(npcs) do
    if not npc.alive then
      local nx=math.floor(npc.px)+offX+TILE/2
      local ny=math.floor(npc.py)+offY+TILE
      drawCowboy(nx,ny,npc.dir,npc.hat,npc.coat,true,0,"stand",false,npc.isUndead)
    end
  end

  -- Living NPCs
  for _,npc in ipairs(npcs) do
    if npc.alive then
      local nx=math.floor(npc.px)+offX+TILE/2
      local ny=math.floor(npc.py)+offY+TILE
      local wf=math.floor(npc.moveTimer*4)%2
      drawCowboy(nx,ny,npc.dir,npc.hat,npc.coat,false,wf,"stand",false,npc.isUndead)
      local distx=npc.tx-player.tx; local disty=npc.ty-player.ty
      local dist=math.sqrt(distx*distx+disty*disty)
      if dist<7 then
        love.graphics.setFont(Font(5)); setColor(C.white)
        love.graphics.print(npc.name, nx-Font(5):getWidth(npc.name)/2, ny-20)
        local barW=20
        local skill=1-(npc.react-NPC_REACT_MIN)/(NPC_REACT_MAX-NPC_REACT_MIN)
        local rc={lerp(0.2,0.9,skill),lerp(0.8,0.1,skill),0.1,1}
        setColor({0,0,0,0.5}); love.graphics.rectangle("fill",nx-barW/2-1,ny-13,barW+2,4)
        setColor(rc); love.graphics.rectangle("fill",nx-barW/2,ny-12,math.floor(barW*skill),3)
      end
    end
  end

  -- Player
  local ppx=math.floor(player.px)+offX+TILE/2
  local ppy=math.floor(player.py)+offY+TILE
  drawCowboy(ppx,ppy,player.dir,player.hat,player.coat,false,player.walkFrame,"stand",false)
end

-- ─── DUEL BACKGROUND ────────────────────────────────────────────────────────
local function drawDuelBG(tintR,tintG,tintB)
  tintR=tintR or 1; tintG=tintG or 1; tintB=tintB or 1
  for y=0,H/2 do
    local t2=y/(H/2)
    local r=lerp(C.sky2[1],C.sky[1],t2)*tintR
    local g=lerp(C.sky2[2],C.sky[2],t2)*tintG
    local b=lerp(C.sky2[3],C.sky[3],t2)*tintB
    setColor({r,g,b,1}); love.graphics.rectangle("fill",0,y,W,1)
  end
  setColor({C.sand[1]*tintR,C.sand[2]*tintG,C.sand[3]*tintB,1})
  love.graphics.rectangle("fill",0,H/2,W,H/2)
  setColor({0.90,0.84,0.60,0.6}); love.graphics.rectangle("fill",0,H/2+1,W,2)

  -- buildings BG
  setColor({C.wood[1]*tintR,C.wood[2]*tintG,C.wood[3]*tintB,1})
  love.graphics.rectangle("fill",15,H/2-32,38,32)
  love.graphics.rectangle("fill",W-53,H/2-26,38,26)
  setColor({C.roof[1]*tintR,C.roof[2]*tintG,C.roof[3]*tintB,1})
  love.graphics.rectangle("fill",13,H/2-36,42,5)
  love.graphics.rectangle("fill",W-55,H/2-30,42,5)

  drawCactus(72,H/2,2); drawCactus(W-72,H/2,2)

  -- sun
  local st=love.timer.getTime()
  setColor({1.0,0.95,0.60*tintB,1})
  love.graphics.circle("fill",W/2,22,13)
  setColor({1.0,0.95,0.60*tintB,0.3})
  love.graphics.circle("fill",W/2,22,20)
  for i=0,7 do
    local a=i*math.pi/4+st*0.25
    setColor({1.0,0.90,0.40*tintB,0.4})
    love.graphics.rectangle("fill",W/2+math.cos(a)*26-1,22+math.sin(a)*26-1,2,2)
  end
  setColor({0.90,0.80,0.55,0.25}); love.graphics.rectangle("fill",0,H/2-7,W,7)
end

-- ─── SHARED DUEL RENDER (used by both normal duel and gang battle) ───────────
-- npcData: {hat,coat,react,name,isGang}
-- state: phase, countdown, win, shotSmoke, flashAlpha, flashColor, earlyShot,
--        playerAction, npcAction, round, resultText ...
local function drawDuelScene(npcData, state, extraLabel, npcDead)
  local isBounty = npcData.isGang
  drawDuelBG(isBounty and 0.80 or 1, isBounty and 0.70 or 1, isBounty and 0.70 or 1)

  local NPC_SCALE = 5
  local npcX = math.floor(W*0.72)
  local npcY = math.floor(H*0.72)
  local plX  = math.floor(W*0.28)
  local plY  = math.floor(H*0.72)

  -- Determine poses from current actions / phase
  local function poseFrom(action, isWinnerSide, phase, win)
    if phase == "duel_shot" or phase == "duel_resolve" then
      if action and action ~= "" then return action end
      -- fallback for classic win display
      if isWinnerSide and win then return "shoot" end
      if not isWinnerSide and not win then return "shoot" end
    end
    if action and (phase == "duel_draw" or phase == "duel_resolve") then
      return action
    end
    return "stand"
  end

  local pPose = poseFrom(state.playerAction, true, state.phase, state.win)
  local nPose = poseFrom(state.npcAction, false, state.phase, state.win)

  -- NPC
  love.graphics.push()
  love.graphics.translate(npcX, npcY)
  love.graphics.scale(NPC_SCALE, NPC_SCALE)
  drawCowboy(0,0,-1, npcData.hat, npcData.coat, npcDead, 0, nPose, isBounty, npcData.isUndead)
  love.graphics.pop()

  -- Player
  love.graphics.push()
  love.graphics.translate(plX, plY)
  love.graphics.scale(NPC_SCALE, NPC_SCALE)
  drawCowboy(0,0,1, player.hat, player.coat, false, 0, pPose, false, false)
  love.graphics.pop()

  -- Muzzle smoke near whoever actually fired
  if state.shotSmoke and state.shotSmoke > 0 then
    local sm = state.shotSmoke
    local function drawSmoke(sx, sy)
      setColor({C.smoke[1],C.smoke[2],C.smoke[3],sm*0.55})
      love.graphics.circle("fill",sx,sy,sm*10)
      love.graphics.circle("fill",sx-4,sy-6,sm*7)
      love.graphics.circle("fill",sx+3,sy-4,sm*5)
    end
    local pShot = state.playerAction == "shoot" or state.playerAction == "shoot_high" or (state.win and not state.npcAction)
    local nShot = state.npcAction == "shoot" or state.npcAction == "shoot_high" or (not state.win and state.phase ~= "duel_wait")
    if pShot then drawSmoke(plX + 30, plY - 24) end
    if nShot then drawSmoke(npcX - 30, plY - 24) end
  end

  -- Ground shadow line
  setColor({0,0,0,0.15}); love.graphics.rectangle("fill",0,npcY+2,W,4)

  -- Tension line between them
  local lineY = H/2+16
  setColor({0,0,0,0.4}); love.graphics.rectangle("fill",50,lineY,W-100,3)
  setColor(C.gold); love.graphics.circle("fill",W/2,lineY+1,4)
  -- tick marks
  for i=1,4 do
    setColor({C.gold[1],C.gold[2],C.gold[3],0.5})
    love.graphics.rectangle("fill",50+i*((W-100)/5)-1,lineY,2,3)
  end

  -- HUD bars
  setColor(C.hud_bg); love.graphics.rectangle("fill",0,0,W,24)
  setColor(C.hud_bg); love.graphics.rectangle("fill",0,H-24,W,24)

  -- Level + kills
  love.graphics.setFont(Font(6)); setColor(C.gold)
  love.graphics.print("L"..player.level.."  K:"..player.score, 4, 5)

  -- Extra label (gang member progress or name)
  if extraLabel then
    love.graphics.setFont(Font(5)); setColor(isBounty and C.bounty or C.white)
    local ew = Font(5):getWidth(extraLabel)
    love.graphics.print(extraLabel, W/2-ew/2, 7)
  end

  -- NPC name + speed bar (use effective react when available)
  love.graphics.setFont(Font(5)); setColor(C.white)
  local nw = Font(5):getWidth(npcData.name)
  love.graphics.print(npcData.name, W-nw-4, 5)
  local bw2=38
  local shownReact = (state.effectiveReact) or npcData.react
  local skill=1-(shownReact-0.15)/(NPC_REACT_MAX-0.15)
  skill=math.max(0,math.min(1,skill))
  local rc={lerp(0.2,0.9,skill),lerp(0.8,0.1,skill),0.1,1}
  setColor({0.3,0.3,0.3,0.8}); love.graphics.rectangle("fill",W-bw2-4,14,bw2,5)
  setColor(rc); love.graphics.rectangle("fill",W-bw2-4,14,math.floor(bw2*skill),5)

  -- Round indicator
  if state.round and state.round > 0 then
    love.graphics.setFont(Font(5)); setColor({0.85,0.8,0.6,1})
    local rtxt = "ROUND "..(state.round).."/"..MAX_ROUNDS
    love.graphics.print(rtxt, W/2-Font(5):getWidth(rtxt)/2, 16)
  end

  -- Phase overlay text
  local ph = state.phase
  if ph=="duel_wait" then
    local dots = math.floor(state.timer*2)%4
    love.graphics.setFont(Font(7)); setColor(C.yellow)
    local msg="FACE OFF"
    love.graphics.print(msg, W/2-Font(7):getWidth(msg)/2, H/2-26)
    love.graphics.setFont(Font(8)); setColor(C.white)
    local dm=string.rep(".",dots)
    love.graphics.print(dm, W/2-Font(8):getWidth(dm)/2, H-20)

  elseif ph=="duel_draw" then
    local pulse=0.65+0.35*math.sin(state.countdown*22)
    love.graphics.setFont(Font(16)); setColor({1,lerp(0.2,1,pulse),0,1})
    local msg="DRAW!"
    love.graphics.print(msg, W/2-Font(16):getWidth(msg)/2, H/2-36)
    -- progress bar
    local eff = state.effectiveReact or npcData.react
    local hs = state.headstart or 0
    local maxT = hs + eff + 0.45
    local prog = math.min(1, state.countdown / maxT)
    setColor({0.75,0.08,0.08,0.85})
    love.graphics.rectangle("fill",20,H-22,math.floor((W-40)*prog),14)
    setColor({1,1,1,0.3}); love.graphics.rectangle("line",20,H-22,W-40,14)
    -- controls hint
    love.graphics.setFont(Font(4)); setColor(C.white)
    love.graphics.print("SPACE SHOT   A/X HIGH   S DUCK   W JUMP", 4, H-19)
    -- show committed action if any
    if state.playerAction then
      love.graphics.setFont(Font(6)); setColor(C.gold)
      local a = actionLabel(state.playerAction)
      love.graphics.print(a, 8, H/2+20)
    end
    if state.npcAction then
      love.graphics.setFont(Font(6)); setColor(C.bounty)
      local a = actionLabel(state.npcAction)
      love.graphics.print(a, W-Font(6):getWidth(a)-8, H/2+20)
    end

  elseif ph=="duel_resolve" or ph=="duel_shot" then
    local txt = state.resultText or (state.win and "GOT 'EM!" or "SHOT DOWN!")
    local col = (state.win or txt=="DODGED!" or txt=="STARE DOWN" or txt=="STANDOFF") and C.green or C.red
    if txt=="DODGED!" or txt=="STARE DOWN" then col = {0.5,0.85,1,1} end
    if txt=="STANDOFF" then col = C.gold end
    love.graphics.setFont(Font(10)); setColor(col)
    love.graphics.print(txt, W/2-Font(10):getWidth(txt)/2, H/2-32)
    -- show both actions
    love.graphics.setFont(Font(5)); setColor(C.white)
    local pL = actionLabel(state.playerAction)
    local nL = actionLabel(state.npcAction)
    love.graphics.print("YOU:"..pL, 10, H/2-10)
    love.graphics.print("THEM:"..nL, W-Font(5):getWidth("THEM:"..nL)-10, H/2-10)
    if state.lightning and state.win then
      love.graphics.setFont(Font(5)); setColor(C.yellow)
      local bx = "+"..(state.bonusXp or 0).." XP"
      love.graphics.print(bx, W/2-Font(5):getWidth(bx)/2, H/2+6)
    end
    if state.earlyShot then
      love.graphics.setFont(Font(5)); setColor(C.bounty)
      love.graphics.print("TOO EARLY!", W/2-Font(5):getWidth("TOO EARLY!")/2, H/2+6)
    end
  end

  -- Screen flash
  if state.flashAlpha and state.flashAlpha>0 then
    local fc=state.flashColor
    setColor({fc[1],fc[2],fc[3],state.flashAlpha})
    love.graphics.rectangle("fill",0,0,W,H)
  end
end

-- ─── GANG BATTLE: "WANTED" INTRO SCREEN ─────────────────────────────────────
local function drawGangIntro()
  local t=gangBattle.introTimer
  -- Dark red vignette
  for y=0,H do
    local vy=math.abs(y-H/2)/(H/2)
    setColor({0.12+vy*0.08, 0.04, 0.02, 1})
    love.graphics.rectangle("fill",0,y,W,1)
  end

  -- Wanted poster
  local pw,ph2=180,220
  local px2=W/2-pw/2; local py2=H/2-ph2/2
  -- poster drop shadow
  setColor({0,0,0,0.5}); love.graphics.rectangle("fill",px2+5,py2+5,pw,ph2)
  -- poster body
  setColor(C.wanted); love.graphics.rectangle("fill",px2,py2,pw,ph2)
  -- border
  setColor({0.60,0.45,0.20,1}); love.graphics.rectangle("line",px2+3,py2+3,pw-6,ph2-6)
  setColor({0.60,0.45,0.20,1}); love.graphics.rectangle("line",px2+5,py2+5,pw-10,ph2-10)

  -- "WANTED" text
  love.graphics.setFont(Font(14)); setColor(C.dark)
  local wt="WANTED"
  love.graphics.print(wt,px2+pw/2-Font(14):getWidth(wt)/2+1,py2+12)
  setColor(C.bounty)
  love.graphics.print(wt,px2+pw/2-Font(14):getWidth(wt)/2,py2+11)

  -- "DEAD OR ALIVE"
  love.graphics.setFont(Font(5)); setColor(C.dark)
  local sub="DEAD OR ALIVE"
  love.graphics.print(sub,px2+pw/2-Font(5):getWidth(sub)/2,py2+32)

  -- Silhouette of three gang members
  love.graphics.push()
  love.graphics.translate(px2+pw/2, py2+120)
  love.graphics.scale(3,3)
  setColor({0.15,0.08,0.05,1})
  -- three cowboy silhouettes (rough)
  for i=-1,1 do
    love.graphics.rectangle("fill",i*14-3,-16,7,13)  -- body
    love.graphics.rectangle("fill",i*14-2,-22,5,6)   -- head
    love.graphics.rectangle("fill",i*14-4,-23,9,1)   -- hat brim
    love.graphics.rectangle("fill",i*14-2,-27,5,4)   -- hat crown
  end
  love.graphics.pop()

  love.graphics.setFont(Font(6)); setColor(C.dark)
  local gang = gangBattle.gangTitle or "THE MUERTE GANG"
  love.graphics.print(gang,px2+pw/2-Font(6):getWidth(gang)/2+1,py2+156)
  setColor(C.bounty)
  love.graphics.print(gang,px2+pw/2-Font(6):getWidth(gang)/2,py2+155)

  -- Reward
  love.graphics.setFont(Font(5)); setColor(C.dark)
  local rew="$1000 REWARD"
  love.graphics.print(rew,px2+pw/2-Font(5):getWidth(rew)/2,py2+175)

  -- Flicker tear/wear lines
  for _=1,6 do
    local lx=px2+rndi(5,pw-5); local ly=py2+rndi(10,ph2-10)
    setColor({C.wanted[1]*0.80,C.wanted[2]*0.78,C.wanted[3]*0.70,0.6})
    love.graphics.rectangle("fill",lx,ly,1,rndi(3,20))
  end

  -- Prompt (after 1.5s)
  if t>1.5 and math.floor(t*2)%2==0 then
    love.graphics.setFont(Font(5)); setColor(C.yellow)
    local msg="PRESS SPACE TO FIGHT"
    love.graphics.print(msg,W/2-Font(5):getWidth(msg)/2,py2+ph2+10)
  end
end

-- ─── GANG BATTLE: BETWEEN ROUNDS ────────────────────────────────────────────
local function drawGangBetween()
  drawDuelBG(0.75,0.65,0.65)
  local idx=gangBattle.current
  local prev=gangBattle.members[idx-1] or gangBattle.members[1]

  setColor(C.hud_bg); love.graphics.rectangle("fill",0,0,W,H)
  setColor({0.20,0.08,0.04,1}); love.graphics.rectangle("fill",20,20,W-40,H-40)
  setColor(C.bounty); love.graphics.rectangle("line",22,22,W-44,H-44)

  -- Draw defeated member lying flat (centered)
  love.graphics.push()
  love.graphics.translate(W/2, H/2-10)
  love.graphics.scale(5,5)
  drawCowboy(0,0,prev.dir or 1,prev.hat,prev.coat,true,0,"stand",true)
  love.graphics.pop()

  love.graphics.setFont(Font(7)); setColor(C.green)
  local msg=prev.name.." DOWN!"
  love.graphics.print(msg,W/2-Font(7):getWidth(msg)/2,H/2+42)

  local nextM=gangBattle.members[idx]
  if nextM then
    love.graphics.setFont(Font(5)); setColor(C.white)
    local n2="NEXT: "..nextM.name
    love.graphics.print(n2,W/2-Font(5):getWidth(n2)/2,H/2+58)
    -- gang counter pips
    for i=1,3 do
      local cx=W/2+(i-2)*18; local cy=H/2+72
      if i < idx then
        setColor(C.blood); love.graphics.circle("fill",cx,cy,5)
        setColor(C.dark); love.graphics.print("X",cx-3,cy-4)
      elseif i==idx then
        setColor(C.bounty); love.graphics.circle("fill",cx,cy,6)
        setColor(C.white); love.graphics.circle("line",cx,cy,7)
      else
        setColor({0.4,0.3,0.3,1}); love.graphics.circle("fill",cx,cy,5)
      end
    end
  end

  if math.floor(gangBattle.timer*2)%2==0 then
    love.graphics.setFont(Font(5)); setColor(C.yellow)
    local pm="PRESS SPACE"
    love.graphics.print(pm,W/2-Font(5):getWidth(pm)/2,H-30)
  end
end

-- ─── GANG BATTLE: VICTORY ────────────────────────────────────────────────────
local function drawGangComplete()
  drawDuelBG(0.80,0.70,0.60)
  setColor({0,0,0,0.5}); love.graphics.rectangle("fill",0,0,W,H)

  love.graphics.setFont(Font(10)); setColor(C.dark)
  local msg="GANG BUSTED!"
  love.graphics.print(msg,W/2-Font(10):getWidth(msg)/2+1,H*0.22+1)
  setColor(C.gold)
  love.graphics.print(msg,W/2-Font(10):getWidth(msg)/2,H*0.22)

  love.graphics.setFont(Font(6)); setColor(C.white)
  local k="+3 KILLS"
  love.graphics.print(k,W/2-Font(6):getWidth(k)/2,H*0.38)

  -- Three dead members
  for i=1,3 do
    local m=gangBattle.members[i]
    if m then
      love.graphics.push()
      love.graphics.translate(W/2+(i-2)*70,H*0.60)
      love.graphics.scale(4,4)
      drawCowboy(0,0,1,m.hat,m.coat,true,0,"stand",true)
      love.graphics.pop()
    end
  end

  if math.floor(gangBattle.timer*2)%2==0 then
    love.graphics.setFont(Font(5)); setColor(C.yellow)
    local pm="PRESS SPACE"
    love.graphics.print(pm,W/2-Font(5):getWidth(pm)/2,H-20)
  end
end

-- ─── BOUNTY WARNING (overlay on explore) ────────────────────────────────────
local function drawBountyWarning()
  local a=math.abs(math.sin(love.timer.getTime()*3))*0.6
  setColor({0.8,0.1,0.05,a}); love.graphics.rectangle("fill",0,0,W,H)
  setColor(C.hud_bg); love.graphics.rectangle("fill",20,H/2-26,W-40,52)
  setColor(C.bounty); love.graphics.rectangle("line",22,H/2-24,W-44,48)
  love.graphics.setFont(Font(7)); setColor(C.bounty)
  local t1="BOUNTY ON YOUR HEAD"
  love.graphics.print(t1,W/2-Font(7):getWidth(t1)/2,H/2-20)
  love.graphics.setFont(Font(5)); setColor(C.white)
  local gname = (GANGS[bounty.gangType] and GANGS[bounty.gangType].title) or "THE MUERTE GANG"
  local t2 = gname.." IS COMING"
  love.graphics.print(t2,W/2-Font(5):getWidth(t2)/2,H/2-4)
  love.graphics.setFont(Font(5)); setColor(C.yellow)
  local t3="GET READY..."
  love.graphics.print(t3,W/2-Font(5):getWidth(t3)/2,H/2+10)
end

-- ─── TITLE SCREEN ───────────────────────────────────────────────────────────
local titleT = 0
local function drawTitle()
  titleT = titleT + love.timer.getDelta()
  for y=0,H do
    local t2=y/H
    setColor({lerp(0.25,C.sky[1],t2),lerp(0.15,C.sky[2],t2),lerp(0.08,C.sky[3],t2),1})
    love.graphics.rectangle("fill",0,y,W,1)
  end
  setColor({0.18,0.12,0.06,1})
  for i=0,3 do
    love.graphics.ellipse("fill",i*90-20+math.sin(titleT*0.2+i)*5, H*0.75, 60, 25)
  end
  setColor(C.ground); love.graphics.rectangle("fill",0,H*0.72,W,H*0.28)

  local function silCowboy(x,y,s,dir)
    love.graphics.push(); love.graphics.translate(x,y); love.graphics.scale(s,s)
    setColor({0.08,0.05,0.03,1})
    love.graphics.rectangle("fill",-4,-10,9,9)
    love.graphics.rectangle("fill",-2,-14,5,5)
    love.graphics.rectangle("fill",-5,-15,10,1)
    love.graphics.rectangle("fill",-2,-19,6,5)
    love.graphics.rectangle("fill",dir>0 and 5 or -6,-9,2,4)
    love.graphics.pop()
  end

  local bob=math.sin(titleT*1.5)*2
  silCowboy(70,H*0.72+bob,2.5,1); silCowboy(W-70,H*0.72-bob,2.5,-1)

  local sp=0.95+0.05*math.sin(titleT*2)
  setColor({1.0,0.92,0.45,1}); love.graphics.circle("fill",W/2,36,18*sp)
  setColor({1.0,0.92,0.45,0.3}); love.graphics.circle("fill",W/2,36,28*sp)

  love.graphics.setFont(Font(14))
  setColor(C.dark); love.graphics.print("HIGH NOON",W/2-Font(14):getWidth("HIGH NOON")/2+1,H*0.3+1)
  setColor(C.yellow); love.graphics.print("HIGH NOON",W/2-Font(14):getWidth("HIGH NOON")/2,H*0.3)
  love.graphics.setFont(Font(5)); setColor(C.white)
  local sub="FASTEST GUN ALIVE"
  love.graphics.print(sub,W/2-Font(5):getWidth(sub)/2,H*0.3+20)

  if math.floor(titleT*2)%2==0 then
    love.graphics.setFont(Font(6)); setColor(C.yellow)
    local msg="PRESS ENTER"
    love.graphics.print(msg,W/2-Font(6):getWidth(msg)/2,H*0.65)
  end
  if #highscores>0 then
    love.graphics.setFont(Font(5)); setColor(C.gold)
    love.graphics.print("BEST: "..highscores[1].." KILLS",W/2-40,H*0.75)
  end
  love.graphics.setFont(Font(5)); setColor({0.8,0.8,0.8,0.7})
  love.graphics.print("WASD/ARROWS: MOVE",4,H-22)
  love.graphics.print("SPACE:SHOT  A/X:HIGH  S:DUCK  W:JUMP",4,H-13)
end

-- ─── DEAD SCREEN ────────────────────────────────────────────────────────────
local deadTimer = 0
local deadFlash = 0
local function drawDead()
  deadTimer=deadTimer+love.timer.getDelta()
  deadFlash=math.max(0,deadFlash-love.timer.getDelta()*0.5)
  drawWorld()
  setColor({0.08,0.02,0.02,0.75}); love.graphics.rectangle("fill",0,0,W,H)
  setColor({0.6,0.0,0.0,0.5})
  for i=1,8 do
    local a=i*math.pi*2/8; local r=20+i*5
    love.graphics.circle("fill",W/2+math.cos(a)*r*0.5,H/2+math.sin(a)*r*0.3,r*0.3)
  end
  if deadFlash>0 then setColor({1,0,0,deadFlash*0.7}); love.graphics.rectangle("fill",0,0,W,H) end

  local bounce=math.min(1,deadTimer*3)
  local gy=lerp(H*0.08,H*0.18,bounce)
  love.graphics.setFont(Font(14))
  setColor(C.dark); love.graphics.print("GAME OVER",W/2-Font(14):getWidth("GAME OVER")/2+1,gy+1)
  setColor(C.red); love.graphics.print("GAME OVER",W/2-Font(14):getWidth("GAME OVER")/2,gy)

  love.graphics.setFont(Font(7)); setColor(C.white)
  local sk="KILLS: "..player.score.."   LVL: "..player.level.."   LIVES: "..(player.lives or 0)
  love.graphics.print(sk,W/2-Font(7):getWidth(sk)/2,H*0.38)

  if #highscores>0 and player.score>=highscores[1] then
    love.graphics.setFont(Font(6)); setColor(C.gold)
    local msg="NEW RECORD!"
    love.graphics.print(msg,W/2-Font(6):getWidth(msg)/2,H*0.50)
  end
  love.graphics.setFont(Font(5)); setColor(C.gold)
  love.graphics.print("TOP GUNSLINGERS",W/2-Font(5):getWidth("TOP GUNSLINGERS")/2,H*0.60)
  for i=1,math.min(5,#highscores) do
    setColor(i==1 and C.gold or C.white)
    love.graphics.print("#"..i.."  "..highscores[i].." kills",W/2-40,H*0.60+i*10)
  end
  if deadTimer>1.5 and math.floor(deadTimer*2)%2==0 then
    love.graphics.setFont(Font(5)); setColor(C.yellow)
    local msg="ENTER: PLAY AGAIN"
    love.graphics.print(msg,W/2-Font(5):getWidth(msg)/2,H*0.90)
  end
end

-- ─── EXPLORE UPDATE ─────────────────────────────────────────────────────────
local function exploreUpdate(dt)
  if player.levelUpTimer and player.levelUpTimer > 0 then
    player.levelUpTimer = player.levelUpTimer - dt
  end
  if player.lifeFlash and player.lifeFlash > 0 then
    player.lifeFlash = player.lifeFlash - dt
  end

  local mx,my=0,0
  if love.keyboard.isDown("up","w") then my=-1 end
  if love.keyboard.isDown("down","s") then my=1 end
  if love.keyboard.isDown("left","a") then mx=-1 end
  if love.keyboard.isDown("right","d") then mx=1 end

  local SPEED=24
  player.walkTimer=player.walkTimer+dt
  if player.walkTimer>0.25 then
    player.walkTimer=0
    if mx~=0 or my~=0 then player.walkFrame=player.walkFrame+1 end
  end
  if mx~=0 then player.dir=mx end

  local newPX=player.px+mx*SPEED*dt; local newPY=player.py+my*SPEED*dt
  local ntx=math.floor(newPX/TILE)+1; local nty=math.floor(newPY/TILE)+1
  if ntx>=1 and ntx<=MAP_W and nty>=1 and nty<=MAP_H then
    local blocked = false
    if stage.id == "pyramid" and world[nty] and world[nty][ntx] == T_STONE then
      blocked = true
    end
    if not blocked then
      player.px=newPX; player.py=newPY; player.tx=ntx; player.ty=nty
    end
  end

  local targetCX=player.px/TILE-W/(TILE*2)+0.5; local targetCY=player.py/TILE-H/(TILE*2)+0.5
  targetCX=math.max(0,math.min(MAP_W-W/TILE,targetCX))
  targetCY=math.max(0,math.min(MAP_H-H/TILE,targetCY))
  cam.x=lerp(cam.x,targetCX,dt*8); cam.y=lerp(cam.y,targetCY,dt*8)

  for _,npc in ipairs(npcs) do
    if npc.alive then
      npc.moveTimer=npc.moveTimer-dt
      if npc.moveTimer<=0 then
        npc.moveTimer=rnd(1.5,4)
        local ndx=rndi(-1,1); local ndy=rndi(-1,1)
        local nx2=npc.tx+ndx; local ny2=npc.ty+ndy
        if nx2>=1 and nx2<=MAP_W and ny2>=1 and ny2<=MAP_H then
          local ok = true
          if stage.id == "pyramid" and world[ny2] and world[ny2][nx2] ~= T_FLOOR then
            ok = false
          end
          if ok then
            npc.tx=nx2; npc.ty=ny2; npc.px=(nx2-1)*TILE; npc.py=(ny2-1)*TILE
          end
        end
        if ndx~=0 then npc.dir=ndx end
      end
    end
  end

  -- Bounty warning flicker
  if bounty.active and not bounty.warned then
    bounty.wantedFlash=bounty.wantedFlash+dt
    if bounty.wantedFlash>2.5 then
      bounty.warned=true
      -- Start gang battle for current area
      local gdef = GANGS[bounty.gangType] or GANGS.muerte
      gangBattle.active=true
      gangBattle.members={}
      gangBattle.gangTitle = gdef.title
      for i=1,3 do
        local rr=gdef.reacts[i]
        local baseR = rnd(rr[1],rr[2])
        gangBattle.members[i]={
          name=gdef.names[i], hat=gdef.hats[i], coat=gdef.coats[i],
          react=baseR, alive=true, dir=1,
          isGang=true,
          effectiveReact = getEffectiveReact(baseR),
        }
      end
      gangBattle.current=1; gangBattle.phase="intro"
      gangBattle.introTimer=0; gangBattle.timer=0
      gangBattle.flashAlpha=0; gangBattle.shotSmoke=0
      gangBattle.earlyShot=false; gangBattle.playerShot=false
      gangBattle.npcShot=false; gangBattle.countdown=0
      gangBattle.headstart = getHeadstart()
      gangBattle.lightning=false; gangBattle.bonusXp=0
      gangBattle.round=1; gangBattle._resolved=false
      gangBattle.playerAction=nil; gangBattle.npcAction=nil
      gangBattle.resultText=""; gangBattle.outcome=nil
      SCREEN="gang"
    end
  end

  -- Check proximity → normal duel (only if bounty not active yet)
  if not bounty.active or bounty.warned then
    for _,npc in ipairs(npcs) do
      if npc.alive then
        local dx=npc.tx-player.tx; local dy=npc.ty-player.ty
        local dist=math.sqrt(dx*dx+dy*dy)
        if dist<=player.engageRange then
          SCREEN="duel"
          duel.active=true; duel.npc=npc; duel.phase="duel_wait"
          duel.timer=0; duel.countdown=0; duel.flashAlpha=0
          duel.playerShot=false; duel.npcShot=false
          duel.resultTimer=0; duel.win=false; duel.shotSmoke=0
          duel.beepTimer=0; duel.earlyShot=false
          duel.lightning=false; duel.bonusXp=0
          duel.round=1; duel.standoff=false; duel._resolved=false
          duel.playerAction=nil; duel.npcAction=nil
          duel.resultText=""; duel.outcome=nil
          duel.waitTime=rnd(duel.waitMin,duel.waitMax)
          -- roll base react then apply presence skill
          local baseReact = rnd(NPC_REACT_MIN,NPC_REACT_MAX)
          duel.npc.react = baseReact
          duel.effectiveReact = getEffectiveReact(baseReact)
          duel.headstart = getHeadstart()
          player.dir=(npc.tx>player.tx) and 1 or -1
          npc.dir=-player.dir
          break
        end
      end
    end
  end
end

-- ─── SHARED DUEL LOGIC (multi-exchange) ──────────────────────────────────────
-- Phases: duel_wait → duel_draw → duel_resolve → (next round or final)
-- Tuned for fast, reactive exchanges: short waits, quick resolve, instant feedback.
local function duelPhaseUpdate(state, npcReact, dt, isGang)
  state.flashAlpha=math.max(0,state.flashAlpha-dt*5)
  state.shotSmoke =math.max(0,(state.shotSmoke or 0)-dt*1.6)

  local function flash(c) state.flashAlpha=1.0; state.flashColor=c end

  if state.phase=="duel_wait" then
    state.timer=state.timer+dt
    state.beepTimer=(state.beepTimer or 0)+dt
    -- fewer / softer beeps on later rounds so it stays snappy
    local beepGap = (state.round and state.round > 1) and rnd(0.55,1.2) or rnd(0.35,0.9)
    if state.beepTimer > beepGap then
      state.beepTimer=0; flash({0.9,0.86,0.5,0.10})
    end
    if state.timer>=state.waitTime then
      state.phase="duel_draw"; state.countdown=0
      state.playerAction=nil; state.npcAction=nil
      state.playerActTime=0; state.npcActTime=0
      state.playerShot=false; state.npcShot=false
      state.earlyShot=false; state.lightning=false; state.bonusXp=0
      state._resolved=false
      flash({1,0.9,0.2,0.88})
    end

  elseif state.phase=="duel_draw" then
    state.countdown=state.countdown+dt
    local hs = state.headstart or 0
    local npcClock = math.max(0, state.countdown - hs)

    -- NPC commits when their clock hits
    if not state.npcAction and npcClock >= npcReact then
      state.npcAction = pickNpcAction(isGang, state.round or 1)
      state.npcActTime = state.countdown
      state.npcShot = isOffensive(state.npcAction)
      -- tiny flash so you feel their move
      flash({0.95,0.5,0.3,0.25})
    end

    -- If player already shot and NPC is still slow: short "bullet flight" window
    -- then force NPC to stand (too late to dodge) so the duel doesn't stall
    if state.playerAction and isOffensive(state.playerAction) and not state.npcAction then
      local flight = 0.14  -- brief window for a last-second dodge
      if state.countdown >= (state.playerActTime + flight) and npcClock < npcReact then
        -- NPC still hasn't reached their react time → they get hit standing
        state.npcAction = "stand"
        state.npcActTime = state.countdown
        state.npcShot = false
      end
    end

    -- Safety: player froze past the window
    if state.countdown > (hs + npcReact + 0.85) and not state.playerAction then
      state.playerAction = "stand"
      state.playerActTime = state.countdown
      if not state.npcAction then
        state.npcAction = pickNpcAction(isGang, state.round or 1)
        state.npcActTime = state.countdown
      end
      state.phase = "duel_resolve"
      state.resultTimer = 0
    elseif state.playerAction and state.npcAction then
      state.phase = "duel_resolve"
      state.resultTimer = 0
      if isOffensive(state.playerAction) or isOffensive(state.npcAction) then
        state.shotSmoke = 1.0
      end
    end

  elseif state.phase=="duel_resolve" then
    state.resultTimer=(state.resultTimer or 0)+dt
  end
end

-- ─── NORMAL DUEL UPDATE ─────────────────────────────────────────────────────
local function duelUpdate(dt)
  local eff = duel.effectiveReact or duel.npc.react
  duelPhaseUpdate(duel, eff, dt, false)

  -- Compute outcome the first frame we enter resolve
  if duel.phase == "duel_resolve" and not duel._resolved then
    duel._resolved = true
    local outcome = resolveExchange(duel.playerAction, duel.npcAction, duel.playerActTime, duel.npcActTime)
    duel.outcome = outcome
    if outcome == "player_win" then
      duel.win = true
      duel.resultText = "GOT 'EM!"
      if duel.lightning then duel.resultText = "LIGHTNING!" end
    elseif outcome == "npc_win" then
      duel.win = false
      duel.resultText = duel.earlyShot and "TOO EARLY!" or "SHOT DOWN!"
    elseif outcome == "double" then
      duel.win = false
      duel.resultText = "BOTH DOWN!"
    else -- continue
      duel.resultText = "DODGED!"
      if not isOffensive(duel.playerAction) and not isOffensive(duel.npcAction) then
        duel.resultText = "STARE DOWN"
      end
    end
    local flashC = duel.win and {1,1,0.8,0.5} or (outcome=="continue" and {0.7,0.85,1,0.4} or {1,0.2,0,0.65})
    duel.flashAlpha = 1.0; duel.flashColor = flashC
  end

  -- Kill/death linger a beat longer than a dodge so it still reads
  local resolveHold = 0.55
  if duel.outcome == "player_win" or duel.outcome == "npc_win" or duel.outcome == "double" then
    resolveHold = 0.85
  end
  if duel.standoff then resolveHold = 1.4 end

  if duel.phase == "duel_resolve" and duel.resultTimer > resolveHold and not duel.standoff then
    local outcome = duel.outcome
    if outcome == "player_win" then
      duel.npc.alive = false
      player.score = player.score + 1
      local xp = xpForEnemy(duel.npc.react, false) + (duel.bonusXp or 0)
      gainXP(xp, duel.lightning and "LIGHTNING" or "KILL")

      if stage.id == "village" or stage.id == "approach" then
        stage.areaKills = stage.areaKills + 1
        if stage.areaKills >= BOUNTY_THRESHOLD and not bounty.active and not bounty.warned then
          bounty.active = true
          bounty.wantedFlash = 0
          bounty.kills_at_trigger = stage.areaKills
          bounty.gangType = (stage.id == "approach") and "viper" or "muerte"
        end
      elseif stage.id == "pyramid" then
        stage.floorKills = stage.floorKills + 1
        if stage.floorKills >= stage.floorGoal then
          -- floor cleared → deeper
          stage.bannerText = "FLOOR "..stage.floor.." CLEAR"
          stage.bannerTimer = 2.5
          stage.floor = stage.floor + 1
          stage.floorKills = 0
          stage.floorGoal = 8 + math.min(4, stage.floor - 1)  -- slightly more each floor
          genPyramidFloor(stage.floor)
          local roadY = math.floor(MAP_H/2)
          player.tx = math.floor(MAP_W/2)
          player.ty = math.floor(MAP_H/2)
          player.px = (player.tx-1)*TILE
          player.py = (player.ty-1)*TILE
          cam.x = player.tx - W/(TILE*2)
          cam.y = player.ty - H/(TILE*2)
          spawnNPCs()
          duel.active = false
          SCREEN = "explore"
          -- skip normal respawn path
          return
        end
      end

      duel.active = false
      local anyAlive = false
      for _,n in ipairs(npcs) do if n.alive then anyAlive = true; break end end
      if not anyAlive then spawnNPCs() end
      SCREEN = "explore"
    elseif outcome == "npc_win" or outcome == "double" then
      duel.active = false
      loseLife(outcome)
    else
      -- continue → next round almost immediately (short tension only)
      duel.round = (duel.round or 1) + 1
      if duel.round > MAX_ROUNDS then
        duel.standoff = true
        duel.resultText = "STANDOFF"
        duel.win = false
        duel.resultTimer = 0
        gainXP(6 + player.level, "STANDOFF")
      else
        duel._resolved = false
        duel.phase = "duel_wait"
        duel.timer = 0
        duel.countdown = 0
        -- later rounds: very short face-off so combat stays fluid
        duel.waitTime = rnd(0.35, 0.85)
        duel.playerAction = nil; duel.npcAction = nil
        duel.shotSmoke = 0
        duel.headstart = getHeadstart()
      end
    end
  end

  if duel.standoff and duel.phase == "duel_resolve" and duel.resultTimer > 1.4 then
    duel.active = false
    duel.standoff = false
    SCREEN = "explore"
  end
end

-- ─── GANG BATTLE UPDATE ──────────────────────────────────────────────────────
local function gangUpdate(dt)
  local gb=gangBattle
  gb.flashAlpha=math.max(0,(gb.flashAlpha or 0)-dt*4)
  gb.shotSmoke =math.max(0,(gb.shotSmoke or 0)-dt*1.2)

  if gb.phase=="intro" then
    gb.introTimer=gb.introTimer+dt
    return
  elseif gb.phase=="between" then
    gb.timer=gb.timer+dt
    return
  elseif gb.phase=="complete" then
    gb.timer=gb.timer+dt
    return
  end

  -- Active exchange against current member — reuse shared phase logic
  local cur = gb.members[gb.current]
  local eff = (cur and (cur.effectiveReact or cur.react)) or 0.4
  duelPhaseUpdate(gb, eff, dt, true)

  if gb.phase == "duel_resolve" and not gb._resolved then
    gb._resolved = true
    local outcome = resolveExchange(gb.playerAction, gb.npcAction, gb.playerActTime, gb.npcActTime)
    gb.outcome = outcome
    if outcome == "player_win" then
      gb.win = true
      gb.resultText = gb.lightning and "LIGHTNING!" or "GOT 'EM!"
    elseif outcome == "npc_win" then
      gb.win = false
      gb.resultText = gb.earlyShot and "TOO EARLY!" or "SHOT DOWN!"
    elseif outcome == "double" then
      gb.win = false
      gb.resultText = "BOTH DOWN!"
    else
      gb.resultText = "DODGED!"
      if not isOffensive(gb.playerAction) and not isOffensive(gb.npcAction) then
        gb.resultText = "STARE DOWN"
      end
    end
    local flashC = gb.win and {1,1,0.8,0.5} or (outcome=="continue" and {0.7,0.85,1,0.4} or {1,0.2,0,0.65})
    gb.flashAlpha = 1.0; gb.flashColor = flashC
  end

  local resolveHold = 0.55
  if gb.outcome == "player_win" or gb.outcome == "npc_win" or gb.outcome == "double" then
    resolveHold = 0.85
  end

  if gb.phase == "duel_resolve" and gb.resultTimer > resolveHold then
    local outcome = gb.outcome
    if outcome == "player_win" then
      cur.alive = false
      local xp = xpForEnemy(cur.react, true) + (gb.bonusXp or 0)
      gainXP(xp, gb.lightning and "LIGHTNING" or "GANG")
      gb.lightning=false; gb.bonusXp=0
      if gb.current < 3 then
        gb.current = gb.current + 1
        gb.phase = "between"; gb.timer = 0
        gb._resolved = false
        gb.round = 1
      else
        gb.phase = "complete"; gb.timer = 0
      end
    elseif outcome == "npc_win" or outcome == "double" then
      gangBattle.active = false
      loseLife(outcome)
    else
      gb.round = (gb.round or 1) + 1
      if gb.round > MAX_ROUNDS then
        cur.alive = false
        gainXP(12 + player.level * 2, "STANDOFF")
        if gb.current < 3 then
          gb.current = gb.current + 1
          gb.phase = "between"; gb.timer = 0
          gb._resolved = false; gb.round = 1
        else
          gb.phase = "complete"; gb.timer = 0
        end
      else
        gb._resolved = false
        gb.phase = "duel_wait"
        gb.timer = 0; gb.countdown = 0
        gb.waitTime = rnd(0.30, 0.75)
        gb.playerAction = nil; gb.npcAction = nil
        gb.shotSmoke = 0
        gb.headstart = getHeadstart()
      end
    end
  end
end

-- ─── GANG KEYPRESSED ────────────────────────────────────────────────────────
local function gangKeyPressed(key)
  local gb=gangBattle
  local shoot=(key=="space" or key=="z" or key=="return")

  if gb.phase=="intro" and gb.introTimer>1.5 and shoot then
    gb.phase="duel_wait"; gb.timer=0; gb.countdown=0
    gb.playerShot=false; gb.npcShot=false; gb.earlyShot=false
    gb.win=false; gb.shotSmoke=0; gb.beepTimer=0
    gb.lightning=false; gb.bonusXp=0
    gb.round=1; gb._resolved=false; gb.standoff=false
    gb.playerAction=nil; gb.npcAction=nil; gb.resultText=""
    gb.headstart = getHeadstart()
    gb.waitTime=rnd(1.0,2.6)

  elseif gb.phase=="duel_draw" and not gb.playerAction then
    local act = actionFromKey(key)
    if act then
      gb.playerAction = act
      gb.playerActTime = gb.countdown
      gb.playerShot = isOffensive(act)
      if isOffensive(act) then
        local lightWindow = 0.100 + skillVal("quickdraw") * 0.015
        if gb.countdown <= lightWindow then
          gb.lightning = true
          gb.bonusXp = 10 + skillVal("quickdraw") * 3
        end
      end
      if gb.npcAction then
        gb.phase = "duel_resolve"
        gb.resultTimer = 0
        gb._resolved = false
        if isOffensive(act) or isOffensive(gb.npcAction) then gb.shotSmoke = 1.0 end
      end
    end

  elseif gb.phase=="duel_wait" then
    local act = actionFromKey(key)
    if act and isOffensive(act) then
      local grace = getFocusGrace() + 0.08
      if gb.timer >= (gb.waitTime - grace) then
        gb.phase = "duel_draw"; gb.countdown = 0.02
        gb.playerAction = act; gb.playerActTime = 0.02
        gb.playerShot = true; gb.bonusXp = 4
      else
        gb.playerAction = act; gb.playerActTime = 0
        gb.earlyShot = true
        gb.npcAction = "shoot"; gb.npcActTime = 0.04
        gb.phase = "duel_resolve"; gb._resolved = false
        gb.resultTimer = 0; gb.shotSmoke = 1.0
      end
    end

  elseif gb.phase=="between" and gb.timer>0.7 and shoot then
    gb.phase="duel_wait"; gb.timer=0; gb.countdown=0
    gb.playerShot=false; gb.npcShot=false; gb.earlyShot=false
    gb.win=false; gb.shotSmoke=0; gb.beepTimer=0
    gb.lightning=false; gb.bonusXp=0
    gb.round=1; gb._resolved=false
    gb.playerAction=nil; gb.npcAction=nil; gb.resultText=""
    gb.headstart = getHeadstart()
    gb.waitTime=rnd(0.5, 1.2)

  elseif gb.phase=="complete" and gb.timer>1.5 and shoot then
    player.score=player.score+3
    gainXP(45 + player.level * 5, "GANG CLEAR")
    gainLife(1)  -- claiming the bounty grants an extra life
    gangBattle.active=false
    bounty.active=false; bounty.warned=false; bounty.wantedFlash=0

    if stage.id == "village" then
      -- Road opens toward the Pyramid
      startTransition("approach", "THE ROAD TO THE PYRAMID")
    elseif stage.id == "approach" then
      -- Enter the Pyramid interior
      stage.floor = 1
      stage.floorKills = 0
      stage.floorGoal = 8
      startTransition("pyramid", "ENTER THE PYRAMID")
    else
      spawnNPCs()
      SCREEN="explore"
    end
  end
end

-- ─── LOVE CALLBACKS ─────────────────────────────────────────────────────────
function love.load()
  love.graphics.setDefaultFilter("nearest","nearest")
  canvas=love.graphics.newCanvas(W,H)
  loadScores(); SCREEN="title"
end

function love.update(dt)
  dt=math.min(dt,0.05)
  if stage.bannerTimer and stage.bannerTimer > 0 then
    stage.bannerTimer = stage.bannerTimer - dt
  end
  if SCREEN=="explore" then exploreUpdate(dt)
  elseif SCREEN=="duel"  then duelUpdate(dt)
  elseif SCREEN=="gang"  then gangUpdate(dt)
  elseif SCREEN=="transition" then
    stage.transitionT = (stage.transitionT or 0) + dt
    if stage.transitionT > 2.8 then
      local nextId = stage.transitionTo or "approach"
      enterArea(nextId)
    end
  end
end

function love.keypressed(key)
  if SCREEN=="title" then
    if key=="return" or key=="space" then
      resetStageToVillage()
      initPlayer()
      genVillage()
      spawnNPCs()
      SCREEN="explore"
    end
  elseif SCREEN=="transition" then
    if key=="return" or key=="space" then
      local nextId = stage.transitionTo or "approach"
      enterArea(nextId)
    end

  elseif SCREEN=="duel" then
    if duel.phase == "duel_draw" and not duel.playerAction then
      local act = actionFromKey(key)
      if act then
        duel.playerAction = act
        duel.playerActTime = duel.countdown
        duel.playerShot = isOffensive(act)
        if isOffensive(act) then
          local lightWindow = 0.100 + skillVal("quickdraw") * 0.015
          if duel.countdown <= lightWindow then
            duel.lightning = true
            duel.bonusXp = 8 + skillVal("quickdraw") * 2
          end
        end
        -- Immediate resolve if enemy already moved
        if duel.npcAction then
          duel.phase = "duel_resolve"
          duel.resultTimer = 0
          duel._resolved = false
          if isOffensive(act) or isOffensive(duel.npcAction) then duel.shotSmoke = 1.0 end
        end
      end
    elseif duel.phase == "duel_wait" then
      -- Only a clear shoot attempt can be "too early". Dodges during wait are ignored.
      local act = actionFromKey(key)
      if act and isOffensive(act) then
        local grace = getFocusGrace() + 0.08  -- slightly more forgiving
        if duel.timer >= (duel.waitTime - grace) then
          -- clutch anticipation → start DRAW with your shot already committed
          duel.phase = "duel_draw"
          duel.countdown = 0.02
          duel.playerAction = act
          duel.playerActTime = 0.02
          duel.playerShot = true
          duel.bonusXp = 3
        else
          duel.playerAction = act
          duel.playerActTime = 0
          duel.earlyShot = true
          duel.npcAction = "shoot"
          duel.npcActTime = 0.04
          duel.phase = "duel_resolve"
          duel._resolved = false
          duel.resultTimer = 0
          duel.shotSmoke = 1.0
        end
      end
    end

  elseif SCREEN=="gang" then
    gangKeyPressed(key)

  elseif SCREEN=="dead" then
    if (key=="return" or key=="space") and deadTimer>1.5 then
      resetStageToVillage()
      initPlayer()
      genVillage()
      spawnNPCs()
      SCREEN="explore"
    end
  end
end

function love.draw()
  love.graphics.setCanvas(canvas)
  love.graphics.clear(C.sky)

  if SCREEN=="title" then
    drawTitle()

  elseif SCREEN=="explore" then
    drawWorld()
    -- HUD
    setColor(C.hud_bg); love.graphics.rectangle("fill",0,0,W,22)
    love.graphics.setFont(Font(6)); setColor(C.gold)
    love.graphics.print("L"..player.level, 4, 3)
    local xpPct = player.xp / math.max(1, player.xpToNext)
    setColor({0.25,0.2,0.1,1}); love.graphics.rectangle("fill", 28, 4, 50, 5)
    setColor(C.gold); love.graphics.rectangle("fill", 28, 4, math.floor(50*xpPct), 5)
    love.graphics.setFont(Font(5)); setColor(C.white)
    love.graphics.print("K:"..player.score, 4, 12)
    -- lives (hearts / xN)
    setColor(C.red)
    local lifeStr = "x"..(player.lives or 1)
    love.graphics.print(lifeStr, 36, 12)
    setColor({0.9, 0.25, 0.2, 1})
    love.graphics.rectangle("fill", 28, 13, 5, 4)
    love.graphics.rectangle("fill", 29, 12, 3, 1)

    -- Area / objective center text
    local centerMsg = ""
    local centerCol = {0.8,0.8,0.8,1}
    if bounty.active then
      centerMsg = "!! WANTED !!"
      centerCol = C.bounty
    elseif stage.id == "village" then
      local left = BOUNTY_THRESHOLD - stage.areaKills
      if left > 0 then centerMsg = left.." TO BOUNTY" end
    elseif stage.id == "approach" then
      local left = BOUNTY_THRESHOLD - stage.areaKills
      if left > 0 then centerMsg = left.." TO VIPERS" else centerMsg = "ROAD TO PYRAMID" end
      centerCol = C.gold
    elseif stage.id == "pyramid" then
      centerMsg = "FLOOR "..stage.floor.."  "..stage.floorKills.."/"..stage.floorGoal
      centerCol = C.hieroglyph
    end
    if centerMsg ~= "" then
      setColor(centerCol)
      love.graphics.print(centerMsg, W/2-Font(5):getWidth(centerMsg)/2, 5)
    end

    local alive=0
    for _,n in ipairs(npcs) do if n.alive then alive=alive+1 end end
    setColor(C.white)
    local rightLabel = (stage.id=="pyramid") and (alive.." UNDEAD") or (alive.." OUTLAWS")
    love.graphics.print(rightLabel, W-Font(5):getWidth(rightLabel)-4, 5)

    love.graphics.setFont(Font(4)); setColor({0.7,0.65,0.5,1})
    local areaName = stage.id=="village" and "VILLAGE" or (stage.id=="approach" and "APPROACH" or ("PYR F"..stage.floor))
    love.graphics.print(areaName.."  QD"..skillVal("quickdraw").." PR"..skillVal("presence").." FO"..skillVal("focus"), W-110, 14)

    if player.levelUpTimer and player.levelUpTimer > 0 then
      local a = math.min(1, player.levelUpTimer)
      setColor({0.1,0.08,0.02,0.75*a})
      love.graphics.rectangle("fill", 30, H/2-28, W-60, 36)
      love.graphics.setFont(Font(10)); setColor({1,0.9,0.2,a})
      local msg = "LEVEL "..player.level.."!"
      love.graphics.print(msg, W/2-Font(10):getWidth(msg)/2, H/2-22)
      love.graphics.setFont(Font(5)); setColor({0.9,0.85,0.6,a})
      love.graphics.print("Skills improved", W/2-Font(5):getWidth("Skills improved")/2, H/2-4)
    end
    if player.lifeFlash and player.lifeFlash > 0 and player.lifeFlashText and player.lifeFlashText ~= "" then
      local a = math.min(1, player.lifeFlash)
      setColor({0.08,0.02,0.02,0.8*a})
      love.graphics.rectangle("fill", 24, H/2+16, W-48, 22)
      love.graphics.setFont(Font(6)); setColor({1,0.35,0.25,a})
      local msg = player.lifeFlashText
      love.graphics.print(msg, W/2-Font(6):getWidth(msg)/2, H/2+22)
    end
    if stage.bannerTimer and stage.bannerTimer > 0 and stage.bannerText ~= "" then
      local a = math.min(1, stage.bannerTimer)
      setColor({0.05,0.04,0.02,0.8*a})
      love.graphics.rectangle("fill", 20, H/2-20, W-40, 28)
      love.graphics.setFont(Font(8)); setColor({1,0.88,0.3,a})
      love.graphics.print(stage.bannerText, W/2-Font(8):getWidth(stage.bannerText)/2, H/2-12)
    end
    if bounty.active and not bounty.warned then
      drawBountyWarning()
    end

  elseif SCREEN=="transition" then
    -- cinematic between areas
    setColor({0.08,0.05,0.02,1}); love.graphics.rectangle("fill",0,0,W,H)
    local t = stage.transitionT or 0
    local a = math.min(1, t * 1.2)
    love.graphics.setFont(Font(8)); setColor({1,0.85,0.3,a})
    local msg = stage.bannerText or "..."
    love.graphics.print(msg, W/2-Font(8):getWidth(msg)/2, H/2-20)
    love.graphics.setFont(Font(5)); setColor({0.85,0.8,0.65,a})
    local sub = (stage.transitionTo=="pyramid") and "Deeper than the desert..." or "Ride east. The stone waits."
    love.graphics.print(sub, W/2-Font(5):getWidth(sub)/2, H/2)
    if t > 1.2 and math.floor(t*2)%2==0 then
      love.graphics.setFont(Font(5)); setColor(C.yellow)
      love.graphics.print("SPACE TO CONTINUE", W/2-Font(5):getWidth("SPACE TO CONTINUE")/2, H*0.82)
    end

  elseif SCREEN=="duel" then
    local npc=duel.npc
    drawDuelScene(
      {hat=npc.hat,coat=npc.coat,react=npc.react,name=npc.name,isGang=false,isUndead=npc.isUndead},
      {phase=duel.phase,timer=duel.timer,countdown=duel.countdown,
       win=duel.win,shotSmoke=duel.shotSmoke,flashAlpha=duel.flashAlpha,
       flashColor=duel.flashColor,earlyShot=duel.earlyShot,
       lightning=duel.lightning,bonusXp=duel.bonusXp,
       effectiveReact=duel.effectiveReact,headstart=duel.headstart,
       playerAction=duel.playerAction,npcAction=duel.npcAction,
       round=duel.round,resultText=duel.resultText,standoff=duel.standoff},
      nil, false)

  elseif SCREEN=="gang" then
    local gb=gangBattle
    if gb.phase=="intro" then
      drawGangIntro()
    elseif gb.phase=="between" then
      drawGangBetween()
    elseif gb.phase=="complete" then
      drawGangComplete()
    else
      -- active duel against current gang member
      local cur=gb.members[gb.current]
      local label=(gb.gangTitle or "GANG").."  "..gb.current.."/3"
      drawDuelScene(
        {hat=cur.hat,coat=cur.coat,react=cur.react,name=cur.name,isGang=true},
        {phase=gb.phase,timer=gb.timer,countdown=gb.countdown,
         win=gb.win,shotSmoke=gb.shotSmoke,flashAlpha=gb.flashAlpha,
         flashColor=gb.flashColor,earlyShot=gb.earlyShot,
         lightning=gb.lightning,bonusXp=gb.bonusXp,
         effectiveReact=cur.effectiveReact,headstart=gb.headstart,
         playerAction=gb.playerAction,npcAction=gb.npcAction,
         round=gb.round,resultText=gb.resultText},
        label, false)
      -- Bounty bar: show which members are alive/dead
      setColor(C.hud_bg); love.graphics.rectangle("fill",W/2-45,H-10,90,10)
      for i=1,3 do
        local cx=W/2+(i-2)*26
        if not gb.members[i].alive then
          setColor(C.blood); love.graphics.circle("fill",cx,H-5,4)
        elseif i==gb.current then
          setColor(C.bounty); love.graphics.circle("fill",cx,H-5,5)
          setColor(C.white); love.graphics.circle("line",cx,H-5,6)
        else
          setColor({0.4,0.3,0.3,1}); love.graphics.circle("fill",cx,H-5,4)
        end
      end
    end

  elseif SCREEN=="dead" then
    drawDead()
  end

  love.graphics.setCanvas()
  local sw,sh=love.graphics.getDimensions()
  local scale=math.min(sw/W,sh/H)
  local ox=math.floor((sw-W*scale)/2); local oy=math.floor((sh-H*scale)/2)
  love.graphics.setColor(1,1,1,1)
  love.graphics.draw(canvas,ox,oy,0,scale,scale)
end

function love.resize() end
