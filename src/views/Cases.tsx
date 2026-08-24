import { useMemo, useState } from "react";
import type { Case, Handoff } from "../types";
import { useMe, useNav, useStore, isOversight, teamOf } from "../store";
import { ESC_LEVELS, emi, escalationEmail, stageGates, tatFor, fmtDur } from "../calc";
import { Avatar, Btn, DateInput, DangerModal, Drawer, DueChip, EmptyState, Field, Ic, KV, Modal, NumInput, Pill, Select, TextArea, TextInput, cx, fmtAED, fmtDate, fmtTime, todayISO, uid } from "../ui";

/* ---------- handoff modal (single-active-owner transfer) ---------- */
export function HandoffModal({ caze, onClose }: { caze: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [toId, setToId] = useState("");
  const [kind, setKind] = useState<Handoff["kind"]>("progression");
  const [reason, setReason] = useState("");
  const to = state.users.find((u) => u.id === toId);
  return (
    <Modal open onClose={onClose} title={`Hand off ${caze.ref}`} width={480}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!toId || reason.trim().length < 3} onClick={() => { dispatch({ t: "HANDOFF_CASE", id: caze.id, toId, reason: reason.trim(), kind }); onClose(); }}>
          <Ic n="arrowR" size={13} /> Transfer ownership
        </Btn>
      </>}>
      <p className="text-[12.5px] text-ink-soft mb-4">A file has exactly one active owner. This records the custody change in the audit trail.</p>
      <div className="space-y-4">
        <Field label="Hand to" req>
          <Select value={toId} onChange={setToId} options={[{ v: "", l: "Select owner…" }, ...state.users.filter((u) => u.active && u.id !== caze.ownerId && (u.role === "SPO" || u.role === "VRM" || u.role === "TL")).map((u) => ({ v: u.id, l: `${u.name} · ${u.team}` }))]} />
        </Field>
        <Field label="Reason" req>
          <Select value={kind} onChange={(v) => setKind(v as Handoff["kind"])} options={[
            { v: "progression", l: "Stage progression" }, { v: "absence", l: "Leave / absence cover" },
            { v: "rebalance", l: "Workload rebalance" }, { v: "correction", l: "Return for correction" },
          ]} />
        </Field>
        <Field label="Note" req><TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Vijay on leave — please cover this file" /></Field>
        {to && <p className="text-[12px] text-pine-800 bg-pine-50 border border-pine-200 rounded-md px-3 py-2">Ownership moves to <strong>{to.name}</strong> ({to.team}). They'll see it in their inbox and alerts.</p>}
      </div>
    </Modal>
  );
}

/* ---------- pipeline strip ---------- */
function PipelineStrip({ stage, setStage }: { stage: string; setStage: (s: string) => void }) {
  const { state } = useStore();
  const open = state.cases.filter((c) => c.status === "OPEN");
  const max = Math.max(1, ...state.stages.map((s) => open.filter((c) => c.stage === s.id).length));
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 anim-up">
      {state.stages.map((s, i) => {
        const n = open.filter((c) => c.stage === s.id).length;
        const active = stage === s.id;
        return (
          <button key={s.id} onClick={() => setStage(active ? "ALL" : s.id)} title={`${s.name} — ${n} open`}
            className={cx("group shrink-0 min-w-[64px] rounded-md border px-2.5 py-2 text-left transition-all",
              active ? "bg-pine-700 border-pine-700 text-paper shadow-md" : "bg-card border-mist hover:border-pine-500 hover:-translate-y-px")}>
            <span className={cx("block num text-[9.5px] font-bold", active ? "text-pine-200" : "text-ink-soft")}>{String(i + 1).padStart(2, "0")}</span>
            <span className={cx("block font-display font-bold text-[11px] tracking-tight truncate", active ? "text-paper" : "text-ink")}>{s.short}</span>
            <span className="mt-1 block h-[3px] rounded-full bg-ink/10 overflow-hidden">
              <span className={cx("block h-full rounded-full transition-all", active ? "bg-pine-300" : "bg-pine-600")} style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className={cx("block num text-[10px] font-semibold mt-0.5", active ? "text-paper" : "text-pine-700")}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- case overview drawer (L2.5) ---------- */
function CaseOverview({ caze, onClose }: { caze: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const [handoff, setHandoff] = useState(false);
  const person = state.persons.find((p) => p.id === caze.personId);
  const def = state.stages.find((s) => s.id === caze.stage);
  const idx = state.stages.findIndex((s) => s.id === caze.stage);
  const t = tatFor(caze, caze.stage, state.stages, todayISO());
  const lv = ESC_LEVELS[t.level];
  const tasks = state.tasks.filter((x) => x.caseId === caze.id);
  const queries = state.queries.filter((x) => x.caseId === caze.id);
  const owner = state.users.find((u) => u.id === caze.ownerId);
  const ltv = caze.propertyValue ? (caze.loanAmount / caze.propertyValue) * 100 : 0;
  return (
    <Drawer open onClose={onClose} title={<span className="flex items-center gap-2">{caze.ref}<Pill tone={caze.status === "CLOSED" ? "gr" : "pine"} dot>{caze.status}</Pill></span>} width={500}
      footer={<>
        <Btn variant="outline" onClick={() => setHandoff(true)}><Ic n="arrowR" size={13} /> Hand off</Btn>
        <Btn onClick={() => nav.go("cases", { caseId: caze.id })}><Ic n="eye" size={14} /> Open Case 360</Btn>
      </>}>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-3">
            <Avatar name={person?.name ?? "?"} size={44} />
            <div className="min-w-0">
              <p className="font-display font-bold text-[17px] tracking-tight leading-tight">{person?.name}{caze.deal ? <span className="text-ink-soft font-medium"> · {caze.deal}</span> : null}</p>
              <p className="num text-[11px] text-ink-soft mt-0.5">{state.banks.find((b) => b.id === caze.bankId)?.name} · RM {caze.bankRm ?? "—"} · {caze.channel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[10px] font-display font-bold tracking-[0.06em]", lv.chip)}>
              <span className={cx("w-1.5 h-1.5 rounded-full", lv.dot)} />{lv.tag}
            </span>
            <span className="text-[11.5px] text-ink-soft num">{def?.name} · stage {idx + 1}/{state.stages.length}{t.target ? ` · target ${fmtDate(t.target)}` : ""}</span>
          </div>
          <div className="flex gap-[3px] mt-2.5">{state.stages.map((s, j) => <span key={s.id} className={cx("h-[4px] flex-1 rounded-full", j < idx ? "bg-pine-500" : j === idx ? "bg-ink" : "bg-ink/12")} />)}</div>
        </div>

        <div className="grid grid-cols-2 gap-x-5">
          <KV k="Owner" v={<span className="flex items-center gap-1.5 justify-end"><Avatar name={owner?.name ?? "?"} size={16} />{owner?.name.split(" ")[0]}</span>} mono={false} />
          <KV k="Next action" v={caze.nextAction ?? <span className="text-rust-600">none</span>} mono={false} />
          <KV k="Due" v={caze.nextActionDue ? <DueChip iso={caze.nextActionDue} /> : "—"} mono={false} />
          <KV k="Waiting for" v={caze.waitingFor ?? "—"} mono={false} />
          <KV k="Loan" v={caze.loanAmount ? fmtAED(caze.loanAmount) : "—"} />
          <KV k="LTV" v={ltv ? `${ltv.toFixed(0)}%` : "—"} />
          <KV k="EMI" v={caze.loanAmount ? fmtAED(emi(caze.loanAmount, caze.rate, caze.tenureMonths)) : "—"} />
          <KV k="Docs" v={`${caze.docs.filter((d) => d.status === "VERIFIED").length}/${caze.docs.filter((d) => d.status !== "NA").length} verified`} mono={false} />
        </div>

        <div>
          <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-2">Open tasks ({tasks.filter((x) => x.status === "OPEN").length})</p>
          <div className="space-y-1.5">
            {tasks.filter((x) => x.status === "OPEN").slice(0, 3).map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-3 border border-mist rounded-md px-3 py-2 text-[12px]">
                <span className="truncate">{x.title}</span><DueChip iso={x.due} />
              </div>
            ))}
            {tasks.filter((x) => x.status === "OPEN").length === 0 && <p className="text-[11.5px] text-ink-soft italic">No open tasks.</p>}
          </div>
        </div>

        {(caze.handoffs ?? []).length > 0 && (
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-2">Custody chain</p>
            {[...(caze.handoffs ?? [])].reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-[11.5px] py-1">
                <span className="font-semibold">{state.users.find((u) => u.id === h.fromId)?.name}</span>
                <Ic n="arrowR" size={11} className="text-pine-600" />
                <span className="font-semibold">{state.users.find((u) => u.id === h.toId)?.name}</span>
                <span className="text-ink-soft num text-[10px]">· {h.kind} · {fmtDate(h.at.slice(0, 10))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {handoff && <HandoffModal caze={caze} onClose={() => setHandoff(false)} />}
    </Drawer>
  );
}

/* ---------- Cases list (L2) ---------- */
export function CasesView() {
  const { state } = useStore();
  const nav = useNav();
  const me = useMe()!;
  const scoped = !isOversight(me.role) && me.role !== "TL" && me.role !== "PA";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [stageF, setStageF] = useState("ALL");
  const [ownerF, setOwnerF] = useState(scoped ? me.id : "ALL");
  const [sort, setSort] = useState("urgency");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [overview, setOverview] = useState<Case | null>(null);

  const rows = useMemo(() => {
    const team = me.role === "TL" ? teamOf(state, me) : null;
    const needle = q.trim().toLowerCase();
    let list = state.cases
      .filter((c) => (status === "ALL" ? true : c.status === status))
      .filter((c) => (stageF === "ALL" ? true : c.stage === stageF))
      .filter((c) => {
        if (ownerF !== "ALL") return c.ownerId === ownerF;
        if (team) return team.has(c.ownerId);
        if (scoped) return c.ownerId === me.id;
        return true;
      })
      .filter((c) => {
        if (!needle) return true;
        const p = state.persons.find((x) => x.id === c.personId)?.name ?? "";
        return [p, c.ref, c.bankRm].join(" ").toLowerCase().includes(needle);
      });
    const today = todayISO();
    const rank = (c: Case) => {
      const t = tatFor(c, c.stage, state.stages, today);
      if (t.level >= 2) return 0;
      if (state.queries.some((x) => x.caseId === c.id && x.status === "OPEN")) return 1;
      if (t.level === 1) return 2;
      if (!c.nextAction) return 4;
      return 3;
    };
    if (sort === "urgency") list = [...list].sort((a, b) => rank(a) - rank(b) || a.ref.localeCompare(b.ref));
    else if (sort === "newest") list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else list = [...list].sort((a, b) => b.loanAmount - a.loanAmount);
    return list;
  }, [state, q, status, stageF, ownerF, sort, me, scoped]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const setPageSafe = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

  return (
    <div className="space-y-3.5">
      <PipelineStrip stage={stageF} setStage={(s) => { setStageF(s); setPage(1); }} />

      <div className="flex flex-wrap items-center gap-2 anim-up">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft"><Ic n="search" size={14} /></span>
          <TextInput value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Client, ref, RM…" className="pl-8 w-[220px]" />
        </div>
        <Select className="w-[120px]" value={status} onChange={(v) => { setStatus(v as typeof status); setPage(1); }} options={[{ v: "OPEN", l: "Open" }, { v: "CLOSED", l: "Closed" }, { v: "ALL", l: "All" }]} />
        <Select className="w-[150px]" value={ownerF} onChange={(v) => { setOwnerF(v); setPage(1); }} options={[{ v: "ALL", l: isOversight(me.role) ? "All owners" : "My team" }, ...state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))]} />
        <Select className="w-[140px]" value={sort} onChange={setSort} options={[{ v: "urgency", l: "Sort · urgency" }, { v: "newest", l: "Sort · newest" }, { v: "value", l: "Sort · value" }]} />
        <span className="ml-auto num text-[11px] text-ink-soft">{rows.length} files · showing {rows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, rows.length)}</span>
      </div>

      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
        <table className="w-full text-[12.5px] min-w-[860px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
              <th className="px-4 py-2.5 font-semibold">File / Client</th>
              <th className="px-3 py-2.5 font-semibold">Stage</th>
              <th className="px-3 py-2.5 font-semibold">Bank</th>
              <th className="px-3 py-2.5 font-semibold">Finance</th>
              <th className="px-3 py-2.5 font-semibold">Owner</th>
              <th className="px-3 py-2.5 font-semibold">Next due</th>
              <th className="px-3 py-2.5 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => {
              const person = state.persons.find((p) => p.id === c.personId);
              const def = state.stages.find((s) => s.id === c.stage);
              const t = tatFor(c, c.stage, state.stages, todayISO());
              const owner = state.users.find((u) => u.id === c.ownerId);
              return (
                <tr key={c.id} onClick={() => setOverview(c)} className="group border-b border-mist/60 last:border-0 hover:bg-pine-50/50 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={person?.name ?? "?"} size={30} />
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight truncate">{person?.name}{c.deal ? <span className="text-ink-soft font-medium"> · {c.deal}</span> : null}</p>
                        <p className="num text-[10.5px] text-pine-700 font-semibold">{c.ref}{(c.handoffs ?? []).length > 0 ? ` · ${(c.handoffs ?? []).length} handoff` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5"><span className={cx("w-1.5 h-1.5 rounded-full", t.level >= 2 ? "bg-rust-500" : t.level === 1 ? "bg-amber-500" : "bg-pine-500")} /><span className="font-medium">{def?.name}</span></span></td>
                  <td className="px-3 py-3"><p className="font-medium">{state.banks.find((b) => b.id === c.bankId)?.short}</p><p className="text-[10.5px] text-ink-soft">{c.channel}</p></td>
                  <td className="px-3 py-3 num">{c.loanAmount ? fmtAED(c.loanAmount) : "—"}</td>
                  <td className="px-3 py-3"><span className="flex items-center gap-1.5"><Avatar name={owner?.name ?? "?"} size={20} /><span className="text-[12px]">{owner?.name.split(" ")[0]}</span></span></td>
                  <td className="px-3 py-3"><DueChip iso={c.nextActionDue} /></td>
                  <td className="px-3 py-3 text-right"><Pill tone={c.status === "CLOSED" ? "gr" : t.level >= 2 ? "rust" : "pine"} dot>{c.status === "CLOSED" ? c.outcome ?? "closed" : t.level >= 2 ? ESC_LEVELS[t.level].tag : "open"}</Pill></td>
                </tr>
              );
            })}
            {pageRows.length === 0 && <tr><td colSpan={7}><EmptyState icon="briefcase" title="No files match" sub="Adjust the stage strip, filters, or search." /></td></tr>}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between anim-up">
          <Select className="w-[110px]" value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(1); }} options={[{ v: "10", l: "10 / page" }, { v: "25", l: "25 / page" }, { v: "50", l: "50 / page" }]} />
          <div className="flex items-center gap-1">
            <button onClick={() => setPageSafe(page - 1)} disabled={page === 1} className="p-1.5 rounded-md border border-mist disabled:opacity-30 hover:border-pine-600 transition-colors"><Ic n="chevL" size={14} /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, i, arr) => (
              <span key={p} className="flex items-center">
                {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-ink-soft">…</span>}
                <button onClick={() => setPageSafe(p)} className={cx("num min-w-[30px] h-[30px] rounded-md text-[12px] font-semibold border transition-all", p === page ? "bg-ink text-paper border-ink" : "border-mist hover:border-pine-600")}>{p}</button>
              </span>
            ))}
            <button onClick={() => setPageSafe(page + 1)} disabled={page === totalPages} className="p-1.5 rounded-md border border-mist disabled:opacity-30 hover:border-pine-600 transition-colors"><Ic n="chevR" size={14} /></button>
          </div>
        </div>
      )}

      {overview && <CaseOverview caze={overview} onClose={() => setOverview(null)} />}
    </div>
  );
}

/* ---------- control panel drawer ---------- */
function ControlPanel({ c, onClose }: { c: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [del, setDel] = useState(false);
  const [f, setF] = useState({
    ownerId: c.ownerId, nextAction: c.nextAction ?? "", nextActionDue: c.nextActionDue ?? todayISO(),
    waitingFor: c.waitingFor ?? "", pendingReason: c.pendingReason ?? "", blocker: c.blocker ?? "",
    expectedCompletion: c.expectedCompletion ?? "", expectedRevenue: c.expectedRevenue,
  });
  const canDanger = me?.role === "HEAD" || me?.role === "ADMIN";
  const clientName = state.persons.find((p) => p.id === c.personId)?.name ?? "";
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
      <div className="mt-6 rounded-lg border border-rust-500/30 bg-rust-100/30 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display font-bold text-[12.5px] text-rust-700">Danger zone</p>
            <p className="text-[10.5px] text-ink-soft mt-0.5">Permanently delete case, tasks & queries. Head/Admin only.</p>
          </div>
          <button onClick={() => setDel(true)} disabled={!canDanger}
            className="shrink-0 inline-flex items-center gap-1.5 h-[30px] px-3 rounded-md border border-rust-500/50 text-[11.5px] font-display font-bold text-rust-700 hover:bg-rust-600 hover:text-paper transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <Ic n="trash" size={13} /> Delete
          </button>
        </div>
      </div>
      <DangerModal open={del} onClose={() => setDel(false)} title="Delete case" target={`${c.ref} · ${clientName}`}
        warn="The case and all its tasks and bank queries are removed. The client profile stays, and history remains in the audit trail."
        confirmLabel="Delete case"
        onConfirm={(reason) => { dispatch({ t: "DELETE_CASE", id: c.id, reason }); setDel(false); onClose(); }} />
    </Drawer>
  );
}

/* ---------- Case 360 (L3) ---------- */
export function Case360({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe();
  const c = state.cases.find((x) => x.id === id);
  const [tab, setTab] = useState<string>(() => (typeof nav.params.tab === "string" ? (nav.params.tab as string) : "overview"));
  const [panel, setPanel] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [note, setNote] = useState("");

  if (!c) return <EmptyState icon="briefcase" title="Case not found" sub="It may have been deleted." />;

  const person = state.persons.find((p) => p.id === c.personId);
  const def = state.stages.find((s) => s.id === c.stage);
  const idx = state.stages.findIndex((s) => s.id === c.stage);
  const nextDef = state.stages[idx + 1];
  const t = tatFor(c, c.stage, state.stages, todayISO());
  const lv = ESC_LEVELS[t.level];
  const tasks = state.tasks.filter((x) => x.caseId === c.id);
  const queries = state.queries.filter((x) => x.caseId === c.id);
  const calcs = state.calcs.filter((x) => x.linkKind === "case" && x.linkId === c.id);
  const gates = stageGates(c, state.stages, state.tasks, state.queries);
  const owner = state.users.find((u) => u.id === c.ownerId);
  const ltv = c.propertyValue ? (c.loanAmount / c.propertyValue) * 100 : 0;
  const emiV = c.loanAmount ? emi(c.loanAmount, c.rate, c.tenureMonths) : 0;
  const activity = state.audit.filter((a) => a.caseId === c.id).slice(0, 30);
  const canAdvance = c.status === "OPEN" && nextDef && gates.pass;

  const TABS = [
    { id: "overview", l: "Overview" },
    { id: "docs", l: `Docs ${c.docs.length}` },
    { id: "tasks", l: `Tasks ${tasks.filter((x) => x.status === "OPEN").length}` },
    { id: "queries", l: `Queries ${queries.filter((x) => x.status === "OPEN").length}` },
    { id: "tat", l: "TAT" },
    { id: "money", l: "Money" },
    { id: "log", l: `Log ${c.tracker?.length ?? 0}` },
    { id: "activity", l: "Audit" },
  ];

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="bg-card border border-mist rounded-lg p-4 anim-up">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <Avatar name={person?.name ?? "?"} size={48} />
            <div>
              <div className="flex items-center gap-2">
                <p className="num text-[11px] font-bold text-pine-700">{c.ref}</p>
                <span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[9.5px] font-display font-bold tracking-[0.06em]", lv.chip)}>
                  <span className={cx("w-1.5 h-1.5 rounded-full", lv.dot, t.level >= 2 && "pulse-dot")} />{lv.tag}
                </span>
                <Pill tone={c.status === "CLOSED" ? "gr" : "pine"} dot>{c.status}</Pill>
              </div>
              <p className="font-display font-bold text-[20px] tracking-tight leading-tight mt-0.5">{person?.name}{c.deal ? <span className="text-ink-soft font-medium text-[15px]"> · {c.deal}</span> : null}</p>
              <p className="num text-[11px] text-ink-soft mt-0.5">{state.banks.find((b) => b.id === c.bankId)?.name} · {c.txType.replace("_", " + ")} · RM {c.bankRm ?? "—"} · {c.channel}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={() => setHandoff(true)}><Ic n="arrowR" size={13} /> Hand off</Btn>
            <Btn variant="outline" size="sm" onClick={() => setPanel(true)}><Ic n="edit" size={13} /> Control panel</Btn>
            {c.status === "OPEN" && (
              <Btn size="sm" onClick={() => setGateOpen(true)} disabled={!nextDef}>
                <Ic n="chevR" size={13} /> Advance{nextDef ? ` → ${nextDef.short}` : ""}
              </Btn>
            )}
          </div>
        </div>
        {/* stage rail */}
        <div className="mt-4">
          <div className="flex gap-[3px]">{state.stages.map((s, j) => <span key={s.id} title={s.name} className={cx("h-[5px] flex-1 rounded-full", j < idx ? "bg-pine-500" : j === idx ? "bg-ink" : "bg-ink/12")} />)}</div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-ink-soft num">{def?.name} · stage {idx + 1}/{state.stages.length} · SLA {def?.sla}d{t.target ? ` · target ${fmtDate(t.target)}` : ""}{t.daysOver > 0 ? <span className="text-rust-600 font-bold"> · {t.daysOver}d over</span> : null}</p>
            <p className="text-[11px] text-ink-soft num">opened {fmtDate(c.createdAt)} · owner {owner?.name}</p>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-mist anim-up overflow-x-auto">
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
                <p className="font-display font-bold text-[14px] tracking-tight mb-3">Control summary</p>
                <div className="grid grid-cols-2 gap-x-5">
                  <KV k="Owner" v={owner?.name ?? "—"} mono={false} />
                  <KV k="Next action" v={c.nextAction ?? <span className="text-rust-600">none</span>} mono={false} />
                  <KV k="Due" v={c.nextActionDue ? <DueChip iso={c.nextActionDue} /> : "—"} mono={false} />
                  <KV k="Waiting for" v={c.waitingFor ?? "—"} mono={false} />
                  <KV k="Why pending" v={c.pendingReason ?? "—"} mono={false} />
                  <KV k="Blocker" v={c.blocker ?? <span className="text-ink-soft">none</span>} mono={false} />
                  <KV k="Expected completion" v={c.expectedCompletion ? fmtDate(c.expectedCompletion) : "—"} mono={false} />
                  <KV k="Expected revenue" v={fmtAED(c.expectedRevenue)} />
                </div>
              </div>
              <div className="bg-card border border-mist rounded-lg p-4">
                <p className="font-display font-bold text-[14px] tracking-tight mb-3">Stage conditions ({def?.conditions.length ?? 0})</p>
                <div className="space-y-1.5">
                  {(def?.conditions ?? []).map((cd, i) => {
                    const key = `${c.stage}:${i}`;
                    const on = !!c.conditionsDone?.[key];
                    return (
                      <button key={key} onClick={() => dispatch({ t: "TOGGLE_CONDITION", caseId: c.id, key, label: cd })}
                        className="w-full flex items-start gap-2.5 text-left group py-0.5">
                        <span className={cx("mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all", on ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300 group-hover:border-pine-500")}>{on && <Ic n="check" size={10} />}</span>
                        <span className={cx("text-[12.5px] leading-snug", on ? "text-ink-soft line-through" : "text-ink")}>{cd}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-ink-soft mt-3">Trigger date: <input type="date" value={c.triggerDates?.[c.stage] ?? ""} onChange={(e) => e.target.value && dispatch({ t: "SET_TRIGGER", caseId: c.id, stageId: c.stage, date: e.target.value })} className="num text-[11px] bg-transparent border-b border-mist" /></p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-mist rounded-lg p-4">
                <p className="font-display font-bold text-[14px] tracking-tight mb-2">Finance</p>
                <KV k="Property value" v={c.propertyValue ? fmtAED(c.propertyValue) : "—"} />
                <KV k="Loan amount" v={c.loanAmount ? fmtAED(c.loanAmount) : "—"} />
                <KV k="LTV" v={ltv ? `${ltv.toFixed(1)}%` : "—"} />
                <KV k="Rate" v={`${c.rate}%`} />
                <KV k="Tenure" v={`${c.tenureMonths} mo`} />
                <KV k="Monthly EMI" v={c.loanAmount ? fmtAED(emiV) : "—"} />
              </div>
              <div className="bg-card border border-mist rounded-lg p-4">
                <p className="font-display font-bold text-[14px] tracking-tight mb-2">Add a note</p>
                <div className="flex gap-2">
                  <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Save all comms here…"
                    onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { dispatch({ t: "ADD_CASE_NOTE", caseId: c.id, text: note }); setNote(""); } }} />
                  <Btn size="sm" disabled={!note.trim()} onClick={() => { dispatch({ t: "ADD_CASE_NOTE", caseId: c.id, text: note }); setNote(""); }}><Ic n="plus" size={13} /></Btn>
                </div>
                <div className="mt-3 space-y-2 max-h-[160px] overflow-y-auto">
                  {[...(c.caseNotes ?? [])].reverse().map((n) => (
                    <p key={n.id} className="text-[11.5px] leading-snug border-l-2 border-pine-500 pl-2.5 py-0.5">
                      <span className="num text-[10px] text-ink-soft block">{state.users.find((u) => u.id === n.by)?.name} · {fmtTime(n.at)}</span>{n.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "docs" && (
          <div className="bg-card border border-mist rounded-lg overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
                <th className="px-4 py-2.5 font-semibold">Document</th><th className="px-3 py-2.5 font-semibold">Stage</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-3 py-2.5 font-semibold text-right">Mark as</th>
              </tr></thead>
              <tbody>
                {c.docs.map((d) => (
                  <tr key={d.id} className="border-b border-mist/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{state.docTypes.find((t) => t.id === d.typeId)?.name ?? d.typeId}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{state.stages.find((s) => s.id === d.stageId)?.short}</td>
                    <td className="px-3 py-2.5"><Pill tone={d.status === "VERIFIED" ? "pine" : d.status === "RECEIVED" ? "steel" : d.status === "REJECTED" ? "rust" : d.status === "NA" ? "gr" : "amber"}>{d.status}</Pill></td>
                    <td className="px-3 py-2.5 text-right">
                      {c.status === "OPEN" && d.status !== "NA" && (
                        <div className="inline-flex gap-1">
                          {(["RECEIVED", "VERIFIED", "REJECTED"] as const).map((s) => (
                            <button key={s} onClick={() => dispatch({ t: "SET_DOC", caseId: c.id, docId: d.id, status: s })}
                              className={cx("px-2 py-1 rounded-md border text-[10.5px] font-display font-bold transition-all", d.status === s ? "bg-ink text-paper border-ink" : "border-mist text-ink-soft hover:border-pine-600 hover:text-pine-700")}>{s[0]}</button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {c.docs.length === 0 && <tr><td colSpan={4}><EmptyState icon="file" title="No documents" sub="Advance a stage to generate its checklist." /></td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "tasks" && (
          <div className="bg-card border border-mist rounded-lg overflow-hidden">
            {tasks.map((tk) => (
              <div key={tk.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-mist/60 last:border-0">
                <button onClick={() => dispatch({ t: "UPDATE_TASK", id: tk.id, patch: { status: tk.status === "OPEN" ? "DONE" : "OPEN" } })}
                  className={cx("w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-all", tk.status === "DONE" ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300 hover:border-pine-500")}>
                  {tk.status === "DONE" && <Ic n="check" size={10} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cx("text-[12.5px] font-medium", tk.status === "DONE" && "line-through text-ink-soft")}>{tk.title}</p>
                  <p className="num text-[10.5px] text-ink-soft">{state.stages.find((s) => s.id === tk.stageId)?.name} · {state.users.find((u) => u.id === tk.ownerId)?.name}{tk.estimateMinutes ? ` · est ${fmtDur(tk.estimateMinutes)}` : ""}</p>
                </div>
                <Pill tone={tk.priority === "HIGH" ? "rust" : tk.priority === "MEDIUM" ? "amber" : "gr"}>{tk.priority}</Pill>
                {tk.status === "OPEN" ? <DueChip iso={tk.due} /> : <span className="num text-[10.5px] text-ink-soft">done {tk.completedAt ? fmtDate(tk.completedAt.slice(0, 10)) : ""}</span>}
              </div>
            ))}
            {tasks.length === 0 && <EmptyState icon="timer" title="No tasks" />}
          </div>
        )}

        {tab === "queries" && (
          <div className="bg-card border border-mist rounded-lg overflow-hidden">
            {queries.map((qq) => (
              <div key={qq.id} className="px-4 py-3 border-b border-mist/60 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[12.5px]">{qq.ref} · {state.banks.find((b) => b.id === qq.bankId)?.short}</p>
                  <Pill tone={qq.status === "OPEN" ? "rust" : qq.status === "RESPONDED" ? "amber" : "pine"}>{qq.status}</Pill>
                </div>
                <p className="text-[12px] text-ink-soft mt-1">{qq.requirement}</p>
                {qq.response && <p className="text-[11.5px] mt-1.5 border-l-2 border-pine-500 pl-2.5 text-pine-800">{qq.response}</p>}
                {qq.status === "OPEN" && c.status === "OPEN" && (
                  <div className="flex gap-1.5 mt-2">
                    <Btn size="sm" variant="outline" onClick={() => dispatch({ t: "UPDATE_QUERY", id: qq.id, patch: { status: "RESPONDED", response: qq.response ?? "Response sent to bank" } })}><Ic n="send" size={12} /> Mark responded</Btn>
                    <Btn size="sm" variant="dark" onClick={() => dispatch({ t: "UPDATE_QUERY", id: qq.id, patch: { status: "CLOSED", qc: qq.qc ?? `Verified by ${me?.name ?? ""}` } })}><Ic n="check" size={12} /> QC & close</Btn>
                  </div>
                )}
              </div>
            ))}
            {queries.length === 0 && <EmptyState icon="help" title="No bank queries" />}
          </div>
        )}

        {tab === "tat" && (
          <div className="bg-card border border-mist rounded-lg p-4 max-w-2xl">
            <p className="font-display font-bold text-[14px] tracking-tight mb-3">Escalation timeline</p>
            <div className="space-y-2">
              {ESC_LEVELS.map((l) => (
                <div key={l.level} className={cx("flex items-start gap-3 rounded-md border px-3.5 py-2.5", t.level === l.level ? "border-pine-600 bg-pine-50" : "border-mist")}>
                  <span className={cx("w-2 h-2 rounded-full mt-1.5", l.dot, t.level === l.level && l.level >= 2 && "pulse-dot")} />
                  <div className="flex-1">
                    <p className="font-display font-bold text-[12.5px]">{l.tag} — {l.label}</p>
                    <p className="text-[11.5px] text-ink-soft mt-0.5">{l.action} · {l.who}{l.copied !== "—" ? ` → cc ${l.copied}` : ""}</p>
                  </div>
                  {t.level === l.level && <Pill tone={l.level >= 2 ? "rust" : l.level === 1 ? "amber" : "pine"}>current</Pill>}
                </div>
              ))}
            </div>
            {t.level >= 1 && person && (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-1.5">Copy escalation email</p>
                {(() => {
                  const em = escalationEmail(t.level as 1 | 2 | 3, person.name, state.banks.find((b) => b.id === c.bankId)?.short ?? "", def?.name ?? "", c.ref, t.daysOver);
                  return <pre className="text-[11px] leading-relaxed whitespace-pre-wrap bg-paper/60 border border-mist rounded-md px-3.5 py-3">{`Subject: ${em.subject}\n\n${em.body}`}</pre>;
                })()}
              </div>
            )}
          </div>
        )}

        {tab === "money" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-card border border-mist rounded-lg p-4">
              <p className="font-display font-bold text-[14px] tracking-tight mb-2">Deal economics</p>
              <KV k="Property value" v={c.propertyValue ? fmtAED(c.propertyValue) : "—"} />
              <KV k="Loan" v={c.loanAmount ? fmtAED(c.loanAmount) : "—"} />
              <KV k="LTV" v={ltv ? `${ltv.toFixed(1)}%` : "—"} />
              <KV k="Rate" v={`${c.rate}%`} />
              <KV k="Tenure" v={`${c.tenureMonths} mo (${Math.round(c.tenureMonths / 12)} yrs)`} />
              <KV k="Monthly EMI" v={c.loanAmount ? fmtAED(emiV) : "—"} />
              <KV k="Total payments" v={c.loanAmount ? fmtAED(emiV * c.tenureMonths) : "—"} />
              <KV k="Expected revenue" v={fmtAED(c.expectedRevenue)} />
            </div>
            <div className="bg-card border border-mist rounded-lg p-4">
              <p className="font-display font-bold text-[14px] tracking-tight mb-2">Saved calculations ({calcs.length})</p>
              {calcs.map((x) => (
                <p key={x.id} className="text-[12px] border-b border-mist/50 py-1.5 last:border-0">{x.label} <span className="num text-[10px] text-ink-soft">· {x.rulesUsed.map((r) => `${r.code} v${r.version}`).join(", ")}</span></p>
              ))}
              {calcs.length === 0 && <p className="text-[11.5px] text-ink-soft italic">None yet — run a calculator and attach it to this case.</p>}
            </div>
          </div>
        )}

        {tab === "log" && (
          <div className="bg-card border border-mist rounded-lg p-4 max-w-2xl">
            <p className="font-display font-bold text-[14px] tracking-tight mb-3">Daily log</p>
            <div className="space-y-2.5">
              {[...(c.tracker ?? [])].reverse().map((e) => (
                <div key={e.date} className="flex gap-3">
                  <span className="num text-[11px] font-bold text-pine-700 shrink-0 w-[74px] pt-0.5">{fmtDate(e.date)}</span>
                  <p className="text-[12.5px] leading-snug flex-1">{e.note}</p>
                </div>
              ))}
              {(c.tracker ?? []).length === 0 && <p className="text-[11.5px] text-ink-soft italic">No daily log yet — update it from the Daily Tracker board.</p>}
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div className="bg-card border border-mist rounded-lg p-4 max-w-2xl">
            <p className="font-display font-bold text-[14px] tracking-tight mb-3">Audit trail</p>
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-3 text-[12px]">
                  <span className="num text-[10.5px] text-ink-soft shrink-0 w-[110px] pt-0.5">{fmtTime(a.at)}</span>
                  <p className="flex-1"><strong>{a.action}</strong> — {a.target}{a.detail ? <span className="text-ink-soft"> · {a.detail}</span> : null} <span className="text-ink-soft num text-[10px]">by {state.users.find((u) => u.id === a.by)?.name ?? a.by}</span></p>
                </div>
              ))}
              {activity.length === 0 && <p className="text-[11.5px] text-ink-soft italic">No activity recorded.</p>}
            </div>
          </div>
        )}
      </div>

      {/* advance gate modal */}
      <Modal open={gateOpen} onClose={() => setGateOpen(false)} title={`Advance ${c.ref} → ${nextDef?.name ?? ""}`} width={480}
        footer={<>
          <Btn variant="ghost" onClick={() => setGateOpen(false)}>Cancel</Btn>
          <Btn disabled={!gates.pass} onClick={() => { dispatch({ t: "ADVANCE_STAGE", id: c.id }); setGateOpen(false); }}><Ic n="check" size={14} /> Advance stage</Btn>
        </>}>
        <p className="text-[12.5px] text-ink-soft mb-3">Evidence-based gates — the file moves only when every check is green.</p>
        <div className="space-y-2">
          {gates.checks.map((g) => (
            <div key={g.label} className={cx("flex items-center gap-2.5 rounded-md border px-3.5 py-2.5", g.pass ? "border-pine-200 bg-pine-50" : "border-rust-500/40 bg-rust-100/30")}>
              <Ic n={g.pass ? "check" : "x"} size={15} className={g.pass ? "text-pine-700" : "text-rust-600"} />
              <span className="flex-1 text-[12.5px] font-medium">{g.label}</span>
              <span className={cx("num text-[10.5px] font-semibold", g.pass ? "text-pine-700" : "text-rust-600")}>{g.detail}</span>
            </div>
          ))}
        </div>
        {!gates.pass && <p className="text-[11.5px] text-rust-600 mt-3">Clear the red checks above — verify documents, complete tasks, close queries, tick conditions.</p>}
      </Modal>

      {panel && <ControlPanel c={c} onClose={() => setPanel(false)} />}
      {handoff && <HandoffModal caze={c} onClose={() => setHandoff(false)} />}
    </div>
  );
}
