import React, { useEffect, useRef, useState } from "react";

/* ---------- helpers ---------- */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const fmtAED = (n: number) => "AED " + Math.round(n).toLocaleString("en-US");
export const fmtN = (n: number, d = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
export const fmtPct = (n: number, d = 1) => `${fmtN(n, d)}%`;

export const todayISO = () => {
  const t = new Date(); const p = (x: number) => String(x).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};
export const addDays = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00"); t.setDate(t.getDate() + d);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};
export const daysUntil = (iso?: string) => {
  if (!iso) return null;
  return Math.round((new Date(iso + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000);
};
export const fmtDate = (iso?: string) =>
  iso ? new Date(iso.length <= 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const ageYears = (dob: string) => {
  const d = new Date(dob + "T00:00:00"), n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
};
export const nowISO = () => new Date().toISOString();
export const uid = () => Math.random().toString(36).slice(2, 9).toUpperCase();

export function useCountUp(target: number, dur = 600) {
  const [v, setV] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current; prev.current = target;
    if (from === target) { setV(target); return; }
    const t0 = performance.now(); let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      setV(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

export function dueTone(iso?: string): "overdue" | "risk" | "ok" | "none" {
  const d = daysUntil(iso);
  if (d === null) return "none";
  if (d < 0) return "overdue";
  if (d <= 2) return "risk";
  return "ok";
}

/* ---------- icons ---------- */
const P: Record<string, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.2" /></>,
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c.7-3.6 3.2-5.4 6.2-5.4s5.5 1.8 6.2 5.4" /><path d="M15.5 5.2a3.4 3.4 0 0 1 0 5.9M17.8 14.9c1.9.7 3 2.2 3.4 4.4" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20.2c.8-3.9 3.6-5.9 7.2-5.9s6.4 2 7.2 5.9" /></>,
  funnel: <path d="M3.5 4.5h17l-6.5 8v5.6l-4 2.4v-8L3.5 4.5Z" />,
  briefcase: <><rect x="3" y="7.5" width="18" height="12.5" rx="1.6" /><path d="M8.5 7.5V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7M3 12.5h18" /></>,
  clipboard: <><rect x="5" y="4.5" width="14" height="16.5" rx="1.6" /><path d="M9 4.5A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.5V6H9V4.5ZM8.5 11l2.2 2.2 4.6-4.6M8.5 16.5h7" /></>,
  file: <><path d="M6 3.5h8l4 4v13H6v-17Z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.4 9.2a2.7 2.7 0 0 1 5.2.9c0 1.7-2.5 2.2-2.5 3.7M12 17.2v.1" /></>,
  calc: <><rect x="5" y="3" width="14" height="18" rx="1.8" /><path d="M8.5 7h7M8.5 12h.1M12 12h.1M15.5 12h.1M8.5 15.5h.1M12 15.5h.1M15.5 15.5v.1M8.5 15.5v3.5" /></>,
  sliders: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="var(--color-card)" /><circle cx="15" cy="12" r="2" fill="var(--color-card)" /><circle cx="7" cy="17" r="2" fill="var(--color-card)" /></>,
  shield: <><path d="M12 3 5 5.8v5.4c0 4.6 3 7.8 7 9.3 4-1.5 7-4.7 7-9.3V5.8L12 3Z" /><path d="m9 11.5 2.2 2.2 3.9-4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4M12 16.8v.1" /></>,
  chevR: <path d="m9 5 7 7-7 7" />,
  chevD: <path d="m5 9 7 7 7-7" />,
  chevL: <path d="m15 5-7 7 7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></>,
  arrowR: <path d="M4 12h16m-6-6 6 6-6 6" />,
  bank: <><path d="m3 8.5 9-5 9 5v1.5H3V8.5Z" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18M3 18h18" /></>,
  home: <><path d="m4 11 8-7 8 7" /><path d="M6 10v10h12V10" /></>,
  logout: <><path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14" /><path d="M10 12h10m-4-4 4 4-4 4" /></>,
  pen: <><path d="M14.5 5 19 9.5 8 20.5H3.5V16L14.5 5Z" /><path d="m12.5 7 4.5 4.5" /></>,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="1.6" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  download: <><path d="M12 3.5v10.5m0 0 4-4m-4 4-4-4" /><path d="M4.5 16.5V19a1.8 1.8 0 0 0 1.8 1.8h11.4A1.8 1.8 0 0 0 19.5 19v-2.5" /></>,
  timer: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 1.5M9.5 3h5M12 3v3" /></>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="1.8" /><path d="M15.5 5.5v-.7A1.8 1.8 0 0 0 13.7 3H4.8A1.8 1.8 0 0 0 3 4.8v8.9a1.8 1.8 0 0 0 1.8 1.8h.7" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16.5H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M9 8h7M9 11.5h5" /></>,
  flag: <path d="M6 21V4m0 0c4-2.4 8 2.4 12 0v9c-4 2.4-8-2.4-12 0" />,
  send: <path d="m4 11.5 16-7-4.5 16-3.5-6.5L4 11.5Zm8 2.5L20 4.5" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  filter: <path d="M4 5h16l-6.2 7.4v5.4L10.2 20v-7.6L4 5Z" />,
  refresh: <><path d="M4 12a8 8 0 0 1 13.6-5.7L20 8.5" /><path d="M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.6 5.7L4 15.5" /><path d="M4 20v-4.5h4.5" /></>,
  scale: <><path d="M12 4v16M7 20h10M12 6.5 6 8m6-1.5L18 8" /><path d="M3.5 13.5 6 8l2.5 5.5a2.8 2.8 0 0 1-5 0ZM15.5 13.5 18 8l2.5 5.5a2.8 2.8 0 0 1-5 0Z" /></>,
  dot: <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m4.5 12.5 7.5 4.2 7.5-4.2M4.5 16.5 12 20.7l7.5-4.2" /></>,
  pulse: <path d="M3 12h4l2.5-6.5L14 18l2.5-6H21" />,
  lock: <><rect x="5.5" y="10.5" width="13" height="10" rx="1.6" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
};

export function Ic({ n, size = 18, className }: { n: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className={cx("shrink-0", className)} aria-hidden>
      {P[n]}
    </svg>
  );
}

/* ---------- primitives ---------- */
export function Btn({ children, onClick, variant = "primary", size = "md", className, disabled, title, type = "button" }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "dark" | "outline" | "ghost" | "danger" | "amber";
  size?: "sm" | "md" | "lg"; className?: string; disabled?: boolean; title?: string; type?: "button" | "submit";
}) {
  const base = "inline-flex items-center justify-center gap-1.5 font-display font-semibold tracking-tight rounded-md transition-all duration-150 focusable active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "text-xs px-2.5 py-1.5", md: "text-[13px] px-3.5 py-2", lg: "text-sm px-5 py-2.5" };
  const vars = {
    primary: "bg-pine-600 text-pine-50 hover:bg-pine-700 shadow-sm shadow-pine-900/20",
    dark: "bg-ink text-paper hover:bg-gr-900 shadow-sm",
    outline: "border border-ink/20 text-ink hover:border-pine-600 hover:text-pine-700 bg-card/60",
    ghost: "text-ink-soft hover:text-ink hover:bg-ink/5",
    danger: "bg-rust-500 text-white hover:bg-rust-600 shadow-sm",
    amber: "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={cx(base, sizes[size], vars[variant], className)}>
      {children}
    </button>
  );
}

const tones: Record<string, string> = {
  pine: "bg-pine-100 text-pine-800 border-pine-200",
  amber: "bg-amber-100 text-amber-700 border-amber-500/25",
  rust: "bg-rust-100 text-rust-700 border-rust-500/25",
  steel: "bg-steel-100 text-steel-700 border-steel-500/25",
  gr: "bg-gr-100 text-gr-700 border-gr-300/60",
  ink: "bg-ink text-paper border-ink",
  gold: "bg-[#f3e5c2] text-[#7a5c10] border-[#dcc791]",
};
export function Pill({ tone = "gr", children, className, dot }: { tone?: string; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full border text-[11px] font-semibold tracking-wide font-display", tones[tone], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const hues = ["bg-pine-700", "bg-steel-600", "bg-amber-600", "bg-gr-700", "bg-pine-900", "bg-rust-600"];
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length;
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span className={cx("inline-flex items-center justify-center rounded-full text-paper font-display font-semibold shrink-0", hues[h], className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 560 }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-2xl shadow-ink/30 border border-mist anim-pop w-full max-h-[88vh] flex flex-col" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-mist">
          <h3 className="font-display font-semibold text-[15px] tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-ink/5 text-ink-soft focusable"><Ic n="x" size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-mist flex justify-end gap-2 bg-paper/60 rounded-b-lg">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer, width = 480 }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full bg-card border-l border-mist shadow-2xl anim-slide flex flex-col w-full" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-mist">
          <h3 className="font-display font-semibold text-[15px] tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-ink/5 text-ink-soft focusable"><Ic n="x" size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-mist flex justify-end gap-2 bg-paper/60">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, req }: { label: string; children: React.ReactNode; hint?: string; req?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-ink-soft mb-1.5">
        {label} {req && <span className="text-rust-500">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-ink-soft/80 mt-1">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full bg-card border border-ink/15 rounded-md px-3 py-2 text-[13px] focusable placeholder:text-ink-soft/50 transition-colors focus:border-pine-500";
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}
export function NumInput({ value, onChange, placeholder, suffix, className }: {
  value: number | ""; onChange: (n: number) => void; placeholder?: string; suffix?: string; className?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <input type="number" inputMode="decimal" value={value === "" ? "" : value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={cx(inputCls, suffix && "pr-14")} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-ink-soft">{suffix}</span>}
    </div>
  );
}
export function Select({ value, onChange, options, className }: {
  value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, "appearance-none pr-8 bg-no-repeat bg-[right_10px_center]", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234c564f' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='m5 9 7 7 7-7'/%3E%3C/svg%3E\")" }}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}
export function DateInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" {...props} className={cx(inputCls, props.className)} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputCls, "resize-y", props.className)} />;
}

export function Segmented<T extends string>({ value, onChange, options, size = "md" }: {
  value: T; onChange: (v: T) => void; options: { v: T; l: string; tone?: string }[]; size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex bg-ink/6 rounded-md p-0.5 gap-0.5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={cx("rounded font-display font-semibold transition-all duration-150 focusable",
            size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
            value === o.v ? "bg-card shadow-sm text-ink" : "text-ink-soft hover:text-ink")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="inline-flex items-center gap-2 focusable rounded-full">
      <span className={cx("w-9 h-5 rounded-full relative transition-colors duration-200", on ? "bg-pine-600" : "bg-gr-300")}>
        <span className={cx("absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-all duration-200", on ? "left-[18px]" : "left-0.5")} />
      </span>
      {label && <span className="text-xs font-medium">{label}</span>}
    </button>
  );
}

export function SectionHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 className="font-display font-bold text-xl tracking-tight text-ink">{title}</h2>
        {sub && <p className="text-[13px] text-ink-soft mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function KV({ k, v, mono = true }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-mist/70 last:border-0">
      <span className="text-[11px] uppercase tracking-[0.07em] font-display font-semibold text-ink-soft">{k}</span>
      <span className={cx("text-[13px] font-medium text-right", mono && "num")}>{v}</span>
    </div>
  );
}

export function EmptyState({ icon = "search", title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="w-11 h-11 rounded-full bg-ink/6 flex items-center justify-center text-ink-soft mb-3"><Ic n={icon} size={20} /></span>
      <p className="font-display font-semibold text-sm">{title}</p>
      {sub && <p className="text-xs text-ink-soft mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; l: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-mist overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cx("px-3.5 py-2.5 text-[13px] font-display font-semibold tracking-tight border-b-2 -mb-px transition-colors whitespace-nowrap focusable",
            active === t.id ? "border-pine-600 text-pine-700" : "border-transparent text-ink-soft hover:text-ink")}>
          {t.l}
          {t.count !== undefined && <span className={cx("ml-1.5 text-[10px] num px-1.5 py-0.5 rounded-full", active === t.id ? "bg-pine-100 text-pine-800" : "bg-ink/8 text-ink-soft")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function DueChip({ iso, label }: { iso?: string; label?: string }) {
  const t = dueTone(iso);
  if (!iso) return <span className="text-xs text-ink-soft/70">{label ?? "no due date"}</span>;
  const d = daysUntil(iso) ?? 0;
  const cls = t === "overdue" ? "bg-rust-100 text-rust-700 border-rust-500/30" : t === "risk" ? "bg-amber-100 text-amber-700 border-amber-500/30" : "bg-pine-100 text-pine-800 border-pine-200";
  const txt = d === 0 ? "today" : d < 0 ? `${-d}d overdue` : `in ${d}d`;
  return <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold num", cls)}><Ic n="clock" size={11} />{fmtDate(iso)} · {txt}</span>;
}
