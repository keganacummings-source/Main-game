/**
 * Find anything (Ctrl+K / Cmd+K).
 *
 * Every big menu already has its own search box — the bag, the verses, the spirits, the skills and
 * perks all do. That is the problem this solves: to find something you first had to know which of
 * five menus it lived in, open that one, and search there.
 *
 * This searches all of them at once and takes you to the thing. It only ever navigates — it opens
 * the menu that holds what you picked and gets out of the way. Nothing here spends a point, sells a
 * piece or equips anything, because a fuzzy search box is the last place that should be able to.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useSnapPick, useSnapValue } from "./use-snap";
import type { TurbzGame } from "@/game/engine";

type GameProp = { game: TurbzGame | null };

type Hit = {
  key: string;
  /** Which menu it lives in, shown as the group heading. */
  group: string;
  label: string;
  note?: string;
  /** The menu action that opens where this lives. */
  act: string;
};

/** The menus themselves, so the palette is also a way to reach any of them by name. */
const MENUS: { act: string; label: string; note: string }[] = [
  { act: "menu:bag", label: "Bag", note: "Items, potions and the Space bar queue" },
  { act: "menu:gear", label: "Gear inventory", note: "Everything you own, compared and sorted" },
  { act: "menu:moves", label: "Verses", note: "Your bar, the library and skill points" },
  { act: "menu:skills", label: "Skills & perks", note: "Account perks and every skill" },
  { act: "menu:ghost", label: "Spirits", note: "Party, Ghost Box and bonuses" },
  { act: "menu:quests", label: "Quests", note: "The board and what is open" },
  { act: "menu:map", label: "Map", note: "The world, your pins and where you are" },
  { act: "menu:craft", label: "Crafting", note: "Potions and brewing" },
  { act: "menu:bounty", label: "Bounty", note: "The board, your tier and the price on you" },
  { act: "menu:trade", label: "Trade", note: "Buy and sell" },
  { act: "menu:auto", label: "Autoplay", note: "Switch it on, or set the task order" },
  { act: "menu:survival", label: "Survival & camp", note: "Hardcore only" },
  { act: "menu:pause", label: "Pause menu", note: "Settings and quitting" },
];

const MAX_PER_GROUP = 6;
const MAX_HITS = 24;

/** Does every word of the query appear somewhere in the haystack? */
function matches(words: string[], ...parts: (string | undefined)[]): boolean {
  if (!words.length) return false;
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/**
 * The shell: the keybind and nothing else.
 *
 * It is mounted the whole time the game is, so it deliberately watches only `mode`. The search
 * itself reads the bag, the gear and every verse, and those are big arrays — subscribing to them
 * from a component that is on screen for a few seconds at a time would mean re-rendering against
 * all of them for the entire session.
 */
export const FindPalette = memo(function FindPalette({ game }: GameProp) {
  const mode = useSnapValue("mode");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((was) => !was);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open || mode !== "play") return null;
  return <FindResults game={game} close={() => setOpen(false)} />;
});

const FindResults = memo(function FindResults({ game, close }: GameProp & { close: () => void }) {
  const s = useSnapPick(["bag", "gear", "abilities", "skills", "perks", "spirits"] as const);
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => { input.current?.focus(); }, []);

  const hits = useMemo<Hit[]>(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return MENUS.slice(0, 8).map((m) => ({ key: m.act, group: "Menus", label: m.label, note: m.note, act: m.act }));
    const out: Hit[] = [];
    const take = (group: string, rows: Hit[]) => { out.push(...rows.slice(0, MAX_PER_GROUP)); void group; };

    take("Menus", MENUS.filter((m) => matches(words, m.label, m.note)).map((m) => ({ key: m.act, group: "Menus", label: m.label, note: m.note, act: m.act })));
    take("Bag", s.bag.filter((it) => matches(words, it.name, it.about)).map((it) => ({ key: `bag:${it.id}`, group: "Bag", label: `${it.name} ×${it.count}`, note: it.about, act: "menu:bag" })));
    take("Gear", s.gear.filter((g) => matches(words, g.name, g.slot, g.quality, g.type)).map((g) => ({ key: `gear:${g.uid}`, group: "Gear", label: g.name, note: `Lv ${g.level} · ${g.slot} · ${g.quality}`, act: "menu:gear" })));
    take("Verses", s.abilities.filter((m) => matches(words, m.name, m.type, m.effect)).map((m) => ({ key: `verse:${m.id}`, group: "Verses", label: m.name, note: `${m.type}${m.rank > 0 ? ` · rank ${m.rank}` : " · not learned"}`, act: "menu:moves" })));
    take("Skills", s.skills.filter((sk) => matches(words, sk.name, sk.line)).map((sk) => ({ key: `skill:${sk.id}`, group: "Skills", label: `${sk.name} ${sk.level}`, note: sk.line, act: "menu:skills" })));
    take("Perks", s.perks.filter((p) => matches(words, p.name, p.about)).map((p) => ({ key: `perk:${p.id}`, group: "Perks", label: p.name, note: `${p.power}/${p.max}`, act: "menu:skills" })));
    take("Spirits", s.spirits.filter((g) => matches(words, g.name, String(g.type))).map((g) => ({ key: `sp:${g.uid}`, group: "Spirits", label: g.name, note: `Lv ${g.level}`, act: "menu:ghost" })));
    return out.slice(0, MAX_HITS);
  }, [q, s.bag, s.gear, s.abilities, s.skills, s.perks, s.spirits]);

  useEffect(() => { setAt(0); }, [q]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    close();
    game?.menuAct(h.act);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAt((n) => Math.min(hits.length - 1, n + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((n) => Math.max(0, n - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(hits[at]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };

  let lastGroup = "";
  return (
    <div className="find-wrap" role="dialog" aria-label="Find anything" data-testid="find-palette" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="find-box px-panel">
        <input
          ref={input}
          className="px-input find-input"
          placeholder="Find an item, a verse, a skill, a menu…"
          aria-label="Find anything"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          data-testid="find-input"
        />
        <div className="find-hits" role="listbox" aria-label="Results">
          {hits.map((h, i) => {
            const head = h.group !== lastGroup ? h.group : null;
            lastGroup = h.group;
            return (
              <div key={h.key}>
                {head && <p className="find-group">{head}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === at}
                  className={`find-hit ${i === at ? "find-hit-on" : ""}`}
                  onPointerEnter={() => setAt(i)}
                  onClick={() => go(h)}
                >
                  <span className="find-hit-label">{h.label}</span>
                  {h.note && <span className="find-hit-note">{h.note}</span>}
                </button>
              </div>
            );
          })}
          {!hits.length && <p className="find-group">Nothing matches “{q}”.</p>}
        </div>
        <p className="find-foot">↑↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  );
});
