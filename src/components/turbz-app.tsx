import { memo, useCallback, useEffect, useRef, useState } from "react";
import { staticSignIn, staticSignUp, useStaticAccount } from "@/lib/auth/static-account";
import { CLASS_RACE } from "@/game/content";
import { CLASSES, classGendered } from "@/game/classes";
import { CharacterSheet, ClassPicker, type Pick } from "@/components/character-ui";
import { FloatWin, narrow, vh, vw } from "@/components/float-win";
import { HudDock, HudFabs, HudHover, HudTarget, HudTracker, HudVitals } from "@/components/hud";
import { isPinned, useLayout } from "@/game/ui-layout";
import { loadCloudSave, writeCloudSave } from "@/game/cloud-client";
import { bindCloud, cloudReady, ingestCloud, localSaves, noteArena, noteHardcore, noteHunt, onSync, readArenaLocal } from "@/game/account-save";
import { postGrave } from "@/game/social-client";
import type { GraveBody } from "@/game/social-types";
import { DesignerMode } from "@/components/designer-mode";
import { ArenaScreen } from "@/components/arena-ui";
import { Boards, DuelBanner, Hub, Options, ShiniesScreen } from "@/components/hub-ui";
import { readShinies } from "@/game/account-save";
import { captureShinyGif, captureShinySeenGif } from "@/game/shiny-gif";
import { postShinySeen, writeShinies } from "@/game/cloud-client";
import { TurbzGame } from "@/game/engine";
import { installBlackMarket } from "@/game/black-market";
import { installLms } from "@/game/lms";
import { installTurbz } from "@/game/turbz-mode";
import { Bag, BlackMarket, BountyBoard, ChestPanel, GearInventory, LootPicker } from "@/components/inventory-ui";
import { ContextMenu, CraftPanel, DiedOverlay, MapPanel, PausePanel, QuestsPanel, RebirthOverlay, SkillsPanel, SpiritsPanel, SurvivalPanel, TalkWindow, VersesPanel, WildGhostPanel } from "@/components/game-panels";
import { useSnapPick, useSnapValue, type Snap } from "@/components/use-snap";
import { Field, Screen, Tabs, Tile } from "@/components/ui-kit";

/** Static (dreamdaw.com) build: accounts + saves live in the worker (see /worker). */

export function TurbzApp() {
  const acct = useStaticAccount();
  if (acct.pending) {
    return (
      <main className="game-root">
        <Screen kicker="TURBZ API" title="Waking the veil">
          <p className="text-dim">Checking your account. Autosave and lobbies wait on the veil.</p>
        </Screen>
      </main>
    );
  }
  if (!acct.user) return <ApiGate />;
  return <Hunt />;
}

export function ApiGate() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("up");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const name = user.trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(name)) return setErr("Username is 3–16 letters, numbers, or _.");
    if (password.length < 8) return setErr("Password needs 8 characters.");
    setBusy(true);
    setErr("");
    try {
      await (mode === "up" ? staticSignUp(name, password) : staticSignIn(name, password));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "TURBZ API refused that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="game-root">
      <Screen kicker="TURBZ API" title={mode === "up" ? "Create your account" : "Welcome back"}>
        <p className="text-dim">Username and password only. Your witch autosaves to this account, so you can leave and pick up where you stopped.</p>
        <Tabs value={mode} onChange={setMode} tabs={[{ id: "up", label: "Sign up" }, { id: "in", label: "Login" }]} />
        <form className="ui-stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Username">
            <input value={user} onChange={(e) => setUser(e.target.value.slice(0, 16))} required placeholder="Username" aria-label="Username" autoComplete="username" className="px-input" />
          </Field>
          <Field label="Password">
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} placeholder="Password" aria-label="Password" autoComplete={mode === "up" ? "new-password" : "current-password"} className="px-input" />
          </Field>
          {err && <p className="text-blood">{err}</p>}
          <button className="px-btn px-btn-kyo" type="submit" disabled={busy}>
            {busy ? "Wait" : mode === "up" ? "Sign Up" : "Login"}
          </button>
        </form>
      </Screen>
    </main>
  );
}

function veilName(user: { id: string; displayName?: string | null; primaryEmail?: string | null }): string {
  const raw = (user.displayName || user.primaryEmail || "witch").split("@")[0] ?? "witch";
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
  if (cleaned.length >= 3) return cleaned;
  const tail = user.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  return `w${tail}`.slice(0, 16);
}

type ScreenId = "hub" | "hunt" | "circle" | "hard" | "boards" | "options" | "designer" | "lms" | "turbz" | "shinies";

/** Re-renders the Shiny collection GIF and uploads it (for the Discord bot's /shiny). */
function uploadShinies(): void {
  const list = readShinies();
  if (!list.length) return;
  setTimeout(() => {
    let gif: string | null = null;
    try { gif = captureShinyGif(list); } catch { gif = null; }
    void writeShinies(list, gif);
  }, 50);
}

function Hunt() {
  const acct = useStaticAccount();
  const username = acct.user ? veilName(acct.user) : "witch";
  // The top level only re-renders when the mode changes; every window subscribes to its own fields.
  const { mode, hasSave } = useSnapPick(["mode", "hasSave"] as const);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TurbzGame | null>(null);
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("Mira");
  const [pick, setPick] = useState<Pick>({ classId: "warden", traitId: null, female: true });
  const race = CLASS_RACE[pick.classId];
  const [screen, setScreen] = useState<ScreenId>("hub");
  const [arenaSeed, setArenaSeed] = useState<unknown>(null);
  const [booted, setBooted] = useState(false);

  const onArenaCloud = useCallback((save: unknown | null) => {
    noteArena(save);
    setArenaSeed(save);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new TurbzGame(canvas);
    installBlackMarket(game);
    installLms(game);
    installTurbz(game);
    gameRef.current = game;
    game.attachCloud((json) => {
      try {
        const parsed = JSON.parse(json) as { slot?: string; save?: unknown };
        if (parsed && parsed.slot === "hardcore") noteHardcore(parsed.save);
        else if (parsed && parsed.slot === "hunt") noteHunt(parsed.save);
        else noteHunt(parsed);
      } catch {
        /* keep the local hunt */
      }
    });
    game.attachGrave((body: GraveBody) => {
      void postGrave(body).catch(() => {});
    });
    game.attachShiny(() => uploadShinies());
    game.attachShinySeen((seen: { entry: import("@/game/account-save").ShinyEntry; witch: string; place: string }) => {
      setTimeout(() => {
        let gif: string | null = null;
        try { gif = captureShinySeenGif(seen.entry); } catch { gif = null; }
        void postShinySeen({ name: seen.entry.name, species: seen.entry.species, level: seen.entry.level, type: seen.entry.type, witch: seen.witch, place: seen.place, mode: seen.entry.mode, gif });
      }, 30);
    });
    game.start();
    bindCloud((payload, urgent) => writeCloudSave({ data: payload, urgent }));
    // Tell the player once when the cloud keeps refusing saves (their progress is still kept locally).
    let warned = false;
    const unSync = onSync((st) => {
      if (st.state === "synced") warned = false;
      else if (st.state === "failed" && st.fails >= 3 && !warned) {
        warned = true;
        game.say("Cloud save is not getting through. Your progress is saved on this device and will upload when it can.");
      }
    });
    // No cloud copy (or the cloud could not be read): play on from this device's own saves.
    const useLocal = () => {
      const local = localSaves();
      if (local.hunt && typeof local.hunt === "object") game.rememberCloud(local.hunt);
      if (local.hardcore && typeof local.hardcore === "object") game.rememberHard(local.hardcore);
      setArenaSeed(readArenaLocal());
    };
    void loadCloudSave()
      .then((text) => {
        if (typeof text === "string" && text.length > 2) {
          try {
            const split = ingestCloud(JSON.parse(text) as unknown);
            if (split.hunt && typeof split.hunt === "object") game.rememberCloud(split.hunt);
            if (split.hardcore && typeof split.hardcore === "object") game.rememberHard(split.hardcore);
            setArenaSeed(split.arena);
          } catch {
            useLocal();
          }
        } else useLocal();
      })
      .catch(() => useLocal())
      .finally(() => {
        cloudReady();
        setBooted(true);
        // Keep the server's copy (and the /shiny GIF) in step with this device.
        uploadShinies();
      });
    // Closing or hiding the tab: save right away so the last few seconds of progress are not lost.
    const flush = () => { try { game.flushCloud(); } catch { /* the page is going anyway */ } };
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      unSync();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
      game.stop();
    };
  }, []);

  const g = () => gameRef.current;
  const playing = mode === "play";

  return (
    <main className="game-root">
      <canvas ref={canvasRef} className="game-canvas" aria-label="TURBZ wilds" />
      <div className="overlay">
        {screen === "hub" && !playing && (
          <Hub
            username={username}
            onHunt={() => { g()?.swapRules("hunt"); setScreen("hunt"); }}
            onCircle={() => setScreen("circle")}
            onLms={() => setScreen("lms")}
            onTurbz={() => setScreen("turbz")}
            onHard={() => { g()?.swapRules("hardcore"); setScreen("hard"); }}
            onBoards={() => setScreen("boards")}
            onOptions={() => setScreen("options")}
            onDesigner={() => setScreen("designer")}
            onShinies={() => setScreen("shinies")}
            onAscend={() => {
              const n = g()?.ascend() ?? 0;
              setArenaSeed(null);
              setCreate(false);
              return n;
            }}
          />
        )}
        {screen === "shinies" && !playing && <ShiniesScreen username={username} onBack={() => setScreen("hub")} />}
        {(screen === "hunt" || screen === "hard") && !playing && !create && (
          <Title
            kind={screen === "hard" ? "hard" : "hunt"}
            hasSave={hasSave}
            onBack={() => setScreen("hub")}
            onNew={() => setCreate(true)}
            onContinue={() => g()?.continueGame()}
            circleReady={booted}
            onCircle={() => setScreen("circle")}
          />
        )}
        {(screen === "hunt" || screen === "hard") && !playing && create && (
          <Create
            name={name}
            setName={setName}
            pick={pick}
            setPick={setPick}
            game={g()}
            hard={screen === "hard"}
            onBack={() => setCreate(false)}
            onGo={() => {
              g()?.begin(name, race, undefined, pick.classId, pick.traitId, classGendered(pick.classId) ? pick.female : true);
              setCreate(false);
            }}
          />
        )}
        {screen === "turbz" && !playing && (
          <Screen kicker="TURBZ" title="A hard wild. Other witches." wide>
            <div className="ui-stack" data-testid="turbz-screen">
              <p className="text-dim">You wake at level 1 on a generated 450×450 map, on Hardcore difficulty. Dungeons and world bosses are the point: they drop the good gear. There is day and night, and no food or water: you have health, mana and stamina. Spells spend mana. Melee spends stamina. Run a pool dry and that kind of attack is half speed for five seconds while it refills. No bounties, no quests, no townsfolk. Ten to fifteen witches grind, craft, and catch spirits, and sometimes die. If two meet they team up, never past three. Gear you wear levels up, slower than you do. If you die, that worn gear and the ghosts out with you drop back to level 1 versions instead of vanishing. Everything else is lost. This run is not saved.</p>
              <Field label="Name">
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} className="px-input" />
              </Field>
              <ClassPicker pick={pick} setPick={setPick} game={g()} />
              <div className="screen-actions">
                <button type="button" className="px-btn" onClick={() => setScreen("hub")}>Back</button>
                <button type="button" className="px-btn px-btn-kyo" data-testid="turbz-go" onClick={() => (g() as unknown as { startTurbz?: (...a: unknown[]) => void } | null)?.startTurbz?.(name, race, pick.classId, pick.traitId, classGendered(pick.classId) ? pick.female : true)}>
                  Wake as {CLASSES.find((c) => c.id === pick.classId)?.name}
                </button>
              </div>
            </div>
          </Screen>
        )}
        {screen === "lms" && !playing && (
          <Screen kicker="LAST MAN STANDING" title="One hundred witches. One survivor." wide>
            <div className="ui-stack" data-testid="lms-screen">
              <p className="text-dim">You and 99 rival witches wake at level 1, spread evenly across Veilreach. The towns are empty and the quests are gone; it is always night and only ghosts walk. Hunger, thirst, rest, camps and chests work like Hardcore, and anyone can swim between continents. Rivals level up, gather, cook, brew, learn heals and wards, and once they wear a full set of gear they hunt everyone else, you included. The last witch alive wins. This match is not saved and does not touch your Hardcore witch.</p>
              <Field label="Name">
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} className="px-input" />
              </Field>
              <ClassPicker pick={pick} setPick={setPick} game={g()} />
              <div className="screen-actions">
                <button type="button" className="px-btn" onClick={() => setScreen("hub")}>Back</button>
                <button type="button" className="px-btn px-btn-kyo" data-testid="lms-go" onClick={() => (g() as unknown as { startLms?: (...a: unknown[]) => void } | null)?.startLms?.(name, race, pick.classId, pick.traitId, classGendered(pick.classId) ? pick.female : true)}>
                  Enter as {CLASSES.find((c) => c.id === pick.classId)?.name}
                </button>
              </div>
            </div>
          </Screen>
        )}
        {playing && screen !== "circle" && screen !== "boards" && screen !== "options" && <Play game={g()} username={username} />}
        {screen === "designer" && !playing && <DesignerMode onBack={() => setScreen("hub")} />}
        {screen === "circle" && <ArenaScreen seed={arenaSeed} onClose={() => setScreen("hub")} onCloud={onArenaCloud} />}
        {screen === "boards" && !playing && <Boards username={username} onBack={() => setScreen("hub")} />}
        {screen === "options" && !playing && <Options username={username} onBack={() => setScreen("hub")} />}
      </div>
    </main>
  );
}

function Title(props: {
  kind: "hunt" | "hard";
  hasSave: boolean;
  onBack: () => void;
  onNew: () => void;
  onContinue: () => void;
  circleReady: boolean;
  onCircle: () => void;
}) {
  const hard = props.kind === "hard";
  return (
    <Screen kicker={hard ? "HARDCORE" : "TURBOHUNT"} title={hard ? "The frontier" : "The hunt"}>
      <p className="text-dim">
        {hard
          ? "A separate wilderness. Hunger, thirst and sleep drain during active play. Wounds only mend with healing spells, potions and meals. Foes grow harder every night. Death takes this body, even in dungeons; your skills, perks and ghosts carry on."
          : "Die and you choose a new witch. Your ghosts come with her, and a finished set of her class can be worn again. Otherwise she wakes in the default robes at a tavern, beside the bounty board."}
      </p>
      <div className="tile-grid">
        <Tile primary title={props.hasSave ? "Continue" : "No witch yet"} about={props.hasSave ? "Pick up where you stopped." : "Start a new witch below."} onClick={props.onContinue} disabled={!props.hasSave} />
        <Tile title={hard ? "New hardcore witch" : "New hunt"} about="Choose a class and a trait." onClick={props.onNew} />
        {!hard && <Tile title="TurboCircle" about="Battle simulator." onClick={props.onCircle} disabled={!props.circleReady} />}
        <Tile title="Back" about="Return to the veil." onClick={props.onBack} />
      </div>
      <p className="text-dim">
        {hard
          ? "Right-click for menus. Press E to gather, fish and open loot chests; Space uses your Space-bar item. Three logs build a campfire to cook, purify water and sleep through the night."
          : "Right-click for menus. Press E beside a node or the shore to gather or fish. Spirits are under G, potions in Crafting (X), and Space uses your Space-bar item."}
      </p>
    </Screen>
  );
}

function Create(props: { name: string; setName: (v: string) => void; pick: Pick; setPick: (p: Pick) => void; game: TurbzGame | null; hard: boolean; onBack: () => void; onGo: () => void }) {
  return (
    <Screen kicker={props.hard ? "NEW HARDCORE WITCH" : "NEW WITCH"} title={`${CLASSES.length} classes of the veil`} wide>
      <div data-testid="create-screen" className="ui-stack">
        <Field label="Name">
          <input value={props.name} data-testid="create-name-input" onChange={(e) => props.setName(e.target.value.slice(0, 16))} className="px-input" />
        </Field>
        <ClassPicker pick={props.pick} setPick={props.setPick} game={props.game} />
        <div className="screen-actions">
          <button type="button" className="px-btn" data-testid="create-back-btn" onClick={props.onBack}>Back</button>
          <button type="button" className="px-btn px-btn-kyo" data-testid="create-go-btn" onClick={props.onGo}>
            Wake as {CLASSES.find((c) => c.id === props.pick.classId)?.name}
          </button>
        </div>
      </div>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// In game
// ---------------------------------------------------------------------------

const PANEL_IDS = ["sheet", "gear", "bag", "skills", "moves", "quests", "map", "ghost", "craft", "bounty", "survival", "trade", "pause", "chest", "wildghost"] as const;
type PanelId = (typeof PANEL_IDS)[number];
const PANEL_TITLE: Record<PanelId, string> = {
  sheet: "Character Sheet", gear: "Gear Inventory", bag: "Bag", skills: "Skills & Perks", moves: "Verses", quests: "Quests",
  map: "World Map", ghost: "Spirits", craft: "Crafting", bounty: "Bounty Board", survival: "Survival & Camp", trade: "Black Market", pause: "Menu", chest: "Loot Chest", wildghost: "Lingering Ghost",
};
/** Default window widths. Rebuilt windows use new layout keys so an old, cramped saved size does not carry over. */
const PANEL_W: Partial<Record<PanelId, number>> = { chest: 640, wildghost: 520, bag: 620, gear: 960, trade: 660, sheet: 560, moves: 720, skills: 640, ghost: 640, craft: 620, survival: 640, quests: 680, map: 1040, bounty: 500, pause: 560 };
const REBUILT = new Set<PanelId>(["gear", "bag", "trade", "moves", "skills", "ghost", "craft", "survival", "quests", "map", "bounty", "pause"]);

function winId(panel: PanelId): string {
  if (panel === "map") return "panel-map-v3";
  return REBUILT.has(panel) ? `panel-${panel}-v2` : `panel-${panel}`;
}

function panelDef(panel: PanelId) {
  return () => {
    if (narrow()) return { x: 8, y: Math.round(vh() * 0.12), w: vw() - 16, h: Math.round(vh() * 0.7) };
    const w = Math.min(vw() - 16, PANEL_W[panel] ?? 460);
    const h = Math.max(320, Math.min(vh() - 200, 820));
    if (panel === "gear" || panel === "bag" || panel === "trade" || panel === "moves" || panel === "pause" || panel === "map") {
      return { x: Math.max(8, Math.round((vw() - w) / 2)), y: Math.max(8, Math.round((vh() - h) / 2) - 40), w, h };
    }
    const step = PANEL_IDS.indexOf(panel) % 5;
    return { x: Math.max(8, vw() - w - 300 - step * 28), y: 64 + step * 24, w, h: Math.min(h, vh() - 210 - step * 24) };
  };
}

type GameProp = { game: TurbzGame | null };

const BAG_KEYS = ["gear", "equipped", "locked", "selected", "sellMult", "kyo", "stash", "setLabel", "setBonus", "totals", "bag", "rules", "quick", "quickCd"] as const;
const BagWin = memo(function BagWin({ game }: GameProp) {
  const s = useSnapPick(BAG_KEYS);
  return <Bag snap={s as unknown as Snap} game={game} />;
});
const GearWin = memo(function GearWin({ game }: GameProp) {
  const s = useSnapPick([...BAG_KEYS, "setProgress"] as const);
  return <GearInventory snap={s as unknown as Snap} game={game} />;
});
const MarketWin = memo(function MarketWin({ game }: GameProp) {
  const s = useSnapPick([...BAG_KEYS, "trade"] as const);
  return <BlackMarket snap={s as unknown as Snap} game={game} />;
});
const BountyWin = memo(function BountyWin({ game }: GameProp) {
  const s = useSnapPick(["bountyBoard", "hunt", "kyo"] as const);
  return <BountyBoard snap={s as unknown as Snap} game={game} />;
});
const SheetWin = memo(function SheetWin() {
  const { sheet } = useSnapPick(["sheet"] as const);
  return <CharacterSheet sheet={sheet} />;
});
const ChestWin = memo(function ChestWin({ game }: GameProp) {
  const s = useSnapPick(["chest", "gear", "equipped", "locked", "sellMult"] as const);
  return <ChestPanel snap={s as unknown as Snap} game={game} />;
});
const LootWin = memo(function LootWin({ game }: GameProp) {
  const s = useSnapPick(["loot", "gear", "equipped", "locked", "sellMult"] as const);
  return <LootPicker snap={s as unknown as Snap} game={game} />;
});

function PanelBody({ panel, game }: { panel: PanelId; game: TurbzGame | null }) {
  switch (panel) {
    case "sheet": return <SheetWin />;
    case "bag": return <BagWin game={game} />;
    case "gear": return <GearWin game={game} />;
    case "skills": return <SkillsPanel game={game} />;
    case "moves": return <VersesPanel game={game} />;
    case "quests": return <QuestsPanel game={game} />;
    case "map": return <MapPanel game={game} />;
    case "ghost": return <SpiritsPanel game={game} />;
    case "craft": return <CraftPanel game={game} />;
    case "bounty": return <BountyWin game={game} />;
    case "survival": return <SurvivalPanel game={game} />;
    case "trade": return <MarketWin game={game} />;
    case "pause": return <PausePanel game={game} />;
    case "chest": return <ChestWin game={game} />;
    case "wildghost": return <WildGhostPanel game={game} />;
  }
}

const Windows = memo(function Windows({ game }: GameProp) {
  const { panel } = useSnapPick(["panel"] as const);
  useLayout();
  const open = PANEL_IDS.filter((id) => id === panel || isPinned(winId(id)));
  return (
    <>
      {open.map((p) => (
        <FloatWin key={p} id={winId(p)} title={PANEL_TITLE[p]} def={panelDef(p)} minW={p === "bag" || p === "gear" ? 320 : 220} onClose={() => { if (panel === p) game?.closePanel(); }}>
          <PanelBody panel={p} game={game} />
        </FloatWin>
      ))}
    </>
  );
});

const Talk = memo(function Talk({ game }: GameProp) {
  const { panel, talk } = useSnapPick(["panel", "talk"] as const);
  if (panel !== "talk" || !talk) return null;
  return (
    <FloatWin id="talk-v2" title={`${talk.name} · ${talk.role}`} onClose={() => game?.closePanel()} def={() => (narrow() ? { x: 8, y: Math.round(vh() * 0.4), w: vw() - 16 } : { x: Math.max(8, Math.round(vw() / 2 - 260)), y: Math.max(8, vh() - 470), w: 520 })}>
      <TalkWindow game={game} />
    </FloatWin>
  );
});

/** A large, short "SHINY DROPPED" pop-up near the top of the screen. It never blocks clicks and fades on its own. */
const SHINY_ALERT_MS = 2400;
const ShinyDropAlert = memo(function ShinyDropAlert() {
  const n = useSnapValue("shinyAlert");
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!n) { setShown(0); return; }
    setShown(n);
    const t = setTimeout(() => setShown(0), SHINY_ALERT_MS);
    return () => clearTimeout(t);
  }, [n]);
  if (!shown) return null;
  return (
    <div className="shiny-drop-alert" key={shown} role="status" aria-live="polite" data-testid="shiny-drop-alert">
      <span>✦ SHINY DROPPED ✦</span>
    </div>
  );
});

const Overlays = memo(function Overlays({ game }: GameProp) {
  const { panel, hint, menu, duel, hover } = useSnapPick(["panel", "hint", "menu", "duel", "hover"] as const);
  return (
    <>
      {hint && !hover && !menu && !panel && <div className="hint-chip px-panel">{hint}</div>}
      <HudHover />
      <ShinyDropAlert />
      {duel && <DuelBanner duel={duel} />}
      <ContextMenu game={game} />
      {panel === "died" && <DiedOverlay game={game} />}
      {panel === "rebirth" && <RebirthOverlay game={game} />}
      {panel === "loot" && <LootWin game={game} />}
      <LmsHud game={game} />
    </>
  );
});

/** Last Man Standing: who is left, your kills, the kill feed, and the end of the match. */
const LmsHud = memo(function LmsHud({ game }: GameProp) {
  const { lms } = useSnapPick(["lms"] as const);
  if (!lms) return null;
  return (
    <>
      <div className="lms-hud px-panel" data-testid="lms-hud">
        <p className="font-display text-xs text-blood">LAST MAN STANDING</p>
        <p><span className="text-kyo">{lms.alive}</span>/{lms.total} alive · kills <span className="text-kyo">{lms.kills}</span> · {lms.age}{lms.hunting ? ` · ${lms.hunting} hunting` : ""}</p>
        {lms.nearest && <p className="text-dim">Nearest: {lms.nearest}</p>}
        {lms.feed.map((f, i) => <p key={i} className="lms-feed">{f}</p>)}
      </div>
      {lms.over && (
        <div className="loot-overlay" role="dialog" aria-label="Match over">
          <div className="px-panel loot-panel" data-testid="lms-over">
            <p className={`font-display text-sm ${lms.won ? "text-kyo" : "text-blood"}`}>{lms.won ? "VICTORY" : "YOU FELL"}</p>
            <h2 className="font-display mt-2 text-sm">{lms.won ? "Last witch standing" : `Place #${lms.place} of ${lms.total}`}</h2>
            <p className="mt-2">Kills {lms.kills} · survived {lms.age}</p>
            <div className="screen-actions">
              <button type="button" className="px-btn px-btn-kyo" onClick={() => game?.toTitle()}>Leave the match</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

function Play({ game, username: _username }: { game: TurbzGame | null; username: string }) {
  return (
    <>
      <HudVitals game={game} />
      <HudTarget />
      <HudTracker game={game} />
      <HudDock game={game} />
      <HudFabs game={game} />
      <Stick on={(x, y) => game?.setStick(x, y)} />
      <Windows game={game} />
      <Talk game={game} />
      <Overlays game={game} />
    </>
  );
}

function Stick({ on }: { on: (x: number, y: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  function at(e: React.PointerEvent) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * 2 - 1;
    const y = ((e.clientY - box.top) / box.height) * 2 - 1;
    const len = Math.hypot(x, y) || 1;
    on(len > 1 ? x / len : x, len > 1 ? y / len : y);
  }
  return (
    <div
      ref={ref}
      className="stick-wrap"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        at(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e);
      }}
      onPointerUp={() => on(0, 0)}
      aria-label="Move stick"
    />
  );
}
