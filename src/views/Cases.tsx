import { useMemo, useState } from "react";
import type { Case, DocStatus, Handoff, HandoffKind, Task } from "../types";
import { isOversight, teamOf, useMe, useNav, useStore } from "../store";
import { ESC_LEVELS, escalationEmail, stageGates, tatFor } from "../calc";
import { Avatar, Btn, DateInput, Drawer, DueChip, EmptyState, Field, Ic, KV, Modal, NumInput, Pill, Select, TextArea, TextInput, cx, fmtAED, fmtDate, fmtN, todayISO, uid, nowISO } from "../ui";

/* ---------- handoff modal ---------- */
export function HandoffModal({ caze, onClose }: { caze: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [toId, setToId] = useState("");
  const [kind, setKind] = useState<HandoffKind>("progression");
  const [reason, setReason] = useState("");
  const ready = toId && reason.trim().length >= 5;
  return (
    <Modal open onClose={onClose} title={`Hand off ${caze.ref}`} width={480}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!ready} onClick={() => { if (ready) { dispatch({ t: "HANDOFF_CASE", id: caze.id, toId, reason: reason.trim(), kind }); onClose(); } }}>
          <Ic n="arrowR" size={14} /> Hand off
        </Btn>
      </>}>
      <div className="space-y-4">
        <p className="text-[12.5px] text-ink-soft">Single active owner — the file moves to one person, and the custody chain is recorded in the audit trail.</p>
        <Field label="New owner" req>
          <Select value={toId} onChange={setToId} options={[{ v: "", l: "Select…" }, ...state.users.filter((u) => u.active && u.id !== caze.ownerId).map((u) => ({ v: u.id, l: `${u.name} — ${u.role}` }))]} />
        </Field>
        <Field label="Reason" req>
          <Select value={kind} onChange={(v) => setKind(v as HandoffKind)} options={[
            { v: "progression", l: "Stage progression" }, { v: "absence", l: "Leave / absence" },
            { v: "rebalance", l: "Rebalance" }, { v: "correction", l: "Return for correction" },
          ]} />
        </Field>
        <Field label="Note" req hint="min 5 characters">
          <TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Moving to FOL stage owner…" />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------- case overview drawer ---------- */
function CaseOverview({ c, onClose }: { c: Case; onClose: () => void }) {
  const { state } = useStore();
  const nav = useNav();
  const [handoff, setHandoff] = useState(false);
  const person = state.persons.find((p) => p.id === c.personId);
  const stage = state.stages.find((s) => s.id === c.stage);
  const t = tatFor(c, c.stage, state.stages, todayISO());
  const lv = ESC_LEVELS[t.level];
  const tasks = state.tasks.filter((x) => x.caseId === c.id);
  const openTasks = tasks.filter((x) => x.status === "OPEN");
  const queries = state.queries.filter((q) => q.caseId === c.id && q.status === "OPEN");
  const docs = c.docs.filter((d) => d.stageId === c.stage);
  const lastNote = c.tracker?.length ? c.tracker[c.tracker.length - 1] : undefined;
  return (
    <Drawer open onClose={onClose} title={<span className="flex items-center gap-2"><span className="num text-pine-700">{c.ref}</span> {person?.name}</span>} width={480}
      footer={<>
        <Btn variant="outline" onClick={() => setHandoff(true)}><Ic n="arrowR" size={13} /> Hand off</Btn>
        <Btn onClick={() => { nav.go("cases", { caseId: c.id }); onClose(); }}>Open Case 360</Btn>
      </>}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Pill tone={c.stage === "CLOSURE" || c.status === "CLOSED" ? "gr" : "pine"} dot>{stage?.name}</Pill>
          <span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[10px] font-display font-bold", lv.chip)}>
            <span className={cx("w-1.5 h-1.5 rounded-full", lv.dot)} />{lv.tag}
          </span>
        </div>
        <div className="bg-paper/60 border border-mist rounded-lg p-3.5">
          <KV k="Owner" v={<span className="flex items-center gap-1.5"><Avatar name={state.users.find((u) => u.id === c.ownerId)?.name ?? "?"} size={18} />{state.users.find((u) => u.id === c.ownerId)?.name}</span>} mono={false} />
          <KV k="Next action" v={c.nextAction ?? <span className="text-rust-600">not set</span>} mono={false} />
          <KV k="Due" v={c.nextActionDue ? fmtDate(c.nextActionDue) : "—"} />
          {c.waitingFor && <KV k="Waiting for" v={<span className="text-amber-700">{c.waitingFor}</span>} mono={false} />}
          {c.blocker && <KV k="Blocker" v={<span className="text-rust-600">{c.blocker}</span>} mono={false} />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card border border-mist rounded-lg px-3.5 py-2.5"><p className="text-[10px] uppercase tracking-wider text-ink-soft font-display font-bold">Loan</p><p className="num font-bold text-[16px] mt-0.5">{fmtAED(c.loanAmount)}</p></div>
          <div className="bg-card border border-mist rounded-lg px-3.5 py-2.5"><p className="text-[10px] uppercase tracking-wider text-ink-soft font-display font-bold">Property</p><p className="num font-bold text-[16px] mt-0.5">{fmtAED(c.propertyValue)}</p></div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-card border border-mist rounded-lg py-2.5"><p className="num font-bold text-[15px]">{docs.filter((d) => d.status === "VERIFIED" || d.status === "NA").length}/{docs.length}</p><p className="text-[10px] text-ink-soft">docs cleared</p></div>
          <div className="bg-card border border-mist rounded-lg py-2.5"><p className="num font-bold text-[15px]">{openTasks.length}</p><p className="text-[10px] text-ink-soft">open tasks</p></div>
          <div className="bg-card border border-mist rounded-lg py-2.5"><p className="num font-bold text-[15px]">{queries.length}</p><p className="text-[10px] text-ink-soft">queries</p></div>
        </div>
        {openTasks.slice(0, 3).map((tk) => (
          <div key={tk.id} className="flex items-center gap-2.5 border border-mist rounded-md px-3 py-2 text-[12px] bg-card">
            <Ic n="check" size={13} className="text-ink-soft" /><span className="flex-1 truncate">{tk.title}</span><DueChip iso={tk.due} />
          </div>
        ))}
        {lastNote && (
          <div className="border-l-2 border-pine-500 bg-paper/70 rounded-r px-3 py-2">
            <p className="num text-[10px] text-ink-soft font-semibold uppercase tracking-wide">Latest · {fmtDate(lastNote.date)}</p>
            <p className="text-[12px] mt-0.5 leading-snug">{lastNote.note}</p>
          </div>
        )}
        {(c.handoffs ?? []).length > 0 && (
          <div>
            <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-1.5">Custody chain</p>
            {[...(c.handoffs ?? [])].reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-[11.5px] py-1">
                <span className="font-semibold">{state.users.find((u) => u.id === h.fromId)?.name}</span>
                <Ic n="arrowR" size={11} className="text-pine-600" />
                <span className="font-semibold">{state.users.find((u) => u.id === h.toId)?.name}</span>
                <span className="text-[10px] text-ink-soft num ml-auto">{fmtDate(h.at.slice(0, 10))} · {h.kind}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {handoff && <HandoffModal caze={c} onClose={() => setHandoff(false)} />}
    </Drawer>
  );
}

/* ---------- cases list ---------- */
export function CasesView() {
  const { state } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [stageF, setStageF] = useState(() => (typeof nav.params.stage === "string" && nav.params.stage ? nav.params.stage : "ALL"));
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [overview, setOverview] = useState<Case | null>(null);

  const scoped = useMemo(() => {
    const seesAll = isOversight(me.role);
    const team = me.role === "TL" ? teamOf(state, me) : null;
    return state.cases.filter((c) => seesAll || (team ? team.has(c.ownerId) : c.ownerId === me.id));
  }, [state.cases, me, state]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped
      .filter((c) => (status === "ALL" ? true : c.status === status))
      .filter((c) => (stageF === "ALL" ? true : c.stage === stageF))
      .filter((c) => {
        if (!needle) return true;
        const p = state.persons.find((x) => x.id === c.personId)?.name ?? "";
        return [p, c.ref, c.deal ?? "", state.banks.find((b) => b.id === c.bankId)?.short ?? ""].join(" ").toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const sev = (c: Case) => {
          const dd = c.nextActionDue ? Math.round((new Date(c.nextActionDue + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000) : 99;
          return c.status === "CLOSED" ? 100 : dd;
        };
        return sev(a) - sev(b);
      });
  }, [scoped, q, status, stageF, state.persons, state.banks]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * perPage, cur * perPage);
  const stageCount = (sid: string) => scoped.filter((c) => c.status === "OPEN" && c.stage === sid).length;

  return (
    <div className="space-y-4">
      {/* pipeline strip */}
      <div className="anim-up flex gap-1 overflow-x-auto pb-1">
        {state.stages.map((s, i) => {
          const n = stageCount(s.id);
          const active = stageF === s.id;
          return (
            <button key={s.id} onClick={() => { setStageF(active ? "ALL" : s.id); setPage(1); }}
              className={cx("focusable group relative shrink-0 rounded-md border px-3 py-2 text-left transition-all duration-200 min-w-[92px]",
                active ? "bg-pine-700 border-pine-700 text-paper shadow-md" : n > 0 ? "bg-card border-mist hover:border-pine-600 hover:-translate-y-px" : "bg-card/60 border-mist/60 opacity-55 hover:opacity-80")}>
              <span className={cx("block num text-[9px] font-bold", active ? "text-pine-200" : "text-ink-soft")}>{String(i + 1).padStart(2, "0")} {s.short}</span>
              <span className={cx("block num font-bold text-[17px] leading-tight", active ? "text-paper" : "text-ink")}>{n}</span>
              <span className={cx("block text-[9px] truncate", active ? "text-pine-200" : "text-ink-soft")}>{s.name}</span>
            </button>
          );
        })}
        <button onClick={() => { setStatus(status === "OPEN" ? "CLOSED" : "OPEN"); setStageF("ALL"); setPage(1); }}
          className="focusable shrink-0 self-center rounded-md border border-dashed border-mist px-3 py-2 text-[11px] font-display font-bold text-ink-soft hover:border-ink hover:text-ink transition-colors">
          {status === "OPEN" ? "View closed" : "View open"}
        </button>
      </div>

      {/* toolbar */}
      <div className="anim-up flex flex-wrap items-center gap-2.5" style={{ animationDelay: "60ms" }}>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft"><Ic n="search" size={14} /></span>
          <TextInput value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search client, ref, bank…" className="pl-8 w-[240px]" />
        </div>
        <Select value={status} onChange={(v) => { setStatus(v as typeof status); setPage(1); }} className="w-[120px]" options={[{ v: "OPEN", l: "Open" }, { v: "CLOSED", l: "Closed" }, { v: "ALL", l: "All" }]} />
        <span className="ml-auto text-[11.5px] text-ink-soft num">Showing {filtered.length ? (cur - 1) * perPage + 1 : 0}–{Math.min(cur * perPage, filtered.length)} of {filtered.length}</span>
        <Select value={String(perPage)} onChange={(v) => { setPerPage(parseInt(v)); setPage(1); }} className="w-[110px]" options={[{ v: "10", l: "10 / page" }, { v: "25", l: "25 / page" }, { v: "50", l: "50 / page" }]} />
      </div>

      {/* table */}
      <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto" style={{ animationDelay: "120ms" }}>
        <table className="w-full text-[12.5px] min-w-[900px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-4 py-2.5 font-semibold">Case</th>
              <th className="px-3 py-2.5 font-semibold">Client</th>
              <th className="px-3 py-2.5 font-semibold">Stage</th>
              <th className="px-3 py-2.5 font-semibold">Bank</th>
              <th className="px-3 py-2.5 font-semibold">Loan</th>
              <th className="px-3 py-2.5 font-semibold">Owner</th>
              <th className="px-3 py-2.5 font-semibold">Next due</th>
              <th className="px-3 py-2.5 font-semibold">TAT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const person = state.persons.find((p) => p.id === c.personId);
              const stage = state.stages.find((s) => s.id === c.stage);
              const t = tatFor(c, c.stage, state.stages, todayISO());
              const lv = ESC_LEVELS[t.level];
              return (
                <tr key={c.id} onClick={() => setOverview(c)}
                  className="group border-b border-mist/60 last:border-0 hover:bg-pine-50/50 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="num text-[11px] font-bold text-pine-700 bg-pine-100 rounded px-1.5 py-0.5">{c.ref}</span>
                      {c.deal && <span className="text-[10.5px] text-amber-700 font-medium truncate max-w-[110px]">{c.deal}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar name={person?.name ?? "?"} size={24} /><span className="font-semibold truncate max-w-[160px]">{person?.name}</span></div></td>
                  <td className="px-3 py-3"><Pill tone={c.status === "CLOSED" ? "gr" : "pine"}>{stage?.short}</Pill></td>
                  <td className="px-3 py-3"><span className="font-medium">{state.banks.find((b) => b.id === c.bankId)?.short}</span>{c.channel && <span className="text-[10px] text-ink-soft ml-1">· {c.channel}</span>}</td>
                  <td className="px-3 py-3 num font-semibold">{c.loanAmount ? fmtAED(c.loanAmount) : "—"}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-1.5"><Avatar name={state.users.find((u) => u.id === c.ownerId)?.name ?? "?"} size={20} /><span className="text-[11.5px]">{state.users.find((u) => u.id === c.ownerId)?.name?.split(" ")[0]}</span></div></td>
                  <td className="px-3 py-3">{c.status === "OPEN" ? <DueChip iso={c.nextActionDue} /> : <span className="text-[11px] text-ink-soft">closed {fmtDate(c.closedAt)}</span>}</td>
                  <td className="px-3 py-3">
                    {c.status === "OPEN"
                      ? <span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[9.5px] font-display font-bold", lv.chip)}><span className={cx("w-1.5 h-1.5 rounded-full", lv.dot, t.level >= 2 && "pulse-dot")} />{lv.tag}</span>
                      : <Pill tone={c.outcome === "WON" ? "pine" : "gr"}>{c.outcome ?? "closed"}</Pill>}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={8}><EmptyState icon="briefcase" title="No cases match" sub="Adjust the filters or pipeline strip above." /></td></tr>}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {pages > 1 && (
        <div className="anim-up flex items-center justify-center gap-1.5">
          <button onClick={() => setPage(Math.max(1, cur - 1))} disabled={cur === 1} className="focusable p-1.5 rounded-md border border-mist bg-card disabled:opacity-40 hover:border-pine-600 transition-colors"><Ic n="chevL" size={14} /></button>
          {Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - cur) <= 1).map((p, i, arr) => (
            <span key={p} className="flex items-center gap-1.5">
              {i > 0 && arr[i - 1] !== p - 1 && <span className="text-ink-soft text-[11px]">…</span>}
              <button onClick={() => setPage(p)} className={cx("focusable num w-8 h-8 rounded-md border text-[12px] font-semibold transition-all", p === cur ? "bg-ink text-paper border-ink" : "bg-card border-mist hover:border-pine-600")}>{p}</button>
            </span>
          ))}
          <button onClick={() => setPage(Math.min(pages, cur + 1))} disabled={cur === pages} className="focusable p-1.5 rounded-md border border-mist bg-card disabled:opacity-40 hover:border-pine-600 transition-colors"><Ic n="chevR" size={14} /></button>
        </div>
      )}

      {overview && <CaseOverview c={overview} onClose={() => setOverview(null)} />}
    </div>
  );
}

/* ---------- Case 360 ---------- */
export function Case360({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe()!;
  const [tab, setTab] = useState(() => (typeof nav.params.tab === "string" ? nav.params.tab : "overview"));
  const [handoff, setHandoff] = useState(false);
  const [addTask, setAddTask] = useState(false);
  const [addQuery, setAddQuery] = useState(false);
  const [note, setNote] = useState("");
  const [trackNote, setTrackNote] = useState("");
  const [emailFor, setEmailFor] = useState<1 | 2 | 3 | null>(null);

  const c = state.cases.find((x) => x.id === id);
  if (!c) return <EmptyState icon="briefcase" title="Case not found" sub="It may have been deleted." />;
  const person = state.persons.find((p) => p.id === c.personId);
  const stageIdx = state.stages.findIndex((s) => s.id === c.stage);
  const stage = state.stages[stageIdx];
  const t = tatFor(c, c.stage, state.stages, todayISO());
  const gates = stageGates(c, state.stages, state.tasks, state.queries);
  const tasks = state.tasks.filter((x) => x.caseId === c.id);
  const queries = state.queries.filter((q) => q.caseId === c.id);
  const docs = c.docs;
  const canEdit = c.status === "OPEN";

  const TABS = [
    { id: "overview", l: "Overview" },
    { id: "docs", l: `Documents ${docs.length}` },
    { id: "tasks", l: `Tasks ${tasks.filter((x) => x.status === "OPEN").length}` },
    { id: "queries", l: `Queries ${queries.filter((x) => x.status === "OPEN").length}` },
    { id: "tat", l: "TAT" },
    { id: "log", l: `Log ${(c.tracker ?? []).length}` },
  ];

  const esc = emailFor != null && t.level >= (emailFor as number) ? escalationEmail(emailFor as 1 | 2 | 3, person?.name ?? "", state.banks.find((b) => b.id === c.bankId)?.short ?? "", stage?.name ?? "", c.ref, t.daysOver) : null;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="anim-up bg-card border border-mist rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="num text-[12px] font-bold text-pine-700 bg-pine-100 rounded px-2 py-0.5">{c.ref}</span>
              <h1 className="font-display font-bold text-[22px] tracking-tight leading-tight">{person?.name}</h1>
              {c.deal && <span className="text-[11px] text-amber-700 font-medium">{c.deal}</span>}
              <Pill tone={c.status === "CLOSED" ? "gr" : "pine"} dot>{c.status}</Pill>
            </div>
            <p className="text-[11.5px] text-ink-soft mt-1 num">
              {state.banks.find((b) => b.id === c.bankId)?.name} · {c.txType.replace(/_/g, " ")} · opened {fmtDate(c.createdAt)}
              {c.bankRm ? ` · RM ${c.bankRm}` : ""}{c.channel ? ` · ${c.channel}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {canEdit && <Btn variant="outline" size="sm" onClick={() => setHandoff(true)}><Ic n="arrowR" size={13} /> Hand off</Btn>}
            {canEdit && <Btn variant="outline" size="sm" onClick={() => setAddTask(true)}><Ic n="plus" size={13} /> Task</Btn>}
            {canEdit && gates.pass && stageIdx < state.stages.length - 1 && (
              <Btn size="sm" onClick={() => dispatch({ t: "ADVANCE_STAGE", id: c.id })}><Ic n="check" size={13} /> Advance to {gates.next?.short}</Btn>
            )}
            {canEdit && !gates.pass && (
              <Btn size="sm" disabled title="Clear documents, tasks, queries and conditions to advance"><Ic n="lock" size={13} /> Gates {gates.checks.filter((x) => x.pass).length}/{gates.checks.length}</Btn>
            )}
          </div>
        </div>

        {/* stage rail */}
        <div className="flex gap-[3px] mt-4">
          {state.stages.map((s, j) => (
            <span key={s.id} title={`${s.name}${j === stageIdx ? " (current)" : ""}`}
              className={cx("h-[5px] flex-1 rounded-full transition-colors", j < stageIdx ? "bg-pine-500" : j === stageIdx ? "bg-ink" : "bg-ink/12")} />
          ))}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10.5px] num text-ink-soft">stage {stageIdx + 1} of {state.stages.length} · SLA {stage?.sla}d{t.target ? ` · target ${fmtDate(t.target)}` : ""}</p>
          <span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[9.5px] font-display font-bold", ESC_LEVELS[t.level].chip)}>
            <span className={cx("w-1.5 h-1.5 rounded-full", ESC_LEVELS[t.level].dot, t.level >= 2 && "pulse-dot")} />{ESC_LEVELS[t.level].tag}
          </span>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-mist overflow-x-auto anim-up" style={{ animationDelay: "60ms" }}>
        {TABS.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={cx("relative px-3.5 py-2.5 text-[12.5px] font-display font-bold whitespace-nowrap transition-colors", tab === tb.id ? "text-ink" : "text-ink-soft hover:text-ink")}>
            {tb.l}
            {tab === tb.id && <span className="absolute left-2 right-2 -bottom-px h-[2.5px] rounded-full bg-pine-700" />}
          </button>
        ))}
      </div>

      <div className="anim-tick" key={tab}>
        {tab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-card border border-mist rounded-lg p-4">
                <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Control panel</p>
                <div className="grid grid-cols-2 gap-x-5">
                  <KV k="Owner" v={state.users.find((u) => u.id === c.ownerId)?.name ?? "—"} mono={false} />
                  <KV k="Next action" v={c.nextAction ?? <span className="text-rust-600">not set</span>} mono={false} />
                  <KV k="Due" v={c.nextActionDue ? fmtDate(c.nextActionDue) : "—"} />
                  <KV k="Waiting for" v={c.waitingFor ?? "—"} mono={false} />
                  <KV k="Pending reason" v={c.pendingReason ?? "—"} mono={false} />
                  <KV k="Blocker" v={c.blocker ?? "—"} mono={false} />
                </div>
                {canEdit && <ControlEditor c={c} />}
              </div>
              <div className="bg-card border border-mist rounded-lg p-4">
                <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Finance</p>
                <div className="grid grid-cols-2 gap-x-5">
                  <KV k="Property value" v={fmtAED(c.propertyValue)} />
                  <KV k="Loan amount" v={fmtAED(c.loanAmount)} />
                  <KV k="LTV" v={`${((c.loanAmount / Math.max(1, c.propertyValue)) * 100).toFixed(1)}%`} />
                  <KV k="Rate" v={`${c.rate}%`} />
                  <KV k="Tenure" v={`${c.tenureMonths} mo`} />
                  <KV k="Expected revenue" v={fmtAED(c.expectedRevenue)} />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-mist rounded-lg p-4">
                <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Stage gates</p>
                {gates.checks.map((g) => (
                  <div key={g.label} className="flex items-center gap-2.5 py-1.5 border-b border-mist/50 last:border-0">
                    <span className={cx("w-4 h-4 rounded-full flex items-center justify-center shrink-0", g.pass ? "bg-pine-600 text-pine-50" : "bg-rust-100 text-rust-600")}>
                      <Ic n={g.pass ? "check" : "x"} size={9} />
                    </span>
                    <span className="flex-1 text-[12px]">{g.label}</span>
                    <span className="num text-[10.5px] text-ink-soft">{g.detail}</span>
                  </div>
                ))}
                <p className={cx("text-[11px] mt-2.5 font-semibold", gates.pass ? "text-pine-700" : "text-ink-soft")}>
                  {gates.pass ? "All gates green — you can advance." : "Clear all gates to advance the stage."}
                </p>
              </div>
              <div className="bg-card border border-mist rounded-lg p-4">
                <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Stage history</p>
                {[...c.stageHistory].reverse().map((h, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-1.5 text-[12px]">
                    <span className="num text-[10px] font-bold text-pine-700 bg-pine-100 rounded px-1.5 py-0.5">{state.stages.find((s) => s.id === h.stageId)?.short}</span>
                    <span className="flex-1">{state.stages.find((s) => s.id === h.stageId)?.name}</span>
                    <span className="num text-[10.5px] text-ink-soft">{fmtDate(h.at.slice(0, 10))}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "docs" && (
          <div className="bg-card border border-mist rounded-lg overflow-hidden">
            {docs.map((d) => {
              const dt = state.docTypes.find((x) => x.id === d.typeId);
              const st = state.stages.find((s) => s.id === d.stageId);
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-mist/60 last:border-0 hover:bg-paper/40 transition-colors">
                  <Ic n="file" size={15} className="text-ink-soft" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-medium truncate">{dt?.name ?? d.typeId}</span>
                    <span className="block text-[10.5px] text-ink-soft num">{st?.name} · updated {fmtDate(d.updatedAt.slice(0, 10))}</span>
                  </span>
                  {canEdit ? (
                    <Select value={d.status} onChange={(v) => dispatch({ t: "SET_DOC", caseId: c.id, docId: d.id, status: v as DocStatus })} className="w-[130px] h-[30px] text-[12px]"
                      options={[{ v: "MISSING", l: "Missing" }, { v: "RECEIVED", l: "Received" }, { v: "VERIFIED", l: "Verified" }, { v: "REJECTED", l: "Rejected" }, { v: "NA", l: "N/A" }]} />
                  ) : <Pill tone={d.status === "VERIFIED" || d.status === "NA" ? "pine" : d.status === "RECEIVED" ? "amber" : d.status === "REJECTED" ? "rust" : "gr"}>{d.status}</Pill>}
                </div>
              );
            })}
            {docs.length === 0 && <EmptyState icon="file" title="No documents yet" sub="Documents are generated as the case advances through stages." />}
          </div>
        )}

        {tab === "tasks" && (
          <div className="bg-card border border-mist rounded-lg overflow-hidden">
            {tasks.map((tk) => (
              <div key={tk.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-mist/60 last:border-0 hover:bg-paper/40 transition-colors group">
                <button disabled={!canEdit} onClick={() => dispatch({ t: "UPDATE_TASK", id: tk.id, patch: { status: tk.status === "OPEN" ? "DONE" : "OPEN" } })}
                  className={cx("focusable w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-all",
                    tk.status === "DONE" ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300 hover:border-pine-600", !canEdit && "opacity-50 cursor-not-allowed")}>
                  {tk.status === "DONE" && <Ic n="check" size={10} />}
                </button>
                <span className="flex-1 min-w-0">
                  <span className={cx("block text-[12.5px] font-medium truncate", tk.status === "DONE" && "line-through text-ink-soft")}>{tk.title}</span>
                  <span className="block text-[10.5px] text-ink-soft num">{state.stages.find((s) => s.id === tk.stageId)?.name} · {state.users.find((u) => u.id === tk.ownerId)?.name}{tk.waitingFor ? ` · waiting: ${tk.waitingFor}` : ""}</span>
                </span>
                <Pill tone={tk.priority === "HIGH" ? "rust" : tk.priority === "MEDIUM" ? "amber" : "gr"}>{tk.priority}</Pill>
                {tk.status === "OPEN" ? <DueChip iso={tk.due} /> : <span className="num text-[10.5px] text-pine-700">done {fmtDate(tk.completedAt?.slice(0, 10))}</span>}
              </div>
            ))}
            {tasks.length === 0 && <EmptyState icon="check" title="No tasks yet" sub="Tasks are generated at each stage." />}
          </div>
        )}

        {tab === "queries" && (
          <div className="space-y-3">
            {canEdit && <div className="flex justify-end"><Btn size="sm" variant="outline" onClick={() => setAddQuery(true)}><Ic n="plus" size={13} /> Log query</Btn></div>}
            {queries.map((q) => (
              <div key={q.id} className="bg-card border border-mist rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display font-bold text-[13px]">{q.ref} · {state.banks.find((b) => b.id === q.bankId)?.short}</p>
                  <Pill tone={q.status === "OPEN" ? "amber" : q.status === "RESPONDED" ? "steel" : "pine"}>{q.status}</Pill>
                </div>
                <p className="text-[12.5px] mt-1.5">{q.requirement}</p>
                <p className="num text-[10.5px] text-ink-soft mt-1">received {fmtDate(q.receivedAt.slice(0, 10))}{q.due ? ` · due ${fmtDate(q.due)}` : ""}</p>
                {q.response && <p className="text-[12px] mt-2 border-l-2 border-steel-500 bg-steel-100/40 rounded-r px-3 py-1.5">{q.response}</p>}
                {canEdit && q.status === "OPEN" && (
                  <div className="flex gap-2 mt-3">
                    <Btn size="sm" variant="outline" onClick={() => dispatch({ t: "UPDATE_QUERY", id: q.id, patch: { status: "RESPONDED", response: "Response submitted to bank." } })}>Mark responded</Btn>
                    <Btn size="sm" onClick={() => dispatch({ t: "UPDATE_QUERY", id: q.id, patch: { status: "CLOSED" } })}>QC & close</Btn>
                  </div>
                )}
              </div>
            ))}
            {queries.length === 0 && <div className="bg-card border border-mist rounded-lg"><EmptyState icon="help" title="No bank queries" sub="Log a query when the bank requests clarification." /></div>}
          </div>
        )}

        {tab === "tat" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-card border border-mist rounded-lg p-4">
              <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Stage TAT</p>
              {state.stages.slice(0, stageIdx + 1).map((s) => {
                const st = tatFor(c, s.id, state.stages, todayISO());
                return (
                  <div key={s.id} className="py-2 border-b border-mist/50 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium">{s.name}</span>
                      <span className="num text-[11px] text-ink-soft">{st.trigger ? `${fmtDate(st.trigger)} → ${st.target ? fmtDate(st.target) : "—"}` : "not started"}</span>
                    </div>
                    {st.trigger && (
                      <p className={cx("num text-[11px] mt-0.5", st.daysOver > 0 ? "text-rust-600 font-semibold" : "text-pine-700")}>
                        {st.elapsed}d elapsed · {st.daysOver > 0 ? `${st.daysOver}d over` : `${Math.max(0, (st.target ? 0 : 0))}on track`} · SLA {s.sla}d
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-mist rounded-lg p-4">
                <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Escalation</p>
                {t.level === 0
                  ? <p className="text-[12.5px] text-ink-soft">On track — no escalation needed.</p>
                  : (
                    <div className="space-y-3">
                      <p className="text-[12.5px]"><span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[10px] font-display font-bold", ESC_LEVELS[t.level].chip)}>{ESC_LEVELS[t.level].tag}</span> <span className="text-ink-soft ml-1">{ESC_LEVELS[t.level].label}</span></p>
                      <p className="text-[11.5px] text-ink-soft">Send: {ESC_LEVELS[t.level].who}{ESC_LEVELS[t.level].copied !== "—" ? ` · cc ${ESC_LEVELS[t.level].copied}` : ""}</p>
                      <div className="flex gap-2">
                        {[1, 2, 3].filter((l) => l <= t.level).map((l) => (
                          <Btn key={l} size="sm" variant={l === t.level ? "dark" : "outline"} onClick={() => setEmailFor(l as 1 | 2 | 3)}>L{l} email</Btn>
                        ))}
                      </div>
                      {esc && emailFor != null && (
                        <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-body bg-paper/70 border border-mist rounded-md px-3 py-2.5">{`Subject: ${esc.subject}\n\n${esc.body}`}</pre>
                      )}
                    </div>
                  )}
              </div>
              {stage?.tatNote && (
                <div className="border-l-2 border-amber-500 bg-amber-100/50 rounded-r px-3.5 py-2.5">
                  <p className="text-[11px] font-display font-bold text-amber-700 uppercase tracking-wide mb-0.5">TAT note</p>
                  <p className="text-[12px] text-amber-700">{stage.tatNote}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "log" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-card border border-mist rounded-lg p-4">
              <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Daily log</p>
              {canEdit && (
                <div className="flex gap-2 mb-3">
                  <TextInput value={trackNote} onChange={(e) => setTrackNote(e.target.value)} placeholder={`Log today's position (${fmtDate(todayISO())})…`} />
                  <Btn disabled={!trackNote.trim()} onClick={() => { dispatch({ t: "SET_TRACKER", caseId: c.id, date: todayISO(), note: trackNote }); setTrackNote(""); }}>Log</Btn>
                </div>
              )}
              {(c.tracker ?? []).slice().reverse().map((e, i) => (
                <div key={i} className="border-l-2 border-pine-500 bg-paper/60 rounded-r px-3 py-2 mb-2">
                  <p className="num text-[10px] text-ink-soft font-semibold uppercase tracking-wide">{fmtDate(e.date)}</p>
                  <p className="text-[12px] mt-0.5 leading-snug">{e.note}</p>
                </div>
              ))}
              {(c.tracker ?? []).length === 0 && <p className="text-[12px] text-ink-soft">No daily log yet.</p>}
            </div>
            <div className="bg-card border border-mist rounded-lg p-4">
              <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Notes / clarifications</p>
              {canEdit && (
                <div className="flex gap-2 mb-3">
                  <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
                  <Btn disabled={!note.trim()} onClick={() => { dispatch({ t: "ADD_CASE_NOTE", caseId: c.id, text: note }); setNote(""); }}>Save</Btn>
                </div>
              )}
              {(c.caseNotes ?? []).slice().reverse().map((n) => (
                <div key={n.id} className="flex gap-2.5 py-2 border-b border-mist/50 last:border-0">
                  <Avatar name={state.users.find((u) => u.id === n.by)?.name ?? n.by} size={22} />
                  <div>
                    <p className="num text-[10px] text-ink-soft">{state.users.find((u) => u.id === n.by)?.name} · {fmtDate(n.at.slice(0, 10))}</p>
                    <p className="text-[12px] mt-0.5">{n.text}</p>
                  </div>
                </div>
              ))}
              {(c.caseNotes ?? []).length === 0 && <p className="text-[12px] text-ink-soft">No notes yet.</p>}
            </div>
          </div>
        )}
      </div>

      {handoff && <HandoffModal caze={c} onClose={() => setHandoff(false)} />}
      {addTask && <AddTaskModal caze={c} onClose={() => setAddTask(false)} />}
      {addQuery && <AddQueryModal caze={c} onClose={() => setAddQuery(false)} />}
    </div>
  );
}

function ControlEditor({ c }: { c: Case }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ nextAction: c.nextAction ?? "", nextActionDue: c.nextActionDue ?? todayISO(), waitingFor: c.waitingFor ?? "", pendingReason: c.pendingReason ?? "", blocker: c.blocker ?? "" });
  if (!open) return <button onClick={() => setOpen(true)} className="focusable mt-3 text-[11.5px] font-display font-bold text-pine-700 hover:underline inline-flex items-center gap-1"><Ic n="edit" size={12} /> Edit control panel</button>;
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-mist pt-3">
      <Field label="Next action"><TextInput value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.target.value })} /></Field>
      <Field label="Due"><DateInput value={f.nextActionDue} onChange={(e) => setF({ ...f, nextActionDue: e.target.value })} /></Field>
      <Field label="Waiting for"><Select value={f.waitingFor} onChange={(v) => setF({ ...f, waitingFor: v })} options={[{ v: "", l: "—" }, ...state.waitingTypes.map((w) => ({ v: w, l: w }))]} /></Field>
      <Field label="Pending reason"><Select value={f.pendingReason} onChange={(v) => setF({ ...f, pendingReason: v })} options={[{ v: "", l: "—" }, ...state.pendingReasons.map((w) => ({ v: w, l: w }))]} /></Field>
      <div className="col-span-2"><Field label="Blocker"><TextInput value={f.blocker} onChange={(e) => setF({ ...f, blocker: e.target.value })} placeholder="optional" /></Field></div>
      <div className="col-span-2 flex justify-end gap-2">
        <Btn size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
        <Btn size="sm" onClick={() => { dispatch({ t: "PATCH_CASE", id: c.id, patch: { ...f, waitingFor: f.waitingFor || undefined, pendingReason: f.pendingReason || undefined, blocker: f.blocker || undefined, nextAction: f.nextAction || undefined } }); setOpen(false); }}>Save</Btn>
      </div>
    </div>
  );
}

function AddTaskModal({ caze, onClose }: { caze: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ title: "", ownerId: me?.id ?? caze.ownerId, priority: "MEDIUM" as Task["priority"], due: todayISO(), estimateMinutes: 0 });
  return (
    <Modal open onClose={onClose} title="New task" width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.title.trim()} onClick={() => { dispatch({ t: "ADD_TASK", task: { id: "t" + uid(), caseId: caze.id, stageId: caze.stage, title: f.title.trim(), ownerId: f.ownerId, priority: f.priority, due: f.due, status: "OPEN", createdAt: nowISO(), estimateMinutes: f.estimateMinutes || undefined } }); onClose(); }}>Create</Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Task" req><TextInput autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Chase valuation report" /></Field></div>
        <Field label="Owner"><Select value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
        <Field label="Priority"><Select value={f.priority} onChange={(v) => setF({ ...f, priority: v as Task["priority"] })} options={[{ v: "HIGH", l: "High" }, { v: "MEDIUM", l: "Medium" }, { v: "LOW", l: "Low" }]} /></Field>
        <Field label="Due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        <Field label="Est. time (min)"><NumInput value={f.estimateMinutes} onChange={(n) => setF({ ...f, estimateMinutes: n })} suffix="min" /></Field>
      </div>
    </Modal>
  );
}

function AddQueryModal({ caze, onClose }: { caze: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [f, setF] = useState({ requirement: "", due: todayISO() });
  const ref = "BQ-" + (200 + state.queries.length + 1);
  return (
    <Modal open onClose={onClose} title={`Log bank query · ${ref}`} width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.requirement.trim()} onClick={() => { dispatch({ t: "ADD_QUERY", q: { id: "q" + uid(), caseId: caze.id, ref, bankId: caze.bankId, requirement: f.requirement.trim(), ownerId: caze.ownerId, receivedAt: nowISO(), due: f.due, status: "OPEN" } }); onClose(); }}>Log query</Btn></>}>
      <div className="space-y-4">
        <Field label="Bank requirement" req><TextArea autoFocus rows={3} value={f.requirement} onChange={(e) => setF({ ...f, requirement: e.target.value })} placeholder="e.g. Provide 6 months company bank statements" /></Field>
        <Field label="Response due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
