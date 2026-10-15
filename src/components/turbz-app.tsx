import { memo, useCallback, useEffect, useRef, useState } from "react";
import { staticSignIn, staticSignUp, useStaticAccount } from "@/lib/auth/static-account";
import { CLASS_RACE } from "@/game/content";
import { CLASSES, classGendered } from "@/game/classes";
import { CharacterSheet, ClassPicker, type Pick } from "@/components/character-ui";
import { FloatWin, narrow, vh, vw } from "@/components/float-win";
import { HudDock, HudFabs, HudTarget, HudTracker, HudVitals } from "@/components/hud";
import { isPinned, useLayout } from "@/game/ui-layout";
import { loadCloudSave, writeCloudSave } from "@/game/cloud-client";
import { bindCloud, cloudReady, ingestCloud, noteArena, noteHardcore, noteHunt, readArenaLocal } from "@/game/account-save";
import { postGrave } from "@/game/social-client";
import type { GraveBody } from "@/game/social-types";
import { DesignerMode } from "@/components/designer-mode";
import { ArenaScreen } from "@/components/arena-ui";
import { Boards, ChatDock, DuelBanner, Hub, Options } from "@/components/hub-ui";
import { TurbzGame } from "@/game/engine";
import { installBlackMarket } from "@/game/black-market";
import { Bag, BlackMarket, BountyBoard, LootPicker } from "@/components/inventory-ui";
import { ContextMenu, CraftPanel, GameChat, LobbyPanel, MapPanel, PausePanel, QuestsPanel, RebirthOverlay, SkillsPanel, SpiritsPanel, SurvivalPanel, TalkWindow, VersesPanel } from "@/components/game-panels";
import { useSnapPick, type Snap } from "@/components/use-snap";
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

type ScreenId = "hub" | "hunt" | "circle" | "hard" | "boards" | "options" | "designer";

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
  const [code, setCode] = useState("");
  const [intent, setIntent] = useState<"solo" | "host" | "join">("solo");
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
    game.start();
    bindCloud((json) => {
      void writeCloudSave({ data: json }).catch(() => {});
    });
    void loadCloudSave()
      .then((text) => {
        if (typeof text === "string" && text.length > 2) {
          try {
            const split = ingestCloud(JSON.parse(text) as unknown);
            if (split.hunt && typeof split.hunt === "object") game.rememberCloud(split.hunt);
            if (split.hardcore && typeof split.hardcore === "object") game.rememberHard(split.hardcore);
            setArenaSeed(split.arena);
          } catch {
            setArenaSeed(readArenaLocal());
          }
        } else setArenaSeed(readArenaLocal());
      })
      .catch(() => setArenaSeed(readArenaLocal()))
      .finally(() => {
        cloudReady();
        setBooted(true);
      });
    return () => game.stop();
  }, []);

  const g = () => gameRef.current;
  const joinCode = (c: string) => {
    if (c.length < 3) return;
    setCode(c);
    setIntent("join");
    if (hasSave) g()?.continueGame({ role: "guest", code: c });
    else setCreate(true);
  };
  const playing = mode === "play";

  return (
    <main className="game-root">
      <canvas ref={canvasRef} className="game-canvas" aria-label="TURBZ wilds" />
      <div className="overlay">
        {!create && screen !== "designer" && !playing && <ChatDock username={username} playing={false} />}
        {screen === "hub" && !playing && (
          <Hub
            username={username}
            onHunt={() => { g()?.swapRules("hunt"); setScreen("hunt"); }}
            onCircle={() => setScreen("circle")}
            onHard={() => { g()?.swapRules("hardcore"); setScreen("hard"); }}
            onBoards={() => setScreen("boards")}
            onOptions={() => setScreen("options")}
            onDesigner={() => setScreen("designer")}
          />
        )}
        {(screen === "hunt" || screen === "hard") && !playing && !create && (
          <Title
            kind={screen === "hard" ? "hard" : "hunt"}
            hasSave={hasSave}
            code={code}
            setCode={setCode}
            onBack={() => setScreen("hub")}
            onNew={() => { setIntent("solo"); setCreate(true); }}
            onContinue={() => g()?.continueGame()}
            onHost={() => {
              const c = code.trim() || makeCode();
              setCode(c);
              setIntent("host");
              if (hasSave) g()?.continueGame({ role: "host", code: c });
              else setCreate(true);
            }}
            onJoin={() => joinCode(code.trim())}
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
              const lobby = intent === "solo" ? undefined : { role: intent === "host" ? ("host" as const) : ("guest" as const), code: code.trim() || makeCode() };
              g()?.begin(name, race, lobby, pick.classId, pick.traitId, classGendered(pick.classId) ? pick.female : true);
              setCreate(false);
            }}
          />
        )}
        {playing && screen !== "circle" && screen !== "boards" && screen !== "options" && <Play game={g()} username={username} />}
        {screen === "designer" && !playing && <DesignerMode onBack={() => setScreen("hub")} />}
        {screen === "circle" && <ArenaScreen seed={arenaSeed} onClose={() => setScreen("hub")} onCloud={onArenaCloud} />}
        {screen === "boards" && !playing && <Boards onBack={() => setScreen("hub")} />}
        {screen === "options" && !playing && <Options username={username} onBack={() => setScreen("hub")} />}
      </div>
    </main>
  );
}

function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function Title(props: {
  kind: "hunt" | "hard";
  hasSave: boolean;
  code: string;
  setCode: (v: string) => void;
  onBack: () => void;
  onNew: () => void;
  onContinue: () => void;
  onHost: () => void;
  onJoin: () => void;
  circleReady: boolean;
  onCircle: () => void;
}) {
  const hard = props.kind === "hard";
  return (
    <Screen kicker={hard ? "HARDCORE" : "TURBOHUNT"} title={hard ? "The frontier" : "The hunt"}>
      <p className="text-dim">
        {hard
          ? "A separate wilderness. Hunger, thirst and sleep drain during active play. Only healing spells mend lasting wounds. Foes grow harder every night. Death takes this body, even in dungeons."
          : "Die and you choose a new witch. A finished set of her blood can be worn again. Otherwise you wake in the default robes at another tavern, beside the bounty board."}
      </p>
      <div className="tile-grid">
        <Tile primary title={props.hasSave ? "Continue" : "No witch yet"} about={props.hasSave ? "Pick up where you stopped." : "Start a new witch below."} onClick={props.onContinue} disabled={!props.hasSave} />
        <Tile title={hard ? "New hardcore witch" : "New hunt"} about="Choose a class and a trait." onClick={props.onNew} />
        {!hard && <Tile title="TurboCircle" about="Battle simulator." onClick={props.onCircle} disabled={!props.circleReady} />}
        <Tile title="Back" about="Return to the veil." onClick={props.onBack} />
      </div>
      {!hard && (
        <div className="ui-card ui-stack-sm">
          <span className="ui-section-title">PLAY TOGETHER</span>
          <p className="text-dim">Create a lobby and share its code. A lobby only exists while its host is online.</p>
          <div className="lobby-join">
            <input value={props.code} onChange={(e) => props.setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="CODE" aria-label="Lobby code" autoComplete="off" className="px-input font-display text-xs" />
            <button className="px-btn" data-testid="title-create-btn" onClick={props.onHost}>Create</button>
            <button className="px-btn" data-testid="title-join-btn" onClick={props.onJoin}>Join</button>
          </div>
        </div>
      )}
      <p className="text-dim">
        {hard
          ? "Counters, steps and rolls can slip. A long roll can clear a blow. Strike when it is your verse."
          : "Right-click for menus. Press E beside a node or the shore to gather or fish. Spirits are under G, potions in Crafting (X)."}
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
          <button className="px-btn" data-testid="create-back-btn" onClick={props.onBack}>Back</button>
          <button className="px-btn px-btn-kyo" data-testid="create-go-btn" onClick={props.onGo}>
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

const PANEL_IDS = ["sheet", "lobby", "bag", "skills", "moves", "quests", "map", "ghost", "craft", "bounty", "survival", "trade", "pause"] as const;
type PanelId = (typeof PANEL_IDS)[number];
const PANEL_TITLE: Record<PanelId, string> = {
  sheet: "Character Sheet", lobby: "Multiplayer Lobby", bag: "Bag", skills: "Skills & Perks", moves: "Verses", quests: "Quests",
  map: "World Map", ghost: "Spirits", craft: "Crafting", bounty: "Bounty Board", survival: "Survival & Camp", trade: "Black Market", pause: "Menu",
};
/** Default window widths. Rebuilt windows use new layout keys so an old, cramped saved size does not carry over. */
const PANEL_W: Partial<Record<PanelId, number>> = { bag: 900, trade: 660, sheet: 560, moves: 720, skills: 640, ghost: 640, craft: 620, survival: 640, quests: 680, map: 560, bounty: 500, pause: 560, lobby: 440 };
const REBUILT = new Set<PanelId>(["bag", "trade", "moves", "skills", "ghost", "craft", "survival", "quests", "map", "bounty", "pause", "lobby"]);

function winId(panel: PanelId): string {
  return REBUILT.has(panel) ? `panel-${panel}-v2` : `panel-${panel}`;
}

function panelDef(panel: PanelId) {
  return () => {
    if (narrow()) return { x: 8, y: Math.round(vh() * 0.12), w: vw() - 16, h: Math.round(vh() * 0.7) };
    const w = Math.min(vw() - 16, PANEL_W[panel] ?? 460);
    const h = Math.max(320, Math.min(vh() - 200, 820));
    if (panel === "bag" || panel === "trade" || panel === "moves" || panel === "pause") {
      return { x: Math.max(8, Math.round((vw() - w) / 2)), y: Math.max(8, Math.round((vh() - h) / 2) - 40), w, h };
    }
    const step = PANEL_IDS.indexOf(panel) % 5;
    return { x: Math.max(8, vw() - w - 300 - step * 28), y: 64 + step * 24, w, h: Math.min(h, vh() - 210 - step * 24) };
  };
}

type GameProp = { game: TurbzGame | null };

const BAG_KEYS = ["gear", "equipped", "locked", "selected", "sellMult", "kyo", "stash", "setLabel", "setBonus", "totals", "bag", "rules"] as const;
const BagWin = memo(function BagWin({ game }: GameProp) {
  const s = useSnapPick(BAG_KEYS);
  return <Bag snap={s as unknown as Snap} game={game} />;
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
const LootWin = memo(function LootWin({ game }: GameProp) {
  const s = useSnapPick(["loot", "gear", "equipped", "locked", "sellMult"] as const);
  return <LootPicker snap={s as unknown as Snap} game={game} />;
});

function PanelBody({ panel, game }: { panel: PanelId; game: TurbzGame | null }) {
  switch (panel) {
    case "sheet": return <SheetWin />;
    case "lobby": return <LobbyPanel game={game} />;
    case "bag": return <BagWin game={game} />;
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
  }
}

const Windows = memo(function Windows({ game }: GameProp) {
  const { panel } = useSnapPick(["panel"] as const);
  useLayout();
  const open = PANEL_IDS.filter((id) => id === panel || isPinned(winId(id)));
  return (
    <>
      {open.map((p) => (
        <FloatWin key={p} id={winId(p)} title={PANEL_TITLE[p]} def={panelDef(p)} minW={p === "bag" ? 320 : 220} onClose={() => { if (panel === p) game?.closePanel(); }}>
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

const Overlays = memo(function Overlays({ game }: GameProp) {
  const { panel, hint, menu, duel } = useSnapPick(["panel", "hint", "menu", "duel"] as const);
  return (
    <>
      {hint && !menu && !panel && <div className="hint-chip px-panel">{hint}</div>}
      {duel && <DuelBanner duel={duel} />}
      <ContextMenu game={game} />
      {panel === "rebirth" && <RebirthOverlay game={game} />}
      {panel === "loot" && <LootWin game={game} />}
    </>
  );
});

function Play({ game, username: _username }: { game: TurbzGame | null; username: string }) {
  return (
    <>
      <HudVitals game={game} />
      <HudTarget />
      <HudTracker game={game} />
      <FloatWin id="chat-v2" title="Chat" compact def={() => (narrow() ? { x: 8, y: 132, w: vw() - 16, collapsed: true } : { x: Math.max(8, vw() - 300), y: 8, w: 290, collapsed: true })}>
        <GameChat game={game} />
      </FloatWin>
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
