import { useEffect, useMemo, useState } from "react";
import type { Case, DocStatus, Person, Task } from "../types";
import { useMe, useNav, useStore } from "../store";
import { ESC_LEVELS, caseBucket, emi, escalationEmail, fmtDur, stageGates, tatFor } from "../calc";
import { Avatar, Btn, DateInput, Drawer, DueChip, EmptyState, Field, Ic, KV, Modal, NumInput, Pill, Select, TextArea, TextInput, cx, daysUntil, fmtAED, fmtDate, fmtN, fmtPct, fmtTime, nowISO, todayISO, uid } from "../ui";
import HandoffModal from "./Handoff";

const DOC_STATUSES: { v: DocStatus; l: string; cls: string; on: string }[] = [
  { v: "MISSING", l: "Missing", cls: "text-ink-soft", on: "bg-gr-700 text-paper border-gr-700" },
  { v: "RECEIVED", l: "Received", cls: "text-amber-700", on: "bg-amber-500 text-white border-amber-500" },
  { v: "VERIFIED", l: "Verified", cls: "text-pine-700", on: "bg-pine-600 text-pine-50 border-pine-600" },
  { v: "REJECTED", l: "Rejected", cls: "text-rust-700", on: "bg-rust-500 text-white border-rust-500" },
  { v: "NA", l: "N/A", cls: "text-ink-soft", on: "bg-ink text-paper border-ink" },
];

const SEV: Record<string, number> = { overdue: 0, query: 1, risk: 2, ready: 3, waiting: 4, noaction: 5 };

function CaseOverview({ caze, onClose, onHandoff }: { caze: Case; onClose: () => void; onHandoff: (c: Case) => void }) {
  const { state } = useStore();
  const nav = useNav();
  const person = state.persons.find((p) => p.id === caze.personId);
  const bank = state.banks.find((b) => b.id === caze.bankId);
  const idx = state.stages.findIndex((s) => s.id === caze.stage);
  const def = state.stages[idx];
  const t = tatFor(caze, caze.stage, state.stages, todayISO());
  const lv = ESC_LEVELS[t.level];
  const tasks = state.tasks.filter((x) => x.caseId === caze.id && x.status === "OPEN");
  const openQ = state.queries.filter((x) => x.caseId === caze.id && x.status === "OPEN");
  const docs = caze.docs ?? [];
  const docOk = docs.filter((d) => d.status === "VERIFIED" || d.status === "NA").length;
  const lastNote = caze.tracker?.length ? caze.tracker[caze.tracker.length - 1] : undefined;
  const chain = caze.handoffs ?? [];
  const uName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;
  const monthly = caze.loanAmount ? emi(caze.loanAmount, caze.rate, caze.tenureMonths) : 0;
  return (
    <Drawer open onClose={onClose} title={<span className="num">{caze.ref} · {person?.name}</span>} width={540}
      footer={<>
        <Btn variant="outline" onClick={() => onHandoff(caze)} disabled={caze.status !== "OPEN"}><Ic n="arrowR" size={13} /> Hand off</Btn>
        <Btn variant="dark" onClick={() => nav.go("cases", { caseId: caze.id })}><Ic n="briefcase" size={13} /> Open Case 360</Btn>
      </>}>
      <div className="space-y-4">
        {/* where it stands */}
        <div className="rounded-lg border border-mist bg-paper/50 p-4">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold text-[14px] tracking-tight">{def?.name}</p>
            <span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[9.5px] font-display font-bold tracking-[0.08em]", lv.chip)}>
              <span className={cx("w-1.5 h-1.5 rounded-full", lv.dot)} />{lv.tag}
            </span>
          </div>
          <div className="flex gap-0.5 mt-2.5">{state.stages.map((s, j) => <span key={s.id} title={s.name} className={cx("h-[4px] flex-1 rounded-full", j < idx ? "bg-pine-500" : j === idx ? "bg-ink" : "bg-ink/12")} />)}</div>
          <p className="num text-[10.5px] text-ink-soft mt-1.5">stage {idx + 1} of {state.stages.length}{t.target ? ` · target ${fmtDate(t.target)}` : ""}{t.daysOver > 0 ? ` · ${t.daysOver}d over` : ""}</p>
        </div>

        {/* control summary */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-[12px]">
          <KV k="Owner" v={uName(caze.ownerId)} mono={false} />
          <KV k="Waiting for" v={caze.waitingFor ?? "—"} mono={false} />
          <KV k="Next action" v={caze.nextAction ?? "—"} mono={false} />
          <KV k="Due" v={caze.nextActionDue ? fmtDate(caze.nextActionDue) : "—"} mono={false} />
          <KV k="Pending reason" v={caze.pendingReason ?? "—"} mono={false} />
          <KV k="Blocker" v={caze.blocker ?? "none"} mono={false} />
          <KV k="Bank · channel" v={`${bank?.short ?? "—"} · ${caze.channel ?? "—"}`} mono={false} />
          <KV k="Bank RM" v={caze.bankRm ?? "—"} mono={false} />
        </div>

        {/* finance */}
        {(caze.loanAmount > 0 || caze.propertyValue > 0) && (
          <div className="rounded-lg border border-pine-200 bg-pine-50/50 p-3.5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-[9.5px] uppercase tracking-[0.08em] font-display font-semibold text-ink-soft">Finance</p><p className="num text-[14px] font-semibold text-pine-800 mt-0.5">{caze.loanAmount ? fmtAED(caze.loanAmount) : "—"}</p></div>
              <div><p className="text-[9.5px] uppercase tracking-[0.08em] font-display font-semibold text-ink-soft">LTV</p><p className="num text-[14px] font-semibold mt-0.5">{caze.propertyValue ? fmtPct((caze.loanAmount / caze.propertyValue) * 100, 0) : "—"}</p></div>
              <div><p className="text-[9.5px] uppercase tracking-[0.08em] font-display font-semibold text-ink-soft">EMI / mo</p><p className="num text-[14px] font-semibold mt-0.5">{monthly ? fmtAED(monthly) : "—"}</p></div>
            </div>
            <p className="num text-[10.5px] text-ink-soft text-center mt-2">rate {caze.rate}% · tenure {caze.tenureMonths} mo · property {caze.propertyValue ? fmtAED(caze.propertyValue) : "n/a"}</p>
          </div>
        )}

        {/* docs + queries + tasks at a glance */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-mist px-2 py-2.5">
            <p className="num text-[18px] font-semibold text-pine-700">{docs.length ? `${docOk}/${docs.length}` : "—"}</p>
            <p className="text-[9.5px] uppercase tracking-[0.07em] font-display font-semibold text-ink-soft">docs verified</p>
          </div>
          <div className="rounded-md border border-mist px-2 py-2.5">
            <p className="num text-[18px] font-semibold">{tasks.length}</p>
            <p className="text-[9.5px] uppercase tracking-[0.07em] font-display font-semibold text-ink-soft">open tasks</p>
          </div>
          <div className="rounded-md border border-mist px-2 py-2.5">
            <p className={cx("num text-[18px] font-semibold", openQ.length ? "text-rust-600" : "")}>{openQ.length}</p>
            <p className="text-[9.5px] uppercase tracking-[0.07em] font-display font-semibold text-ink-soft">bank queries</p>
          </div>
        </div>
        {tasks.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.09em] font-display font-bold text-ink-soft mb-1.5">Open tasks (top 3)</p>
            {tasks.slice(0, 3).map((tk) => (
              <div key={tk.id} className="flex items-center justify-between gap-2 border border-mist rounded-md px-3 py-2 mb-1.5 text-[12px]">
                <span className="truncate">{tk.title}</span>
                <DueChip iso={tk.due} />
              </div>
            ))}
          </div>
        )}
        {lastNote && (
          <div className="border-l-2 border-pine-500 bg-paper/60 rounded-r-md px-3 py-2">
            <p className="num text-[10px] text-ink-soft font-semibold">{fmtDate(lastNote.date)} · daily log</p>
            <p className="text-[12px] leading-snug mt-0.5 line-clamp-2">{lastNote.note}</p>
          </div>
        )}
        {chain.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.09em] font-display font-bold text-ink-soft mb-1.5">Custody chain</p>
            <div className="space-y-1">
              {[...chain].reverse().map((h, i) => (
                <p key={i} className="num text-[11px] text-ink-soft"><span className="text-ink font-semibold text-ink/90">{uName(h.fromId)}</span> → <span className="text-ink font-semibold text-ink/90">{uName(h.toId)}</span> · {h.kind} · {fmtDate(h.at.slice(0, 10))}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

export function CasesView() {
  const { state } = useStore();
  const nav = useNav();
  const me = useMe();
  const scoped = !!me && ["VRM", "SPO"].includes(me.role);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | "OPEN" | "CLOSED">("OPEN");
  const [stageF, setStageF] = useState("ALL");
  const [ownerF, setOwnerF] = useState(scoped && me ? me.id : "ALL");
  const [sort, setSort] = useState("urgency");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [handoff, setHandoff] = useState<Case | null>(null);
  const [overview, setOverview] = useState<Case | null>(null);

  const personName = (id: string) => state.persons.find((p) => p.id === id)?.name ?? "—";
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";

  /* pipeline strip: count + financed value per stage */
  const open = state.cases.filter((c) => c.status === "OPEN");
  const strip = state.stages.map((s) => {
    const cs = open.filter((c) => c.stage === s.id);
    return { s, n: cs.length, fin: cs.reduce((a, c) => a + c.loanAmount, 0) };
  });

  const filtered = state.cases.filter((c) =>
    (status === "ALL" || c.status === status) &&
    (stageF === "ALL" || c.stage === stageF) &&
    (ownerF === "ALL" || c.ownerId === ownerF) &&
    (c.ref + " " + (state.persons.find((p) => p.id === c.personId)?.name ?? "")).toLowerCase().includes(q.trim().toLowerCase())
  );

  const sorted = useMemo(() => {
    const sev = (c: Case) => {
      if (c.status === "CLOSED") return 9;
      const b = caseBucket(state, c);
      return b ? SEV[b] ?? 6 : 6;
    };
    const arr = [...filtered];
    if (sort === "urgency") arr.sort((a, b) => sev(a) - sev(b) || (a.nextActionDue ?? "9999").localeCompare(b.nextActionDue ?? "9999"));
    else if (sort === "newest") arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sort === "oldest") arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (sort === "stage") arr.sort((a, b) => state.stages.findIndex((s) => s.id === a.stage) - state.stages.findIndex((s) => s.id === b.stage));
    else if (sort === "owner") arr.sort((a, b) => userName(a.ownerId).localeCompare(userName(b.ownerId)));
    return arr;
  }, [filtered, sort, state]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, totalPages);
  const pageRows = sorted.slice((cur - 1) * pageSize, cur * pageSize);
  const setPg = (n: number) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const pageWindow = useMemo(() => {
    const w: number[] = [];
    const start = Math.max(1, Math.min(cur - 2, totalPages - 4));
    for (let i = start; i <= Math.min(totalPages, start + 4); i++) w.push(i);
    return w;
  }, [cur, totalPages]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4 anim-up">
        <div>
          <h1 className="font-display font-bold text-[26px] tracking-tight">Cases</h1>
          <p className="text-[13px] text-ink-soft mt-0.5">
            One case = one golden record. Click a row for the <strong className="text-ink">overview</strong>, then open Case 360 for the full file.
            {scoped && <> Showing <strong className="text-ink">your files</strong> — switch owner to view others read-only.</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative"><Ic n="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" /><TextInput className="pl-8 w-48" placeholder="Ref or client…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select className="w-36" value={sort} onChange={(v) => { setSort(v); setPage(1); }} options={[{ v: "urgency", l: "Sort: Urgency" }, { v: "newest", l: "Sort: Newest" }, { v: "oldest", l: "Sort: Oldest" }, { v: "stage", l: "Sort: Stage" }, { v: "owner", l: "Sort: Owner" }]} />
          <Select className="w-36" value={ownerF} onChange={(v) => { setOwnerF(v); setPage(1); }} options={[{ v: "ALL", l: "All owners" }, ...state.users.map((u) => ({ v: u.id, l: u.name }))]} />
        </div>
      </div>

      {/* pipeline strip — chevron flow, one arrow per stage */}
      <div className="anim-up mb-2 bg-ink rounded-lg px-2.5 py-3 sidebar-texture" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center gap-0 overflow-x-auto">
          <button onClick={() => { setStageF("ALL"); setStatus("ALL"); setPage(1); }}
            className={cx("focusable shrink-0 text-left pl-4 pr-5 py-2.5 transition-all", stageF === "ALL" && status === "ALL" ? "text-paper" : "text-paper/65 hover:text-paper")}>
            <p className="num text-[20px] font-semibold leading-none">{state.cases.length}</p>
            <p className="text-[8.5px] font-display font-bold uppercase tracking-[0.11em] mt-1">All files</p>
          </button>
          {strip.map(({ s, n, fin }, si) => {
            const on = stageF === s.id;
            return (
              <button key={s.id} onClick={() => { setStageF(on ? "ALL" : s.id); setStatus("OPEN"); setPage(1); }}
                title={`${s.name} — ${n} open · ${fin ? fmtAED(fin) : "no finance"} in stage`}
                className={cx("focusable shrink-0 text-left pl-6 pr-7 py-2.5 transition-all relative -ml-2 first:ml-0",
                  on ? "bg-pine-500 text-paper shadow-lg shadow-pine-950/40 z-[1]" : "text-paper/70 hover:text-paper hover:bg-paper/8")}
                style={{ clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 50%, 100% 100%, 12px 100%, 0 50%)" }}>
                <p className="num text-[19px] font-semibold leading-none">{n}</p>
                <p className="text-[8.5px] font-display font-bold uppercase tracking-[0.11em] mt-1 opacity-90">{String(si + 1).padStart(2, "0")} {s.short}</p>
                {n > 0 && <span className={cx("absolute bottom-[3px] left-[16px] right-[18px] h-[3px] rounded-full", on ? "bg-paper/80" : "bg-pine-400/70")} style={{ width: `${Math.max(22, Math.min(82, (n / Math.max(1, open.length)) * 82))}%` }} />}
              </button>
            );
          })}
          <button onClick={() => { setStatus(status === "CLOSED" ? "ALL" : "CLOSED"); setStageF("ALL"); setPage(1); }}
            className={cx("focusable shrink-0 text-left pl-6 pr-5 py-2.5 transition-all -ml-2", status === "CLOSED" ? "bg-gr-500 text-paper" : "text-paper/65 hover:text-paper hover:bg-paper/8")}
            style={{ clipPath: "polygon(12px 0, 100% 0, 100% 100%, 12px 100%, 0 50%)" }}>
            <p className="num text-[19px] font-semibold leading-none">{state.cases.length - open.length}</p>
            <p className="text-[8.5px] font-display font-bold uppercase tracking-[0.11em] mt-1">Closed</p>
          </button>
        </div>
        <p className="text-[10px] text-paper/50 font-display font-semibold tracking-wide mt-1.5 pl-2">
          PIPELINE · click a stage arrow to filter — hover any row below for a <span className="text-paper/80">preview</span>, click it for the case overview
        </p>
      </div>

      {/* table */}
      <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up" style={{ animationDelay: "120ms" }}>
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
            {pageRows.map((c, i) => {
              const st = state.stages.find((s) => s.id === c.stage);
              const idx = state.stages.findIndex((s) => s.id === c.stage);
              const openQ = state.queries.some((qq) => qq.caseId === c.id && qq.status === "OPEN");
              return (
                <tr key={c.id} onClick={() => setOverview(c)}
                  className="group border-b border-mist/60 last:border-0 hover:bg-pine-50/50 cursor-pointer transition-colors anim-up" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                  <td className="px-4 py-3">
                    <p className="num font-semibold text-pine-700 flex items-center gap-1.5">{c.ref}<Ic n="eye" size={12} className="text-ink-soft/70 group-hover:text-pine-700 transition-colors" /></p>
                    <p className="text-[10.5px] text-ink-soft">opened {fmtDate(c.createdAt)} · click to preview</p>
                  </td>
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
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={userName(c.ownerId)} size={22} />
                      <span className="text-[12px]">{userName(c.ownerId).split(" ")[0]}</span>
                      {(c.handoffs ?? []).length > 0 && <span className="num text-[9.5px] text-ink-soft bg-mist/60 rounded px-1 py-[1px]" title="Custody chain">{(c.handoffs ?? []).length}↔</span>}
                      {c.status === "OPEN" && (
                        <button onClick={(e) => { e.stopPropagation(); setHandoff(c); }} title="Hand off this file"
                          className="focusable ml-0.5 w-6 h-6 rounded border border-mist flex items-center justify-center text-ink-soft hover:border-pine-600 hover:text-pine-700 hover:bg-pine-50 transition-all opacity-0 group-hover:opacity-100">
                          <Ic n="arrowR" size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Pill tone={c.status === "CLOSED" ? "gr" : "pine"} dot>{c.status}</Pill>
                      <button onClick={(e) => { e.stopPropagation(); nav.go("cases", { caseId: c.id }); }} title="Open Case 360"
                        className="focusable w-6 h-6 rounded border border-mist flex items-center justify-center text-ink-soft hover:border-pine-600 hover:text-pine-700 hover:bg-pine-50 transition-all opacity-0 group-hover:opacity-100">
                        <Ic n="arrowR" size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && <EmptyState icon="briefcase" title="No cases match" sub="Adjust the pipeline strip, filters, or owner scope." />}
      </div>

      {/* smart pagination */}
      {sorted.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mt-3 anim-up" style={{ animationDelay: "180ms" }}>
          <p className="text-[12px] text-ink-soft num">
            Showing <strong className="text-ink">{(cur - 1) * pageSize + 1}–{Math.min(cur * pageSize, sorted.length)}</strong> of <strong className="text-ink">{sorted.length}</strong>
            {stageF !== "ALL" && <> in <strong className="text-ink">{state.stages.find((s) => s.id === stageF)?.name}</strong></>}
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setPg(Math.max(1, cur - 1))} disabled={cur === 1}
              className="focusable w-8 h-8 rounded-md border border-mist bg-card flex items-center justify-center text-ink-soft hover:border-pine-600 hover:text-pine-700 disabled:opacity-40 disabled:pointer-events-none transition-all">
              <Ic n="chevL" size={15} />
            </button>
            {pageWindow[0] > 1 && <><button onClick={() => setPg(1)} className="focusable w-8 h-8 rounded-md border border-mist bg-card num text-[12px] hover:border-pine-600 hover:text-pine-700 transition-all">1</button><span className="text-ink-soft px-1">…</span></>}
            {pageWindow.map((n) => (
              <button key={n} onClick={() => setPg(n)}
                className={cx("focusable w-8 h-8 rounded-md border num text-[12px] font-semibold transition-all", n === cur ? "border-ink bg-ink text-paper" : "border-mist bg-card hover:border-pine-600 hover:text-pine-700")}>
                {n}
              </button>
            ))}
            {pageWindow[pageWindow.length - 1] < totalPages && <><span className="text-ink-soft px-1">…</span><button onClick={() => setPg(totalPages)} className="focusable w-8 h-8 rounded-md border border-mist bg-card num text-[12px] hover:border-pine-600 hover:text-pine-700 transition-all">{totalPages}</button></>}
            <button onClick={() => setPg(Math.min(totalPages, cur + 1))} disabled={cur === totalPages}
              className="focusable w-8 h-8 rounded-md border border-mist bg-card flex items-center justify-center text-ink-soft hover:border-pine-600 hover:text-pine-700 disabled:opacity-40 disabled:pointer-events-none transition-all">
              <Ic n="chevR" size={15} />
            </button>
            <Select className="w-[110px]" value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
              options={[{ v: "10", l: "10 / page" }, { v: "25", l: "25 / page" }, { v: "50", l: "50 / page" }]} />
          </div>
        </div>
      )}

      {overview && <CaseOverview caze={overview} onClose={() => setOverview(null)} onHandoff={(cz) => { setOverview(null); setHandoff(cz); }} />}
      {handoff && <HandoffModal caze={handoff} onClose={() => setHandoff(null)} />}
    </div>
  );
}

/* ================= CASE 360 ================= */

const CLOSURE_AUDIT = [
  "Correct transaction type identified?",
  "Bank-specific submission controls followed?",
  "Bank queries logged and closed?",
  "Pre-Approval QC completed?",
  "Valuation QC completed?",
  "FOL QC completed?",
  "Signing completed?",
  "DDA confirmed?",
  "Seller liability/release handled where applicable?",
  "Transfer completed?",
  "Title deed received?",
  "Title deed QC sent?",
  "Open actions recorded?",
];

export function Case360({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe();
  const c = state.cases.find((x) => x.id === id);
  const [tab, setTab] = useState(() => (typeof nav.params.tab === "string" ? nav.params.tab : "docs"));
  const [gateOpen, setGateOpen] = useState(false);
  const [editPanel, setEditPanel] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [queryModal, setQueryModal] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditChecked, setAuditChecked] = useState<boolean[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [finOpen, setFinOpen] = useState(false);

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

      {/* finance strip — collapsible */}
      <div className="anim-up bg-ink text-paper rounded-lg overflow-hidden" style={{ animationDelay: "60ms" }}>
        <button onClick={() => setFinOpen(!finOpen)} className="focusable w-full flex items-center gap-3 px-4 py-3 hover:bg-paper/5 transition-colors text-left">
          <Ic n="calc" size={16} className="text-pine-300" />
          <span className="font-display font-bold text-[13px] tracking-tight">Finance</span>
          <span className="num text-[12px] text-paper/70">
            {c.loanAmount ? <>loan {fmtAED(c.loanAmount)}{c.propertyValue ? <> · LTV {fmtPct(ltv, 0)}</> : null}</> : "no finance on tracker"}
            {c.loanAmount ? <> · EMI {fmtAED(monthly)}/mo</> : null}
          </span>
          <Ic n="chevD" size={14} className={cx("ml-auto text-paper/60 transition-transform", finOpen && "rotate-180")} />
        </button>
        {finOpen && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 border-t border-paper/10">
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
        )}
      </div>

      {/* control panel — progressive disclosure */}
      <div className="anim-up" style={{ animationDelay: "120ms" }}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(showMore ? tiles : tiles.slice(0, 4)).map((t, i) => (
            <div key={i} className="bg-card border border-mist rounded-lg px-3.5 py-3 hover:shadow-sm transition-shadow">
              <p className="text-[10px] uppercase tracking-[0.1em] font-display font-semibold text-ink-soft mb-1">{t.k}</p>
              <div className={t.tone}>{t.v}</div>
              {t.sub && <div className="text-[11px] text-ink-soft mt-0.5">{t.sub}</div>}
            </div>
          ))}
        </div>
        <button onClick={() => setShowMore(!showMore)}
          className="focusable mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-display font-semibold text-pine-700 hover:underline">
          <Ic n={showMore ? "chevD" : "chevR"} size={12} className={cx("transition-transform", showMore && "rotate-90")} />
          {showMore ? "Show fewer details" : `Show ${tiles.length - 4} more details (blocker, ageing, completion, revenue)`}
        </button>
      </div>

      {/* stage rail — collapsible */}
      <div className="anim-up bg-card border border-mist rounded-lg overflow-hidden" style={{ animationDelay: "160ms" }}>
        <button onClick={() => setRailOpen(!railOpen)} className="focusable w-full flex items-center gap-3 px-4 py-3 hover:bg-paper/50 transition-colors text-left">
          <span className="w-8 h-8 rounded-md bg-pine-700 text-paper flex items-center justify-center font-display font-bold text-[11px] shrink-0">{def.short}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-[13px] tracking-tight truncate">{def.name} <span className="num text-[11px] text-ink-soft font-body font-normal">· stage {idx + 1} of {stages.length}</span></p>
            <div className="flex gap-[3px] mt-1.5">
              {stages.map((s, j) => <span key={s.id} title={s.name} className={cx("h-[4px] flex-1 rounded-full", j < idx ? "bg-pine-500" : j === idx ? "bg-ink" : "bg-ink/12")} />)}
            </div>
          </div>
          <Ic n="chevD" size={14} className={cx("text-ink-soft transition-transform shrink-0", railOpen && "rotate-180")} />
        </button>
        {railOpen && (
          <div className="p-4 pt-2 border-t border-mist overflow-x-auto">
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
        )}
      </div>

      {/* tabs */}
      <div className="anim-up bg-card border border-mist rounded-lg" style={{ animationDelay: "200ms" }}>
        <div className="px-4 pt-1">
          <div className="flex gap-1 border-b border-mist overflow-x-auto">
            {[
              { id: "tat", l: "TAT & Escalation", count: (c.conditionsDone ? Object.keys(c.conditionsDone).length : 0) },
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
          {tab === "tat" && <TatTab c={c} person={person} />}

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
            ? <Btn variant="dark" disabled={!gates.pass} onClick={() => { setGateOpen(false); setAuditChecked(Array(CLOSURE_AUDIT.length).fill(false)); setAuditOpen(true); }}><Ic n="check" size={14} /> Close case — run audit</Btn>
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

      {auditOpen && (
        <Modal open onClose={() => setAuditOpen(false)} title={`Case Closure Audit — ${c.ref}`} width={560}
          footer={<>
            <Btn variant="ghost" onClick={() => setAuditOpen(false)}>Cancel</Btn>
            <Btn variant="dark" disabled={auditChecked.some((v) => !v)} onClick={() => {
              dispatch({ t: "CLOSE_CASE", id: c.id, audit: CLOSURE_AUDIT.filter((_, i) => auditChecked[i]) });
              setAuditOpen(false);
            }}><Ic n="check" size={14} /> Confirm all & close case</Btn>
          </>}>
          <p className="text-[12px] text-ink-soft mb-3">Batch 6–7 end-of-case control. Transaction completion and administrative closure are separate — confirm every item before the golden record is archived. {auditChecked.filter(Boolean).length}/{CLOSURE_AUDIT.length} confirmed.</p>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {CLOSURE_AUDIT.map((item, i) => (
              <button key={i} onClick={() => setAuditChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                className={cx("focusable w-full flex items-center gap-2.5 px-3 py-2 rounded-md border text-left transition-all",
                  auditChecked[i] ? "border-pine-200 bg-pine-50" : "border-mist bg-card hover:border-pine-400")}>
                <span className={cx("w-[18px] h-[18px] rounded flex items-center justify-center shrink-0", auditChecked[i] ? "bg-pine-600 text-pine-50" : "border border-gr-300")}>
                  {auditChecked[i] && <Ic n="check" size={10} />}
                </span>
                <span className={cx("text-[12.5px]", auditChecked[i] ? "text-pine-800 font-medium" : "text-ink")}>{item}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

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
        <p className="text-[10px] text-ink-soft num mt-0.5">logged {fmtTime(t.createdAt)}{t.estimateMinutes ? <> · <span className="font-semibold text-pine-700">est. {fmtDur(t.estimateMinutes)}</span></> : null}</p>
      </div>
      <Pill tone={t.priority === "HIGH" ? "rust" : t.priority === "MEDIUM" ? "amber" : "gr"}>{t.priority}</Pill>
      {done
        ? <span className="text-[11px] num text-ink-soft">done {t.completedAt ? fmtDate(t.completedAt.slice(0, 10)) : "—"}{t.completedBy ? ` · by ${state.users.find((u) => u.id === t.completedBy)?.name ?? t.completedBy}` : ""}</span>
        : <DueChip iso={t.due} />}
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
  const [f, setF] = useState({ title: "", type: state.taskTypes[0], ownerId: me?.id ?? "", priority: "MEDIUM" as Task["priority"], due: todayISO(), stageId, ed: 0, eh: 0, em: 0 });
  const estMin = f.ed * 1440 + f.eh * 60 + f.em;
  return (
    <Modal open onClose={onClose} title="New task" width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.title.trim()} onClick={() => { dispatch({ t: "ADD_TASK", task: { id: "t" + uid(), caseId, stageId: f.stageId, type: f.type, title: f.title.trim(), ownerId: f.ownerId, priority: f.priority, due: f.due, status: "OPEN", createdAt: nowISO(), estimateMinutes: estMin || undefined } }); onClose(); }}>Create task</Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Task" req><TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Collect updated bank statements" /></Field></div>
        <Field label="Stage"><Select value={f.stageId} onChange={(v) => setF({ ...f, stageId: v })} options={state.stages.map((s) => ({ v: s.id, l: s.name }))} /></Field>
        <Field label="Type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={state.taskTypes.map((t) => ({ v: t, l: t }))} /></Field>
        <Field label="Owner"><Select value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
        <Field label="Priority"><Select value={f.priority} onChange={(v) => setF({ ...f, priority: v as Task["priority"] })} options={[{ v: "HIGH", l: "High" }, { v: "MEDIUM", l: "Medium" }, { v: "LOW", l: "Low" }]} /></Field>
        <Field label="Due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        <Field label="Expected time to complete" hint={estMin ? `= ${fmtDur(estMin)}` : "days · hours · minutes"}>
          <div className="grid grid-cols-3 gap-2">
            <NumInput value={f.ed} onChange={(n) => setF({ ...f, ed: n })} suffix="d" />
            <NumInput value={f.eh} onChange={(n) => setF({ ...f, eh: n })} suffix="h" />
            <NumInput value={f.em} onChange={(n) => setF({ ...f, em: n })} suffix="m" />
          </div>
        </Field>
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

function TatTab({ c, person }: { c: Case; person: Person }) {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe();
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const today = todayISO();
  const cur = tatFor(c, c.stage, state.stages, today);
  const curDef = state.stages.find((s) => s.id === c.stage);
  const histStages = c.stageHistory.map((h) => h.stageId).filter((v, i, a) => a.indexOf(v) === i);
  const curLevel = ESC_LEVELS[cur.level];

  const copyEmail = async () => {
    if (cur.level < 1) return;
    const bank = state.banks.find((b) => b.id === c.bankId)?.short ?? "";
    const em = escalationEmail(cur.level as 1 | 2 | 3, person.name, bank, curDef?.name ?? c.stage, c.ref, cur.daysOver);
    const text = `Subject: ${em.subject}\n\n${em.body}`;
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-4">
      {/* rule legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 bg-ink text-paper rounded-lg px-4 py-2.5 text-[11px] font-display">
        <span className="font-bold tracking-[0.1em] uppercase text-[10px] text-paper/60">Escalation rules</span>
        <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-pine-400 mr-1.5" />Day 1 — normal follow-up</span>
        <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />Day 2 — Level 1 → Team Leader</span>
        <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-rust-500 mr-1.5" />Day 3 — Level 2 → Dept Head CC'd</span>
        <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-paper mr-1.5" />Day 4+ — Level 3 → Dept Head copies Kiran</span>
      </div>

      {/* stage TAT cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {histStages.map((sid) => {
          const def = state.stages.find((s) => s.id === sid);
          const t = tatFor(c, sid, state.stages, today);
          const lv = ESC_LEVELS[t.level];
          const conds = def?.conditions ?? [];
          const done = conds.filter((_, ci) => c.conditionsDone?.[`${sid}:${ci}`]).length;
          const isCur = sid === c.stage;
          return (
            <div key={sid} className={cx("border rounded-lg p-3.5 transition-all anim-up", isCur ? "border-pine-600 shadow-md bg-pine-50/40" : "border-mist bg-card")}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-display font-bold text-[13.5px] tracking-tight">{def?.name}</p>
                <span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[9.5px] font-display font-bold tracking-[0.08em]", lv.chip)}>
                  <span className={cx("w-1.5 h-1.5 rounded-full", lv.dot, t.level >= 2 && "pulse-dot")} />{isCur ? lv.tag : done === conds.length && conds.length ? "CLEARED" : lv.tag}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                <div>
                  <p className="text-[9.5px] uppercase tracking-[0.08em] font-display font-semibold text-ink-soft">Trigger date</p>
                  <input type="date" value={t.trigger ?? ""} onChange={(e) => e.target.value && dispatch({ t: "SET_TRIGGER", caseId: c.id, stageId: sid, date: e.target.value })}
                    className="focusable num mt-0.5 w-full text-[11.5px] bg-transparent border-b border-mist pb-0.5" />
                </div>
                <div>
                  <p className="text-[9.5px] uppercase tracking-[0.08em] font-display font-semibold text-ink-soft">Target (SLA {def?.sla}d)</p>
                  <p className="num text-[11.5px] font-semibold mt-1">{t.target ? fmtDate(t.target) : "—"}</p>
                </div>
                <div>
                  <p className="text-[9.5px] uppercase tracking-[0.08em] font-display font-semibold text-ink-soft">Elapsed</p>
                  <p className={cx("num text-[11.5px] font-semibold mt-1", t.daysOver > 0 && "text-rust-600")}>{t.trigger ? `${t.elapsed}d${t.daysOver > 0 ? ` (+${t.daysOver})` : ""}` : "—"}</p>
                </div>
              </div>
              {conds.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] uppercase tracking-[0.09em] font-display font-bold text-ink-soft">Stage conditions</p>
                    <span className={cx("num text-[10px] font-bold px-1.5 py-0.5 rounded", done === conds.length ? "bg-pine-100 text-pine-800" : "bg-amber-100 text-amber-700")}>{done}/{conds.length}</span>
                  </div>
                  <div className="space-y-1">
                    {conds.map((cd, ci) => {
                      const key = `${sid}:${ci}`;
                      const on = !!c.conditionsDone?.[key];
                      return (
                        <button key={key} onClick={() => dispatch({ t: "TOGGLE_CONDITION", caseId: c.id, key, label: cd })}
                          className="focusable w-full flex items-start gap-2 text-left group py-0.5">
                          <span className={cx("mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all", on ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300 bg-card group-hover:border-pine-500")}>
                            {on && <Ic n="check" size={10} />}
                          </span>
                          <span className={cx("text-[11.5px] leading-snug", on ? "text-ink-soft line-through" : "text-ink")}>{cd}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {isCur && def?.tatNote && (
                <p className="mt-3 text-[11px] leading-snug border-l-2 border-amber-500 bg-amber-100/50 rounded-r px-2.5 py-1.5 text-amber-700 font-medium">{def.tatNote}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* escalation email */}
      {cur.level >= 1 && c.status === "OPEN" && (
        <div className={cx("border rounded-lg p-4 anim-up", cur.level >= 2 ? "border-rust-500/50 bg-rust-100/30" : "border-amber-500/50 bg-amber-100/30")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display font-bold text-[13.5px] tracking-tight">
              {curLevel.tag} escalation ready — <span className="text-ink-soft font-medium">send: {curLevel.who} · cc: {curLevel.copied}</span>
            </p>
            <Btn size="sm" variant="dark" onClick={copyEmail}><Ic n={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy escalation email"}</Btn>
          </div>
          {(() => {
            const bank = state.banks.find((b) => b.id === c.bankId)?.short ?? "";
            const em = escalationEmail(cur.level as 1 | 2 | 3, person.name, bank, curDef?.name ?? c.stage, c.ref, cur.daysOver);
            return <pre className="mt-3 text-[11.5px] leading-relaxed whitespace-pre-wrap font-body bg-card/80 border border-mist rounded-md px-3.5 py-3">{`Subject: ${em.subject}\n\n${em.body}`}</pre>;
          })()}
        </div>
      )}

      {/* bank application + client profile */}
      {(c.bankApp || true) && (
        <div className="grid lg:grid-cols-2 gap-3">
          {c.bankApp && (
            <div className="border border-mist bg-card rounded-lg p-4 anim-up">
              <p className="font-display font-bold text-[13px] tracking-tight mb-2.5">Bank application — {state.banks.find((b) => b.id === c.bankId)?.name}</p>
              <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-[12px]">
                {[
                  ["Bank officer", c.bankApp.officer], ["Officer email", c.bankApp.officerEmail],
                  ["Application ref", c.bankApp.appRef], ["Status", c.bankApp.status ? `${c.bankApp.status} · ${c.bankApp.statusDate ? fmtDate(c.bankApp.statusDate) : ""}` : undefined],
                  ["Rate", c.bankApp.rate != null ? `${c.bankApp.rate}%` : undefined], ["LTV", c.bankApp.ltv != null ? `${c.bankApp.ltv}%` : undefined],
                  ["Valuation fee", c.bankApp.valuationFee != null ? fmtAED(c.bankApp.valuationFee) : undefined], ["Offer expiry", c.bankApp.offerExpiry ? fmtDate(c.bankApp.offerExpiry) : undefined],
                  ["Insurance", c.bankApp.insuranceProvider],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-3 border-b border-mist/50 py-1">
                    <span className="text-ink-soft">{k}</span><span className="num font-semibold text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="border border-mist bg-card rounded-lg p-4 anim-up">
            <p className="font-display font-bold text-[13px] tracking-tight mb-2.5">Client information — {person.name}</p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-[12px]">
              {[
                ["Mobile", person.mobile], ["WhatsApp", person.whatsapp], ["Email", person.email],
                ["Nationality", person.nationality], ["Emirate", person.emirate],
                ["Employment", person.employment === "SALARIED" ? "Salaried" : "Self-employed"],
                ["Employer", person.employer], ["Sector", person.sector], ["Years employed", person.yearsEmployed ? String(person.yearsEmployed) : undefined],
                ["Credit score", person.creditScore], ["Assigned team", person.assignedTeam], ["Assigned RM", person.assignedRm],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b border-mist/50 py-1">
                  <span className="text-ink-soft">{k}</span><span className="num font-semibold text-right">{String(v)}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-b border-mist/50 py-1"><span className="text-ink-soft">Monthly salary</span><span className="num font-semibold">{person.monthlySalary ? fmtAED(person.monthlySalary) : "—"}</span></div>
              <div className="flex justify-between gap-3 border-b border-mist/50 py-1"><span className="text-ink-soft">Existing liabilities</span><span className="num font-semibold">{fmtAED(person.liabilities.reduce((s, l) => s + l.monthly, 0))}/m</span></div>
              <div className="flex justify-between gap-3 py-1"><span className="text-ink-soft">DBR (auto)</span><span className={cx("num font-bold", person.monthlySalary ? (person.liabilities.reduce((s, l) => s + l.monthly, 0) / person.monthlySalary) * 100 >= 50 ? "text-rust-600" : "text-pine-700" : "")}>{person.monthlySalary ? `${((person.liabilities.reduce((s, l) => s + l.monthly, 0) / person.monthlySalary) * 100).toFixed(1)}%` : "—"}</span></div>
            </div>
            <button onClick={() => nav.go("people", { params: { personId: person.id } })} className="focusable mt-3 text-[11.5px] font-display font-bold text-pine-700 hover:underline flex items-center gap-1"><Ic n="user" size={13} /> Open full client profile</button>
          </div>
        </div>
      )}

      {/* notes / clarifications */}
      <div className="border border-mist bg-card rounded-lg p-4 anim-up">
        <p className="font-display font-bold text-[13px] tracking-tight">Notes / clarifications <span className="text-ink-soft font-body font-normal text-[11.5px]">— save all comms for this file here</span></p>
        {c.status === "OPEN" && (
          <div className="flex gap-2 mt-2.5">
            <input value={note} onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { dispatch({ t: "ADD_CASE_NOTE", caseId: c.id, text: note }); setNote(""); } }}
              placeholder="e.g. Called banker Babar — FOL expected tomorrow before noon…"
              className="focusable flex-1 h-[34px] rounded-md border border-mist bg-paper/60 px-3 text-[12.5px]" />
            <Btn size="sm" disabled={!note.trim()} onClick={() => { dispatch({ t: "ADD_CASE_NOTE", caseId: c.id, text: note }); setNote(""); }}><Ic n="plus" size={13} /> Save</Btn>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {[...(c.caseNotes ?? [])].sort((a, b) => b.at.localeCompare(a.at)).map((n) => (
            <div key={n.id} className="flex gap-2.5 anim-tick">
              <Avatar name={state.users.find((u) => u.id === n.by)?.name ?? n.by} size={22} />
              <div className="min-w-0">
                <p className="text-[10.5px] text-ink-soft num">{state.users.find((u) => u.id === n.by)?.name ?? n.by} · {fmtTime(n.at)}</p>
                <p className="text-[12.5px] leading-relaxed">{n.text}</p>
              </div>
            </div>
          ))}
          {!(c.caseNotes ?? []).length && <p className="text-[12px] text-ink-soft italic">No notes saved yet.</p>}
        </div>
      </div>
      <p className="text-[10.5px] text-ink-soft">Logged by {me?.name} · trigger changes, condition clears and notes are written to the audit trail · source: Ops Guide Book Batch 1</p>
    </div>
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
