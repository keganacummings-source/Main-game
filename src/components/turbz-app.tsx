import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { staticSignIn, staticSignUp, useStaticAccount } from "@/lib/auth/static-account";
import { ALCHEMY_RECIPES, CLASS_RACE, ENCHANT_BY_ID, ITEM_BY_ID, RACES, enchantText, equipmentStats, type TypeId } from "@/game/content";
import { CLASSES, classGendered } from "@/game/classes";
import { CharacterSheet, ClassPicker, LobbyPanel, type Pick } from "@/components/character-ui";
import { FloatWin, narrow, vh, vw } from "@/components/float-win";
import { HudActions, Vitals, VerseBar } from "@/components/hud";
import { isPinned, resetLayout, useLayout } from "@/game/ui-layout";
import { loadCloudSave, writeCloudSave } from "@/game/cloud-client";
import { bindCloud, cloudReady, ingestCloud, noteArena, noteHardcore, noteHunt, readArenaLocal } from "@/game/account-save";
import { postGrave } from "@/game/social-client";
import type { GraveBody } from "@/game/social-types";
import { bestFood } from "@/game/item-use";
import { CAMP_RECIPE_LIST } from "@/game/survival";
import { DesignerMode } from "@/components/designer-mode";
import { ArenaScreen } from "@/components/arena-ui";
import { AccountChip, Boards, ChatDock, DuelBanner, Hub, Options } from "@/components/hub-ui";
import { getSnap, subscribe, TurbzGame } from "@/game/engine";
import { installBlackMarket } from "@/game/black-market";

/** Static (dreamdaw.com) build: accounts + saves live in the worker (see /worker). */

function useSnap() {
  return useSyncExternalStore(subscribe, getSnap, getSnap);
}

export function TurbzApp() {
  const acct = useStaticAccount();
  const user = acct.user;
  const isPending = acct.pending;
  if (isPending) {
    return (
      <main className="game-root grid place-items-center overflow-auto p-3">
        <div className="screen-card px-panel my-auto w-full max-w-md overflow-auto p-4">
          <p className="font-display text-xs text-blood">TURBZ API</p>
          <h1 className="font-display mt-3 text-xl text-bone">TURBZ</h1>
          <p className="mt-3 text-dim">Checking your account. Autosave and lobbies wait on the veil.</p>
        </div>
      </main>
    );
  }
  if (!user) return <ApiGate />;
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
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(name)) {
      setErr("Username is 3–16 letters, numbers, or _.");
      return;
    }
    if (password.length < 8) {
      setErr("Password needs 8 characters.");
      return;
    }
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
    <main className="game-root grid place-items-center overflow-auto p-3">
      <div className="screen-card px-panel my-auto w-full max-w-md overflow-auto p-4">
        <p className="font-display text-xs text-blood">TURBZ API</p>
        <h1 className="font-display mt-3 text-xl text-bone">Login</h1>
        <p className="mt-3 text-dim">Username and password only. Your witch autosaves to this account, so you can leave and pick up where you stopped.</p>
        <form
          className="mt-4 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            value={user}
            onChange={(e) => setUser(e.target.value.slice(0, 16))}
            required
            placeholder="Username"
            aria-label="Username"
            autoComplete="username"
            className="w-full border-2 border-bone bg-ink px-3 py-2 text-bone outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={8}
            placeholder="Password"
            aria-label="Password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            className="w-full border-2 border-bone bg-ink px-3 py-2 text-bone outline-none"
          />
          {err && <p className="text-blood">{err}</p>}
          <button className="px-btn px-btn-kyo" type="submit" disabled={busy}>
            {busy ? "Wait" : mode === "up" ? "Sign Up" : "Login"}
          </button>
          <button className="px-btn" type="button" onClick={() => setMode(mode === "up" ? "in" : "up")}>
            {mode === "up" ? "Login" : "Sign Up"}
          </button>
        </form>
      </div>
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

function Hunt() {
  const acct = useStaticAccount();
  const who = acct.user;
  const username = who ? veilName(who) : "witch";
  const snap = useSnap();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TurbzGame | null>(null);
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("Mira");
  const [pick, setPick] = useState<Pick>({ classId: "warden", traitId: null, female: true });
  const race = CLASS_RACE[pick.classId];
  const [code, setCode] = useState("");
  const [intent, setIntent] = useState<"solo" | "host" | "join">("solo");
  const [chat, setChat] = useState("");
  const [screen, setScreen] = useState<"hub" | "hunt" | "circle" | "hard" | "boards" | "options" | "designer">("hub");
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
    if (snap.hasSave) g()?.continueGame({ role: "guest", code: c });
    else setCreate(true);
  };

  return (
    <main className="game-root">
      <canvas ref={canvasRef} className="game-canvas" aria-label="TURBZ wilds" />
      <div className="overlay">
        {!create && screen !== "designer" && !(snap.mode === "play" && screen !== "hub") && <ChatDock username={username} playing={false} />}
        {!create && snap.mode === "play" && screen !== "hub" && (
          <FloatWin id="chat" title="Veil chat" compact def={() => ({ x: Math.max(8, vw() - 296), y: 8, w: 288 })}>
            <ChatDock username={username} playing bare />
          </FloatWin>
        )}
        {screen === "hub" && snap.mode !== "play" && (
          <Hub
            username={username}
            onHunt={() => {
              g()?.swapRules("hunt");
              setScreen("hunt");
            }}
            onCircle={() => setScreen("circle")}
            onHard={() => {
              g()?.swapRules("hardcore");
              setScreen("hard");
            }}
            onBoards={() => setScreen("boards")}
            onOptions={() => setScreen("options")}
            onDesigner={() => setScreen("designer")}
          />
        )}
        {(screen === "hunt" || screen === "hard") && snap.mode !== "play" && !create && (
          <Title
            kind={screen === "hard" ? "hard" : "hunt"}
            hasSave={snap.hasSave}
            code={code}
            setCode={setCode}
            onBack={() => setScreen("hub")}
            onNew={() => {
              setIntent("solo");
              setCreate(true);
            }}
            onContinue={() => {
              g()?.continueGame();
            }}
            onHost={() => {
              const c = code.trim() || makeCode();
              setCode(c);
              setIntent("host");
              if (snap.hasSave) g()?.continueGame({ role: "host", code: c });
              else setCreate(true);
            }}
            onJoin={() => joinCode(code.trim())}
            onJoinCode={joinCode}
            circleReady={booted}
            circleMarks={
              arenaSeed && typeof arenaSeed === "object" && "points" in arenaSeed
                ? Number((arenaSeed as { points: number }).points)
                : null
            }
            onCircle={() => setScreen("circle")}
          />
        )}
        {(screen === "hunt" || screen === "hard") && snap.mode !== "play" && create && (
          <Create
            name={name}
            setName={setName}
            pick={pick}
            setPick={setPick}
            game={g()}
            onBack={() => setCreate(false)}
            onGo={() => {
              const lobby =
                intent === "solo"
                  ? undefined
                  : { role: intent === "host" ? ("host" as const) : ("guest" as const), code: code.trim() || makeCode() };
              g()?.begin(name, race, lobby, pick.classId, pick.traitId, classGendered(pick.classId) ? pick.female : true);
              setCreate(false);
            }}
          />
        )}
        {snap.mode === "play" && screen !== "circle" && screen !== "boards" && screen !== "options" && (
          <Play snap={snap} game={g()} chat={chat} setChat={setChat} />
        )}
        {screen === "designer" && snap.mode !== "play" && <DesignerMode onBack={() => setScreen("hub")} />}
        {screen === "circle" && (
          <ArenaScreen
            seed={arenaSeed}
            onClose={() => setScreen("hub")}
            onCloud={onArenaCloud}
          />
        )}
        {screen === "boards" && snap.mode !== "play" && <Boards onBack={() => setScreen("hub")} />}
        {screen === "options" && snap.mode !== "play" && <Options username={username} onBack={() => setScreen("hub")} />}
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
  onJoinCode: (code: string) => void;
  circleReady: boolean;
  circleMarks: number | null;
  onCircle: () => void;
}) {
  const hard = props.kind === "hard";
  return (
    <div className="flex h-full items-center justify-center overflow-auto p-3 pb-20">
      <div className="screen-card px-panel my-auto w-full max-w-xl p-4 sm:p-5">
        <p className="font-display text-xs text-blood">{hard ? "HARDCORE" : "TURBOHUNT"}</p>
        <h1 className="font-display mt-3 text-lg text-bone sm:text-2xl">{hard ? "The frontier" : "The hunt"}</h1>
        <p className="mt-3 text-dim">
          {hard
            ? "A separate wilderness. Hunger, thirst and sleep drain during active play. Hunt or buy food, chop logs, cook on campfires and purify gathered water. Only healing spells mend lasting wounds. Death takes this body, even in dungeons."
            : "Die and you must choose a new witch. A finished set of her blood can be worn again. Otherwise you wake in the default robes, at another tavern, beside the bounty board."}
        </p>
        <div className="mt-5 grid gap-2">
          <button className="px-btn px-btn-kyo" onClick={props.onNew}>
            {hard ? "New hardcore witch" : "New Hunt"}
          </button>
          <button className="px-btn" disabled={!props.hasSave} onClick={props.onContinue}>
            Continue
          </button>
          {!hard && (
            <button className="px-btn" disabled={!props.circleReady} onClick={props.onCircle}>
              TurboCircle
            </button>
          )}
          <button className="px-btn" onClick={props.onBack}>
            Back to the veil
          </button>
        </div>
        {!hard && (
          <div className="mt-5 border-t-2 border-bone pt-4">
            <p className="font-display text-xs text-kyo">Lobby code</p>
            <p className="text-dim">Create a lobby and share its code. A lobby only exists while its host is online, and friends need the host's code to join.</p>
            <input
              value={props.code}
              onChange={(e) => props.setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="CODE"
              aria-label="Lobby code"
              autoComplete="off"
              suppressHydrationWarning
              className="mt-2 w-full border-2 border-bone bg-ink px-3 py-2 font-display text-xs text-bone outline-none"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button className="px-btn" data-testid="title-create-btn" onClick={props.onHost}>
                Create
              </button>
              <button className="px-btn" data-testid="title-join-btn" onClick={props.onJoin}>
                Join
              </button>
            </div>
          </div>
        )}
        <p className="mt-4 text-dim">
          {hard
            ? "Counters, steps, and rolls can slip. A long roll can clear a blow. Spamming them only chips, and then you trip. Strike when it is your verse."
            : "Right-click for menus. Walk up to a node or the shore, then press E to gather or fish. Spirits are under G. Potions are mixed in Crafting (X)."}
        </p>
      </div>
    </div>
  );
}

function Create(props: {
  name: string;
  setName: (v: string) => void;
  pick: Pick;
  setPick: (p: Pick) => void;
  game: TurbzGame | null;
  onBack: () => void;
  onGo: () => void;
}) {
  return (
    <div className="flex h-full items-start justify-center overflow-auto p-3 pb-20">
      <div className="px-panel my-auto w-full max-w-4xl p-4" data-testid="create-screen">
        <p className="font-display text-xs text-blood">CHOOSE A CLASS</p>
        <h2 className="font-display mt-2 text-sm text-bone">{CLASSES.length} classes of the veil</h2>
        <label className="mt-3 block text-dim">
          Name
          <input
            value={props.name}
            data-testid="create-name-input"
            onChange={(e) => props.setName(e.target.value.slice(0, 16))}
            className="mt-1 w-full border-2 border-bone bg-ink px-3 py-2 text-bone outline-none"
          />
        </label>
        <div className="mt-3">
          <ClassPicker pick={props.pick} setPick={props.setPick} game={props.game} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button className="px-btn" data-testid="create-back-btn" onClick={props.onBack}>
            Back
          </button>
          <button className="px-btn px-btn-kyo" data-testid="create-go-btn" onClick={props.onGo}>
            Wake as {CLASSES.find((c) => c.id === props.pick.classId)?.name}
          </button>
        </div>
      </div>
    </div>
  );
}

function typeClass(t: TypeId): string {
  return `type-${t}`;
}

const PANEL_IDS = ["sheet", "lobby", "bag", "skills", "moves", "quests", "map", "ghost", "craft", "bounty", "survival", "trade", "pause"] as const;
const PANEL_TITLE: Record<string, string> = {
  sheet: "Character Sheet", lobby: "Multiplayer Lobby", bag: "Bag", skills: "Skills", moves: "Verses", quests: "Quest Board",
  map: "World Map", ghost: "Spirits", craft: "Crafting", bounty: "Bounty", survival: "Survival & Camp", trade: "Black Market", pause: "Paused",
};

function panelDef(panel: string) {
  return () => {
    if (narrow()) return { x: 8, y: Math.round(vh() * 0.2), w: vw() - 16, h: Math.round(vh() * 0.78) };
    const w = panel === "sheet" || panel === "ghost" || panel === "craft" ? 560 : panel === "map" ? 520 : 440;
    const step = PANEL_IDS.indexOf(panel as (typeof PANEL_IDS)[number]) % 6;
    return { x: Math.max(8, vw() - w - 8 - step * 36), y: 92 + step * 28, w, h: Math.min(vh() - 230 - step * 28, 720) };
  };
}

function PanelBody({ panel, snap, game }: { panel: string; snap: ReturnType<typeof getSnap>; game: TurbzGame | null }) {
  return (
    <>
      {panel === "sheet" && <CharacterSheet sheet={snap.sheet} />}
      {panel === "lobby" && <LobbyPanel lobby={snap.lobby} game={game} inGame={snap.mode === "play"} />}
          {panel === "survival" && <Survival snap={snap} game={game} />}
          {panel === "bag" && <Bag snap={snap} game={game} />}
          {panel === "skills" && <Skills snap={snap} game={game} />}
          {panel === "quests" && (
            <div className="grid gap-2">
              <p className="font-display text-xs text-kyo">RANDOM QUEST BOARD</p>
              <p className="text-dim">Ten contracts at once. Board refreshes every 30 minutes.</p>
              {snap.questBoard && snap.questBoard.length > 0 ? (
                snap.questBoard.map((q: { id: string; name: string; about: string; rewardKyo: number; active?: boolean }) => (
                  <div key={q.id} className={`border-2 border-bone p-2 ${q.active ? "border-kyo" : ""}`}>
                    <p className="font-display text-xs text-kyo">{q.name}</p>
                    <p>{q.about}</p>
                    <p className="text-dim">Reward · {q.rewardKyo} kyo</p>
                    {!q.active && (
                      <button type="button" className="px-btn mt-1 !min-h-9 !py-1" onClick={() => game?.acceptQuest?.(q.id)}>
                        Accept
                      </button>
                    )}
                    {q.active && <p className="text-kyo mt-1">Active</p>}
                  </div>
                ))
              ) : (
                <>
                  <p className="font-display text-xs text-kyo">{snap.questName}</p>
                  <p>{snap.questAbout}</p>
                </>
              )}
              <p className="mt-2 text-dim">Skills and finished sets survive the veil. The body does not.</p>
              <p className="mt-2">Set {snap.setLabel}</p>
              <p className="text-dim">{snap.setBonus}</p>
              <p className="mt-2 text-dim">Unlocked sets: {snap.unlocked.length}</p>
            </div>
          )}
          {panel === "map" && <Mini snap={snap} game={game} />}
          {panel === "moves" && <Moves snap={snap} game={game} />}
          {panel === "ghost" && <Ghost snap={snap} game={game} />}
          {panel === "craft" && <Craft snap={snap} game={game} />}
          {panel === "bounty" && (
            <div className="grid gap-2">
              <p className="font-display text-xs text-blood">BOUNTY BOARD</p>
              <p>{snap.bounty || "The board is blank. Take a name and a hunter steps onto this map."}</p>
              {snap.bountyPlace && <p className="text-dim">{snap.bountyPlace}.</p>}
              <p className="text-dim">They are one of the playable classes, 5 to 50 levels above you, in better gear, with spirits of their own. You have five minutes. After that they double in power and hunt you. Kill them and you take every piece they wear, plus their kyo.</p>
              <button className="px-btn px-btn-kyo" data-testid="take-bounty-btn" onClick={() => game?.takeBounty()}>
                {snap.bounty ? "Bounty already out" : "Accept bounty"}
              </button>
            </div>
          )}
          {panel === "pause" && (
            <div className="grid gap-2">
              <p>
                WASD / arrows: move. E: gather, fish, or talk. X: Crafting. 1–9: cast. B/I: Bag. V: Verses. K: Skills. G: Spirits. C: Character Sheet. L: Lobby. M: Map. H: Hardcore Survival. Escape: close or pause. Unstuck moves you to the cursor after 3 seconds. Right-click or Menu opens more actions. Chat and search fields stop movement while typing.
              </p>
              {snap.roomCode && <p className="text-kyo">Lobby {snap.roomCode}</p>}
              <p className="text-dim">Drag any window by its title bar, resize from the corner, and pin it to keep it open and locked. Your layout saves to your TURBZ account.</p>
              <div className="sheet-box grid gap-1" data-testid="designer-maps">
                <p className="font-display text-[9px] text-kyo">DESIGNER MAPS</p>
                {snap.map.startsWith("custom-") && (
                  <button className="px-btn px-btn-kyo" data-testid="leave-custom-map-btn" onClick={() => game?.leaveCustom()}>Return to the overworld</button>
                )}
                {(game?.customMaps() ?? []).map((m) => (
                  <button key={m.id} className={`px-btn text-left ${snap.map === `custom-${m.id}` ? "map-btn-active" : ""}`} data-testid={`enter-map-${m.id}`} aria-current={snap.map === `custom-${m.id}` ? "true" : undefined} disabled={snap.map === `custom-${m.id}`} onClick={() => game?.enterCustom(m.id)}>
                    {snap.map === `custom-${m.id}` ? <>▶ You are here: {m.name}</> : <>Enter {m.name}</>} <span className="text-dim">· {m.kind}</span>
                  </button>
                ))}
                {!(game?.customMaps().length) && <p className="text-dim">Build and save maps in Designer Mode, then enter them here.</p>}
              </div>
              <button className="px-btn" data-testid="unstuck-menu-btn" onClick={() => game?.beginUnstuck()}>
                {snap.unstuck ? `Unstuck ${snap.unstuck}` : "Unstuck · land on cursor in 3s"}
              </button>
              <button className="px-btn" data-testid="reset-layout-btn" onClick={() => resetLayout()}>
                Reset window layout
              </button>
              <AccountChip />
              <button className="px-btn" onClick={() => game?.toTitle()}>
                Return to title
              </button>
            </div>
          )}
          {panel === "trade" && (
            <BlackMarket snap={snap} game={game} />
          )}
    </>
  );
}

function Play({
  snap,
  game,
  chat,
  setChat,
}: {
  snap: ReturnType<typeof getSnap>;
  game: TurbzGame | null;
  chat: string;
  setChat: (v: string) => void;
}) {
  const last = snap.chat[snap.chat.length - 1];
  useLayout();
  const open = PANEL_IDS.filter((id) => id === snap.panel || isPinned(`panel-${id}`));
  return (
    <>
      <FloatWin id="vitals" title={`${snap.name} · ${snap.sheet?.className ?? ""}`} compact def={() => (narrow() ? { x: 8, y: 8, w: vw() - 16 } : { x: 8, y: 8, w: 320 })}>
        <div data-testid="vitals-dock" className="vitals">
          <Vitals snap={snap} />
          {snap.foe && <p className="vitals-line text-kyo" data-testid="vitals-foe">{snap.foe}</p>}
          {snap.turn && <p className="vitals-line text-dim">{snap.turn}</p>}
          {snap.autoplay && <p className="vitals-line text-kyo">Autoplay · {snap.grind || "looking"} · attacks on</p>}
          {snap.rules === "hardcore" && !snap.autoplay && <p className="vitals-line text-dim">Manual attacks · press Attack</p>}
          {snap.jarLeft > 0 && <p className="vitals-line text-kyo">Ghost jar · {snap.jarLeft}s</p>}
          {snap.log[0] && <p className="vitals-line vitals-log" data-testid="vitals-log">{snap.log[0]}</p>}
          {snap.shrine && <p className="vitals-line text-kyo">{snap.shrine}</p>}
          {snap.roomCode && <p className="vitals-line text-kyo" data-testid="vitals-lobby">Lobby {snap.roomCode} · {snap.lobby.members.length} in party</p>}
          {snap.bounty && <p className="vitals-line text-blood" data-testid="vitals-bounty">{snap.bounty}</p>}
          {snap.bountyPlace && <p className="vitals-line text-dim">{snap.bountyPlace}</p>}
          <HudActions snap={snap} game={game} />
          <form
            className="mt-1"
            onSubmit={(e) => {
              e.preventDefault();
              game?.sendChat(chat);
              setChat("");
            }}
          >
            <input
              value={chat}
              onChange={(e) => setChat(e.target.value)}
              placeholder={last ? `${last.name}: ${last.text}` : "Party chat"}
              aria-label="Party chat"
              data-testid="party-chat-input"
              autoComplete="off"
              suppressHydrationWarning
              className="hud-input"
            />
          </form>
        </div>
      </FloatWin>
      {snap.survival && (
        <FloatWin id="survival-hud" title="Survival" compact def={() => ({ x: 8, y: narrow() ? 160 : 260, w: 300 })}>
          <div className="survival-hud-body">
            <button className="px-btn" onClick={() => game?.toggle("survival")}>Survival & Camp</button>
            <p>Hunger {Math.ceil(snap.survival.hunger)} · Thirst {Math.ceil(snap.survival.thirst)} · Sleep {Math.ceil(snap.survival.rest)}</p>
            {Math.min(snap.survival.hunger, snap.survival.thirst, snap.survival.rest) < 15 && <p className="text-blood">Supplies low. Empty reserves cause lasting damage.</p>}
            {snap.sleeping && <button className="px-btn" onClick={() => game?.survivalAction("sleep")}>Sleeping · Wake up</button>}
          </div>
        </FloatWin>
      )}

      {snap.hint && !snap.menu && !snap.panel && <div className="hint-chip px-panel">{snap.hint}</div>}
      {snap.duel && <DuelBanner duel={snap.duel} />}
      {snap.menu && (
        <div
          className="ctx-menu px-panel"
          style={{
            left: typeof window === "undefined" ? snap.menu.sx : Math.max(8, Math.min(snap.menu.sx, window.innerWidth - 340)),
            top: typeof window === "undefined" ? snap.menu.sy : Math.max(8, Math.min(snap.menu.sy, window.innerHeight - 240)),
          }}
        >
          <p className="font-display text-xs text-kyo">{snap.menu.title}</p>
          {snap.menu.lines.map((line) => (
            <p key={line} className="text-dim">
              {line}
            </p>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-1">
            {snap.menu.actions.map((action) => (
              <button key={action.id} className="px-btn" onClick={() => game?.menuAct(action.id)}>
                {action.label}
              </button>
            ))}
            <button className="px-btn" onClick={() => game?.clearMenu()}>
              Close
            </button>
          </div>
        </div>
      )}
      <FloatWin id="movebar" title="Verses · 1-9 or numpad · 0 attacks" compact def={() => { const w = Math.min(vw() - 16, snap.bar.length * 92 + 140); return { x: Math.max(8, Math.round((vw() - w) / 2)), y: vh() - (narrow() ? 220 : 148), w }; }}>
        <VerseBar snap={snap} game={game} />
      </FloatWin>
      <button
        className={`unstuck-fab px-btn ${snap.unstuck ? "px-btn-kyo" : ""}`}
        type="button"
        data-testid="unstuck-btn"
        onClick={() => game?.beginUnstuck()}
      >
        {snap.unstuck ? `Unstuck ${snap.unstuck}` : "Unstuck"}
      </button>
      <button
        className={`auto-fab px-btn ${snap.autoplay ? "px-btn-kyo" : ""}`}
        type="button"
        onClick={() => game?.toggleAutoplay()}
      >
        {snap.autoplay ? (snap.rules === "hardcore" ? "Stop grind" : "Stop auto") : snap.rules === "hardcore" ? "Grind nodes" : "Autoplay"}
      </button>
      <button className="menu-fab px-btn" type="button" onClick={() => game?.openShell(Math.max(8, window.innerWidth - 340), Math.max(8, window.innerHeight - 460))}>
        Menu
      </button>
      <Stick on={(x, y) => game?.setStick(x, y)} />
      {open.map((panel) => (
        <FloatWin key={panel} id={`panel-${panel}`} title={PANEL_TITLE[panel]} def={panelDef(panel)} onClose={() => { if (snap.panel === panel) game?.closePanel(); }}>
          <PanelBody panel={panel} snap={snap} game={game} />
        </FloatWin>
      ))}
      {snap.panel === "talk" && snap.talk && (
        <FloatWin id="talk" title={`${snap.talk.name} · ${snap.talk.role}`} onClose={() => game?.closePanel()} def={() => (narrow() ? { x: 8, y: 124, w: vw() - 16 } : { x: 8, y: Math.max(8, vh() - 420), w: 420 })}>
          <div>
            <p className="font-display text-xs text-kyo">
              {snap.talk.name} · {snap.talk.role}
            </p>
            <p className="mt-2">{snap.talk.line}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="px-btn" onClick={() => game?.nextLine()}>
                More
              </button>
              {snap.talk.shrine && (
                <button className="px-btn px-btn-kyo" onClick={() => game?.startShrine(snap.talk!.shrine!)}>
                  Enter shrine
                </button>
              )}
              {snap.talk.id === "orien" && (
                <button className="px-btn" onClick={() => game?.teach()}>
                  Learn verse · 35
                </button>
              )}
              {snap.talk.id === "holt" && (
                <button className="px-btn" onClick={() => game?.turnSalt()}>
                  Turn in salt
                </button>
              )}
              <button className="px-btn" onClick={() => game?.closePanel()}>
                Leave
              </button>
            </div>
            {snap.talk.shop === "general" && (
              <div className="mt-3 grid gap-1">
                {snap.wares.map((ware) => (
                  <button key={ware.id} className="px-btn" onClick={() => game?.buyItem(ware.id)}>
                    {ware.name} · {ware.price} kyo
                  </button>
                ))}
              </div>
            )}
            {(snap.talk.shop === "armor" || snap.talk.shop === "fence") && (
              <div className="mt-3 grid gap-1">
                {snap.stock.map((item) => (
                  <button key={item.uid} className="px-btn" onClick={() => game?.buyGear(item.uid)}>
                    {item.name} · {item.price}
                  </button>
                ))}
                {snap.talk.shop === "fence" && (
                  <button className="px-btn" onClick={() => snap.selected && game?.sell(snap.selected)}>
                    Sell selected gear
                  </button>
                )}
              </div>
            )}
            {snap.talk.shop === "alchemy" && (
              <div className="mt-3 grid gap-1">
                <p className="text-dim">Lise sells the idea. You do the mixing in Crafting.</p>
                <button className="px-btn px-btn-kyo" onClick={() => game?.toggle("craft")}>
                  Open crafting
                </button>
              </div>
            )}
            {snap.talk.id === "bram" && (
              <button className="px-btn mt-2" onClick={() => game?.brew("meal")}>
                Cook a fish
              </button>
            )}
          </div>
        </FloatWin>
      )}
      {snap.panel === "rebirth" && <Rebirth snap={snap} game={game} />}
    </>
  );
}

function Rebirth({ snap, game }: { snap: ReturnType<typeof getSnap>; game: TurbzGame | null }) {
  const [name, setName] = useState("Mira");
  const [pick, setPick] = useState<Pick>({ classId: "warden", traitId: null, female: true });
  const race = CLASS_RACE[pick.classId];
  const [setId, setSetId] = useState<string | null>(null);
  const owned = snap.unlocked.filter((s) => s.race === race);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-auto bg-ink/85 p-3">
      <div className="px-panel max-h-[92dvh] w-full max-w-4xl overflow-auto p-4" data-testid="rebirth-screen">
        <p className="font-display text-xs text-blood">THE VEIL</p>
        <h2 className="font-display mt-2 text-sm">Choose the next witch</h2>
        <p className="text-dim">This body is gone. Account Score, skills, perks, and finished sets stay. You wake in another tavern.</p>
        <label className="mt-3 block text-dim">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            className="mt-1 w-full border-2 border-bone bg-ink px-3 py-2 text-bone outline-none"
          />
        </label>
        <div className="mt-3">
          <ClassPicker pick={pick} setPick={(p) => { setPick(p); if (p.classId !== pick.classId) setSetId(null); }} game={game} />
        </div>
        <p className="mt-3 font-display text-xs text-kyo">Spawn clothes</p>
        <div className="mt-2 grid gap-2">
          <button className={`px-btn ${setId === null ? "border-kyo" : ""}`} onClick={() => setSetId(null)}>
            Default witch robes
          </button>
          {owned.length === 0 && <p className="text-dim">No finished {RACES.find((r) => r.id === race)?.name} set yet. Find every piece once.</p>}
          {owned.map((s) => (
            <button key={s.id} className={`px-btn text-left ${setId === s.id ? "border-kyo" : ""}`} onClick={() => setSetId(s.id)}>
              {s.name}
              <span className="mt-1 block text-dim">{s.bonus}</span>
            </button>
          ))}
        </div>
        <button className="px-btn px-btn-kyo mt-4" data-testid="rebirth-go-btn" onClick={() => game?.rebirth(name, race, setId, pick.classId, pick.traitId, classGendered(pick.classId) ? pick.female : true)}>
          Wake at a new tavern
        </button>
      </div>
    </div>
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

function Bag({ snap, game }: { snap: ReturnType<typeof getSnap>; game: TurbzGame | null }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const term = search.trim().toLowerCase();
  const items = snap.bag.filter(item => item.name.toLowerCase().includes(term));
  const gear = snap.gear.filter(piece => `${piece.name} ${piece.slot} ${piece.quality}`.toLowerCase().includes(term)).slice().sort((a, b) => Number(snap.equipped.includes(b.uid)) - Number(snap.equipped.includes(a.uid)) || a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
  const count = (id: string) => snap.bag.find(item => item.id === id)?.count ?? 0;
  return (
    <div className="grid gap-4">
      <div className="inventory-tools">
        <input className="px-input" aria-label="Search inventory" placeholder="Search items, gear or slot" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="px-input" aria-label="Inventory category" value={category} onChange={e => setCategory(e.target.value)}><option value="all">Everything</option><option value="items">Items</option><option value="gear">Gear</option></select>
        {search && <button className="px-btn" onClick={() => setSearch("")}>Clear search</button>}
      </div>
      <div>
        <p className="font-display text-xs">Worn · {snap.setLabel}</p>
        <p className="text-dim">{snap.setBonus}</p>
        <ul className="mt-2">
          {snap.totals.map((row) => (
            <li key={row.id}>
              {row.name} {row.power}
            </li>
          ))}
          {snap.totals.length === 0 && <li className="text-dim">No enchantments on what you are wearing.</li>}
        </ul>
        {category !== "gear" && <div className="mt-3 grid gap-1">
          <p className="text-kyo">Items · {items.length} stacks</p>
          {!items.length && <p className="text-dim">{term ? "No matching items." : "Your bag is empty."}</p>}
          {items.map((item) => (
            <button key={item.id} className="px-btn text-left" disabled={!!item.useProblem} title={item.useProblem ?? item.about} onClick={() => game?.useBag(item.id)}>
              {item.name} x{item.count}
              <span className="mt-1 block text-dim">{item.about}</span>
              {item.useProblem && <span className="block text-dim">{item.useProblem}</span>}
            </button>
          ))}
        </div>}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button className="px-btn px-btn-kyo" onClick={() => game?.toggle("craft")}>
            Crafting · potions
          </button>
          <button className="px-btn" disabled={count("leather") < 10 || count("mushroom") < 10} onClick={() => game?.craftGear()}>
            Stitch gear · Leather {count("leather")}/10 · Mushroom {count("mushroom")}/10
          </button>
          <button className="px-btn" onClick={() => game?.sellMats()}>
            {snap.rules === "hardcore" ? "Sell hides & ore · Keep survival supplies" : "Sell gathered materials"}
          </button>
        </div>
      </div>
      {category !== "items" && <div className="grid gap-1">
        <p className="text-kyo">Gear · Worn first</p>
        {!gear.length && <p className="text-dim">No matching gear.</p>}
        {gear.map((piece) => (
          <button
            key={piece.uid}
            className={`px-btn text-left ${snap.selected === piece.uid ? "border-kyo" : ""}`}
            onClick={() => game?.select(piece.uid)}
          >
            {piece.name}
            <span className="mt-1 block text-dim">
              {`Lv ${piece.level} · ${piece.slot} · ${piece.quality} · ${equipmentStats(piece).damage ? `Damage ${equipmentStats(piece).damage}` : `Armor ${equipmentStats(piece).armor}`} · ${(piece.enchants ?? []).length} enchant${(piece.enchants ?? []).length === 1 ? "" : "s"}${snap.equipped.includes(piece.uid) ? " · worn" : ""}`}
            </span>
            {snap.selected === piece.uid && (piece.enchants ?? []).length > 0 && (
              <span className="mt-1 block text-dim">
                {(piece.enchants ?? []).map((e) => (
                  <span key={`${piece.uid}-${e.id}`} className="mt-1 block">
                    {ENCHANT_BY_ID[e.id]?.name ?? e.id} {e.power} · {enchantText(e)}
                  </span>
                ))}
              </span>
            )}
          </button>
        ))}
        {snap.selected && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="px-btn px-btn-kyo" onClick={() => game?.equip(snap.selected!)}>
              Wear
            </button>
            <button className="px-btn" disabled={snap.equipped.includes(snap.selected)} onClick={() => game?.sell(snap.selected!)}>
              {snap.equipped.includes(snap.selected) ? "Worn · Equip a replacement to sell" : "Sell"}
            </button>
            <button className="px-btn col-span-2" onClick={() => game?.disenchant()}>
              Strip an enchant · 80 kyo
            </button>

          </div>
        )}
        {snap.stash.length > 0 && (
          <div className="mt-2 grid gap-1">
            {snap.stash.map((line, i) => (
              <button key={`${line}-${i}`} className="px-btn" onClick={() => game?.applyStash(i)}>
                Apply {line}
              </button>
            ))}
          </div>
        )}
      </div>}
    </div>
  );
}


function BlackMarket({ snap, game }: { snap: ReturnType<typeof getSnap>; game: TurbzGame | null }) {
  const [cat, setCat] = useState<"items" | "gear" | "enchants" | "spirits">("gear");
  const [stock, setStock] = useState<{ items: unknown[]; gear: unknown[]; enchants: unknown[]; spirits: unknown[]; refreshIn: number } | null>(null);
  useEffect(() => {
    const pull = () => {
      const g = game as { blackMarketSnap?: () => typeof stock; openBlackMarket?: () => void; ensureBlackMarket?: (f?: boolean) => void } | null;
      g?.ensureBlackMarket?.(false);
      const next = g?.blackMarketSnap?.() ?? (snap as { blackMarket?: typeof stock }).blackMarket ?? null;
      setStock(next);
    };
    pull();
    const id = window.setInterval(pull, 1000);
    return () => window.clearInterval(id);
  }, [game, snap]);
  const secs = stock?.refreshIn ?? 0;
  const mm = Math.floor(secs / 60);
  const ss = Math.floor(secs % 60);
  return (
    <div className="grid gap-2">
      <p className="font-display text-xs text-blood">BLACK MARKET</p>
      <p className="text-dim">Shadow stock refreshes every 5 minutes. Gear and items sit 5–50 levels above you — made for Kyo grinders.</p>
      <p className="text-kyo">Next refresh · {mm}:{ss.toString().padStart(2, "0")}</p>
      <div className="grid grid-cols-4 gap-1">
        {(["items", "gear", "enchants", "spirits"] as const).map((c) => (
          <button key={c} type="button" className={`px-btn !min-h-9 !py-1 capitalize ${cat === c ? "px-btn-kyo" : ""}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      {cat === "gear" && (
        <div className="grid gap-1">
          {(stock?.gear as { uid: string; name: string; level: number; quality: string; price: number; type?: string }[] | undefined)?.map((g) => (
            <div key={g.uid} className="flex flex-wrap items-center justify-between gap-2 border-2 border-bone px-2 py-1">
              <span>
                {g.name} <span className="text-dim">lv {g.level} · {g.quality}</span>
              </span>
              <button type="button" className="px-btn !min-h-9 !py-1" onClick={() => game?.buyGear?.(g.uid)}>
                {g.price} kyo
              </button>
            </div>
          )) || <p className="text-dim">No gear this cycle. Wait for refresh.</p>}
        </div>
      )}
      {cat === "items" && (
        <div className="grid gap-1">
          {(stock?.items as { id: string; name: string; price: number; count?: number }[] | undefined)?.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-bone px-2 py-1">
              <span>{it.name}{it.count ? ` ×${it.count}` : ""}</span>
              <button type="button" className="px-btn !min-h-9 !py-1" onClick={() => game?.buyItem?.(it.id)}>
                {it.price} kyo
              </button>
            </div>
          )) || <p className="text-dim">No items this cycle.</p>}
        </div>
      )}
      {cat === "enchants" && (
        <div className="grid gap-1">
          {(stock?.enchants as { id: string; name: string; price: number; about?: string }[] | undefined)?.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-bone px-2 py-1">
              <span>
                {e.name}
                {e.about ? <span className="block text-dim">{e.about}</span> : null}
              </span>
              <button type="button" className="px-btn !min-h-9 !py-1" onClick={() => game?.buyEnchant?.(e.id)}>
                {e.price} kyo
              </button>
            </div>
          )) || <p className="text-dim">No enchants this cycle.</p>}
        </div>
      )}
      {cat === "spirits" && (
        <div className="grid gap-1">
          {(stock?.spirits as { id: string; name: string; price: number; level?: number }[] | undefined)?.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-bone px-2 py-1">
              <span>
                {s.name}
                {s.level != null ? <span className="text-dim"> · lv {s.level}</span> : null}
              </span>
              <button type="button" className="px-btn !min-h-9 !py-1" onClick={() => game?.buySpirit?.(s.id)}>
                {s.price} kyo
              </button>
            </div>
          )) || <p className="text-dim">No spirits this cycle.</p>}
        </div>
      )}
      {snap.trade && (
        <div className="mt-3 border-t-2 border-bone pt-2 grid gap-2">
          <p className="text-dim">Player trade still available if someone is nearby.</p>
          <p>With {snap.trade.peer}</p>
          <p>You offer: {snap.trade.mine}</p>
          <p>They offer: {snap.trade.theirs}</p>
          <button className="px-btn" onClick={() => game?.offerSelected()}>Offer selected gear</button>
          <button className="px-btn" onClick={() => game?.lockTrade()}>
            {snap.trade.me ? "Unlock" : "Lock in"}
            {snap.trade.them ? " · they are ready" : ""}
          </button>
        </div>
      )}
    </div>
  );
}

function Skills({ snap, game }: { snap: ReturnType<typeof getSnap>; game: TurbzGame | null }) {
  const [tab, setTab] = useState<"perks" | "skills">("perks");
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-1">
        <button type="button" className={`px-btn ${tab === "perks" ? "px-btn-kyo" : ""}`} onClick={() => setTab("perks")}>
          Account Perks
        </button>
        <button type="button" className={`px-btn ${tab === "skills" ? "px-btn-kyo" : ""}`} onClick={() => setTab("skills")}>
          Skills
        </button>
      </div>
      {tab === "perks" && (
        <>
          <p>
            Account {snap.accountLevel} · {snap.accountXp}/{snap.accountNeed} · {snap.perkPoints} perk points
          </p>
          <p className="text-kyo">Account Score {snap.accountScore}. Kept forever when a witch dies.</p>
          <div className="bar-track">
            <div className="h-full bg-kyo" style={{ width: `${Math.min(100, (snap.accountXp / Math.max(1, snap.accountNeed)) * 100)}%` }} />
          </div>
          <p className="text-dim">Unlock and level permanent account bonuses. They stay on every witch — death, new body, and Hardcore all keep them.</p>
          <div className="grid gap-1">
            {snap.perks.map((perk) => (
              <button key={perk.id} className="px-btn text-left" disabled={snap.perkPoints < 1 || perk.power >= perk.max} onClick={() => game?.spendPerk(perk.id)}>
                {perk.name} {perk.power}/{perk.max}
                <span className="mt-1 block text-dim">{perk.about}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {tab === "skills" && (
        <>
          <p className="text-dim">Skills cap at 400 and stay on the account. A death does not reset them, so you can keep grinding.</p>
          <p className="text-kyo">{snap.skillPoints} character skill points. Spend them in Verses to unlock or upgrade spells.</p>
          <div className="grid gap-1">
            {snap.skills.map((sk) => (
              <p key={sk.id}>
                <span className="text-kyo">
                  {sk.name} {sk.level}/400
                </span>
                <span className="text-dim">
                  {" "}
                  · {sk.xp}/{sk.need} · {sk.line}
                </span>
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Moves({ snap, game }: { snap: ReturnType<typeof getSnap>; game: TurbzGame | null }) {
  const [tab, setTab] = useState<"equip" | "catalog">("equip");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"name" | "type" | "power" | "rank">("type");
  const [expanded, setExpanded] = useState<string | null>(null);
  const equipped = new Set(snap.bar.map((m) => m.id));
  const unlocked = snap.abilities.filter((m) => m.rank > 0);
  const catalog = [...snap.abilities]
    .filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()) || m.type.includes(filter.toLowerCase()) || m.effect.includes(filter.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "type") return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      if (sort === "power") return b.power - a.power;
      return (b.rank || 0) - (a.rank || 0) || a.name.localeCompare(b.name);
    });
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-1">
        <button type="button" className={`px-btn ${tab === "equip" ? "px-btn-kyo" : ""}`} onClick={() => setTab("equip")}>
          Equip · {snap.bar.length}/9
        </button>
        <button type="button" className={`px-btn ${tab === "catalog" ? "px-btn-kyo" : ""}`} onClick={() => setTab("catalog")}>
          Unlock & Upgrade
        </button>
      </div>
      {tab === "equip" && (
        <>
          <p className="text-dim">You can hold 9 verses at once. Equip unlocked spells here; unequip to free a slot.</p>
          <div className="grid gap-1">
            {snap.bar.map((m, i) => (
              <div key={`${m.id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 border-2 border-bone px-2 py-1">
                <span className={typeClass(m.type)}>{i + 1}. {m.name}</span>
                <button type="button" className="px-btn !min-h-9 !py-1" onClick={() => game?.setBar(i, "")}>
                  Unequip
                </button>
              </div>
            ))}
            {snap.bar.length === 0 && <p className="text-dim">No verses equipped. Open Unlock & Upgrade, then equip from your unlocked list.</p>}
          </div>
          <p className="font-display text-[9px] text-kyo">UNLOCKED · TAP TO EQUIP</p>
          <div className="grid gap-1">
            {unlocked.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`px-btn text-left ${equipped.has(m.id) ? "opacity-50" : ""}`}
                disabled={equipped.has(m.id) || snap.bar.length >= 9}
                onClick={() => game?.setBar(snap.bar.length, m.id)}
              >
                <span className={typeClass(m.type)}>{m.name}</span>
                <span className="text-dim"> · Rank {m.rank}/5 · {m.effect}</span>
              </button>
            ))}
            {unlocked.length === 0 && <p className="text-dim">Unlock verses in the catalog first.</p>}
          </div>
        </>
      )}
      {tab === "catalog" && (
        <>
          <p className="text-kyo">{snap.skillPoints} skill points · +3 each character level</p>
          <p className="text-dim">Unlock or upgrade for 1 point, up to rank 5. Each upgrade adds 15% damage, healing or shield strength.</p>
          <input className="px-input" aria-label="Search abilities" placeholder="Search by name, type, or effect" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="flex flex-wrap gap-1">
            {(["type", "name", "power", "rank"] as const).map((s) => (
              <button key={s} type="button" className={`px-btn !min-h-9 !py-1 ${sort === s ? "px-btn-kyo" : ""}`} onClick={() => setSort(s)}>
                {s}
              </button>
            ))}
          </div>
          {catalog.map((move) => (
            <div className="px-panel verse-card p-3" key={move.id}>
              <button
                className={`verse-name ${typeClass(move.type)}`}
                aria-expanded={expanded === move.id}
                aria-describedby={`verse-${move.id}`}
                onClick={() => setExpanded(expanded === move.id ? null : move.id)}
              >
                {move.name} · {move.rank ? `Rank ${move.rank}/5` : "Locked"}
              </button>
              <div id={`verse-${move.id}`} className={`verse-description ${expanded === move.id ? "verse-open" : ""}`}>
                <p>{move.about}</p>
                <p className="text-dim">
                  Power {move.power} · Accuracy {move.accuracy}% · Critical {move.crit}% · Range {move.range} · Effect {move.effect} · {move.type}
                </p>
              </div>
              <button className="px-btn mt-2" disabled={snap.skillPoints < 1 || move.rank >= 5} onClick={() => game?.spendAbility(move.id)}>
                {move.rank >= 5 ? "Max rank" : move.rank ? "Upgrade · 1 point" : "Unlock · 1 point"}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Survival({ snap, game }: { snap: ReturnType<typeof getSnap>; game: TurbzGame | null }) {
  if (!snap.survival) return null;
  const bag = Object.fromEntries(snap.bag.map(item => [item.id, item.count]));
  const count = (id: string) => bag[id] ?? 0;
  const food = bestFood(bag, snap.survival.hunger);
  return <div className="grid gap-3">
    <p className="text-kyo">Frontier Survival</p>
    <p>Logs {count('timber')} · Raw meat {count('meat')} · Fish {count('fish')} · Raw water {count('raw_water')}</p>
    <div className="grid grid-cols-2 gap-2"><button className="px-btn" disabled={!food} onClick={() => game?.eatFood()}>{food ? `Eat ${snap.bag.find(item => item.id === food)?.name}` : 'No meal needed / stocked'}</button><button className="px-btn" disabled={!count('drinking_water') || snap.survival.thirst >= 100} onClick={() => game?.useBag('drinking_water')}>Drink purified water · {count('drinking_water')}</button></div>
    {[['Hunger', snap.survival.hunger], ['Thirst', snap.survival.thirst], ['Sleep', snap.survival.rest]].map(([name, value]) => <label key={name}>{name} · {Math.ceil(Number(value))}/100<progress className="survival-meter" max={100} value={value} /></label>)}
    <p className="text-dim">Full reserves last 30 minutes of food, 20 of water, and 40 of sleep during active play. Empty reserves damage you; low sleep slows movement. Pause and hidden tabs stop the clock.</p>
    <p>Injuries persist until a healing spell is used. Meals, sleep, potions, level-ups and hearths do not heal.</p>
    <button className="px-btn" disabled={!snap.nearTree} onClick={() => game?.survivalAction('chop')}>Chop nearby tree → Logs</button>
    <button className="px-btn" disabled={!snap.nearWater} onClick={() => game?.survivalAction('water')}>Harvest water · Stand by a water tile</button>
    <button className="px-btn" disabled={!snap.nearWater} onClick={() => game?.startFishing()}>Fish · Stand by any water tile</button>
    <button className="px-btn" disabled={snap.nearCamp || count('timber') < 3} onClick={() => game?.survivalAction('fire')}>Build campfire · 3 logs</button>
    <p className="text-kyo">{snap.nearCamp ? 'Campfire within reach' : 'Stand beside a campfire to cook, purify, or sleep'}</p>
    <p className="text-kyo">Campfire Crafting</p>
    {CAMP_RECIPE_LIST.map(r => {
      const have = Object.entries(r.costs).every(([id, n]) => count(id) >= n);
      const name = (id: string) => ITEM_BY_ID[id]?.name ?? id;
      const costs = Object.entries(r.costs).map(([id, n]) => `${n} ${name(id)} (${count(id)})`).join(' + ');
      const outputs = Object.entries(r.outputs).map(([id, n]) => `${name(id)} x${n}`).join(', ');
      return <button key={r.id} className="px-btn" title={r.about} disabled={!snap.nearCamp || !have} onClick={() => game?.survivalAction(r.id)}>{r.name} · {costs} → {outputs}</button>;
    })}
    <button className="px-btn" disabled={!snap.nearCamp} onClick={() => game?.survivalAction('sleep')}>{snap.sleeping ? 'Wake up' : 'Sleep · About 13 seconds for a full rest'}</button>
    <p className="text-dim">Use meals and drinking water from Bag. Holt sells rations and cooked meat. Hunt animals for raw meat. Look for LOGS markers, including the grove beside the hearth.</p>
    <button className="px-btn" onClick={() => game?.toggle('bag')}>Open Bag · Eat / Drink</button>
  </div>;
}

function Craft({ snap, game }: { snap: ReturnType<typeof getSnap>; game: TurbzGame | null }) {
  const count = (id: string) => snap.bag.find((item) => item.id === id)?.count ?? 0;
  return (
    <div className="grid gap-2" data-testid="craft-panel">
      <p className="text-kyo">Alchemy</p>
      <p className="text-dim">Combine what you gathered. Fishing meals still cook at a campfire. Potions are mixed here.</p>
      {ALCHEMY_RECIPES.map((recipe) => {
        const have = Object.entries(recipe.costs).every(([id, n]) => count(id) >= n);
        const costs = Object.entries(recipe.costs).map(([id, n]) => `${ITEM_BY_ID[id]?.name ?? id} ${count(id)}/${n}`).join(" + ");
        const out = ITEM_BY_ID[recipe.output]?.name ?? recipe.name;
        return (
          <button key={recipe.id} className="px-btn text-left" disabled={!have} title={recipe.about} onClick={() => game?.brew(recipe.id)}>
            {recipe.name}
            <span className="mt-1 block text-dim">{costs} → {out}{recipe.n > 1 ? ` x${recipe.n}` : ""}</span>
            <span className="block text-dim">{recipe.about}</span>
          </button>
        );
      })}
    </div>
  );
}

function Ghost({ snap, game }: { snap: ReturnType<typeof getSnap>; game: TurbzGame | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const following = snap.spirits.filter((s) => s.active).length;
  return (
    <div className="grid gap-2" data-testid="spirit-panel">
      <p className="text-kyo">Following {following}/{snap.spiritSlots} · Party {snap.spirits.length}/{snap.spiritCap}</p>
      <p className="text-dim">A fallen foe may stay as a spirit and join on its own. A ghost jar raises that chance for one minute. Three can follow until you spend a skill point on another slot. Each spirit knows up to 10 moves and readies 3.</p>
      {snap.jarLeft > 0 && <p className="text-kyo">Jar humming · {snap.jarLeft}s left</p>}
      <button className="px-btn" disabled={snap.skillPoints < 1 || snap.spiritSlots >= 10} onClick={() => game?.spendGhostSlot()}>
        {snap.spiritSlots >= 10 ? "Ghost slots maxed (10)" : `Buy a ghost slot · 1 skill point (${snap.skillPoints} left)`}
      </button>
      {!snap.spirits.length && <p className="text-dim">No spirits yet. Defeat enemies. Use a ghost jar from your bag before the kill if you want better odds.</p>}
      {snap.spirits.map((s) => (
        <div key={s.uid} className="sheet-box grid gap-1" data-testid={`spirit-${s.uid}`}>
          <button className="px-btn text-left" onClick={() => setOpen(open === s.uid ? null : s.uid)}>
            <span className={typeClass(s.type)}>{s.name}</span>
            <span className="text-dim"> · Lv {s.level} · {s.hp}/{s.max}</span>
            <span className="mt-1 block text-dim">{s.active ? "Following" : "Benched"} · {s.known.filter((m) => m.slotted).length}/3 readied · {s.known.length} known</span>
          </button>
          {open === s.uid && (
            <>
              <p className="text-dim">Click a move to ready or unready it. Gold border means it is slotted.</p>
              {s.known.map((m) => (
                <button key={m.id} className={`px-btn text-left ${m.slotted ? "border-kyo" : ""}`} onClick={() => game?.toggleSpiritMove(s.uid, m.id)}>
                  <span className={typeClass(m.type)}>{m.slotted ? "Readied · " : ""}{m.name}</span>
                  <span className="mt-1 block text-dim">{m.player ? "Aids you" : "Strikes foes"} · {m.about}</span>
                </button>
              ))}
              <div className="grid grid-cols-2 gap-1">
                <button className="px-btn px-btn-kyo" onClick={() => game?.setSpiritActive(s.uid, !s.active)}>{s.active ? "Call back" : "Send out"}</button>
                <button className="px-btn" onClick={() => game?.dismissSpirit(s.uid)}>Dismiss</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Mini({ snap, game }: { snap: ReturnType<typeof getSnap>; game: TurbzGame | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !game) return;
    game.drawMap(canvas);
  }, [game, snap.mapX, snap.mapY, snap.map, JSON.stringify(snap.dungeonPortals), JSON.stringify(snap.survival?.campfires)]);
  return <div className="grid gap-3"><p className="text-kyo">Next dungeon in {Math.floor(snap.dungeonCountdown / 60)}:{String(snap.dungeonCountdown % 60).padStart(2, "0")} of active play.</p><canvas ref={ref} className="map-canvas" aria-label="World map" />{snap.dungeonPortals.filter(p => !p.cleared).map(p => <button className="px-btn" key={p.id} disabled={snap.map !== "world"} onClick={() => game?.trackRift(p.id)}>Track / enter Dungeon {p.id.slice(5)}</button>)}</div>;
}
