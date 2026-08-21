import { useMemo, useState } from "react";
import type { Case, DocStatus, Task } from "../types";
import { useMe, useNav, useStore } from "../store";
import { emi, stageGates } from "../calc";
import { Avatar, Btn, DateInput, Drawer, DueChip, EmptyState, Field, Ic, KV, Modal, NumInput, Pill, Select, TextArea, TextInput, cx, daysUntil, fmtAED, fmtDate, fmtN, fmtPct, fmtTime, nowISO, todayISO, uid } from "../ui";

const DOC_STATUSES: { v: DocStatus; l: string; cls: string; on: string }[] = [
  { v: "MISSING", l: "Missing", cls: "text-ink-soft", on: "bg-gr-700 text-paper border-gr-700" },
  { v: "RECEIVED", l: "Received", cls: "text-amber-700", on: "bg-amber-500 text-white border-amber-500" },
  { v: "VERIFIED", l: "Verified", cls: "text-pine-700", on: "bg-pine-600 text-pine-50 border-pine-600" },
  { v: "REJECTED", l: "Rejected", cls: "text-rust-700", on: "bg-rust-500 text-white border-rust-500" },
  { v: "NA", l: "N/A", cls: "text-ink-soft", on: "bg-ink text-paper border-ink" },
];

export function CasesView() {
  const { state } = useStore();
  const nav = useNav();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [stageF, setStageF] = useState("ALL");
  const [ownerF, setOwnerF] = useState("ALL");

  const list = state.cases.filter((c) =>
    (status === "ALL" || c.status === status) &&
    (stageF === "ALL" || c.stage === stageF) &&
    (ownerF === "ALL" || c.ownerId === ownerF) &&
    (c.ref + (state.persons.find((p) => p.id === c.personId)?.name ?? "")).toLowerCase().includes(q.toLowerCase())
  );
  const personName = (id: string) => state.persons.find((p) => p.id === id)?.name ?? "—";
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4 anim-up">
        <div>
          <h1 className="font-display font-bold text-[26px] tracking-tight">Cases</h1>
          <p className="text-[13px] text-ink-soft mt-0.5">One case = one golden record. Open any file for Case 360.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative"><Ic n="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" /><TextInput className="pl-8 w-48" placeholder="Ref or client…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-40" value={status} onChange={(v) => setStatus(v as never)} options={[{ v: "ALL", l: "All statuses" }, { v: "OPEN", l: "Open" }, { v: "CLOSED", l: "Closed" }]} />
          <Select className="w-44" value={stageF} onChange={setStageF} options={[{ v: "ALL", l: "All stages" }, ...state.stages.map((s) => ({ v: s.id, l: s.name }))]} />
          <Select className="w-40" value={ownerF} onChange={setOwnerF} options={[{ v: "ALL", l: "All owners" }, ...state.users.map((u) => ({ v: u.id, l: u.name }))]} />
        </div>
      </div>
      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[13px] min-w-[980px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/60">
              <th className="px-4 py-2.5 font-semibold">Case</th><th className="px-3 py-2.5 font-semibold">Client</th>
              <th className="px-3 py-2.5 font-semibold">Bank · Product</th><th className="px-3 py-2.5 font-semibold">Finance</th>
              <th className="px-3 py-2.5 font-semibold">Stage</th><th className="px-3 py-2.5 font-semibold">Next action</th>
              <th className="px-3 py-2.5 font-semibold">Owner</th><th className="px-3 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c, i) => {
              const st = state.stages.find((s) => s.id === c.stage);
              const idx = state.stages.findIndex((s) => s.id === c.stage);
              const openQ = state.queries.some((qq) => qq.caseId === c.id && qq.status === "OPEN");
              return (
                <tr key={c.id} onClick={() => nav.go("cases", { caseId: c.id })}
                  className="border-b border-mist/60 last:border-0 hover:bg-pine-50/50 cursor-pointer transition-colors anim-up" style={{ animationDelay: `${i * 25}ms` }}>
                  <td className="px-4 py-3"><p className="num font-semibold text-pine-700">{c.ref}</p><p className="text-[10.5px] text-ink-soft">opened {fmtDate(c.createdAt)}</p></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar name={personName(c.personId)} size={26} /><div><p className="font-semibold leading-tight">{personName(c.personId)}</p>{c.deal && <p className="text-[10.5px] text-amber-700 font-medium">{c.deal}</p>}</div></div></td>
                  <td className="px-3 py-3"><p className="font-medium">{state.banks.find((b) => b.id === c.bankId)?.short} <span className="text-[10px] text-ink-soft font-normal">· {c.channel}</span></p><p className="text-[10.5px] text-ink-soft max-w-[170px] truncate">RM {c.bankRm ?? "—"}</p></td>
                  <td className="px-3 py-3">{c.loanAmount || c.propertyValue
                    ? <><p className="num font-semibold">{c.loanAmount ? fmtAED(c.loanAmount) : "—"}</p><p className="text-[10.5px] text-ink-soft">of {c.propertyValue ? fmtAED(c.propertyValue) : "—"}</p></>
                    : <span className="text-[11px] text-ink-soft/60 italic">not on tracker</span>}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Pill tone={c.status === "CLOSED" ? "gr" : idx >= 10 ? "pine" : idx >= 5 ? "steel" : "amber"}>{st?.name}</Pill>
                      {openQ && <Pill tone="steel" dot>QRY</Pill>}
                    </div>
                    <div className="flex gap-0.5 mt-1.5">{state.stages.map((s, j) => <span key={s.id} className={cx("h-[3px] w-3 rounded-full", j < idx ? "bg-pine-500" : j === idx ? "bg-ink" : "bg-ink/12")} />)}</div>
                  </td>
                  <td className="px-3 py-3"><p className="text-[12px] font-medium max-w-[180px] truncate">{c.nextAction ?? <span className="text-ink-soft/60">{c.status === "CLOSED" ? "—" : "not set"}</span>}</p>{c.status === "OPEN" && c.nextActionDue && <DueChip iso={c.nextActionDue} />}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-1.5"><Avatar name={userName(c.ownerId)} size={22} /><span className="text-[12px]">{userName(c.ownerId).split(" ")[0]}</span></div></td>
                  <td className="px-3 py-3"><Pill tone={c.status === "CLOSED" ? "gr" : "pine"} dot>{c.status}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <EmptyState icon="briefcase" title="No cases match" sub="Adjust filters or convert a lead to open a case." />}
      </div>
    </div>
  );
}

/* ================= CASE 360 ================= */

export function Case360({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe();
  const c = state.cases.find((x) => x.id === id);
  const [tab, setTab] = useState("docs");
  const [gateOpen, setGateOpen] = useState(false);
  const [editPanel, setEditPanel] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [queryModal, setQueryModal] = useState(false);

  const person = state.persons.find((p) => p.id === c?.personId);
  const stages = state.stages;
  const idx = c ? stages.findIndex((s) => s.id === c.stage) : -1;
  const def = c ? stages[idx] : undefined;

  const tasks = useMemo(() => (c ? state.tasks.filter((t) => t.caseId === c.id) : []), [state.tasks, c]);
  const queries = c ? state.queries.filter((qq) => qq.caseId === c.id) : [];
  const calcs = c ? state.calcs.filter((cc) => cc.linkId === c.id) : [];
  const activity = c ? state.audit.filter((a) => a.caseId === c.id) : [];
  const gates = c ? stageGates(state, c) : null;

  if (!c || !person || !def || !gates) return <EmptyState icon="briefcase" title="Case not found" />;

  const ageDays = Math.round((Date.now() - new Date(c.createdAt + "T00:00:00").getTime()) / 86400000);
  const monthly = emi(c.loanAmount, c.rate, c.tenureMonths);
  const ltv = (c.loanAmount / c.propertyValue) * 100;
  const isLast = idx === stages.length - 1;
  const userName = (id2: string) => state.users.find((u) => u.id === id2)?.name ?? "—";

  const docDone = c.docs.filter((d) => d.status === "VERIFIED" || d.status === "NA").length;

  const tiles: { k: string; v: React.ReactNode; sub?: React.ReactNode; tone?: string }[] = [
    { k: "Current stage", v: <span className="font-display font-bold text-[15px]">{def.name}</span>, sub: <span className="num text-[11px]">stage {idx + 1} of {stages.length} · SLA {def.sla}d</span> },
    { k: "Owner", v: <span className="flex items-center gap-2"><Avatar name={userName(c.ownerId)} size={22} /><span className="font-semibold text-[14px]">{userName(c.ownerId)}</span></span>, sub: state.users.find((u) => u.id === c.ownerId)?.team },
    { k: "Next action", v: <span className="font-semibold text-[13px]">{c.nextAction ?? <span className="text-rust-600">not set</span>}</span>, sub: c.nextActionDue ? <DueChip iso={c.nextActionDue} /> : <span className="text-[11px] text-rust-600 font-semibold">no due date</span> },
    { k: "Waiting for", v: <span className={cx("font-semibold text-[14px]", c.waitingFor ? "text-amber-700" : "text-ink-soft/60")}>{c.waitingFor ?? "—"}</span>, sub: c.pendingReason ? `reason: ${c.pendingReason}` : undefined },
    { k: "Blocker", v: <span className={cx("font-semibold text-[13px]", c.blocker ? "text-rust-600" : "text-ink-soft/60")}>{c.blocker ?? "none"}</span> },
    { k: "Ageing", v: <span className={cx("num text-[17px] font-semibold", ageDays > 45 ? "text-amber-700" : "")}>{ageDays}d</span>, sub: `opened ${fmtDate(c.createdAt)}` },
    { k: "Expected completion", v: <span className="num text-[14px] font-semibold">{c.expectedCompletion ? fmtDate(c.expectedCompletion) : "—"}</span> },
    { k: "Expected revenue", v: <span className="num text-[17px] font-semibold text-pine-700">{fmtAED(c.expectedRevenue)}</span>, sub: "fees on this file" },
  ];

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="anim-up">
        <button onClick={() => nav.go("cases")} className="inline-flex items-center gap-1 text-[12px] font-display font-semibold text-ink-soft hover:text-ink mb-2 focusable"><Ic n="chevL" size={14} /> All cases</button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display font-bold text-[26px] tracking-tight num">{c.ref}</h1>
              <Pill tone={c.status === "CLOSED" ? "gr" : "pine"} dot>{c.status}</Pill>
              <Pill tone="ink">{c.txType.replace("_", " + ")}</Pill>
            </div>
            <p className="text-[13px] text-ink-soft mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Avatar name={person.name} size={20} /> <span className="font-semibold text-ink">{person.name}</span>
              {c.deal && <Pill tone="amber">{c.deal}</Pill>}
              <span>· {state.banks.find((b) => b.id === c.bankId)?.name}</span>
              <span>· Bank RM: <strong className="text-ink">{c.bankRm ?? "—"}</strong></span>
              {c.channel && <span>· {c.channel}</span>}
              {c.outcome && <Pill tone={c.outcome === "WON" ? "green" : "gray"}>{c.outcome === "WON" ? "Won" : "Closed / lost"}</Pill>}
            </p>
          </div>
          <div className="flex gap-2">
            {c.status === "OPEN" && <>
              <Btn variant="outline" onClick={() => setEditPanel(true)}><Ic n="pen" size={14} /> Control panel</Btn>
              {isLast
                ? <Btn variant="dark" onClick={() => setGateOpen(true)}><Ic n="check" size={14} /> Close file</Btn>
                : <Btn disabled={!gates.pass} title={gates.pass ? "All gates passed" : "Stage gates not passed — review checklist"} onClick={() => setGateOpen(true)}><Ic n="arrowR" size={14} /> Advance stage</Btn>}
            </>}
          </div>
        </div>
      </div>

      {/* finance strip */}
      <div className="anim-up grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 bg-ink text-paper rounded-lg overflow-hidden" style={{ animationDelay: "60ms" }}>
        {[
          { k: "Property value", v: c.propertyValue ? fmtAED(c.propertyValue) : "—" },
          { k: "Loan amount", v: c.loanAmount ? fmtAED(c.loanAmount) : "—" },
          { k: "Applied LTV", v: c.loanAmount && c.propertyValue ? fmtPct(ltv, 1) : "—" },
          { k: "Rate", v: `${fmtN(c.rate, 2)}%` },
          { k: "Tenure", v: `${c.tenureMonths} mo` },
          { k: "Monthly EMI", v: c.loanAmount ? fmtAED(monthly) : "—" },
        ].map((x, i) => (
          <div key={x.k} className={cx("px-4 py-3", i > 0 && "border-l border-paper/10")}>
            <p className="text-[10px] uppercase tracking-[0.1em] font-display font-semibold text-paper/60">{x.k}</p>
            <p className="num text-[16px] font-semibold mt-0.5">{x.v}</p>
          </div>
        ))}
      </div>

      {/* control panel */}
      <div className="anim-up grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ animationDelay: "120ms" }}>
        {tiles.map((t, i) => (
          <div key={i} className="bg-card border border-mist rounded-lg px-3.5 py-3 hover:shadow-sm transition-shadow">
            <p className="text-[10px] uppercase tracking-[0.1em] font-display font-semibold text-ink-soft mb-1">{t.k}</p>
            <div className={t.tone}>{t.v}</div>
            {t.sub && <div className="text-[11px] text-ink-soft mt-0.5">{t.sub}</div>}
          </div>
        ))}
      </div>

      {/* stage rail */}
      <div className="anim-up bg-card border border-mist rounded-lg p-4 overflow-x-auto" style={{ animationDelay: "160ms" }}>
        <div className="flex items-center gap-1 min-w-max">
          {stages.map((s, j) => (
            <div key={s.id} className="flex items-center">
              <div title={s.name}
                className={cx("flex flex-col items-center gap-1 px-2 py-1.5 rounded-md border transition-all",
                  j < idx ? "border-pine-200 bg-pine-50" : j === idx ? "border-ink bg-ink text-paper shadow-md" : "border-mist bg-card opacity-70")}>
                <span className={cx("num text-[9px] font-semibold", j === idx ? "text-paper/60" : "text-ink-soft")}>{String(j + 1).padStart(2, "0")}</span>
                <span className={cx("font-display font-bold text-[11px] tracking-tight", j < idx && "text-pine-700")}>{s.short}</span>
              </div>
              {j < stages.length - 1 && <div className={cx("w-3 h-[2px]", j < idx ? "bg-pine-400" : "bg-ink/12")} />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2.5 text-[11px] text-ink-soft">
          <Ic n="layers" size={13} />
          <span>Stage history:</span>
          {c.stageHistory.slice(-5).map((h, i) => (
            <span key={i} className="num">{stages.find((s) => s.id === h.stageId)?.short} <span className="opacity-60">{fmtDate(h.at.slice(0, 10))}</span>{i < Math.min(c.stageHistory.length, 5) - 1 ? " →" : ""}</span>
          ))}
        </div>
      </div>

      {/* tabs */}
      <div className="anim-up bg-card border border-mist rounded-lg" style={{ animationDelay: "200ms" }}>
        <div className="px-4 pt-1">
          <div className="flex gap-1 border-b border-mist overflow-x-auto">
            {[
              { id: "docs", l: "Documents & QC", count: c.docs.length },
              { id: "tasks", l: "Tasks", count: tasks.filter((t) => t.status === "OPEN").length },
              { id: "queries", l: "Bank queries", count: queries.filter((qq) => qq.status === "OPEN").length },
              { id: "log", l: "Daily log", count: c.tracker?.length ?? 0 },
              { id: "calcs", l: "Calculations", count: calcs.length },
              { id: "activity", l: "Activity", count: activity.length },
            ].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cx("px-3.5 py-2.5 text-[13px] font-display font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap focusable",
                  tab === t.id ? "border-pine-600 text-pine-700" : "border-transparent text-ink-soft hover:text-ink")}>
                {t.l}<span className={cx("ml-1.5 text-[10px] num px-1.5 py-0.5 rounded-full", tab === t.id ? "bg-pine-100 text-pine-800" : "bg-ink/8 text-ink-soft")}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === "docs" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] text-ink-soft">Checklist is generated per stage from the workflow engine. No file uploads in V1 — status marks are the control. <span className="num font-semibold text-pine-700">{docDone}/{c.docs.length}</span> cleared.</p>
              </div>
              {stages.filter((s) => s.docs.length > 0 && c.stageHistory.some((h) => h.stageId === s.id)).map((s) => {
                const items = c.docs.filter((dd) => dd.stageId === s.id);
                if (!items.length) return null;
                const done = items.filter((dd) => dd.status === "VERIFIED" || dd.status === "NA").length;
                return (
                  <div key={s.id} className="mb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-display font-bold text-[12px] tracking-tight">{s.name}</span>
                      <span className={cx("num text-[10px] px-1.5 py-0.5 rounded-full", done === items.length ? "bg-pine-100 text-pine-800" : "bg-amber-100 text-amber-700")}>{done}/{items.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((dd) => {
                        const dt = state.docTypes.find((t) => t.id === dd.typeId);
                        return (
                          <div key={dd.id} className="flex flex-wrap items-center gap-3 bg-paper/60 border border-mist/70 rounded-md px-3 py-2">
                            <span className={cx("w-5 h-5 rounded-full border flex items-center justify-center shrink-0", dd.status === "VERIFIED" || dd.status === "NA" ? "bg-pine-600 border-pine-600 text-pine-50" : dd.status === "RECEIVED" ? "bg-amber-500 border-amber-500 text-white" : dd.status === "REJECTED" ? "bg-rust-500 border-rust-500 text-white" : "border-gr-300 text-transparent")}>
                              <Ic n="check" size={11} />
                            </span>
                            <div className="min-w-[160px] flex-1">
                              <p className="text-[13px] font-semibold">{dt?.name}</p>
                              <p className="text-[10.5px] text-ink-soft num">updated {fmtTime(dd.updatedAt)} by {userName(dd.updatedBy).split(" ")[0]}{dd.note ? ` · ${dd.note}` : ""}</p>
                            </div>
                            {c.status === "OPEN" && (
                              <div className="flex gap-1">
                                {DOC_STATUSES.map((st2) => (
                                  <button key={st2.v} onClick={() => dispatch({ t: "SET_DOC", caseId: c.id, docId: dd.id, status: st2.v })}
                                    className={cx("px-2 py-1 rounded border text-[10.5px] font-display font-semibold transition-all focusable",
                                      dd.status === st2.v ? st2.on : "bg-card border-mist text-ink-soft hover:border-ink/30")}>
                                    {st2.l}
                                  </button>
                                ))}
                              </div>
                            )}
                            {c.status !== "OPEN" && <Pill tone={dd.status === "VERIFIED" ? "pine" : dd.status === "RECEIVED" ? "amber" : "gr"}>{dd.status}</Pill>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {c.docs.length === 0 && <EmptyState icon="file" title="No documents required yet" sub="Document requirements appear as the case enters each stage." />}
            </div>
          )}

          {tab === "tasks" && (
            <div>
              <div className="flex justify-end mb-3">{c.status === "OPEN" && <Btn size="sm" onClick={() => setTaskModal(true)}><Ic n="plus" size={13} /> Add task</Btn>}</div>
              <div className="space-y-1.5">
                {tasks.map((t) => <TaskRow key={t.id} t={t} editable={c.status === "OPEN"} />)}
                {tasks.length === 0 && <EmptyState icon="clipboard" title="No tasks yet" />}
              </div>
            </div>
          )}

          {tab === "queries" && (
            <div>
              <div className="flex justify-end mb-3">{c.status === "OPEN" && <Btn size="sm" onClick={() => setQueryModal(true)}><Ic n="plus" size={13} /> Log bank query</Btn>}</div>
              <div className="space-y-2">
                {queries.map((qq) => (
                  <div key={qq.id} className={cx("border rounded-md px-3.5 py-3", qq.status === "OPEN" ? "border-steel-500/40 bg-steel-100/40" : "border-mist bg-paper/50")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="num font-bold text-[13px]">{qq.ref}</span>
                        <Pill tone={qq.status === "OPEN" ? "steel" : qq.status === "RESPONDED" ? "amber" : "gr"} dot>{qq.status}</Pill>
                        <span className="text-[11px] text-ink-soft">{state.banks.find((b) => b.id === qq.bankId)?.name}</span>
                      </div>
                      <div className="flex items-center gap-2"><DueChip iso={qq.due} /><Avatar name={userName(qq.ownerId)} size={20} /></div>
                    </div>
                    <p className="text-[13px] font-semibold mt-2">{qq.requirement}</p>
                    <p className="text-[11.5px] text-ink-soft mt-1 whitespace-pre-line">{qq.actionPoints}</p>
                    {qq.response && <p className="text-[12px] mt-2 bg-card border border-mist rounded px-2.5 py-1.5"><span className="font-display font-semibold text-[10.5px] uppercase tracking-wide text-ink-soft">Response · </span>{qq.response}</p>}
                    {c.status === "OPEN" && qq.status !== "CLOSED" && (
                      <div className="flex gap-2 mt-2">
                        {qq.status === "OPEN" && <Btn size="sm" variant="outline" onClick={() => dispatch({ t: "UPDATE_QUERY", id: qq.id, patch: { status: "RESPONDED", response: qq.response ?? "Response sent to bank" } })}><Ic n="send" size={12} /> Mark responded</Btn>}
                        <Btn size="sm" variant="dark" onClick={() => dispatch({ t: "UPDATE_QUERY", id: qq.id, patch: { status: "CLOSED", qc: qq.qc ?? `Verified by ${me?.name ?? ""}` } })}><Ic n="check" size={12} /> QC & close</Btn>
                      </div>
                    )}
                  </div>
                ))}
                {queries.length === 0 && <EmptyState icon="help" title="No bank queries" sub="Log a query when the bank raises a requirement on this file." />}
              </div>
            </div>
          )}

          {tab === "calcs" && (
            <div className="space-y-2">
              {calcs.map((cc) => (
                <div key={cc.id} className="border border-mist rounded-md px-3.5 py-3 bg-paper/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display font-bold text-[13px]">{cc.label}</p>
                    <span className="text-[10.5px] text-ink-soft num">{fmtTime(cc.at)} · {userName(cc.by).split(" ")[0]} · {cc.type}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
                    {Object.entries(cc.outputs).map(([k, v]) => (
                      <span key={k} className="text-[12px]"><span className="text-ink-soft capitalize">{k}: </span><span className="num font-semibold">{String(v)}</span></span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] font-display font-semibold uppercase tracking-wide text-ink-soft">Rule versions:</span>
                    {cc.rulesUsed.length ? cc.rulesUsed.map((r) => <span key={r.code} className="num text-[10.5px] bg-ink/6 rounded px-1.5 py-0.5">{r.code} v{r.version}</span>) : <span className="text-[11px] text-ink-soft">formula only</span>}
                  </div>
                </div>
              ))}
              {calcs.length === 0 && <EmptyState icon="calc" title="No saved calculations" sub="Run calculators from the Calculator Centre and attach them to this case." />}
              <div className="flex justify-end"><Btn size="sm" variant="outline" onClick={() => nav.go("calculators", { params: { calc: "affordability", personId: c.personId, propertyValue: c.propertyValue, caseId: c.id } })}><Ic n="calc" size={13} /> Run calculator for this case</Btn></div>
            </div>
          )}

          {tab === "log" && <DailyLogTab caze={c} />}

          {tab === "activity" && (
            <div className="space-y-3">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-3 anim-tick">
                  <span className="mt-1 w-2 h-2 rounded-full bg-pine-500 shrink-0" />
                  <div>
                    <p className="text-[12.5px]"><span className="font-semibold">{userName(a.by)}</span> · {a.action} — <span className="font-medium">{a.target}</span></p>
                    <p className="text-[10.5px] text-ink-soft num">{fmtTime(a.at)}{a.detail ? ` · ${a.detail}` : ""}</p>
                  </div>
                </div>
              ))}
              {activity.length === 0 && <EmptyState icon="clock" title="No recorded activity" />}
            </div>
          )}
        </div>
      </div>

      {/* gate modal */}
      <Modal open={gateOpen} onClose={() => setGateOpen(false)} width={520}
        title={isLast ? `Close ${c.ref} — closure gates` : `Advance ${c.ref} → ${gates.nextStage ? stages.find((s) => s.id === gates.nextStage)?.name : ""}`}
        footer={<>
          <Btn variant="ghost" onClick={() => setGateOpen(false)}>Cancel</Btn>
          {isLast
            ? <Btn variant="dark" disabled={!gates.pass} onClick={() => { dispatch({ t: "CLOSE_CASE", id: c.id }); setGateOpen(false); }}><Ic n="check" size={14} /> Close case</Btn>
            : <Btn disabled={!gates.pass} onClick={() => { dispatch({ t: "ADVANCE_STAGE", id: c.id }); setGateOpen(false); }}><Ic n="arrowR" size={14} /> Advance to {stages.find((s) => s.id === gates.nextStage)?.short}</Btn>}
        </>}>
        <p className="text-[12px] text-ink-soft mb-3">Evidence-based progression — the file only moves when every gate is green. Next stage tasks and document requirements are generated automatically.</p>
        <div className="space-y-1.5">
          {gates.checks.map((ch, i) => (
            <div key={i} className={cx("flex items-center justify-between px-3 py-2 rounded-md border", ch.pass ? "border-pine-200 bg-pine-50" : "border-rust-500/30 bg-rust-100/50")}>
              <span className="text-[12.5px] font-medium flex items-center gap-2">
                <span className={cx("w-4.5 h-4.5 rounded-full flex items-center justify-center", ch.pass ? "bg-pine-600 text-pine-50" : "bg-rust-500 text-white")} style={{ width: 18, height: 18 }}>
                  {ch.pass ? <Ic n="check" size={10} /> : <Ic n="x" size={10} />}
                </span>
                {ch.label}
              </span>
              <span className={cx("num text-[11px] font-semibold", ch.pass ? "text-pine-700" : "text-rust-600")}>{ch.detail}</span>
            </div>
          ))}
        </div>
      </Modal>

      {editPanel && <ControlPanelDrawer c={c} onClose={() => setEditPanel(false)} />}
      {taskModal && <AddTask caseId={c.id} stageId={c.stage} onClose={() => setTaskModal(false)} />}
      {queryModal && <AddQuery caze={c} onClose={() => setQueryModal(false)} />}
    </div>
  );
}

function TaskRow({ t, editable }: { t: Task; editable: boolean }) {
  const { state, dispatch } = useStore();
  const done = t.status === "DONE";
  return (
    <div className={cx("flex flex-wrap items-center gap-3 px-3 py-2 rounded-md border transition-all", done ? "border-mist/70 bg-paper/40 opacity-65" : "border-mist bg-paper/70 hover:border-ink/25")}>
      <button disabled={!editable} onClick={() => dispatch({ t: "UPDATE_TASK", id: t.id, patch: done ? { status: "OPEN", completedAt: undefined } : { status: "DONE", completedAt: nowISO() } })}
        className={cx("w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all focusable", done ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300 bg-card hover:border-pine-500")}>
        {done && <Ic n="check" size={11} />}
      </button>
      <div className="flex-1 min-w-[180px]">
        <p className={cx("text-[13px] font-semibold", done && "line-through")}>{t.title}</p>
        <p className="text-[10.5px] text-ink-soft num">{t.type} · {state.stages.find((s) => s.id === t.stageId)?.short} · {state.users.find((u) => u.id === t.ownerId)?.name}{t.waitingFor ? ` · waiting: ${t.waitingFor}` : ""}{t.pendingReason ? ` · ${t.pendingReason}` : ""}</p>
      </div>
      <Pill tone={t.priority === "HIGH" ? "rust" : t.priority === "MEDIUM" ? "amber" : "gr"}>{t.priority}</Pill>
      {done ? <span className="text-[11px] num text-ink-soft">done {fmtDate(t.completedAt?.slice(0, 10))}</span> : <DueChip iso={t.due} />}
    </div>
  );
}

function ControlPanelDrawer({ c, onClose }: { c: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [f, setF] = useState({
    ownerId: c.ownerId, nextAction: c.nextAction ?? "", nextActionDue: c.nextActionDue ?? todayISO(),
    waitingFor: c.waitingFor ?? "", pendingReason: c.pendingReason ?? "", blocker: c.blocker ?? "",
    expectedCompletion: c.expectedCompletion ?? "", expectedRevenue: c.expectedRevenue,
  });
  return (
    <Drawer open onClose={onClose} title={`Control panel · ${c.ref}`} width={440}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => { dispatch({ t: "PATCH_CASE", id: c.id, patch: { ...f, waitingFor: f.waitingFor || undefined, pendingReason: f.pendingReason || undefined, blocker: f.blocker || undefined, expectedCompletion: f.expectedCompletion || undefined, nextAction: f.nextAction || undefined, nextActionDue: f.nextActionDue || undefined } }); onClose(); }}>Save panel</Btn></>}>
      <p className="text-[12px] text-ink-soft mb-4 -mt-1">Every open case must have an owner, a next action and a due date.</p>
      <div className="space-y-4">
        <Field label="Owner"><Select value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
        <Field label="Next action"><TextInput value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.target.value })} placeholder="e.g. Chase valuation report" /></Field>
        <Field label="Next action due"><DateInput value={f.nextActionDue} onChange={(e) => setF({ ...f, nextActionDue: e.target.value })} /></Field>
        <Field label="Waiting for"><Select value={f.waitingFor} onChange={(v) => setF({ ...f, waitingFor: v })} options={[{ v: "", l: "— not waiting —" }, ...state.waitingTypes.map((w) => ({ v: w, l: w }))]} /></Field>
        <Field label="Why pending"><Select value={f.pendingReason} onChange={(v) => setF({ ...f, pendingReason: v })} options={[{ v: "", l: "— none —" }, ...state.pendingReasons.map((w) => ({ v: w, l: w }))]} /></Field>
        <Field label="Blocker"><TextInput value={f.blocker} onChange={(e) => setF({ ...f, blocker: e.target.value })} placeholder="Optional" /></Field>
        <Field label="Expected completion"><DateInput value={f.expectedCompletion} onChange={(e) => setF({ ...f, expectedCompletion: e.target.value })} /></Field>
        <Field label="Expected revenue"><NumInput value={f.expectedRevenue} onChange={(n) => setF({ ...f, expectedRevenue: n })} suffix="AED" /></Field>
      </div>
    </Drawer>
  );
}

function AddTask({ caseId, stageId, onClose }: { caseId: string; stageId: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ title: "", type: state.taskTypes[0], ownerId: me?.id ?? "", priority: "MEDIUM" as Task["priority"], due: todayISO(), stageId });
  return (
    <Modal open onClose={onClose} title="New task" width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.title.trim()} onClick={() => { dispatch({ t: "ADD_TASK", task: { id: "t" + uid(), caseId, stageId: f.stageId, type: f.type, title: f.title.trim(), ownerId: f.ownerId, priority: f.priority, due: f.due, status: "OPEN", createdAt: nowISO() } }); onClose(); }}>Create task</Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Task" req><TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Collect updated bank statements" /></Field></div>
        <Field label="Stage"><Select value={f.stageId} onChange={(v) => setF({ ...f, stageId: v })} options={state.stages.map((s) => ({ v: s.id, l: s.name }))} /></Field>
        <Field label="Type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={state.taskTypes.map((t) => ({ v: t, l: t }))} /></Field>
        <Field label="Owner"><Select value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
        <Field label="Priority"><Select value={f.priority} onChange={(v) => setF({ ...f, priority: v as Task["priority"] })} options={[{ v: "HIGH", l: "High" }, { v: "MEDIUM", l: "Medium" }, { v: "LOW", l: "Low" }]} /></Field>
        <Field label="Due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function AddQuery({ caze, onClose }: { caze: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ requirement: "", actionPoints: "", bankId: caze.bankId, due: todayISO() });
  const ref = "BQ-" + String(31 + state.queries.length).padStart(3, "0");
  return (
    <Modal open onClose={onClose} title={`Log bank query · ${ref}`} width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.requirement.trim()} onClick={() => { dispatch({ t: "ADD_QUERY", q: { id: "q" + uid(), caseId: caze.id, ref, bankId: f.bankId, requirement: f.requirement.trim(), actionPoints: f.actionPoints, ownerId: me?.id ?? "", receivedAt: nowISO(), due: f.due, status: "OPEN" } }); onClose(); }}>Log query</Btn></>}>
      <div className="space-y-4">
        <Field label="Bank requirement" req><TextArea value={f.requirement} onChange={(e) => setF({ ...f, requirement: e.target.value })} placeholder="e.g. Provide 6 months company bank statements" /></Field>
        <Field label="Action points"><TextArea value={f.actionPoints} onChange={(e) => setF({ ...f, actionPoints: e.target.value })} placeholder={"1. …\n2. …"} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bank"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v })} options={state.banks.map((b) => ({ v: b.id, l: b.name }))} /></Field>
          <Field label="Response due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function DailyLogTab({ caze }: { caze: Case }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [note, setNote] = useState("");
  const today = todayISO();
  const entries = [...(caze.tracker ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const todays = caze.tracker?.find((e) => e.date === today)?.note ?? "";
  const dates = state.trackerDates.includes(today) ? state.trackerDates : [...state.trackerDates, today].sort();
  return (
    <div className="space-y-4">
      <div className="border border-pine-200 bg-pine-50/60 rounded-md p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="font-display font-bold text-[13px] tracking-tight">Log today's position · <span className="num">{fmtDate(today)}</span></p>
          {todays && <Pill tone="green">logged</Pill>}
        </div>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { dispatch({ t: "SET_TRACKER", caseId: caze.id, date: today, note }); setNote(""); } }}
            placeholder={todays ? "Update today's note…" : "e.g. Pre-approval received — waiting for client confirmation…"}
            className="focusable flex-1 h-[34px] rounded-md border border-mist bg-card px-3 text-[12.5px]"
          />
          <Btn size="sm" disabled={!note.trim()} onClick={() => { dispatch({ t: "SET_TRACKER", caseId: caze.id, date: today, note }); setNote(""); }}>
            <Ic n="check" size={13} /> Save
          </Btn>
        </div>
        {todays && <p className="text-[11.5px] text-ink-soft mt-2">Current: <span className="text-ink font-medium">{todays}</span></p>}
      </div>

      <div>
        <p className="text-[10.5px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft mb-2">Daily log — {entries.length} entries</p>
        <div className="space-y-2.5">
          {entries.map((e) => (
            <div key={e.date} className="flex gap-3 anim-tick">
              <div className="flex flex-col items-center">
                <span className={cx("mt-0.5 w-2.5 h-2.5 rounded-full shrink-0", e.date === dates[dates.length - 1] ? "bg-pine-600" : "bg-pine-300")} />
                <span className="w-px flex-1 bg-mist" />
              </div>
              <div className="pb-1 min-w-0">
                <p className="num text-[11px] font-bold text-pine-700">{fmtDate(e.date)}{e.date === today && <span className="ml-2 text-[9.5px] uppercase tracking-wide bg-pine-600 text-paper rounded px-1.5 py-[1px]">today</span>}</p>
                <p className="text-[12.5px] leading-relaxed text-ink whitespace-pre-line">{e.note}</p>
              </div>
            </div>
          ))}
          {entries.length === 0 && <EmptyState icon="calendar" title="No daily log yet" sub="Log today's position above, or open the Daily Tracker board." />}
        </div>
      </div>
    </div>
  );
}
