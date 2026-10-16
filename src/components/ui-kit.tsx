import { useEffect, useState, type ReactNode } from "react";

/** Shared building blocks so every window looks and behaves the same (matches the Bag). */

export function Tabs<T extends string>({ value, onChange, tabs, label, className = "" }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: ReactNode; disabled?: boolean; testid?: string }[]; label?: string; className?: string }) {
  return (
    <div className={`ui-tabs ${className}`.trim()} role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          disabled={t.disabled}
          data-testid={t.testid}
          className={`px-btn ui-tab ${value === t.id ? "px-btn-kyo" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <section className="ui-section">
      <header className="ui-section-head">
        <span className="ui-section-title">{title}</span>
        {right && <span className="ui-section-right">{right}</span>}
      </header>
      {children}
    </section>
  );
}

export function Meter({ value, max, label, kind = "kyo", detail, small }: { value: number; max: number; label?: ReactNode; kind?: "kyo" | "hp" | "xp" | "good" | "bad" | "void"; detail?: ReactNode; small?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1e-9, max)) * 100));
  return (
    <div className={`ui-meter ui-meter-${kind} ${small ? "ui-meter-sm" : ""}`} role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)}>
      <div className="ui-meter-fill" style={{ width: `${pct}%` }} />
      {label && <span className="ui-meter-label">{label}</span>}
      <span className="ui-meter-value">{detail ?? `${Math.round(value)}/${Math.round(max)}`}</span>
    </div>
  );
}

export function Pips({ value, max, label }: { value: number; max: number; label?: string }) {
  return (
    <span className="ui-pips" aria-label={label ?? `${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? "ui-pip ui-pip-on" : "ui-pip"} />
      ))}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="ui-empty">{children}</p>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="key-badge">{children}</kbd>;
}

export function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode }[]; label?: string }) {
  return (
    <div className="chip-row" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={`chip ${value === o.id ? "chip-on" : ""}`} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Two-tap confirm for anything destructive or expensive. */
export function ConfirmButton({ label, confirm, onConfirm, disabled, className = "", plain }: { label: ReactNode; confirm: ReactNode; onConfirm: () => void; disabled?: boolean; className?: string; plain?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`px-btn ${armed ? "px-btn-danger" : plain ? "" : "px-btn-kyo"} ${className}`}
      disabled={disabled}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirm : label}
    </button>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="ui-field">
      <span className="ui-field-label">{label}</span>
      {children}
      {hint && <span className="ui-field-hint">{hint}</span>}
    </label>
  );
}

/** Full-screen menu layout used by every out-of-game screen. */
export function Screen({ kicker, title, children, wide, roomy, aside }: { kicker: string; title: ReactNode; children: ReactNode; wide?: boolean; roomy?: boolean; aside?: ReactNode }) {
  return (
    <div className="screen">
      <div className={`screen-frame ${wide ? "screen-frame-wide" : ""} ${roomy ? "screen-frame-roomy" : ""}`}>
        <div className="screen-brand" aria-hidden="true">
          <span className="screen-logo">TURBZ</span>
          <span className="screen-sub">V6</span>
        </div>
        <div className="px-panel screen-card">
          <p className="screen-kicker">{kicker}</p>
          <h1 className="screen-title">{title}</h1>
          {children}
        </div>
        {aside}
      </div>
    </div>
  );
}

export function Tile({ title, about, onClick, primary, disabled, testid, badge }: { title: ReactNode; about?: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; testid?: string; badge?: ReactNode }) {
  return (
    <button type="button" className={`ui-tile ${primary ? "ui-tile-primary" : ""}`} onClick={onClick} disabled={disabled} data-testid={testid}>
      <span className="ui-tile-title">{title}{badge && <span className="ui-tile-badge">{badge}</span>}</span>
      {about && <span className="ui-tile-about">{about}</span>}
    </button>
  );
}
