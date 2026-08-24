import { useMemo, useState } from "react";
import type { Case } from "../types";
import { useMe, useNav, useStore, isOversight, teamOf } from "../store";
import { ESC_LEVELS, tatFor, fmtDur } from "../calc";
import { Avatar, Btn, DueChip, EmptyState, Ic, Pill, Select, TextInput, cx, fmtDate, todayISO, uid, nowISO } from "../ui";

function scopedFilter<T extends { ownerId: string }>(state: ReturnType<typeof useStore>["state"], me: NonNullable<ReturnType<typeof useMe>>, items: T[]): T[] {
  if (isOversight(me.role)) return items;
  if (me.role === "TL") { const team = teamOf(state, me); return items.filter((i) => team.has(i.ownerId)); }
  if (me.role === "PA") return items;
  return items.filter((i) => i.ownerId === me.id);
}

/* ---------- Task Engine ---------- */
export function TasksView() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const [tab, setTab] = useState<"TODAY" | "OVERDUE" | "OPEN" | "DONE">("TODAY");
  const items = scopedFilter(state, me, state.tasks);
  const inTab = (t: (typeof items)[number]) => {
    if (tab === "DONE") return t.status === "DONE";
    if (t.status !== "OPEN") return false;
    if (tab === "OPEN") return true;
    const dd = t.due ? Math.round((new Date(t.due + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000) : 99;
    return tab === "OVERDUE" ? dd < 0 : dd <= 0;
  };
  const rows = items.filter(inTab);
  return (
    <div className="space-y-3.5">
      <div className="flex gap-2 anim-up">
        {(["TODAY", "OVERDUE", "OPEN", "DONE"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cx("px-3.5 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all", tab === t ? (t === "OVERDUE" ? "bg-rust-600 text-white border-rust-600" : "bg-ink text-paper border-ink") : "border-mist text-ink-soft hover:border-pine-600")}>
            {t === "TODAY" ? "Today" : t === "OVERDUE" ? "Overdue" : t === "OPEN" ? "All open" : "Done"}
            <span className="num text-[10px] opacity-70 ml-1">{items.filter((x) => inTabOverride(x, t)).length}</span>
          </button>
        ))}
      </div>
      <div className="bg-card border border-mist rounded-lg overflow-hidden anim-up">
        {rows.map((t) => {
          const c = state.cases.find((x) => x.id === t.caseId);
          return (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-mist/60 last:border-0 hover:bg-pine-50/40 transition-colors">
              <button onClick={() => dispatch({ t: "UPDATE_TASK", id: t.id, patch: { status: t.status === "OPEN" ? "DONE" : "OPEN" } })}
                className={cx("w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-all", t.status === "DONE" ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300 hover:border-pine-500")}>
                {t.status === "DONE" && <Ic n="check" size={10} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cx("text-[12.5px] font-medium truncate", t.status === "DONE" && "line-through text-ink-soft")}>{t.title}</p>
                <p className="num text-[10.5px] text-ink-soft">{c?.ref} · {state.stages.find((s) => s.id === t.stageId)?.name} · {state.users.find((u) => u.id === t.ownerId)?.name}{t.estimateMinutes ? ` · est ${fmtDur(t.estimateMinutes)}` : ""}</p>
              </div>
              <Pill tone={t.priority === "HIGH" ? "rust" : t.priority === "MEDIUM" ? "amber" : "gr"}>{t.priority}</Pill>
              {t.status === "OPEN" ? <DueChip iso={t.due} /> : <span className="num text-[10.5px] text-ink-soft">done {t.completedAt ? fmtDate(t.completedAt.slice(0, 10)) : ""}{t.completedBy ? ` · ${state.users.find((u) => u.id === t.completedBy)?.name?.split(" ")[0]}` : ""}</span>}
            </div>
          );
        })}
        {rows.length === 0 && <EmptyState icon="timer" title={`Nothing in “${tab.toLowerCase()}”`} sub="Tasks appear as cases move through stages." />}
      </div>
    </div>
  );
}
function inTabOverride(t: { status: string; due?: string }, tab: string): boolean {
  if (tab === "DONE") return t.status === "DONE";
  if (t.status !== "OPEN") return false;
  if (tab === "OPEN") return true;
  const dd = t.due ? Math.round((new Date(t.due + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000) : 99;
  return tab === "OVERDUE" ? dd < 0 : dd <= 0;
}

/* ---------- Documents & QC (pending verification backlog) ---------- */
export function DocumentsView() {
  const { state } = useStore();
  const nav = useNav();
  const [status, setStatus] = useState("RECEIVED");
  const rows: { c: Case; docId: string; typeId: string; stageId: string; st: string }[] = [];
  state.cases.filter((c) => c.status === "OPEN").forEach((c) => c.docs.forEach((d) => { if (status === "ALL" || d.status === status) rows.push({ c, docId: d.id, typeId: d.typeId, stageId: d.stageId, st: d.status }); }));
  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-2 anim-up">
        <Select className="w-[200px]" value={status} onChange={setStatus} options={[{ v: "RECEIVED", l: "Pending verification" }, { v: "MISSING", l: "Missing" }, { v: "VERIFIED", l: "Verified" }, { v: "ALL", l: "All statuses" }]} />
        <span className="ml-auto num text-[11px] text-ink-soft">{rows.length} documents</span>
      </div>
      <div className="bg-card border border-mist rounded-lg overflow-hidden anim-up">
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
            <th className="px-4 py-2.5 font-semibold">Document</th><th className="px-3 py-2.5 font-semibold">Case</th>
            <th className="px-3 py-2.5 font-semibold">Stage</th><th className="px-3 py-2.5 font-semibold">Status</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.docId} onClick={() => nav.go("cases", { caseId: r.c.id, params: { tab: "docs" } })} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/40 cursor-pointer transition-colors">
                <td className="px-4 py-2.5 font-medium">{state.docTypes.find((t) => t.id === r.typeId)?.name}</td>
                <td className="px-3 py-2.5 num text-pine-700 font-semibold">{r.c.ref}</td>
                <td className="px-3 py-2.5 text-ink-soft">{state.stages.find((s) => s.id === r.stageId)?.name}</td>
                <td className="px-3 py-2.5"><Pill tone={r.st === "VERIFIED" ? "pine" : r.st === "RECEIVED" ? "steel" : r.st === "MISSING" ? "amber" : "gr"}>{r.st}</Pill></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4}><EmptyState icon="file" title="Nothing here" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Bank Queries ---------- */
export function QueriesView() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [status, setStatus] = useState("OPEN");
  const rows = scopedFilter(state, me, state.queries).filter((q) => (status === "ALL" ? true : q.status === status));
  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-2 anim-up">
        {["OPEN", "RESPONDED", "CLOSED", "ALL"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cx("px-3.5 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all", status === s ? "bg-ink text-paper border-ink" : "border-mist text-ink-soft hover:border-pine-600")}>{s}</button>
        ))}
      </div>
      <div className="bg-card border border-mist rounded-lg overflow-hidden anim-up">
        {rows.map((q) => {
          const c = state.cases.find((x) => x.id === q.caseId);
          return (
            <div key={q.id} className="px-4 py-3 border-b border-mist/60 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[12.5px]">{q.ref} · {state.banks.find((b) => b.id === q.bankId)?.short} · <button onClick={() => nav.go("cases", { caseId: q.caseId })} className="num text-pine-700 hover:underline">{c?.ref}</button></p>
                <Pill tone={q.status === "OPEN" ? "rust" : q.status === "RESPONDED" ? "amber" : "pine"}>{q.status}</Pill>
              </div>
              <p className="text-[12px] text-ink-soft mt-1">{q.requirement}</p>
              {q.response && <p className="text-[11.5px] mt-1.5 border-l-2 border-pine-500 pl-2.5 text-pine-800">{q.response}</p>}
              {q.status !== "CLOSED" && (
                <div className="flex gap-1.5 mt-2">
                  {q.status === "OPEN" && <Btn size="sm" variant="outline" onClick={() => dispatch({ t: "UPDATE_QUERY", id: q.id, patch: { status: "RESPONDED", response: q.response ?? "Response sent" } })}><Ic n="send" size={12} /> Mark responded</Btn>}
                  <Btn size="sm" variant="dark" onClick={() => dispatch({ t: "UPDATE_QUERY", id: q.id, patch: { status: "CLOSED", qc: `Verified by ${me.name}` } })}><Ic n="check" size={12} /> QC & close</Btn>
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <EmptyState icon="help" title="No queries in this state" />}
      </div>
    </div>
  );
}

/* ---------- Morning Board (Daily Tracker) ---------- */
export function TrackerView() {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe()!;
  const [span, setSpan] = useState(3);
  const [edit, setEdit] = useState<{ c: Case; date: string } | null>(null);
  const [note, setNote] = useState("");
  const today = todayISO();
  const dates = state.trackerDates.slice(-span);
  const unlogged = state.cases.filter((c) => c.status === "OPEN" && !c.tracker?.some((e) => e.date === dates[dates.length - 1]));
  const cellOf = (c: Case, d: string) => c.tracker?.find((e) => e.date === d)?.note ?? "";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5 anim-up">
        <div>
          <h1 className="font-display font-bold text-[22px] tracking-tight">Morning Board</h1>
          <p className="text-[12px] text-ink-soft">One day, every file. The system tracks — this board reports.</p>
        </div>
        <div className="ml-auto flex gap-1.5">
          {[3, 6].map((n) => (
            <button key={n} onClick={() => setSpan(n)} className={cx("px-3 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all", span === n ? "bg-ink text-paper border-ink" : "border-mist text-ink-soft hover:border-pine-600")}>Last {n} days</button>
          ))}
        </div>
      </div>

      {unlogged.length > 0 && (
        <div className="anim-up">
          <p className="text-[10.5px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft mb-2">Not logged on {fmtDate(dates[dates.length - 1])} — click to log ({unlogged.length})</p>
          <div className="flex flex-wrap gap-2">
            {unlogged.slice(0, 12).map((c) => (
              <button key={c.id} onClick={() => { setEdit({ c, date: dates[dates.length - 1] }); setNote(""); }}
                className="flex items-center gap-2 bg-card border border-mist rounded-md pl-1.5 pr-2.5 py-1.5 hover:border-amber-500 hover:shadow-sm transition-all">
                <DueChip iso={dates[dates.length - 1]} />
                <span className="num text-[10.5px] font-bold text-pine-700">{c.ref}</span>
                <span className="text-[11.5px] font-semibold">{state.persons.find((p) => p.id === c.personId)?.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full border-collapse text-[12.5px]" style={{ minWidth: 380 + dates.length * 250 }}>
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-3.5 py-2.5 font-semibold w-[260px]">File</th>
              {dates.map((dt) => <th key={dt} className={cx("px-3 py-2.5 font-semibold whitespace-nowrap", dt === today && "text-pine-700")}>{fmtDate(dt)}{dt === today && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-pine-600 align-middle" />}</th>)}
            </tr>
          </thead>
          <tbody>
            {state.cases.filter((c) => c.status === "OPEN").map((c) => (
              <tr key={c.id} className="border-b border-mist/60 last:border-0 group">
                <td className="px-3.5 py-2.5 align-top">
                  <button onClick={() => nav.go("cases", { caseId: c.id })} className="text-left">
                    <p className="font-semibold text-[12.5px] leading-tight hover:text-pine-700">{state.persons.find((p) => p.id === c.personId)?.name}</p>
                    <p className="num text-[10px] text-pine-700 font-semibold mt-0.5">{c.ref} · {state.banks.find((b) => b.id === c.bankId)?.short} · {state.stages.find((s) => s.id === c.stage)?.short}</p>
                  </button>
                </td>
                {dates.map((dt) => {
                  const val = cellOf(c, dt);
                  return (
                    <td key={dt} className={cx("px-1.5 py-1.5 align-top", dt === today && "bg-pine-50/50")}>
                      <button onClick={() => { setEdit({ c, date: dt }); setNote(val); }}
                        className={cx("w-full min-h-[48px] rounded-md border px-2 py-1.5 text-left transition-all", val ? "border-mist bg-paper/70 hover:border-pine-400" : "border-dashed border-mist hover:border-pine-400 hover:bg-pine-50/60")}>
                        {val ? <span className="text-[11px] leading-snug line-clamp-3">{val}</span> : <span className="text-[10.5px] text-ink-soft/50 italic">— log</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => setEdit(null)} />
          <div className="relative bg-card border border-mist rounded-xl shadow-2xl w-full max-w-[480px] p-5 anim-pop">
            <p className="font-display font-bold text-[15px] tracking-tight">{edit.c.ref} · {state.persons.find((p) => p.id === edit.c.personId)?.name}</p>
            <p className="num text-[11px] text-ink-soft mt-0.5">{fmtDate(edit.date)}{edit.date === today ? " · today" : ""}</p>
            <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={4}
              placeholder="e.g. Pre-approval received — waiting for client confirmation…"
              className="w-full mt-3 rounded-md border border-mist bg-paper/60 px-3 py-2.5 text-[13px] resize-y focus:outline-none focus:border-pine-600" />
            <div className="flex justify-end gap-2 mt-3">
              <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
              <Btn onClick={() => { dispatch({ t: "SET_TRACKER", caseId: edit.c.id, date: edit.date, note }); setEdit(null); }}><Ic n="check" size={13} /> Save entry</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- TAT & Escalation Monitor ---------- */
export function TatView() {
  const { state } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [lvl, setLvl] = useState("ALL");
  const today = todayISO();
  const rows = useMemo(() => {
    const cases = scopedFilter(state, me, state.cases.filter((c) => c.status === "OPEN"));
    return cases
      .map((c) => ({ c, t: tatFor(c, c.stage, state.stages, today) }))
      .filter(({ t }) => (lvl === "ALL" ? true : String(t.level) === lvl))
      .sort((a, b) => b.t.level - a.t.level || b.t.daysOver - a.t.daysOver);
  }, [state, me, lvl, today]);
  const counts = [0, 1, 2, 3].map((l) => state.cases.filter((c) => c.status === "OPEN" && tatFor(c, c.stage, state.stages, today).level === l).length);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 anim-up">
        {ESC_LEVELS.map((m, i) => (
          <button key={m.level} onClick={() => setLvl(lvl === String(m.level) ? "ALL" : String(m.level))}
            className={cx("text-left rounded-lg border px-3.5 py-3 transition-all", lvl === String(m.level) ? "border-ink shadow-md" : "border-mist bg-card hover:border-ink/30")}
            style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center justify-between">
              <span className={cx("inline-flex items-center gap-1.5 text-[10px] font-display font-bold tracking-[0.08em] px-2 py-[3px] rounded", m.chip)}><span className={cx("w-1.5 h-1.5 rounded-full", m.dot)} />{m.tag}</span>
              <span className="num text-[22px] font-semibold leading-none">{counts[m.level]}</span>
            </div>
            <p className="text-[11px] font-semibold mt-2">{m.label}</p>
          </button>
        ))}
      </div>
      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[12.5px] min-w-[760px]">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
            <th className="px-4 py-2.5 font-semibold">File / Client</th><th className="px-3 py-2.5 font-semibold">Stage</th>
            <th className="px-3 py-2.5 font-semibold">Trigger</th><th className="px-3 py-2.5 font-semibold">Target</th>
            <th className="px-3 py-2.5 font-semibold">Elapsed</th><th className="px-3 py-2.5 font-semibold">Escalation</th><th className="px-3 py-2.5 font-semibold">Owner</th>
          </tr></thead>
          <tbody>
            {rows.map(({ c, t }) => {
              const lv = ESC_LEVELS[t.level];
              return (
                <tr key={c.id} onClick={() => nav.go("cases", { caseId: c.id })} className={cx("border-b border-mist/60 last:border-0 cursor-pointer transition-colors hover:bg-pine-50/40", t.level === 3 && "bg-rust-100/25")}>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Avatar name={state.persons.find((p) => p.id === c.personId)?.name ?? "?"} size={26} /><div><p className="font-semibold leading-tight">{state.persons.find((p) => p.id === c.personId)?.name}</p><p className="num text-[10px] text-pine-700 font-semibold">{c.ref} · {state.banks.find((b) => b.id === c.bankId)?.short}</p></div></div></td>
                  <td className="px-3 py-2.5">{state.stages.find((s) => s.id === c.stage)?.name}</td>
                  <td className="px-3 py-2.5 num">{t.trigger ? fmtDate(t.trigger) : <span className="text-rust-600 font-semibold">not set</span>}</td>
                  <td className="px-3 py-2.5 num">{t.target ? fmtDate(t.target) : "—"}</td>
                  <td className="px-3 py-2.5 num">{t.trigger ? <>{t.elapsed}d{t.daysOver > 0 && <span className="text-rust-600 font-semibold"> (+{t.daysOver})</span>}</> : "—"}</td>
                  <td className="px-3 py-2.5"><span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[9.5px] font-display font-bold tracking-[0.06em]", lv.chip)}><span className={cx("w-1.5 h-1.5 rounded-full", lv.dot, t.level >= 2 && "pulse-dot")} />{lv.tag}</span></td>
                  <td className="px-3 py-2.5 text-[11.5px]">{state.users.find((u) => u.id === c.ownerId)?.name}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7}><EmptyState icon="timer" title="Nothing at this level" sub="Good news — no files here." /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
