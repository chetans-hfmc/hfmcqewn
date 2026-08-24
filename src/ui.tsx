import React, { useEffect, useState } from "react";

export function cx(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(" ");
}

/* ---------- formatting helpers ---------- */
export const fmtAED = (n: number) => "AED " + Math.round(n).toLocaleString("en-US");
export const fmtN = (n: number, dp = 0) => n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const fmtPct = (n: number, dp = 1) => `${n.toFixed(dp)}%`;
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const nowISO = () => new Date().toISOString();
export const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const daysUntil = (iso?: string): number | null => {
  if (!iso) return null;
  return Math.round((new Date(iso + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000);
};
export const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
export const fmtTime = (iso?: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
export const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- icons (inline stroke set) ---------- */
const P: Record<string, React.ReactNode> = {
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" /></>,
  home: <><path d="M4 11.2 12 4.5l8 6.7" /><path d="M6 10v9.5h4.2V15h3.6v4.5H18V10" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20.2c.8-3.9 3.6-5.9 7.2-5.9s6.4 2 7.2 5.9" /></>,
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c.7-3.6 3.2-5.4 6.2-5.4s5.5 1.8 6.2 5.4" /><path d="M15.5 5.2a3.4 3.4 0 0 1 0 5.9M17.8 14.9c1.9.7 3 2.2 3.4 4.4" /></>,
  funnel: <><path d="M4 5h16l-6.2 7.4V19l-3.6-2v-4.6L4 5Z" /></>,
  briefcase: <><rect x="3.5" y="7.5" width="17" height="12" rx="1.8" /><path d="M9 7.5V6a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 15 6v1.5M3.5 12.5h17" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="1.6" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  timer: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.8 1.8M9.5 3h5" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  x: <><path d="M6 6l12 12M18 6 6 18" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
  chevD: <><path d="m6 9.5 6 6 6-6" /></>,
  chevR: <><path d="m9.5 6 6 6-6 6" /></>,
  chevL: <><path d="m14.5 6-6 6 6 6" /></>,
  arrowR: <><path d="M4 12h15M13.5 6l6 6-6 6" /></>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="1.6" /><path d="M5.5 15.5h-1a1.6 1.6 0 0 1-1.6-1.6v-9A1.6 1.6 0 0 1 4.5 3.5h9A1.6 1.6 0 0 1 15 5v1" /></>,
  send: <><path d="m4 11.5 16-7-4.5 16-4-6.5L4 11.5Z" /><path d="m11.5 14 8.5-9.5" /></>,
  edit: <><path d="M4 20h4.5L20 8.5 15.5 4 4 15.5V20Z" /><path d="m13 6.5 4.5 4.5" /></>,
  pen: <><path d="M4 20h4.5L20 8.5 15.5 4 4 15.5V20Z" /><path d="m13 6.5 4.5 4.5" /></>,
  trash: <><path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" /><path d="M6.5 6.5l.8 12.2a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7l.8-12.2" /><path d="M10 10.5v6M14 10.5v6" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="1.6" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  logout: <><path d="M14 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" /><path d="M17 8.5 20.5 12 17 15.5M9.5 12h11" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.4 2" /></>,
  calc: <><rect x="5" y="3.5" width="14" height="17" rx="1.8" /><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h7M8.5 15.5v.01" /></>,
  sliders: <><path d="M5 7h9M18 7h1M5 12h3M12 12h7M5 17h12M20 17h-1" /><circle cx="16" cy="7" r="1.8" /><circle cx="10" cy="12" r="1.8" /><circle cx="19" cy="17" r="1.8" /></>,
  shield: <><path d="M12 3.5 5 6v6c0 4.4 3 7.4 7 8.9 4-1.5 7-4.5 7-8.9V6l-7-2.5Z" /></>,
  book: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v16.5H6.5A1.5 1.5 0 0 0 5 21V4.5Z" /><path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19" /></>,
  layers: <><path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z" /><path d="m3.5 12 8.5 4.5L20.5 12M3.5 16l8.5 4.5L20.5 16" /></>,
  list: <><path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20" /><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" /></>,
  file: <><path d="M6 3.5h8l4 4V20.5H6V3.5Z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.2A2.6 2.6 0 0 1 12 7.5c1.4 0 2.5 1 2.5 2.3 0 1.7-2.5 2-2.5 3.7M12 16.8h.01" /></>,
  bell: <><path d="M18 16.2H6c1.3-1.2 1.7-2.7 1.7-4.6V9.4a4.3 4.3 0 0 1 8.6 0v2.2c0 1.9.4 3.4 1.7 4.6Z" /><path d="M10.2 19a2 2 0 0 0 3.6 0" /></>,
  pulse: <><path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" /></>,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 3.5V7h-3.5" /></>,
  download: <><path d="M12 3.5v10.5m0 0 4-4m-4 4-4-4" /><path d="M4.5 16.5V19a1.8 1.8 0 0 0 1.8 1.8h11.4A1.8 1.8 0 0 0 19.5 19v-2.5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  alert: <><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
};

export function Ic({ n, size = 16, className }: { n: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {P[n] ?? null}
    </svg>
  );
}

/* ---------- primitives ---------- */
const inputCls = "w-full h-[34px] rounded-md border border-mist bg-card px-3 text-[13px] text-ink placeholder:text-ink-soft/50 focus:outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/15 transition-all disabled:opacity-60 disabled:cursor-not-allowed";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}
export function NumInput({ value, onChange, placeholder, suffix, className, disabled }: {
  value: number | ""; onChange: (n: number) => void; placeholder?: string; suffix?: string; className?: string; disabled?: boolean;
}) {
  return (
    <div className={cx("relative", className)}>
      <input type="number" inputMode="decimal" value={value === "" ? "" : value} placeholder={placeholder} disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={cx(inputCls, suffix && "pr-14", disabled && "opacity-60 cursor-not-allowed")} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-ink-soft pointer-events-none">{suffix}</span>}
    </div>
  );
}
export function Select({ value, onChange, options, className, disabled }: {
  value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; className?: string; disabled?: boolean;
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
      className={cx(inputCls, "appearance-none pr-8", disabled && "opacity-60 cursor-not-allowed", className)}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}
export function DateInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" {...props} className={cx(inputCls, props.className)} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputCls, "h-auto py-2 resize-y", props.className)} />;
}

export function Btn({ children, onClick, variant = "primary", size = "md", disabled, title, className }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "dark" | "outline" | "ghost";
  size?: "sm" | "md"; disabled?: boolean; title?: string; className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-md font-display font-bold tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-pine-600/40 disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "h-[30px] px-3 text-[12px]" : "h-[34px] px-4 text-[12.5px]";
  const variants = {
    primary: "bg-pine-700 text-paper hover:bg-pine-600 shadow-sm hover:shadow",
    dark: "bg-ink text-paper hover:bg-pine-950 shadow-sm",
    outline: "border border-mist bg-card text-ink hover:border-pine-600 hover:text-pine-700",
    ghost: "text-ink-soft hover:bg-ink/6 hover:text-ink",
  };
  return <button title={title} disabled={disabled} onClick={onClick} className={cx(base, sizes, variants[variant], className)}>{children}</button>;
}

const TONES: Record<string, string> = {
  pine: "bg-pine-100 text-pine-800", green: "bg-pine-100 text-pine-800",
  amber: "bg-amber-100 text-amber-700", rust: "bg-rust-100 text-rust-700",
  steel: "bg-steel-100 text-steel-700", ink: "bg-ink text-paper", gr: "bg-gr-100 text-gr-700",
};
export function Pill({ children, tone = "gr", dot, className }: { children: React.ReactNode; tone?: string; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10.5px] font-display font-bold tracking-wide whitespace-nowrap", TONES[tone] ?? TONES.gr, className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}{children}
    </span>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const hues = ["bg-pine-700", "bg-steel-600", "bg-amber-600", "bg-rust-600", "bg-ink"];
  const h = hues[(name.charCodeAt(0) || 0) % hues.length];
  return (
    <span className={cx("inline-flex items-center justify-center rounded-full text-paper font-display font-bold shrink-0", h)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>
  );
}

export function DueChip({ iso }: { iso?: string }) {
  const dd = daysUntil(iso);
  if (dd == null) return <span className="text-[11px] text-ink-soft">—</span>;
  const tone = dd < 0 ? "bg-rust-100 text-rust-700" : dd === 0 ? "bg-amber-100 text-amber-700" : "bg-gr-100 text-gr-700";
  return <span className={cx("num inline-block rounded px-1.5 py-[2px] text-[10.5px] font-semibold", tone)}>{dd < 0 ? `${-dd}d over` : dd === 0 ? "today" : `${dd}d`}</span>;
}

export function Field({ label, req, hint, children }: { label: string; req?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-display font-bold uppercase tracking-[0.08em] text-ink-soft mb-1.5">
        {label}{req && <span className="text-rust-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[10.5px] text-ink-soft mt-1">{hint}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 560 }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] anim-pop" onClick={onClose} />
      <div className="relative bg-card border border-mist rounded-xl shadow-2xl w-full max-h-[88vh] flex flex-col anim-pop" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-mist">
          <h3 className="font-display font-bold text-[15px] tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-ink/6 text-ink-soft hover:text-ink transition-colors"><Ic n="x" size={16} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-mist flex justify-end gap-2 bg-paper/60 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer, width = 460 }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full bg-card border-l border-mist shadow-2xl flex flex-col anim-slide w-full" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-mist shrink-0">
          <h3 className="font-display font-bold text-[15px] tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-ink/6 text-ink-soft hover:text-ink transition-colors"><Ic n="x" size={16} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-mist flex justify-end gap-2 bg-paper/60 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

export function KV({ k, v, mono = true }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-mist/50 last:border-0">
      <span className="text-[11.5px] text-ink-soft">{k}</span>
      <span className={cx("text-[12px] font-semibold text-right", mono && "num")}>{v}</span>
    </div>
  );
}

export function SectionHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="font-display font-bold text-[24px] tracking-tight text-ink">{title}</h1>
        {sub && <p className="text-[12.5px] text-ink-soft mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ icon = "file", title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <span className="w-12 h-12 rounded-xl bg-mist/50 flex items-center justify-center text-ink-soft mb-3"><Ic n={icon} size={22} /></span>
      <p className="font-display font-bold text-[14px]">{title}</p>
      {sub && <p className="text-[12px] text-ink-soft mt-1 max-w-sm">{sub}</p>}
    </div>
  );
}

/* ---------- destructive-action confirmation ---------- */
export function DangerModal({ open, onClose, title, target, warn, blocked, blockReason, confirmLabel = "Delete permanently", onConfirm }: {
  open: boolean; onClose: () => void; title: string; target: string; warn: React.ReactNode;
  blocked?: boolean; blockReason?: string; confirmLabel?: string; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  const ready = reason.trim().length >= 5 && !blocked;
  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2 text-rust-700"><Ic n="trash" size={16} />{title}</span>} width={480}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <button onClick={() => { if (ready) onConfirm(reason.trim()); }} disabled={!ready}
          className="inline-flex items-center gap-1.5 h-[34px] px-4 rounded-md text-[12.5px] font-display font-bold bg-rust-600 text-paper hover:bg-rust-700 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          <Ic n="trash" size={13} />{confirmLabel}
        </button>
      </>}>
      <div className="space-y-3.5">
        <p className="text-[13px] leading-relaxed">You are about to delete <strong className="num">{target}</strong>. {warn}</p>
        {blocked && (
          <div className="flex items-start gap-2.5 rounded-md border border-amber-500/50 bg-amber-100/50 px-3.5 py-2.5">
            <Ic n="help" size={15} className="text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700 leading-snug"><strong>Not allowed:</strong> {blockReason}</p>
          </div>
        )}
        <div>
          <p className="text-[11px] uppercase tracking-[0.09em] font-display font-bold text-ink-soft mb-1.5">Reason — required (written to audit trail)</p>
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus rows={3} placeholder="e.g. Duplicate record / client withdrew application…" />
          <p className={cx("num text-[10.5px] mt-1", reason.trim().length >= 5 ? "text-pine-700" : "text-ink-soft")}>{reason.trim().length}/5 min characters</p>
        </div>
      </div>
    </Modal>
  );
}
