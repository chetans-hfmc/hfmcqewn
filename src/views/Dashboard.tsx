import { useMemo, useState } from "react";
import { ESC_LEVELS, tatFor } from "../calc";
import { useNav, useStore } from "../store";
import { Btn, Ic, cx, fmtAED, fmtDate, fmtN, fmtTime, todayISO, useCountUp } from "../ui";

function Count({ v, format, className }: { v: number; format: (n: number) => string; className?: string }) {
  const n = useCountUp(v);
  return <span className={cx("num", className)}>{format(n)}</span>;
}

const LADDER = [
  { id: "l3", level: 3, tag: "LEVEL 3", who: "Dept Head copies Kiran", on: "bg-rust-600 border-rust-600 text-white", off: "bg-card border-rust-200 hover:border-rust-500", num: "text-rust-600" },
  { id: "l2", level: 2, tag: "LEVEL 2", who: "TL escalates to Dept Head", on: "bg-amber-600 border-amber-600 text-white", off: "bg-card border-amber-500/40 hover:border-amber-500", num: "text-amber-600" },
  { id: "l1", level: 1, tag: "LEVEL 1", who: "Flagged to Team Leader", on: "bg-steel-600 border-steel-600 text-white", off: "bg-card border-steel-500/40 hover:border-steel-500", num: "text-steel-600" },
  { id: "ok", level: 0, tag: "ON TRACK", who: "Normal follow-up", on: "bg-pine-700 border-pine-700 text-white", off: "bg-card border-mist hover:border-pine-500", num: "text-pine-700" },
];

export default function Dashboard() {
  const { state } = useStore();
  const nav = useNav();
  const today = todayISO();

  const open = useMemo(() => state.cases.filter((c) => c.status === "OPEN"), [state.cases]);
  const withT = useMemo(() => open.map((c) => ({ c, t: tatFor(c, c.stage, state.stages, today) })), [open, state.stages, today]);
  const byLevel = (lv: number) => withT.filter((x) => x.t.level === lv).sort((a, b) => b.t.daysOver - a.t.daysOver);
  const L3 = byLevel(3);
  const L2 = byLevel(2);
  const L1 = byLevel(1);
  const OK = byLevel(0);

  /* files parked on Sir's instruction — his queue, made visible */
  const holds = useMemo(() => open.filter((c) => {
    const wt = (c.waitingFor ?? "").toLowerCase();
    const pr = (c.pendingReason ?? "").toLowerCase();
    const taskHold = state.tasks.some((t) => t.caseId === c.id && t.status === "OPEN" &&
      (((t.waitingFor ?? "").toLowerCase().includes("kiran")) || (t.pendingReason ?? "").toLowerCase().includes("instruction") || t.title.toLowerCase().startsWith("hold")));
    return wt.includes("kiran") || pr.includes("hold") || taskHold;
  }), [open, state.tasks]);

  const decisions = L3.length + L2.length + holds.length;
  const [expanded, setExpanded] = useState<string>(() => (L3.length ? "l3" : L2.length ? "l2" : L1.length ? "l1" : "ok"));
  const expandedList = expanded === "l3" ? L3 : expanded === "l2" ? L2 : expanded === "l1" ? L1 : OK;
  const [showActivity, setShowActivity] = useState(false);

  const pipeline = open.reduce((s, c) => s + c.loanAmount, 0);
  const revenue = open.reduce((s, c) => s + c.expectedRevenue, 0);
  const openQueries = state.queries.filter((q) => q.status === "OPEN").length;
  const activity = state.audit.slice(0, 8);
  const stageCounts = state.stages.map((s) => ({ s, n: open.filter((c) => c.stage === s.id).length }));
  const maxStage = Math.max(1, ...stageCounts.map((x) => x.n));
  const uName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;

  return (
    <div className="max-w-[1180px] mx-auto">
      {/* header */}
      <div className="anim-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-display font-semibold uppercase tracking-[0.16em] text-pine-700">Business control · {fmtDate(today)}</p>
          <h1 className="font-display font-bold text-[27px] tracking-tight text-ink mt-0.5">Control Tower</h1>
          <p className="text-[12.5px] text-ink-soft mt-1">What needs your decision first — everything else waits behind a click.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="outline" onClick={() => nav.go("tat")}><Ic n="timer" size={13} /> TAT & Escalation</Btn>
          <Btn variant="outline" onClick={() => nav.go("tracker")}><Ic n="calendar" size={13} /> Daily tracker</Btn>
          <Btn variant="outline" onClick={() => nav.go("queries")}><Ic n="help" size={13} /> Bank queries · {openQueries}</Btn>
        </div>
      </div>

      {/* intervention strip — the one thing that matters */}
      <button onClick={() => nav.go("tat")}
        className={cx("anim-up group w-full text-left mt-4 relative overflow-hidden rounded-lg px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 transition-all hover:-translate-y-px hover:shadow-lg sidebar-texture focusable",
          decisions > 0 ? "bg-ink text-paper" : "bg-pine-700 text-paper")}
        style={{ animationDelay: "50ms" }}>
        <span className={cx("w-2.5 h-2.5 rounded-full shrink-0", decisions > 0 ? "bg-rust-500 pulse-dot" : "bg-pine-300")} />
        <div className="min-w-0">
          <p className="font-display font-bold text-[21px] tracking-tight leading-tight">
            <Count v={decisions} format={(n) => fmtN(n)} /> file{decisions === 1 ? "" : "s"} need{decisions === 1 ? "s" : ""} your decision
          </p>
          <p className="text-[11.5px] text-paper/60 mt-0.5">
            {decisions > 0 ? "Level 2–3 escalations and files parked on your instruction — open the monitor" : "Tower is green — no intervention required right now"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="num text-[10.5px] font-bold px-2 py-1 rounded bg-rust-500/25 text-rust-100 border border-rust-500/40">{L3.length} at L3</span>
          <span className="num text-[10.5px] font-bold px-2 py-1 rounded bg-amber-500/25 text-amber-100 border border-amber-500/40">{L2.length} at L2</span>
          <span className="num text-[10.5px] font-bold px-2 py-1 rounded bg-paper/10 border border-paper/25">{holds.length} on hold</span>
          <Ic n="arrowR" size={18} className="text-paper/70 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      {/* escalation ladder — click a level, see only its files */}
      <div className="anim-up grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4" style={{ animationDelay: "110ms" }}>
        {LADDER.map((l) => {
          const n = l.level === 3 ? L3.length : l.level === 2 ? L2.length : l.level === 1 ? L1.length : OK.length;
          const active = expanded === l.id;
          return (
            <button key={l.id} onClick={() => setExpanded(l.id)}
              className={cx("focusable text-left rounded-lg border px-4 py-3.5 transition-all duration-200",
                active ? cx(l.on, "shadow-md -translate-y-px") : cx(l.off, "hover:-translate-y-px hover:shadow-sm"))}>
              <div className="flex items-baseline justify-between gap-2">
                <Count v={n} format={(x) => fmtN(x)} className={cx("text-[26px] font-semibold leading-none", active ? "text-inherit" : l.num)} />
                <span className={cx("text-[9px] font-display font-bold tracking-[0.12em]", active ? "text-inherit opacity-80" : "text-ink-soft")}>{l.tag}</span>
              </div>
              <p className={cx("text-[11px] mt-1.5", active ? "text-inherit opacity-85" : "text-ink-soft")}>{l.who}</p>
            </button>
          );
        })}
      </div>

      {/* expanded list for the selected level */}
      <div key={expanded} className="anim-pop mt-2.5 bg-card border border-mist rounded-lg overflow-hidden">
        {expandedList.length === 0 ? (
          <p className="px-4 py-3.5 text-[12.5px] text-ink-soft italic">No files at this level.</p>
        ) : (
          <>
            <div className="divide-y divide-mist/60">
              {expandedList.slice(0, 7).map(({ c, t }) => {
                const person = state.persons.find((p) => p.id === c.personId);
                const st = state.stages.find((s) => s.id === c.stage);
                return (
                  <button key={c.id} onClick={() => nav.go("cases", { caseId: c.id })}
                    className="focusable w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-pine-50/50 transition-colors group">
                    <span className="num text-[11px] font-bold text-pine-700 w-16 shrink-0">{c.ref}</span>
                    <span className="text-[13px] font-semibold truncate flex-1">{person?.name}</span>
                    <span className="hidden sm:block text-[10px] font-display font-bold uppercase tracking-wide bg-pine-100 text-pine-800 rounded px-1.5 py-0.5 shrink-0">{st?.short}</span>
                    <span className={cx("num text-[11px] font-semibold shrink-0", t.daysOver > 0 ? "text-rust-600" : "text-ink-soft")}>
                      {t.daysOver > 0 ? `${t.daysOver}d over` : t.target ? `due ${fmtDate(t.target)}` : "—"}
                    </span>
                    <span className="hidden md:block text-[11px] text-ink-soft w-24 text-right shrink-0">{uName(c.ownerId).split(" ")[0]}</span>
                    <Ic n="chevR" size={14} className="text-ink-soft group-hover:text-pine-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                );
              })}
            </div>
            {expandedList.length > 7 && (
              <button onClick={() => nav.go("tat")} className="focusable w-full px-4 py-2 text-[11.5px] font-display font-bold text-pine-700 hover:bg-pine-50 transition-colors border-t border-mist text-left">
                {expandedList.length - 7} more in the TAT monitor →
              </button>
            )}
          </>
        )}
      </div>

      {/* pipeline + holds */}
      <div className="grid lg:grid-cols-5 gap-4 mt-4">
        {/* pipeline snapshot */}
        <div className="anim-up lg:col-span-3 bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "170ms" }}>
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h2 className="font-display font-bold text-[15px] tracking-tight">Pipeline snapshot</h2>
            <span className="text-[10.5px] text-ink-soft">click a stage → filtered Cases</span>
          </div>
          <div className="flex overflow-x-auto pb-1 -mx-1 px-1">
            {stageCounts.map(({ s, n }, j) => (
              <button key={s.id} onClick={() => nav.go("cases", { params: { stage: s.id } })}
                title={`${s.name} — ${n} open file${n === 1 ? "" : "s"}`}
                className="focusable relative shrink-0 h-[56px] pl-5 pr-6 text-left transition-all hover:brightness-110 hover:-translate-y-px"
                style={{
                  clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)",
                  background: n ? `rgba(15, 85, 62, ${0.4 + (n / maxStage) * 0.6})` : "#dfe3d8",
                  marginLeft: j ? -7 : 0,
                }}>
                <span className={cx("block num text-[15px] font-semibold leading-none pt-2", n ? "text-paper" : "text-ink-soft")}>{n}</span>
                <span className={cx("block text-[8.5px] font-display font-bold uppercase tracking-[0.08em] mt-0.5", n ? "text-paper/75" : "text-ink-soft/80")}>{s.short}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center divide-x divide-mist mt-3.5 border-t border-mist pt-3.5">
            {[
              { l: "Financed pipeline", v: pipeline ? fmtAED(pipeline) : "—", cls: "text-ink" },
              { l: "Expected revenue", v: revenue ? fmtAED(revenue) : "—", cls: "text-pine-700" },
              { l: "Open files", v: fmtN(open.length), cls: "text-ink" },
            ].map((x, i) => (
              <div key={x.l} className={cx("pr-5", i > 0 && "pl-5")}>
                <p className="text-[9.5px] uppercase tracking-[0.1em] font-display font-semibold text-ink-soft">{x.l}</p>
                <p className={cx("num text-[16px] font-semibold mt-0.5", x.cls)}>{x.v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* on hold by your instruction */}
        <div className="anim-up lg:col-span-2 bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "220ms" }}>
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h2 className="font-display font-bold text-[15px] tracking-tight">On hold by your instruction</h2>
            <span className="num text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-ink text-paper">{holds.length}</span>
          </div>
          {holds.length === 0 ? (
            <p className="text-[12px] text-ink-soft italic py-3">No files parked on your instruction.</p>
          ) : (
            <div className="space-y-1.5">
              {holds.slice(0, 6).map((c) => {
                const person = state.persons.find((p) => p.id === c.personId);
                const holdTask = state.tasks.find((t) => t.caseId === c.id && t.status === "OPEN" && t.title.toLowerCase().startsWith("hold"));
                return (
                  <button key={c.id} onClick={() => nav.go("cases", { caseId: c.id })}
                    className="focusable w-full flex items-center gap-2.5 border border-mist rounded-md px-3 py-2 text-left hover:border-ink/40 hover:shadow-sm transition-all group">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-semibold truncate">{person?.name} <span className="num text-ink-soft font-normal">· {c.ref}</span></span>
                      <span className="block text-[10.5px] text-ink-soft truncate">{holdTask?.title.replace(/^HOLD — /, "") ?? c.pendingReason ?? "No follow-up until released"}</span>
                    </span>
                    <Ic n="chevR" size={13} className="text-ink-soft group-hover:text-pine-700 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[10.5px] text-ink-soft mt-3">Release a hold from the file's Control Panel or TAT tab.</p>
        </div>
      </div>

      {/* today's movement — collapsed by default */}
      <div className="anim-up mt-4 bg-card border border-mist rounded-lg overflow-hidden" style={{ animationDelay: "270ms" }}>
        <button onClick={() => setShowActivity(!showActivity)}
          className="focusable w-full flex items-center justify-between px-4 py-3 hover:bg-paper/60 transition-colors">
          <span className="font-display font-bold text-[13.5px] tracking-tight">Today's movement <span className="num text-ink-soft font-normal text-[11.5px]">· {state.audit.length} logged events</span></span>
          <Ic n="chevD" size={15} className={cx("text-ink-soft transition-transform duration-200", showActivity && "rotate-180")} />
        </button>
        {showActivity && (
          <div className="border-t border-mist divide-y divide-mist/60 anim-pop">
            {activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2 text-[12px]">
                <span className="num text-[10.5px] text-ink-soft w-14 shrink-0">{fmtTime(a.at)}</span>
                <span className="text-[9px] font-display font-bold uppercase tracking-[0.09em] bg-ink/8 text-ink-soft rounded px-1.5 py-0.5 shrink-0">{a.module}</span>
                <span className="truncate flex-1"><strong className="font-semibold">{a.action}</strong> · {a.target}{a.detail ? <span className="text-ink-soft"> — {a.detail}</span> : null}</span>
                <span className="hidden sm:block text-[10.5px] text-ink-soft shrink-0">{uName(a.by).split(" ")[0]}</span>
              </div>
            ))}
            <button onClick={() => nav.go("audit")} className="focusable w-full px-4 py-2 text-[11.5px] font-display font-bold text-pine-700 hover:bg-pine-50 transition-colors text-left">
              Full audit trail →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
