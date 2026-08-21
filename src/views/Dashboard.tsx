import { useMemo } from "react";
import type { Case } from "../types";
import { useMe, useNav, useStore } from "../store";
import { caseBucket } from "../calc";
import { Avatar, DueChip, Ic, Pill, cx, daysUntil, fmtAED, fmtDate, fmtN, fmtTime, todayISO, useCountUp } from "../ui";

const BUCKETS: { id: ReturnType<typeof caseBucket>; label: string; desc: string; bar: string; dot: string; text: string }[] = [
  { id: "overdue", label: "Overdue", desc: "Next action past due", bar: "bg-rust-500", dot: "bg-rust-500", text: "text-rust-700" },
  { id: "risk", label: "At risk", desc: "Due within 48 hours", bar: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-700" },
  { id: "waiting", label: "Waiting", desc: "Blocked on a third party", bar: "bg-[#d8b64c]", dot: "bg-[#d8b64c]", text: "text-[#7a5c10]" },
  { id: "query", label: "Bank query", desc: "Open query on file", bar: "bg-steel-500", dot: "bg-steel-500", text: "text-steel-700" },
  { id: "ready", label: "Ready to advance", desc: "All stage gates passed", bar: "bg-pine-500", dot: "bg-pine-500", text: "text-pine-700" },
  { id: "noaction", label: "No next action", desc: "Needs an owner decision", bar: "bg-gr-700", dot: "bg-gr-700", text: "text-gr-700" },
];

function Stat({ label, value, format, sub, tone, delay }: { label: string; value: number; format: (n: number) => string; sub?: string; tone?: string; delay: number }) {
  const v = useCountUp(value);
  return (
    <div className="anim-up bg-card border border-mist rounded-lg p-4 hover:shadow-md hover:-translate-y-px transition-all duration-200" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-[11px] font-display font-semibold uppercase tracking-[0.09em] text-ink-soft">{label}</p>
      <p className={cx("num text-[26px] font-semibold leading-tight mt-1", tone ?? "text-ink")}>{format(v)}</p>
      {sub && <p className="text-[11px] text-ink-soft mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { state } = useStore();
  const me = useMe();
  const nav = useNav();

  const open = useMemo(() => state.cases.filter((c) => c.status === "OPEN"), [state.cases]);
  const bucketed = useMemo(() => {
    const m: Record<string, Case[]> = { overdue: [], risk: [], waiting: [], query: [], ready: [], noaction: [] };
    for (const c of open) { const b = caseBucket(state, c); if (b) m[b].push(c); }
    return m;
  }, [state, open]);

  const pipeline = open.reduce((s, c) => s + c.loanAmount, 0);
  const revenue = open.reduce((s, c) => s + c.expectedRevenue, 0);
  const openTasks = state.tasks.filter((t) => t.status === "OPEN");
  const attention = bucketed.overdue.length + bucketed.risk.length + bucketed.noaction.length;
  const eibor = state.eibor[state.eibor.length - 1];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const stageCounts = state.stages.map((s) => ({ s, n: open.filter((c) => c.stage === s.id).length })).filter((x) => x.n > 0);
  const maxN = Math.max(1, ...stageCounts.map((x) => x.n));

  const personName = (id: string) => state.persons.find((p) => p.id === id)?.name ?? "—";
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";

  return (
    <div className="space-y-5">
      {/* header strip */}
      <div className="anim-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-display font-semibold uppercase tracking-[0.14em] text-pine-700">Control Tower · {fmtDate(todayISO())}</p>
          <h1 className="font-display font-bold text-[26px] tracking-tight text-ink mt-1">
            {greeting}, {me?.name.split(" ")[0]} — <span className={attention > 0 ? "text-rust-600" : "text-pine-700"}>{attention > 0 ? `${attention} case${attention > 1 ? "s" : ""} need attention` : "all clear"}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {eibor && (
            <Pill tone="steel" className="num">
              <Ic n="pulse" size={12} /> EIBOR 3M {fmtN(eibor.m3, 3)}% · {fmtDate(eibor.date)}
            </Pill>
          )}
          <Pill tone="pine" className="num"><Ic n="briefcase" size={12} /> {open.length} open cases</Pill>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Stat label="Open cases" value={open.length} format={(n) => fmtN(n)} sub={`${stageCounts.length} active stages`} delay={0} />
        <Stat label="Pipeline finance" value={pipeline} format={(n) => fmtAED(n)} sub="Sum of open loan amounts" delay={60} />
        <Stat label="Expected revenue" value={revenue} format={(n) => fmtAED(n)} sub="Fees on open files" delay={120} tone="text-pine-700" />
        <Stat label="Open tasks" value={openTasks.length} format={(n) => fmtN(n)} sub={`${openTasks.filter((t) => (daysUntil(t.due) ?? 1) < 0).length} overdue`} delay={180} />
        <Stat label="Open bank queries" value={state.queries.filter((q) => q.status === "OPEN").length} format={(n) => fmtN(n)} sub="Awaiting response" delay={240} tone="text-steel-700" />
      </div>

      {/* control tower buckets */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display font-bold text-lg tracking-tight">Case control tower</h2>
          <p className="text-xs text-ink-soft">Every open file answers: what is pending, who owns it, who are we waiting for. Click any card to open Case 360.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
          {BUCKETS.map((b, bi) => {
            const list = bucketed[b.id ?? ""] ?? [];
            return (
              <div key={b.label} className="anim-up bg-card/70 border border-mist rounded-lg overflow-hidden flex flex-col" style={{ animationDelay: `${bi * 50}ms` }}>
                <div className={cx("h-1", b.bar)} />
                <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                  <div>
                    <p className={cx("font-display font-bold text-[13px] tracking-tight", b.text)}>{b.label}</p>
                    <p className="text-[10.5px] text-ink-soft">{b.desc}</p>
                  </div>
                  <span className={cx("num text-lg font-semibold", b.text)}>{list.length}</span>
                </div>
                <div className="px-2 pb-2 space-y-1.5 flex-1 min-h-[70px]">
                  {list.length === 0 && <p className="text-[11px] text-ink-soft/60 px-1.5 py-2">— clear —</p>}
                  {list.map((c) => (
                    <button key={c.id} onClick={() => nav.go("cases", { caseId: c.id })}
                      className={cx("w-full text-left bg-card border border-mist rounded-md px-2.5 py-2 hover:border-ink/30 hover:shadow-sm hover:-translate-y-px transition-all duration-150 focusable group")}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="num text-[11px] font-semibold text-pine-700 group-hover:text-pine-800">{c.ref}</span>
                        <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", b.dot, b.id === "overdue" && "pulse-dot")} />
                      </div>
                      <p className="text-[12px] font-semibold truncate mt-0.5">{personName(c.personId)}</p>
                      <p className="text-[10.5px] text-ink-soft truncate">{state.stages.find((s) => s.id === c.stage)?.name}{c.waitingFor ? ` · waiting: ${c.waitingFor}` : ""}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <Avatar name={userName(c.ownerId)} size={18} />
                        {c.nextActionDue && <span className="text-[10px] num text-ink-soft">{c.nextActionDue === todayISO() ? "due today" : (daysUntil(c.nextActionDue)! < 0 ? `${-daysUntil(c.nextActionDue)!}d late` : fmtDate(c.nextActionDue))}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* stage distribution */}
        <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "150ms" }}>
          <h3 className="font-display font-bold text-sm tracking-tight mb-3">Pipeline by stage</h3>
          <div className="flex items-end gap-1.5 h-36">
            {state.stages.map((s, i) => {
              const n = open.filter((c) => c.stage === s.id).length;
              return (
                <div key={s.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full flex items-end h-28">
                    <div className={cx("w-full rounded-t bar-grow transition-colors", n > 0 ? "bg-pine-600 group-hover:bg-pine-500" : "bg-ink/8")}
                      style={{ height: `${(n / maxN) * 100}%`, minHeight: n > 0 ? 6 : 3, animationDelay: `${i * 40}ms` }} />
                  </div>
                  <span className="text-[9px] num text-ink-soft">{s.short}</span>
                  {n > 0 && <span className="absolute -top-1 num text-[10px] font-semibold text-pine-700">{n}</span>}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-soft mt-2">14-stage mortgage workflow · HO → CL</p>
        </div>

        {/* next actions */}
        <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "220ms" }}>
          <h3 className="font-display font-bold text-sm tracking-tight mb-3">Next action queue</h3>
          <div className="space-y-1">
            {open.filter((c) => c.nextAction).sort((a, b) => (a.nextActionDue ?? "9999").localeCompare(b.nextActionDue ?? "9999")).slice(0, 7).map((c) => (
              <button key={c.id} onClick={() => nav.go("cases", { caseId: c.id })}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-ink/5 transition-colors text-left focusable">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold truncate">{c.nextAction}</p>
                  <p className="text-[10.5px] text-ink-soft num">{c.ref} · {personName(c.personId)} · {userName(c.ownerId).split(" ")[0]}</p>
                </div>
                <DueChip iso={c.nextActionDue} />
              </button>
            ))}
          </div>
        </div>

        {/* activity */}
        <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "290ms" }}>
          <h3 className="font-display font-bold text-sm tracking-tight mb-3">Live activity</h3>
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {state.audit.slice(0, 9).map((a) => (
              <div key={a.id} className="flex gap-2.5 anim-tick">
                <Avatar name={userName(a.by)} size={22} />
                <div className="min-w-0">
                  <p className="text-[12px] leading-snug"><span className="font-semibold">{userName(a.by).split(" ")[0]}</span> · {a.action} — <span className="font-medium">{a.target}</span></p>
                  <p className="text-[10.5px] text-ink-soft num">{fmtTime(a.at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
