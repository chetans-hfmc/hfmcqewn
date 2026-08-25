import { useMemo, useState } from "react";
import type { Case, DocStatus, Task } from "../types";
import { isOversight, teamOf, useMe, useNav, useStore } from "../store";
import { ESC_LEVELS, tatFor } from "../calc";
import { Avatar, Btn, DueChip, EmptyState, Ic, Pill, SectionHead, Select, TextArea, TextInput, cx, fmtDate, nowISO, todayISO, uid } from "../ui";

function scopedCases(state: ReturnType<typeof useStore>["state"], me: NonNullable<ReturnType<typeof useMe>>): Case[] {
  const seesAll = isOversight(me.role);
  const team = me.role === "TL" ? teamOf(state, me) : null;
  return state.cases.filter((c) => seesAll || (team ? team.has(c.ownerId) : c.ownerId === me.id));
}

/* ---------- Tasks ---------- */
export function TasksView() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [status, setStatus] = useState<"OPEN" | "DONE" | "ALL">("OPEN");
  const [owner, setOwner] = useState("ALL");
  const myCaseIds = new Set(scopedCases(state, me).map((c) => c.id));
  const tasks = state.tasks
    .filter((t) => myCaseIds.has(t.caseId))
    .filter((t) => (status === "ALL" ? true : t.status === status))
    .filter((t) => (owner === "ALL" ? true : t.ownerId === owner))
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const overdue = tasks.filter((t) => t.status === "OPEN" && t.due && t.due < todayISO()).length;
  return (
    <div className="space-y-4">
      <SectionHead title="Task engine" sub={`${tasks.filter((t) => t.status === "OPEN").length} open · ${overdue} overdue — every action has an owner and a due date.`}
        right={<div className="flex gap-2">
          <Select value={status} onChange={(v) => setStatus(v as typeof status)} className="w-[110px]" options={[{ v: "OPEN", l: "Open" }, { v: "DONE", l: "Done" }, { v: "ALL", l: "All" }]} />
          <Select value={owner} onChange={setOwner} className="w-[150px]" options={[{ v: "ALL", l: "All owners" }, ...state.users.map((u) => ({ v: u.id, l: u.name }))]} />
        </div>} />
      <div className="anim-up bg-card border border-mist rounded-lg overflow-hidden">
        {tasks.map((t) => {
          const c = state.cases.find((x) => x.id === t.caseId);
          const person = state.persons.find((p) => p.id === c?.personId);
          return (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-mist/60 last:border-0 hover:bg-paper/40 transition-colors">
              <button onClick={() => dispatch({ t: "UPDATE_TASK", id: t.id, patch: { status: t.status === "OPEN" ? "DONE" : "OPEN" } })}
                className={cx("focusable w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-all",
                  t.status === "DONE" ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300 hover:border-pine-600")}>
                {t.status === "DONE" && <Ic n="check" size={10} />}
              </button>
              <button onClick={() => nav.go("cases", { caseId: t.caseId })} className="flex-1 min-w-0 text-left focusable rounded">
                <span className={cx("block text-[12.5px] font-medium truncate", t.status === "DONE" && "line-through text-ink-soft")}>{t.title}</span>
                <span className="block text-[10.5px] text-ink-soft num">{c?.ref} · {person?.name} · {state.stages.find((s) => s.id === t.stageId)?.name}{t.waitingFor ? ` · waiting: ${t.waitingFor}` : ""}</span>
              </button>
              <Pill tone={t.priority === "HIGH" ? "rust" : t.priority === "MEDIUM" ? "amber" : "gr"}>{t.priority}</Pill>
              <div className="flex items-center gap-1.5"><Avatar name={state.users.find((u) => u.id === t.ownerId)?.name ?? "?"} size={20} /></div>
              {t.status === "OPEN" ? <DueChip iso={t.due} /> : <span className="num text-[10.5px] text-pine-700">done</span>}
            </div>
          );
        })}
        {tasks.length === 0 && <EmptyState icon="check" title="No tasks match" sub="Adjust the filters above." />}
      </div>
    </div>
  );
}

/* ---------- Documents & QC ---------- */
export function DocumentsView() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [status, setStatus] = useState<"ALL" | DocStatus>("ALL");
  const myCaseIds = new Set(scopedCases(state, me).map((c) => c.id));
  const rows = state.cases.filter((c) => myCaseIds.has(c.id))
    .flatMap((c) => c.docs.map((d) => ({ c, d })))
    .filter(({ d }) => (status === "ALL" ? true : d.status === status));
  const counts = (s: DocStatus) => rows.length ? state.cases.filter((c) => myCaseIds.has(c.id)).flatMap((c) => c.docs).filter((d) => d.status === s).length : 0;
  return (
    <div className="space-y-4">
      <SectionHead title="Documents & QC" sub="Mark received / verified — no file uploads needed. Status drives the stage gates."
        right={<Select value={status} onChange={(v) => setStatus(v as typeof status)} className="w-[140px]"
          options={[{ v: "ALL", l: "All" }, { v: "MISSING", l: `Missing (${counts("MISSING")})` }, { v: "RECEIVED", l: `Received (${counts("RECEIVED")})` }, { v: "VERIFIED", l: `Verified (${counts("VERIFIED")})` }, { v: "REJECTED", l: `Rejected (${counts("REJECTED")})` }, { v: "NA", l: "N/A" }]} />} />
      <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[700px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-4 py-2.5 font-semibold">Document</th>
              <th className="px-3 py-2.5 font-semibold">Case</th>
              <th className="px-3 py-2.5 font-semibold">Stage</th>
              <th className="px-3 py-2.5 font-semibold">Updated</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, d }) => (
              <tr key={d.id} className="border-b border-mist/60 last:border-0 hover:bg-paper/40 transition-colors">
                <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Ic n="file" size={14} className="text-ink-soft" /><span className="font-medium">{state.docTypes.find((t) => t.id === d.typeId)?.name ?? d.typeId}</span></div></td>
                <td className="px-3 py-2.5"><button onClick={() => nav.go("cases", { caseId: c.id, params: { tab: "docs" } })} className="focusable num text-[11px] font-bold text-pine-700 bg-pine-100 rounded px-1.5 py-0.5 hover:bg-pine-200 transition-colors">{c.ref}</button></td>
                <td className="px-3 py-2.5 text-[11.5px]">{state.stages.find((s) => s.id === d.stageId)?.name}</td>
                <td className="px-3 py-2.5 num text-[11px] text-ink-soft">{fmtDate(d.updatedAt.slice(0, 10))}</td>
                <td className="px-3 py-2.5">
                  <Select value={d.status} onChange={(v) => dispatch({ t: "SET_DOC", caseId: c.id, docId: d.id, status: v as DocStatus })} className="w-[125px] h-[30px] text-[12px]"
                    options={[{ v: "MISSING", l: "Missing" }, { v: "RECEIVED", l: "Received" }, { v: "VERIFIED", l: "Verified" }, { v: "REJECTED", l: "Rejected" }, { v: "NA", l: "N/A" }]} />
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5}><EmptyState icon="file" title="No documents match" /></td></tr>}
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
  const [status, setStatus] = useState<"OPEN" | "RESPONDED" | "CLOSED" | "ALL">("OPEN");
  const myCaseIds = new Set(scopedCases(state, me).map((c) => c.id));
  const queries = state.queries.filter((q) => myCaseIds.has(q.caseId)).filter((q) => (status === "ALL" ? true : q.status === status));
  return (
    <div className="space-y-4">
      <SectionHead title="Bank queries" sub="One case can have many queries — log, respond, QC and close each one."
        right={<Select value={status} onChange={(v) => setStatus(v as typeof status)} className="w-[130px]"
          options={[{ v: "OPEN", l: "Open" }, { v: "RESPONDED", l: "Responded" }, { v: "CLOSED", l: "Closed" }, { v: "ALL", l: "All" }]} />} />
      <div className="grid md:grid-cols-2 gap-3">
        {queries.map((q, i) => {
          const c = state.cases.find((x) => x.id === q.caseId);
          const person = state.persons.find((p) => p.id === c?.personId);
          return (
            <div key={q.id} className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-display font-bold text-[13.5px]">{q.ref} · {state.banks.find((b) => b.id === q.bankId)?.short}</p>
                <Pill tone={q.status === "OPEN" ? "amber" : q.status === "RESPONDED" ? "steel" : "pine"} dot>{q.status}</Pill>
              </div>
              <button onClick={() => nav.go("cases", { caseId: q.caseId, params: { tab: "queries" } })} className="focusable text-[11px] num text-pine-700 font-bold hover:underline mt-0.5">{c?.ref} · {person?.name}</button>
              <p className="text-[12.5px] mt-2 leading-snug">{q.requirement}</p>
              <p className="num text-[10.5px] text-ink-soft mt-1.5">received {fmtDate(q.receivedAt.slice(0, 10))}{q.due ? <> · due <DueChip iso={q.due} /></> : null}</p>
              {q.response && <p className="text-[11.5px] mt-2 border-l-2 border-steel-500 bg-steel-100/40 rounded-r px-3 py-1.5">{q.response}</p>}
              {q.status !== "CLOSED" && (
                <div className="flex gap-2 mt-3">
                  {q.status === "OPEN" && <Btn size="sm" variant="outline" onClick={() => dispatch({ t: "UPDATE_QUERY", id: q.id, patch: { status: "RESPONDED", response: "Response submitted to bank." } })}>Mark responded</Btn>}
                  <Btn size="sm" onClick={() => dispatch({ t: "UPDATE_QUERY", id: q.id, patch: { status: "CLOSED" } })}>QC & close</Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {queries.length === 0 && <div className="bg-card border border-mist rounded-lg"><EmptyState icon="help" title="No queries here" /></div>}
    </div>
  );
}

/* ---------- Morning Board (daily tracker) ---------- */
export function TrackerView() {
  const { state, dispatch } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [q, setQ] = useState("");
  const [span, setSpan] = useState<3 | 6 | 99>(3);
  const dates = state.trackerDates;
  const shown = span === 99 ? dates : dates.slice(-span);
  const today = todayISO();
  const cases = scopedCases(state, me).filter((c) => c.status === "OPEN");
  const filtered = cases.filter((c) => {
    const n = q.trim().toLowerCase();
    if (!n) return true;
    const p = state.persons.find((x) => x.id === c.personId)?.name ?? "";
    return [p, c.ref].join(" ").toLowerCase().includes(n);
  });
  const cellOf = (c: Case, date: string) => c.tracker?.find((e) => e.date === date)?.note ?? "";
  const unlogged = filtered.filter((c) => !cellOf(c, dates[dates.length - 1]));
  const [editing, setEditing] = useState<{ c: Case; date: string } | null>(null);
  const [val, setVal] = useState("");

  return (
    <div className="space-y-4">
      <SectionHead title="Morning board" sub="The daily stand-up wall — one row per file, one column per day. Click a cell to log."
        right={<div className="flex gap-2 items-center">
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-[180px]" />
          <Select value={String(span)} onChange={(v) => setSpan(parseInt(v) as 3 | 6 | 99)} className="w-[130px]"
            options={[{ v: "3", l: "Last 3 days" }, { v: "6", l: "Last 6 days" }, { v: "99", l: "All days" }]} />
        </div>} />

      <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 400 + shown.length * 230 }}>
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-3.5 py-2.5 font-semibold w-[280px] sticky left-0 bg-[#f2f4ec] z-10 border-r border-mist">File</th>
              {shown.map((dt) => (
                <th key={dt} className={cx("px-3 py-2.5 font-semibold whitespace-nowrap", dt === today && "text-pine-700")}>
                  {fmtDate(dt)}{dt === today && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-pine-600 align-middle" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const person = state.persons.find((p) => p.id === c.personId);
              return (
                <tr key={c.id} className="border-b border-mist/70 group">
                  <td className="px-3.5 py-2 sticky left-0 bg-card group-hover:bg-[#f4f7f0] transition-colors z-10 border-r border-mist align-top">
                    <button onClick={() => nav.go("cases", { caseId: c.id })} className="focusable text-left w-full rounded">
                      <div className="flex items-center gap-2">
                        <span className="num text-[10px] font-bold text-pine-700 bg-pine-100 rounded px-1.5 py-0.5 shrink-0">{c.ref}</span>
                        <span className="text-[10.5px] text-ink-soft">{state.stages.find((s) => s.id === c.stage)?.short}</span>
                      </div>
                      <p className="font-semibold text-[12.5px] mt-0.5 truncate">{person?.name}</p>
                    </button>
                  </td>
                  {shown.map((dt) => {
                    const v = cellOf(c, dt);
                    return (
                      <td key={dt} className={cx("px-1.5 py-1.5 align-top", dt === today && "bg-pine-50/50")}>
                        <button onClick={() => { setEditing({ c, date: dt }); setVal(v); }}
                          className={cx("focusable w-full min-h-[52px] rounded-md border px-2 py-1.5 text-left transition-all",
                            v ? "border-mist bg-paper/70 hover:border-pine-400 hover:shadow-sm" : "border-dashed border-mist/90 hover:border-pine-400 hover:bg-pine-50/60")}
                          title={v || `Log ${fmtDate(dt)}`}>
                          {v ? <span className="text-[10.5px] leading-snug line-clamp-4">{v}</span> : <span className="text-[10px] text-ink-soft/50 italic">— log</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={shown.length + 1} className="px-4 py-10 text-center text-ink-soft">No files match.</td></tr>}
          </tbody>
        </table>
      </div>

      {unlogged.length > 0 && (
        <div className="anim-up bg-amber-100/40 border border-amber-500/30 rounded-lg px-4 py-3">
          <p className="font-display font-bold text-[12.5px] text-amber-700 mb-2">Not logged on {fmtDate(dates[dates.length - 1])} ({unlogged.length})</p>
          <div className="flex flex-wrap gap-2">
            {unlogged.slice(0, 12).map((c) => (
              <button key={c.id} onClick={() => { setEditing({ c, date: dates[dates.length - 1] }); setVal(""); }}
                className="focusable num text-[11px] font-semibold bg-card border border-amber-500/40 rounded-md px-2.5 py-1.5 hover:border-pine-600 hover:shadow-sm transition-all">
                {c.ref}
              </button>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px] flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="bg-card rounded-lg shadow-2xl w-full max-w-[460px] anim-pop border border-mist p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-display font-bold text-[14px]">{editing.c.ref} · {fmtDate(editing.date)}</p>
              <button onClick={() => setEditing(null)} className="focusable p-1 rounded-md text-ink-soft hover:text-ink hover:bg-ink/6"><Ic n="x" size={14} /></button>
            </div>
            <TextArea autoFocus rows={4} value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. Sir Kiran is following up Dinesh — waiting for approval…" />
            <div className="flex justify-end gap-2 mt-3">
              <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn onClick={() => { dispatch({ t: "SET_TRACKER", caseId: editing.c.id, date: editing.date, note: val }); setEditing(null); }}><Ic n="check" size={13} /> Save</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- TAT & Escalation monitor ---------- */
export function TatView() {
  const { state } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [lvl, setLvl] = useState("ALL");
  const today = todayISO();
  const rows = useMemo(() => {
    const seenAll = isOversight(me.role);
    const team = me.role === "TL" ? teamOf(state, me) : null;
    return state.cases
      .filter((c) => c.status === "OPEN")
      .filter((c) => seenAll || (team ? team.has(c.ownerId) : c.ownerId === me.id))
      .map((c) => ({ c, t: tatFor(c, c.stage, state.stages, today) }))
      .filter(({ t }) => (lvl === "ALL" ? true : String(t.level) === lvl))
      .sort((a, b) => b.t.level - a.t.level || b.t.daysOver - a.t.daysOver);
  }, [state, me, lvl, today]);
  const counts = [0, 1, 2, 3].map((l) => state.cases.filter((c) => c.status === "OPEN" && tatFor(c, c.stage, state.stages, today).level === l).length);
  return (
    <div className="space-y-4">
      <SectionHead title="TAT & escalation" sub="Trigger date → SLA target → days over → automatic level. The ladder escalates to Kiran." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {ESC_LEVELS.map((m, i) => (
          <button key={m.level} onClick={() => setLvl(lvl === String(m.level) ? "ALL" : String(m.level))}
            className={cx("focusable anim-up text-left rounded-lg border px-3.5 py-3 transition-all",
              lvl === String(m.level) ? "border-ink shadow-md -translate-y-px" : "border-mist bg-card hover:border-ink/30 hover:-translate-y-px")}
            style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center justify-between">
              <span className={cx("inline-flex items-center gap-1.5 text-[9.5px] font-display font-bold tracking-[0.08em] px-2 py-[3px] rounded", m.chip)}>
                <span className={cx("w-1.5 h-1.5 rounded-full", m.dot)} />{m.tag}
              </span>
              <span className="num text-[20px] font-semibold leading-none">{counts[m.level]}</span>
            </div>
            <p className="text-[11px] font-semibold mt-1.5">{m.label}</p>
            <p className="text-[10px] text-ink-soft">{m.who}{m.copied !== "—" ? ` → cc ${m.copied}` : ""}</p>
          </button>
        ))}
      </div>
      <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto" style={{ animationDelay: "120ms" }}>
        <table className="w-full text-[12.5px] min-w-[760px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-4 py-2.5 font-semibold">Case</th>
              <th className="px-3 py-2.5 font-semibold">Stage</th>
              <th className="px-3 py-2.5 font-semibold">Trigger</th>
              <th className="px-3 py-2.5 font-semibold">Target</th>
              <th className="px-3 py-2.5 font-semibold">Elapsed</th>
              <th className="px-3 py-2.5 font-semibold">Level</th>
              <th className="px-3 py-2.5 font-semibold">Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, t }) => {
              const person = state.persons.find((p) => p.id === c.personId);
              const m = ESC_LEVELS[t.level];
              return (
                <tr key={c.id} onClick={() => nav.go("cases", { caseId: c.id, params: { tab: "tat" } })}
                  className={cx("border-b border-mist/60 last:border-0 hover:bg-pine-50/50 cursor-pointer transition-colors", t.level === 3 && "bg-rust-100/25")}>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className="num text-[10.5px] font-bold text-pine-700 bg-pine-100 rounded px-1.5 py-0.5">{c.ref}</span><span className="font-semibold truncate max-w-[150px]">{person?.name}</span></div></td>
                  <td className="px-3 py-2.5">{state.stages.find((s) => s.id === c.stage)?.name}</td>
                  <td className="px-3 py-2.5 num text-[11px]">{t.trigger ? fmtDate(t.trigger) : <span className="text-rust-600 font-semibold">not set</span>}</td>
                  <td className="px-3 py-2.5 num text-[11px]">{t.target ? fmtDate(t.target) : "—"}</td>
                  <td className="px-3 py-2.5 num">{t.trigger ? <><strong>{t.elapsed}d</strong>{t.daysOver > 0 ? <span className="text-rust-600 font-semibold"> (+{t.daysOver})</span> : <span className="text-pine-700"> ✓</span>}</> : "—"}</td>
                  <td className="px-3 py-2.5"><span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[9.5px] font-display font-bold", m.chip)}><span className={cx("w-1.5 h-1.5 rounded-full", m.dot, t.level >= 2 && "pulse-dot")} />{m.tag}</span></td>
                  <td className="px-3 py-2.5 text-[11.5px]">{state.users.find((u) => u.id === c.ownerId)?.name}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={7}><EmptyState icon="timer" title="Nothing at this level" sub="Good news — the ladder is quiet." /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
