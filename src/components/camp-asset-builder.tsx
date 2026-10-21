import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CAMP_CATEGORIES, TILE_CATEGORIES, POWER_TEXTURES, SPAWN_LOCATIONS, WALK_EFFECTS,
  loadPack, savePack, groupOf, parsePack, mergePack, packBytes, customPowerSlots, powerDefaultArt, powerTexture, POWER_PACK_URL,
  type Asset, type AssetGroup, type AssetSize,
} from "@/game/camp-assets";
import { NEWTEX_DIR, loadTileCatalog } from "@/game/tile-atlas";
import { isBlank } from "@/game/pixel-edit";
import { Section, Tabs, Empty, ConfirmButton } from "./ui-kit";
import { PixelStudio, decodeToPix, pixToDataUrl } from "./pixel-studio";

// ─── small helpers ────────────────────────────────────────────────────────────────────────────────────────────────

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadJson(name: string, data: unknown) {
  downloadBlob(name, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
}

async function downloadPng(name: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(name, blob);
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "asset";

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Pack tiles of the New Texture set, offered in the "Replaces" box. */
const NEWTEX_NAMES = [
  "bed", "chest", "deep_water", "dirt_floor", "ghostbox", "grass", "grass_flowers", "hell_floor", "hell_wall", "ice", "lava", "log",
  "portal", "sand", "sand_wall", "snow", "snow_wall", "stone_floor", "stone_wall", "swamp", "swamp_floor", "temple_floor", "temple_wall",
  "tree_desert", "tree_hell", "tree_plains", "tree_snow", "tree_swamp", "water", "wood_floor", "wood_wall",
  "hellgen", "battery", "wire", "xpgen", "duplicator",
];

const GROUP_LABEL: Record<AssetGroup, string> = { camp: "Camp piece", tile: "Map tile", power: "Power block" };

const defaultName = (group: AssetGroup, category: string): string => {
  if (group === "power") return POWER_TEXTURES.find((p) => p.id === category)?.label ?? "Power texture";
  if (group === "camp") return "New camp piece";
  return TILE_CATEGORIES.find((c) => c.id === category)?.label.replace(/ \/.*$/, "") ?? "New tile";
};

function blankAsset(group: AssetGroup, category?: string): Asset {
  const cat = category ?? (group === "camp" ? "walls" : group === "power" ? "hellgen" : "floor");
  return {
    id: uid(),
    name: defaultName(group, cat),
    group,
    category: cat,
    pixels: "",
    size: 32,
    created: Date.now(),
    live: group === "power" ? true : undefined,
    holdMax: 0,
    holdItems: [],
    spawnIn: [],
    isDeco: false,
    walkEffects: [],
  };
}

/** A labelled control that is NOT a <label>, so checkboxes and buttons inside it behave (nested labels swallow clicks). */
function FieldRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="ui-field">
      <span className="ui-field-label">{label}</span>
      {children}
      {hint && <span className="ui-field-hint">{hint}</span>}
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="chip chip-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function Thumb({ src, size = 64 }: { src?: string; size?: number }) {
  return (
    <span className="ca-thumb" style={{ width: size, height: size }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", imageRendering: "pixelated" }} /> : null}
    </span>
  );
}

// ─── the screen ───────────────────────────────────────────────────────────────────────────────────────────────────

type Notice = { tone: "good" | "bad" | "info"; text: string } | null;
type Filter = "all" | AssetGroup;

export function CampAssetBuilder({ onBack }: { onBack: () => void }) {
  const [assets, setAssets] = useState<Asset[]>(() => loadPack());
  const [editing, setEditing] = useState<Asset | null>(null);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [catPaths, setCatPaths] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const say = (tone: "good" | "bad" | "info", text: string) => {
    setNotice({ tone, text });
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
  };
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Pack tile paths for the "Replaces" suggestions.
  useEffect(() => {
    let live = true;
    loadTileCatalog().then((cat) => {
      if (!live || !cat) return;
      setCatPaths(cat.categories.flatMap((c) => c.tiles.map((t) => t.path)));
    });
    return () => { live = false; };
  }, []);

  const persist = (next: Asset[]): boolean => {
    setAssets(next);
    const ok = savePack(next);
    if (!ok) say("bad", "Could not save: this browser's storage is full or blocked. Export your pack as JSON so nothing is lost, then delete pieces you do not need.");
    return ok;
  };

  const patch = (change: Partial<Asset>) => {
    setEditing((e) => (e ? { ...e, ...change } : e));
    setDirty(true);
  };

  const startNew = (group: AssetGroup, category?: string, pixels = "") => {
    const a = blankAsset(group, category);
    a.pixels = pixels;
    setEditing(a);
    setDirty(false);
  };

  const openEdit = (a: Asset) => {
    setEditing({ ...a, group: groupOf(a) });
    setDirty(false);
  };

  /** Power slot shortcut: edit your texture for it, or start one from the art the game ships with. */
  const paintSlot = async (slot: string) => {
    const mine = [...assets].filter((a) => groupOf(a) === "power" && a.category === slot).sort((a, b) => b.created - a.created)[0];
    if (mine) return openEdit(mine);
    const p = await decodeToPix(powerDefaultArt(slot), 32);
    startNew("power", slot, p ? pixToDataUrl(p, 32) : "");
    if (!p) say("info", "Could not load the built-in art, so you are starting from a blank canvas.");
  };

  const leaveEditor = () => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    setEditing(null);
    setDirty(false);
  };

  const save = async (close: boolean) => {
    if (!editing) return;
    if (!editing.pixels.startsWith("data:image/")) return say("bad", "Paint something first.");
    const pix = await decodeToPix(editing.pixels, editing.size);
    if (!pix || isBlank(pix)) {
      if (!window.confirm("This canvas is empty. Save it anyway?")) return;
    }
    const name = editing.name.trim() || defaultName(groupOf(editing), editing.category);
    // A saved power texture is the newest for its block, so it is the one the game draws.
    const toSave: Asset = { ...editing, name, created: groupOf(editing) === "power" ? Date.now() : editing.created };
    const next = assets.some((a) => a.id === toSave.id) ? assets.map((a) => (a.id === toSave.id ? toSave : a)) : [...assets, toSave];
    if (!persist(next)) return;
    setEditing(close ? null : toSave);
    setDirty(false);
    const live = groupOf(toSave) === "power" ? toSave.live !== false : !!(toSave.live && toSave.replaces);
    say("good", live ? `Saved "${name}". It is live in game now.` : `Saved "${name}".`);
  };

  const remove = (id: string) => {
    persist(assets.filter((a) => a.id !== id));
    if (editing?.id === id) { setEditing(null); setDirty(false); }
  };

  const duplicate = (a: Asset) => {
    const copy: Asset = { ...a, id: uid(), name: `${a.name} copy`, created: Date.now(), live: groupOf(a) === "power" ? false : a.live };
    persist([...assets, copy]);
    say("info", groupOf(a) === "power" ? "Duplicated. The copy is not live until you turn Live on." : "Duplicated.");
  };

  const toggleLive = (a: Asset) => {
    const live = groupOf(a) === "power" ? a.live === false : !a.live;
    persist(assets.map((x) => (x.id === a.id ? { ...x, live } : x)));
  };

  // ─── import / export ──────────────────────────────────────────────────────────────────────────────────────
  const importPackText = (text: string, label: string) => {
    const parsed = parsePack(text);
    if (!parsed) return say("bad", `${label} is not a pack file.`);
    if (!parsed.assets.length) return say("bad", `${label} has no usable pieces${parsed.skipped ? ` (${parsed.skipped} were invalid)` : ""}.`);
    const m = mergePack(assets, parsed.assets);
    if (persist(m.assets)) say("good", `Imported ${m.added} new and ${m.replaced} updated${parsed.skipped ? `, ${parsed.skipped} skipped` : ""}.`);
  };

  const onImportFile = async (f: File | undefined) => {
    if (!f) return;
    importPackText(await f.text(), f.name);
    if (importRef.current) importRef.current.value = "";
  };

  const importBuiltinPower = async () => {
    try {
      const r = await fetch(POWER_PACK_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      importPackText(await r.text(), "The built-in power pack");
    } catch {
      say("bad", "Could not load the built-in power pack.");
    }
  };

  const exportAll = () => {
    if (!assets.length) return say("info", "Nothing to export yet.");
    downloadJson("camp-tile-pack.json", assets);
  };

  const onImagePicked = async (f: File | undefined) => {
    if (!f || !editing) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result ?? "");
      const p = await decodeToPix(url, editing.size);
      if (!p) return say("bad", "That image could not be read.");
      patch({ pixels: pixToDataUrl(p, editing.size) });
      say("info", `Imported ${f.name}, scaled to ${editing.size}×${editing.size}. Undo (Ctrl+Z) brings your old art back.`);
    };
    reader.readAsDataURL(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startFromGame = async () => {
    if (!editing) return;
    const g = groupOf(editing);
    const src = g === "power" ? powerDefaultArt(editing.category) : editing.replaces;
    if (!src) return say("info", "Fill in the Replaces path first, and the tile it points at loads here as a starting point.");
    const p = await decodeToPix(src, editing.size);
    if (!p) return say("bad", `Could not load ${src}.`);
    patch({ pixels: pixToDataUrl(p, editing.size) });
  };

  // ─── derived ──────────────────────────────────────────────────────────────────────────────────────────────
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => filter === "all" || groupOf(a) === filter)
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
      .sort((a, b) => b.created - a.created);
  }, [assets, filter, query]);

  const counts = useMemo(() => {
    const c = { all: assets.length, camp: 0, tile: 0, power: 0 };
    for (const a of assets) c[groupOf(a)]++;
    return c;
  }, [assets]);

  const customSlots = useMemo(() => customPowerSlots(assets), [assets]);
  const bytes = useMemo(() => packBytes(assets), [assets]);
  const usedPct = Math.min(100, Math.round((bytes / (4.5 * 1024 * 1024)) * 100));

  const editingGroup: AssetGroup | null = editing ? groupOf(editing) : null;
  const categories = editingGroup === "camp"
    ? CAMP_CATEGORIES.map((id) => ({ id: id as string, label: id as string }))
    : editingGroup === "power"
      ? POWER_TEXTURES.map((c) => ({ id: c.id as string, label: c.label as string }))
      : TILE_CATEGORIES.map((c) => ({ id: c.id as string, label: c.label as string }));

  const replaceSuggestions = useMemo(() => {
    if (!editing || editingGroup !== "tile") return [] as string[];
    const folder = TILE_CATEGORIES.find((c) => c.id === editing.category)?.folder ?? "";
    const pack = folder ? catPaths.filter((p) => p.includes(`/${folder}/`)) : [];
    return [...NEWTEX_NAMES.map((n) => `${NEWTEX_DIR}${n}.png`), ...pack].slice(0, 600);
  }, [editing, editingGroup, catPaths]);

  // ─── editor ───────────────────────────────────────────────────────────────────────────────────────────────
  if (editing && editingGroup) {
    const g = editingGroup;
    const isNew = !assets.some((a) => a.id === editing.id);
    return (
      <div className="designer-screen">
        <header className="designer-header">
          <div>
            <p className="screen-kicker">TILE BUILDER · {GROUP_LABEL[g].toUpperCase()}</p>
            <h1 className="screen-title">{editing.name || "Untitled"}{dirty ? " *" : ""}</h1>
          </div>
          <div className="ca-actions">
            <button type="button" className="px-btn px-btn-kyo" onClick={() => save(false)} title="Save and keep painting">Save</button>
            <button type="button" className="px-btn" onClick={() => save(true)} title="Save and go back to the list">Save &amp; close</button>
            <button type="button" className="px-btn" onClick={leaveEditor}>{dirty ? "Discard" : "Back"}</button>
          </div>
        </header>

        {notice && <p className={`ca-notice ca-notice-${notice.tone}`} role="status">{notice.text}</p>}

        <div className="ca-editor">
          <div className="ca-canvas-col">
            <PixelStudio
              size={editing.size}
              pixels={editing.pixels}
              tileMode={g === "tile"}
              onChange={(pixels) => { setEditing((e) => (e ? { ...e, pixels } : e)); setDirty(true); }}
            />
          </div>

          <div className="ca-meta px-panel">
            <Section title="Details">
              <FieldRow label="Name">
                <input className="px-input" value={editing.name} maxLength={60} onChange={(e) => patch({ name: e.target.value })} />
              </FieldRow>
              <FieldRow label="Type">
                <Tabs
                  value={g}
                  onChange={(next) => {
                    const category = next === "camp" ? "walls" : next === "power" ? "hellgen" : "floor";
                    patch({ group: next, category, live: next === "power" ? (editing.live ?? true) : editing.live, name: dirty || !isNew ? editing.name : defaultName(next, category) });
                  }}
                  tabs={[{ id: "camp", label: "Camp" }, { id: "tile", label: "Map tile" }, { id: "power", label: "Power" }]}
                />
              </FieldRow>
              <FieldRow label="Category">
                <select className="px-input" value={editing.category} onChange={(e) => patch({ category: e.target.value })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Canvas size" hint="Changing it re-samples your art so nothing is lost. The game draws pieces at 32×32.">
                <div className="ps-row">
                  {([16, 32, 64] as AssetSize[]).map((s) => (
                    <button key={s} type="button" className={`px-btn ui-btn-sm ${editing.size === s ? "px-btn-kyo" : ""}`} onClick={() => patch({ size: s })}>{s}×{s}</button>
                  ))}
                </div>
              </FieldRow>
              <FieldRow label="Starting point">
                <div className="ps-row">
                  <button type="button" className="px-btn ui-btn-sm" onClick={startFromGame} title={g === "power" ? "Load the art the game ships for this block" : "Load the tile named in Replaces"}>
                    {g === "power" ? "Load game art" : "Load tile to edit"}
                  </button>
                  <button type="button" className="px-btn ui-btn-sm" onClick={() => fileRef.current?.click()}>Import PNG</button>
                  <button type="button" className="px-btn ui-btn-sm" disabled={!editing.pixels} onClick={() => downloadPng(`${slug(editing.name)}.png`, editing.pixels)}>Export PNG</button>
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/gif,image/webp,image/jpeg" hidden onChange={(e) => onImagePicked(e.target.files?.[0])} />
              </FieldRow>
            </Section>

            {g === "power" && (
              <Section title="In game">
                <Check checked={editing.live !== false} onChange={(v) => patch({ live: v })}>Live: draw this on the placed block</Check>
                <p className="ui-field-hint">The newest live texture saved for a block is the one the game draws. Turn Live off to keep a draft without using it.</p>
              </Section>
            )}

            {g === "tile" && (
              <>
                <Section title="In game">
                  <FieldRow label="Replaces" hint="A pack tile this one draws over everywhere in game. Pick from the list or type a path.">
                    <input className="px-input" list="ca-replaces" value={editing.replaces ?? ""} placeholder="/MapAssets/NewTex/stone_wall.png" onChange={(e) => patch({ replaces: e.target.value.trim() || undefined })} />
                    <datalist id="ca-replaces">{replaceSuggestions.map((p) => <option key={p} value={p} />)}</datalist>
                  </FieldRow>
                  <div className="ps-row">
                    <Check checked={!!editing.live} onChange={(v) => patch({ live: v })}>Live: draw in game now</Check>
                    <Check checked={!!editing.solid} onChange={(v) => patch({ solid: v })}>Solid: blocks movement</Check>
                    <Check checked={!!editing.isDeco} onChange={(v) => patch({ isDeco: v })}>Decoration only</Check>
                  </div>
                  {editing.live && !editing.replaces && <p className="text-bad" style={{ fontSize: 16 }}>Live needs a Replaces path to know which tile to draw over.</p>}
                </Section>
                <Section title="Gameplay properties">
                  <FieldRow label="Holds up to" hint="How many items this tile can store (0 = none).">
                    <input className="px-input" type="number" min={0} max={999} value={editing.holdMax ?? 0} onChange={(e) => patch({ holdMax: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                  </FieldRow>
                  <FieldRow label="Item kinds it holds" hint="Comma-separated: kyo, ghost gear, an item id…">
                    <input className="px-input" defaultValue={(editing.holdItems ?? []).join(", ")} key={editing.id} onBlur={(e) => patch({ holdItems: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                  </FieldRow>
                  <FieldRow label="Spawns in">
                    <div className="chip-row">
                      {SPAWN_LOCATIONS.map((loc) => {
                        const on = (editing.spawnIn ?? []).includes(loc);
                        return <button key={loc} type="button" className={`chip ${on ? "chip-on" : ""}`} aria-pressed={on} onClick={() => { const cur = editing.spawnIn ?? []; patch({ spawnIn: on ? cur.filter((x) => x !== loc) : [...cur, loc] }); }}>{loc}</button>;
                      })}
                    </div>
                  </FieldRow>
                  <FieldRow label="Walk-on effects">
                    <div className="chip-row">
                      {WALK_EFFECTS.map((eff) => {
                        const on = (editing.walkEffects ?? []).includes(eff);
                        return <button key={eff} type="button" className={`chip ${on ? "chip-on" : ""}`} aria-pressed={on} onClick={() => { const cur = editing.walkEffects ?? []; patch({ walkEffects: on ? cur.filter((x) => x !== eff) : [...cur, eff] }); }}>{eff}</button>;
                      })}
                    </div>
                  </FieldRow>
                </Section>
              </>
            )}

            {!isNew && (
              <div className="ps-row" style={{ marginTop: 8 }}>
                <ConfirmButton plain label="Delete this piece" confirm="Really delete?" onConfirm={() => remove(editing.id)} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── library ──────────────────────────────────────────────────────────────────────────────────────────────
  return (
    <div className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="screen-kicker">TILE BUILDER</p>
          <h1 className="screen-title">Camp, tile &amp; power art</h1>
        </div>
        <button type="button" className="px-btn" onClick={onBack}>Back</button>
      </header>

      <p className="designer-status">
        Paint camp pieces, map tiles and the Power blocks. Pieces save on this device and go live in your games right away. Export a pack to ship them in an update.
      </p>

      {notice && <p className={`ca-notice ca-notice-${notice.tone}`} role="status">{notice.text}</p>}

      <div className="ca-toolbar">
        <button type="button" className="px-btn px-btn-kyo" onClick={() => startNew("camp")}>New camp piece</button>
        <button type="button" className="px-btn" onClick={() => startNew("tile")}>New map tile</button>
        <button type="button" className="px-btn" onClick={() => startNew("power")}>New power texture</button>
        <span className="ps-sep" />
        <button type="button" className="px-btn" onClick={() => importRef.current?.click()}>Import pack</button>
        <button type="button" className="px-btn" onClick={exportAll} disabled={!assets.length}>Export pack</button>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImportFile(e.target.files?.[0])} />
      </div>

      <Section title="Power blocks" right={<button type="button" className="px-btn ui-btn-sm" onClick={importBuiltinPower} title="Add the art the game ships with to your pack, so you can edit and re-export it">Import built-in art</button>}>
        <div className="ca-slots">
          {POWER_TEXTURES.map((p) => {
            const custom = customSlots.has(p.id);
            const art = powerTexture(p.id) ?? powerDefaultArt(p.id);
            return (
              <button key={p.id} type="button" className="ca-slot px-panel" onClick={() => paintSlot(p.id)} title={custom ? "Edit your texture" : "Start from the built-in art"}>
                <Thumb src={art} size={48} />
                <span className="ca-slot-name">{p.label}</span>
                <span className={`chip ${custom ? "chip-on" : ""}`} style={{ margin: 0 }}>{custom ? "Custom" : "Built-in"}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <div className="ca-filterbar">
        <div className="chip-row" role="group" aria-label="Filter">
          {([["all", "All"], ["camp", "Camp"], ["tile", "Map tiles"], ["power", "Power"]] as [Filter, string][]).map(([id, label]) => (
            <button key={id} type="button" className={`chip ${filter === id ? "chip-on" : ""}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label} · {counts[id]}</button>
          ))}
        </div>
        <input className="px-input ca-search" placeholder="Search by name or category" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
        <span className="text-dim ca-storage" title="Browsers keep about 5 MB per site. Export packs you want to keep.">Storage {usedPct}%</span>
      </div>

      {assets.length === 0 && <Empty>Nothing here yet. Start with a Power block above, or make a camp piece or map tile.</Empty>}
      {assets.length > 0 && shown.length === 0 && <Empty>No pieces match.</Empty>}

      <div className="ca-grid">
        {shown.map((a) => {
          const g = groupOf(a);
          const live = g === "power" ? a.live !== false : !!(a.live && a.replaces);
          return (
            <div key={a.id} className="px-panel ca-card">
              <button type="button" className="ca-card-art" onClick={() => openEdit(a)} title="Edit">
                <Thumb src={a.pixels} size={64} />
              </button>
              <div className="ca-card-body">
                <div className="ca-card-name" title={a.name}>{a.name}</div>
                <div className="text-dim ca-card-sub">{GROUP_LABEL[g]} · {a.category} · {a.size}px</div>
                {g !== "camp" && (
                  <button type="button" className={`chip ${live ? "chip-on" : ""}`} style={{ margin: "2px 0" }} aria-pressed={live} onClick={() => toggleLive(a)} title="Toggle whether the game draws this">
                    {live ? "Live" : "Not live"}
                  </button>
                )}
                <div className="ps-row">
                  <button type="button" className="px-btn ui-btn-sm" onClick={() => openEdit(a)}>Edit</button>
                  <button type="button" className="px-btn ui-btn-sm" onClick={() => duplicate(a)}>Copy</button>
                  <button type="button" className="px-btn ui-btn-sm" onClick={() => downloadPng(`${slug(a.name)}.png`, a.pixels)} title="Download as a PNG">PNG</button>
                  <ConfirmButton plain className="ui-btn-sm" label="Delete" confirm="Sure?" onConfirm={() => remove(a.id)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
