import { useMemo, useState } from "react";
import type { DocStatus, Task } from "../types";
import { useMe, useNav, useStore } from "../store";
import { Avatar, Btn, DateInput, DueChip, EmptyState, Field, Ic, Modal, Pill, SectionHead, Segmented, Select, TextArea, TextInput, cx, fmtDate, fmtTime, nowISO, todayISO, uid } from "../ui";

function useNames() {
  const { state } = useStore();
  return {
    person: (id: string) => state.persons.find((p) => p.id === id)?.name ?? "—",
    user: (id: string) => state.users.find((u) => u.id === id)?.name ?? "—",
    caze: (id: string) => state.cases.find((c) => c.id === id),
  };
}

/* ================= TASKS ================= */
export function TasksView() {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe();
  const n = useNames();
  const [status, setStatus] = useState<"OPEN" | "DONE" | "ALL">("OPEN");
  const [owner, setOwner] = useState("ALL");
  const [add, setAdd] = useState(false);

  const list = state.tasks
    .filter((t) => (status === "ALL" || t.status === status) && (owner === "ALL" || t.ownerId === owner))
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const overdue = state.tasks.filter((t) => t.status === "OPEN" && t.due && t.due < todayISO()).length;

  return (
    <div>
      <SectionHead title="Task engine" sub={`${state.tasks.filter((t) => t.status === "OPEN").length} open · ${overdue} overdue — every action in the operation is a task with an owner and a due date.`}
        right={<div className="flex gap-2">
          <Segmented value={status} onChange={setStatus} options={[{ v: "OPEN", l: "Open" }, { v: "DONE", l: "Done" }, { v: "ALL", l: "All" }]} />
          <Select className="w-40" value={owner} onChange={setOwner} options={[{ v: "ALL", l: "All owners" }, ...state.users.map((u) => ({ v: u.id, l: u.name }))]} />
          <Btn onClick={() => setAdd(true)}><Ic n="plus" size={14} /> Task</Btn>
        </div>} />
      <div className="space-y-1.5">
        {list.map((t, i) => {
          const c = n.caze(t.caseId);
          const done = t.status === "DONE";
          return (
            <div key={t.id} className={cx("anim-up flex flex-wrap items-center gap-3 px-3.5 py-2.5 rounded-lg border bg-card transition-all hover:shadow-sm", done ? "border-mist/70 opacity-60" : "border-mist")} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
              <button onClick={() => dispatch({ t: "UPDATE_TASK", id: t.id, patch: done ? { status: "OPEN", completedAt: undefined } : { status: "DONE", completedAt: nowISO() } })}
                className={cx("w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all focusable", done ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300 bg-card hover:border-pine-500 hover:bg-pine-50")}>
                {done && <Ic n="check" size={11} />}
              </button>
              <div className="flex-1 min-w-[220px]">
                <p className={cx("text-[13px] font-semibold", done && "line-through")}>{t.title}</p>
                <p className="text-[10.5px] text-ink-soft num">
                  {c?.ref} · {state.stages.find((s) => s.id === t.stageId)?.name} · {n.person(c?.personId ?? "")}{t.waitingFor ? ` · waiting: ${t.waitingFor}` : ""}{t.pendingReason ? ` · ${t.pendingReason}` : ""}
                </p>
              </div>
              <Pill tone={t.priority === "HIGH" ? "rust" : t.priority === "MEDIUM" ? "amber" : "gr"}>{t.priority}</Pill>
              <Avatar name={n.user(t.ownerId)} size={22} />
              {done ? <span className="text-[11px] num text-ink-soft w-24 text-right">{fmtDate(t.completedAt?.slice(0, 10))}</span> : <span className="w-[190px] text-right"><DueChip iso={t.due} /></span>}
              <button className="p-1.5 rounded-md hover:bg-ink/8 text-ink-soft" title="Open case" onClick={() => nav.go("cases", { caseId: t.caseId })}><Ic n="arrowR" size={14} /></button>
            </div>
          );
        })}
        {list.length === 0 && <EmptyState icon="clipboard" title="No tasks in this view" />}
      </div>
      {add && <GlobalAddTask onClose={() => setAdd(false)} />}
    </div>
  );
}

function GlobalAddTask({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ caseId: state.cases.find((c) => c.status === "OPEN")?.id ?? "", title: "", type: state.taskTypes[0], ownerId: me?.id ?? "", priority: "MEDIUM" as Task["priority"], due: todayISO() });
  const caze = state.cases.find((c) => c.id === f.caseId);
  return (
    <Modal open onClose={onClose} title="New task" width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.title.trim() || !f.caseId} onClick={() => { dispatch({ t: "ADD_TASK", task: { id: "t" + uid(), caseId: f.caseId, stageId: caze?.stage ?? "HANDOVER", type: f.type, title: f.title.trim(), ownerId: f.ownerId, priority: f.priority, due: f.due, status: "OPEN", createdAt: nowISO() } }); onClose(); }}>Create task</Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Case" req><Select value={f.caseId} onChange={(v) => setF({ ...f, caseId: v })} options={state.cases.filter((c) => c.status === "OPEN").map((c) => ({ v: c.id, l: `${c.ref} · ${state.persons.find((p) => p.id === c.personId)?.name}` }))} /></Field></div>
        <div className="col-span-2"><Field label="Task" req><TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
        <Field label="Type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={state.taskTypes.map((t) => ({ v: t, l: t }))} /></Field>
        <Field label="Owner"><Select value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
        <Field label="Priority"><Select value={f.priority} onChange={(v) => setF({ ...f, priority: v as Task["priority"] })} options={[{ v: "HIGH", l: "High" }, { v: "MEDIUM", l: "Medium" }, { v: "LOW", l: "Low" }]} /></Field>
        <Field label="Due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* ================= DOCUMENTS ================= */
export function DocumentsView() {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const n = useNames();
  const [status, setStatus] = useState<"ALL" | DocStatus>("ALL");
  const [q, setQ] = useState("");

  const rows = useMemo(() =>
    state.cases.flatMap((c) => c.docs.map((d) => ({ c, d })))
      .filter(({ c, d }) => (status === "ALL" || d.status === status) &&
        ((n.caze(c.id)?.ref ?? "") + (state.docTypes.find((t) => t.id === d.typeId)?.name ?? "")).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.d.updatedAt.localeCompare(a.d.updatedAt)),
    [state, status, q]);

  const counts = (["VERIFIED", "RECEIVED", "MISSING", "REJECTED", "NA"] as DocStatus[]).map((s) => ({ s, n: state.cases.flatMap((c) => c.docs).filter((d) => d.status === s).length }));

  return (
    <div>
      <SectionHead title="Documents & QC" sub="No file uploads in V1 — marking received / verified is the control. The checklist is generated per stage by the workflow engine."
        right={<div className="relative"><Ic n="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" /><TextInput className="pl-8 w-52" placeholder="Search ref or document…" value={q} onChange={(e) => setQ(e.target.value)} /></div>} />
      <div className="flex gap-1.5 mb-4 flex-wrap anim-up">
        {(["ALL", "VERIFIED", "RECEIVED", "MISSING", "REJECTED", "NA"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s as never)}
            className={cx("px-3 py-1.5 rounded-full text-[12px] font-display font-semibold border transition-all focusable",
              status === s ? "bg-ink text-paper border-ink" : "bg-card border-mist text-ink-soft hover:border-ink/30")}>
            {s === "ALL" ? "All" : s[0] + s.slice(1).toLowerCase()}
            <span className="ml-1.5 num text-[10px] opacity-70">{s === "ALL" ? state.cases.flatMap((c) => c.docs).length : counts.find((x) => x.s === s)?.n ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map(({ c, d }, i) => {
          const dt = state.docTypes.find((t) => t.id === d.typeId);
          const st = state.stages.find((s) => s.id === d.stageId);
          return (
            <div key={d.id} className="anim-up flex flex-wrap items-center gap-3 px-3.5 py-2.5 rounded-lg border border-mist bg-card hover:shadow-sm transition-all" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
              <span className={cx("w-2 h-8 rounded-full shrink-0", d.status === "VERIFIED" || d.status === "NA" ? "bg-pine-500" : d.status === "RECEIVED" ? "bg-amber-500" : d.status === "REJECTED" ? "bg-rust-500" : "bg-gr-300")} />
              <div className="flex-1 min-w-[200px]">
                <p className="text-[13px] font-semibold">{dt?.name}</p>
                <p className="text-[10.5px] text-ink-soft num">{c.ref} · {st?.name} · updated {fmtTime(d.updatedAt)} by {n.user(d.updatedBy).split(" ")[0]}{d.note ? ` · ${d.note}` : ""}</p>
              </div>
              <Select className="w-32" value={d.status} onChange={(v) => dispatch({ t: "SET_DOC", caseId: c.id, docId: d.id, status: v as DocStatus })}
                options={[{ v: "MISSING", l: "Missing" }, { v: "RECEIVED", l: "Received" }, { v: "VERIFIED", l: "Verified" }, { v: "REJECTED", l: "Rejected" }, { v: "NA", l: "N/A" }]} />
              <button className="p-1.5 rounded-md hover:bg-ink/8 text-ink-soft" onClick={() => nav.go("cases", { caseId: c.id })}><Ic n="arrowR" size={14} /></button>
            </div>
          );
        })}
        {rows.length === 0 && <EmptyState icon="file" title="No documents in this view" />}
      </div>
    </div>
  );
}

/* ================= BANK QUERIES ================= */
export function QueriesView() {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe();
  const n = useNames();
  const [status, setStatus] = useState<"ALL" | "OPEN" | "RESPONDED" | "CLOSED">("ALL");
  const [add, setAdd] = useState(false);

  const list = state.queries.filter((qq) => status === "ALL" || qq.status === status)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return (
    <div>
      <SectionHead title="Bank queries" sub="One case can carry several queries — each with a requirement, action points, evidence and QC before closure."
        right={<div className="flex gap-2">
          <Segmented value={status} onChange={setStatus} options={[{ v: "ALL", l: "All" }, { v: "OPEN", l: "Open" }, { v: "RESPONDED", l: "Responded" }, { v: "CLOSED", l: "Closed" }]} />
          <Btn onClick={() => setAdd(true)}><Ic n="plus" size={14} /> Query</Btn>
        </div>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {list.map((qq, i) => {
          const c = n.caze(qq.caseId);
          return (
            <div key={qq.id} className={cx("anim-up border rounded-lg p-4 bg-card transition-all hover:shadow-md", qq.status === "OPEN" ? "border-steel-500/40" : "border-mist")} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="num font-bold text-[14px]">{qq.ref}</span>
                  <Pill tone={qq.status === "OPEN" ? "steel" : qq.status === "RESPONDED" ? "amber" : "gr"} dot>{qq.status}</Pill>
                </div>
                <button className="num text-[11.5px] font-semibold text-pine-700 hover:underline" onClick={() => nav.go("cases", { caseId: qq.caseId })}>{c?.ref} · {n.person(c?.personId ?? "")}</button>
              </div>
              <p className="text-[13.5px] font-semibold mt-2.5">{qq.requirement}</p>
              {qq.actionPoints && <p className="text-[11.5px] text-ink-soft mt-1 whitespace-pre-line">{qq.actionPoints}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-[11px] text-ink-soft">{state.banks.find((b) => b.id === qq.bankId)?.name}</span>
                <Avatar name={n.user(qq.ownerId)} size={20} />
                <span className="text-[11px] text-ink-soft">received {fmtDate(qq.receivedAt.slice(0, 10))}</span>
                <span className="ml-auto"><DueChip iso={qq.due} /></span>
              </div>
              {qq.response && <p className="text-[12px] mt-2.5 bg-paper/70 border border-mist rounded px-2.5 py-1.5"><span className="font-display font-semibold text-[10px] uppercase tracking-wide text-ink-soft">Response · </span>{qq.response}{qq.qc ? <span className="text-ink-soft"> — {qq.qc}</span> : null}</p>}
              {qq.status !== "CLOSED" && (
                <div className="flex gap-2 mt-3">
                  {qq.status === "OPEN" && <Btn size="sm" variant="outline" onClick={() => dispatch({ t: "UPDATE_QUERY", id: qq.id, patch: { status: "RESPONDED", response: qq.response ?? "Response sent to bank" } })}><Ic n="send" size={12} /> Mark responded</Btn>}
                  <Btn size="sm" variant="dark" onClick={() => dispatch({ t: "UPDATE_QUERY", id: qq.id, patch: { status: "CLOSED", qc: qq.qc ?? `Verified by ${me?.name ?? "TL"}` } })}><Ic n="check" size={12} /> QC & close</Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {list.length === 0 && <EmptyState icon="help" title="No queries in this view" />}
      {add && <GlobalAddQuery onClose={() => setAdd(false)} />}
    </div>
  );
}

function GlobalAddQuery({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const open = state.cases.filter((c) => c.status === "OPEN");
  const [f, setF] = useState({ caseId: open[0]?.id ?? "", requirement: "", actionPoints: "", due: todayISO() });
  const caze = state.cases.find((c) => c.id === f.caseId);
  const ref = "BQ-" + String(31 + state.queries.length).padStart(3, "0");
  return (
    <Modal open onClose={onClose} title={`Log bank query · ${ref}`} width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.requirement.trim() || !f.caseId} onClick={() => { dispatch({ t: "ADD_QUERY", q: { id: "q" + uid(), caseId: f.caseId, ref, bankId: caze?.bankId ?? state.banks[0].id, requirement: f.requirement.trim(), actionPoints: f.actionPoints, ownerId: me?.id ?? "", receivedAt: nowISO(), due: f.due, status: "OPEN" } }); onClose(); }}>Log query</Btn></>}>
      <div className="space-y-4">
        <Field label="Case" req><Select value={f.caseId} onChange={(v) => setF({ ...f, caseId: v })} options={open.map((c) => ({ v: c.id, l: `${c.ref} · ${state.persons.find((p) => p.id === c.personId)?.name}` }))} /></Field>
        <Field label="Bank requirement" req><TextArea value={f.requirement} onChange={(e) => setF({ ...f, requirement: e.target.value })} /></Field>
        <Field label="Action points"><TextArea value={f.actionPoints} onChange={(e) => setF({ ...f, actionPoints: e.target.value })} /></Field>
        <Field label="Response due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
