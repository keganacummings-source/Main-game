import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pin, PinOff, X, GripVertical } from "lucide-react";
import { setWin, useLayout, type WinRect } from "@/game/ui-layout";

let zTop = 30;

type Props = {
  id: string;
  title: string;
  def: () => WinRect;
  onClose?: () => void;
  children: React.ReactNode;
  minW?: number;
  minH?: number;
  compact?: boolean;
};

function clamp(r: WinRect, tall = 40): WinRect {
  if (typeof window === "undefined") return r;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.max(140, Math.min(r.w, vw - 8));
  const x = Math.max(0, Math.min(r.x, vw - w));
  const y = Math.max(0, Math.min(r.y, vh - Math.min(vh, Math.max(32, r.collapsed ? 32 : tall))));
  const h = r.h === undefined ? undefined : Math.max(60, Math.min(r.h, vh - y - 4));
  return { ...r, w, x, y, h };
}

export function FloatWin({ id, title, def, onClose, children, minW = 200, minH = 80, compact }: Props) {
  const layout = useLayout();
  const stored = layout[id];
  const base = def();
  const [live, setLive] = useState<WinRect | null>(null);
  const [z, setZ] = useState(() => ++zTop);
  const drag = useRef<{ kind: "move" | "size"; sx: number; sy: number; r: WinRect } | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [tall, setTall] = useState(40);
  const [, setView] = useState(0);
  useEffect(() => {
    const onResize = () => setView((n) => n + 1);
    window.addEventListener("resize", onResize);
    const el = box.current;
    const ro = el ? new ResizeObserver(() => setTall(el.offsetHeight)) : null;
    if (el && ro) ro.observe(el);
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, []);
  const rect = clamp(live ?? { ...base, ...stored }, tall);
  const pinned = !!rect.pinned;
  const collapsed = !!rect.collapsed;

  const front = () => setZ(++zTop);
  const start = (kind: "move" | "size") => (e: React.PointerEvent) => {
    front();
    if (pinned || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button") && kind === "move") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = (e.currentTarget as HTMLElement).closest("[data-win]") as HTMLElement | null;
    drag.current = { kind, sx: e.clientX, sy: e.clientY, r: { ...rect, h: kind === "size" ? rect.h ?? el?.offsetHeight : rect.h } };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    setLive(d.kind === "move" ? { ...d.r, x: d.r.x + dx, y: d.r.y + dy } : { ...d.r, w: Math.max(minW, d.r.w + dx), h: Math.max(minH, (d.r.h ?? minH) + dy) });
  };
  const end = () => {
    if (!drag.current) return;
    drag.current = null;
    if (live) setWin(id, clamp(live, tall), base);
    setLive(null);
  };

  return (
    <div
      ref={box}
      data-win={id}
      data-testid={`win-${id}`}
      className={`float-win px-panel ${pinned ? "float-win-pinned" : ""} ${collapsed ? "float-win-collapsed" : ""} ${live ? "float-win-dragging" : ""}`}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: collapsed ? undefined : rect.h, zIndex: z }}
      onPointerDown={front}
      role="region"
      aria-label={title}
    >
      <div
        className={`float-win-bar ${compact ? "float-win-bar-compact" : ""}`}
        onPointerDown={start("move")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest("button")) setWin(id, { collapsed: !collapsed }, rect);
        }}
        title="Drag to move · double-click to fold"
        data-testid={`win-${id}-bar`}
      >
        <GripVertical size={14} className="shrink-0 opacity-60" />
        <span className="float-win-title">{title}</span>
        <button
          type="button"
          className="float-win-btn"
          title={collapsed ? "Expand" : "Fold"}
          aria-label={collapsed ? `Expand ${title}` : `Fold ${title}`}
          data-testid={`win-${id}-fold`}
          onClick={() => setWin(id, { collapsed: !collapsed }, rect)}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button
          type="button"
          className="float-win-btn"
          title={pinned ? "Unpin (unlock and allow closing)" : "Pin (lock position and keep open)"}
          aria-label={pinned ? `Unpin ${title}` : `Pin ${title}`}
          data-testid={`win-${id}-pin`}
          onClick={() => setWin(id, { pinned: !pinned }, rect)}
        >
          {pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
        {onClose && (
          <button
            type="button"
            className="float-win-btn"
            aria-label={`Close ${title}`}
            data-testid={`win-${id}-close`}
            onClick={() => {
              if (pinned) setWin(id, { pinned: false }, rect);
              onClose();
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {!collapsed && <div className="float-win-body">{children}</div>}
      {!pinned && !collapsed && (
        <div
          className="float-win-size"
          onPointerDown={start("size")}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label={`Resize ${title}`}
          data-testid={`win-${id}-resize`}
        />
      )}
    </div>
  );
}

export const vw = () => (typeof window === "undefined" ? 1280 : window.innerWidth);
export const vh = () => (typeof window === "undefined" ? 800 : window.innerHeight);
export const narrow = () => vw() <= 760;
