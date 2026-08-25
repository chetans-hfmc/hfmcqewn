/* ============================================================
   Cases — Pipeline Board (kanban) + List + Case 360 workspace
   "Where is it?" first: chevron strip, drag-to-advance board,
   pulsing current-stage markers, hover-reveal tooltips.
   ============================================================ */
import { useMemo, useState } from "react";
import type { BankQuery, Case, DocStatus, HandoffKind, Person, StageDef, Task } from "../types";
import { useMe, useNav, useStore, isOversight, teamOf } from "../store";
import { ESC_LEVELS, emi, escalationEmail, stageGates, tatFor } from "../calc";
import { Avatar, Btn, DateInput, Drawer, DueChip, EmptyState, Field, Ic, KV, Modal, NumInput, Pill, Select, TextArea, TextInput, cx, daysUntil, fmtAED, fmtDate, fmtN, fmtPct, fmtTime, nowISO, todayISO, uid } from "../ui";

const fmtDur = (min?: number) => {
  if (!min || min <= 0) return "";
  const dd = Math.floor(min / 1440), hh = Math.floor((min % 1440) / 60), mm = min % 60;
  const p: string[] = [];
  if (dd) p.push(`${dd}d`); if (hh) p.push(`${hh}h`); if (mm || !p.length) p.push(`${mm}m`);
  return p.join(" ");
};

const STAGE_TONE: Record<string, string> = {
  HANDOVER: "bg-gr-100 text-gr-700", INTAKE: "bg-gr-100 text-gr-700", FILEQC: "bg-steel-100 text-steel-700",
  SUBMIT: "bg-steel-100 text-steel-700", PREAPP: "bg-pine-100 text-pine-800", QUERY: "bg-rust-100 text-rust-700",
  VALUATION: "bg-amber-100 text-amber-700", FOL: "bg-pine-100 text-pine-800", DDA: "bg-pine-200 text-pine-800",
  BOOKING: "bg-pine-200 text-pine-800", RELEASE: "bg-amber-100 text-amber-700", TRANSFER: "bg-steel-100 text-steel-700",
  TITLEQC: "bg-steel-100 text-steel-700", CLOSURE: "bg-gr-100 text-gr-700",
};

const DOC_STATES: { v: DocStatus; l: string; chip: string }[] = [
  { v: "MISSING", l: "Missing", chip: "bg-rust-100 text-rust-700 border-rust-500/40" },
  { v: "RECEIVED", l: "Received", chip: "bg-amber-100 text-amber-700 border-amber-500/40" },
  { v: "VERIFIED", l: "Verified", chip: "bg-pine-100 text-pine-800 border-pine-500/40" },
  { v: "REJECTED", l: "Rejected", chip: "bg-ink/8 text-rust-700 border-rust-500/40" },
  { v: "NA", l: "N/A", chip: "bg-gr-100 text-gr-700 border-mist" },
];

const CLOSURE_AUDIT = [
  "Transaction type correctly identified", "Bank queries logged & closed", "Pre-Approval checked",
  "Valuation checked", "FOL QC completed & signed", "DDA confirmed", "Release documents collected (if applicable)",
  "Transfer completed", "Title deed received", "Title deed QC email sent", "Trackers updated",
  "Open actions closed / handed over", "Case marked complete",
];

type SortKey = "urgency" | "recent" | "value" | "ref";

export function CasesView() {
  const { state } = useStore();
  const me = useMe()!;
  const nav = useNav();
  const [mode, setMode] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [stageF, setStageF] = useState<string>(() => (typeof nav.params.stage === "string" && nav.params.stage ? nav.params.stage : "ALL"));
  const [scope, setScope] = useState<"mine" | "all">(isOversight(me.role) ? "all" : "mine");
  const [sort, setSort] = useState<SortKey>("urgency");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [preview, setPreview] = useState<Case | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [gateCase, setGateCase] = useState<Case | null>(null);
  const [toast, setToast] = useState("");

  const today = todayISO();
  const uName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";
  const personOf = (id: string) => state.persons.find((p) => p.id === id);

  const team = useMemo(() => teamOf(state, me), [state, me]);
  const inScope = (c: Case) => scope === "all" || (me.role === "TL" ? team.has(c.ownerId) : c.ownerId === me.id);

  const all = useMemo(() => state.cases.filter((c) =>
    (status === "ALL" ? true : c.status === status) &&
    (stageF === "ALL" || c.stage === stageF) && inScope(c) &&
    (!q.trim() || [c.ref, c.deal, c.bankRm, personOf(c.personId)?.name, state.banks.find((b) => b.id === c.bankId)?.short]
      .join(" ").toLowerCase().includes(q.trim().toLowerCase()))
  ), [state, status, stageF, scope, q, team]); // eslint-disable-line react-hooks/exhaustive-deps

  const urgency = (c: Case) => {
    const t = tatFor(c, c.stage, state.stages, today);
    const overdueTask = state.tasks.some((x) => x.caseId === c.id && x.status === "OPEN" && x.due && (daysUntil(x.due) ?? 0) < 0);
    if (t.level >= 2 || overdueTask) return 0;
    if (state.queries.some((x) => x.caseId === c.id && x.status === "OPEN")) return 1;
    if (t.level === 1) return 2;
    if (!c.nextAction || c.waitingFor) return 3;
    return 4;
  };
  const sorted = useMemo(() => {
    const arr = [...all];
    if (sort === "urgency") arr.sort((a, b) => urgency(a) - urgency(b) || a.ref.localeCompare(b.ref));
    if (sort === "recent") arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "value") arr.sort((a, b) => b.loanAmount - a.loanAmount);
    if (sort === "ref") arr.sort((a, b) => a.ref.localeCompare(b.ref));
    return arr;
  }, [all, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const setPg = (p: number) => setPage(Math.min(Math.max(0, p), pages - 1));

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  const drop = (c: Case, stageId: string) => {
    const from = state.stages.findIndex((s) => s.id === c.stage);
    const to = state.stages.findIndex((s) => s.id === stageId);
    if (to === from) return;
    if (to !== from + 1) { showToast("Files advance one stage at a time — through the evidence gate."); return; }
    setGateCase(c);
  };

  const stripStats = useMemo(() => state.stages.map((s) => {
    const cs = state.cases.filter((c) => c.status === "OPEN" && c.stage === s.id && inScope(c));
    return { s, n: cs.length, val: cs.reduce((t, c) => t + c.loanAmount, 0) };
  }), [state, scope, team]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxVal = Math.max(1, ...stripStats.map((x) => x.val));

  const pageNums = (cur: number, total: number) => {
    const out: (number | "…")[] = [];
    for (let i = 0; i < total; i++) {
      if (i === 0 || i === total - 1 || Math.abs(i - cur) <= 1) out.push(i);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  };

  return (
    <div className="space-y-4">
      {/* chevron pipeline strip — "where is everything?" at a glance */}
      <div className="flex gap-[3px] overflow-x-auto pb-1 anim-up">
        {stripStats.map(({ s, n, val }, i) => {
          const on = stageF === s.id;
          const clip = i === 0
            ? "polygon(0 0, calc(100% - 13px) 0, 100% 50%, calc(100% - 13px) 100%, 0 100%)"
            : "polygon(0 0, calc(100% - 13px) 0, 100% 50%, calc(100% - 13px) 100%, 0 100%, 13px 50%)";
          return (
            <button key={s.id} onClick={() => setStageF(on ? "ALL" : s.id)}
              className={cx("tip tip-b focusable relative shrink-0 min-w-[92px] px-4 py-2 text-left transition-all duration-200",
                i === 0 && "pl-3", on ? "bg-pine-700 text-paper shadow-md -translate-y-0.5" : n ? "bg-ink text-paper/90 hover:bg-pine-800 hover:-translate-y-0.5" : "bg-mist/60 text-ink-soft hover:bg-mist")}
              style={{ clipPath: clip }} data-tip={`${s.name} · SLA ${s.sla}d`}>
              <span className="flex items-baseline justify-between gap-2">
                <span className="num text-[9px] font-bold opacity-60">{String(i + 1).padStart(2, "0")}</span>
                <span className="num text-[15px] font-semibold leading-none">{n}</span>
              </span>
              <span className="block text-[10px] font-display font-bold tracking-wide mt-1 truncate">{s.short}</span>
              <span className="block h-[3px] mt-1.5 rounded-full overflow-hidden bg-current/20">
                <span className={cx("block h-full rounded-full", on ? "bg-paper" : "bg-pine-400")} style={{ width: `${Math.round((val / maxVal) * 100)}%` }} />
              </span>
            </button>
          );
        })}
        <button onClick={() => setStageF("ALL")}
          className={cx("focusable shrink-0 px-4 py-2 self-center rounded-md text-[11px] font-display font-bold transition-all",
            stageF === "ALL" ? "bg-amber-500 text-white shadow-sm" : "bg-card border border-mist text-ink-soft hover:border-amber-500 hover:text-amber-700")}>
          All stages
        </button>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 anim-up" style={{ animationDelay: "60ms" }}>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft"><Ic n="search" size={14} /></span>
          <TextInput value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Client, ref, RM, deal…" className="pl-8 w-[220px]" />
        </div>
        <div className="flex rounded-lg border border-mist overflow-hidden">
          {([["board", "grid", "Pipeline board"], ["list", "list", "List view"]] as const).map(([v, ic, label]) => (
            <button key={v} onClick={() => setMode(v)} data-tip={label}
              className={cx("tip tip-b focusable flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-display font-bold transition-all",
                mode === v ? "bg-ink text-paper" : "bg-card text-ink-soft hover:bg-mist/50")}>
              <Ic n={ic} size={13} />{v === "board" ? "Board" : "List"}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-mist overflow-hidden">
          {(["OPEN", "CLOSED", "ALL"] as const).map((v) => (
            <button key={v} onClick={() => { setStatus(v); setPage(0); }}
              className={cx("focusable px-3 py-2 text-[11px] font-display font-bold tracking-wide transition-all",
                status === v ? "bg-pine-700 text-paper" : "bg-card text-ink-soft hover:bg-mist/50")}>{v === "ALL" ? "All" : v[0] + v.slice(1).toLowerCase()}</button>
          ))}
        </div>
        <Select value={scope} onChange={(v) => { setScope(v as "mine" | "all"); setPage(0); }} className="w-[130px]"
          options={[{ v: "mine", l: me.role === "TL" ? "My team" : "My files" }, { v: "all", l: "All files" }]} />
        <Select value={sort} onChange={(v) => setSort(v as SortKey)} className="w-[150px]"
          options={[{ v: "urgency", l: "Sort · urgency" }, { v: "recent", l: "Sort · newest" }, { v: "value", l: "Sort · finance" }, { v: "ref", l: "Sort · ref" }]} />
        <span className="ml-auto num text-[11.5px] text-ink-soft"><strong className="text-ink">{sorted.length}</strong> files · {fmtAED(sorted.reduce((t, c) => t + c.loanAmount, 0))}</span>
      </div>

      {/* ===== BOARD MODE — kanban across the 14 stages ===== */}
      {mode === "board" && (
        <div className="anim-up overflow-x-auto pb-3 -mx-1 px-1">
          <div className="flex gap-3 items-start" style={{ minWidth: "max-content" }}>
            {state.stages.map((s, si) => {
              const cards = sorted.filter((c) => c.status === "OPEN" && c.stage === s.id);
              const closedN = state.cases.filter((c) => c.status === "CLOSED" && c.stage === s.id).length;
              return (
                <div key={s.id}
                  onDragOver={(e) => { e.preventDefault(); setOverCol(s.id); }}
                  onDragLeave={() => setOverCol((o) => (o === s.id ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault(); setOverCol(null);
                    const c = state.cases.find((x) => x.id === dragId);
                    if (c) drop(c, s.id);
                    setDragId(null);
                  }}
                  className={cx("w-[248px] shrink-0 rounded-lg border bg-card transition-all duration-200",
                    overCol === s.id ? "kcol-over border-pine-500" : "border-mist", dragId && overCol !== s.id && "opacity-75")}>
                  {/* column header — current-stage columns glow when live files sit in them */}
                  <div className={cx("tip tip-b flex items-center gap-2 px-3 py-2.5 border-b border-mist rounded-t-lg", cards.length ? "bg-pine-50/70" : "bg-paper/60")}
                    data-tip={`${s.name} · target SLA ${s.sla} working days`}>
                    <span className={cx("relative flex w-2 h-2 shrink-0")}>
                      {cards.length > 0 && <span className="absolute inline-flex w-full h-full rounded-full bg-pine-500 opacity-60 pulse-dot" />}
                      <span className={cx("relative inline-flex w-2 h-2 rounded-full", cards.length ? "bg-pine-600" : "bg-gr-300")} />
                    </span>
                    <span className="num text-[9.5px] font-bold text-ink-soft">{String(si + 1).padStart(2, "0")}</span>
                    <span className="text-[12px] font-display font-bold tracking-tight flex-1 truncate">{s.name}</span>
                    <span className={cx("num text-[10.5px] font-bold rounded-full px-2 py-[2px]", cards.length ? "bg-pine-700 text-paper" : "bg-mist/70 text-ink-soft")}>{cards.length}</span>
                  </div>

                  <div className="p-2 space-y-2 min-h-[90px] max-h-[520px] overflow-y-auto">
                    {cards.map((c) => {
                      const p = personOf(c.personId);
                      const t = tatFor(c, c.stage, state.stages, today);
                      const lv = ESC_LEVELS[t.level];
                      const openQ = state.queries.filter((x) => x.caseId === c.id && x.status === "OPEN").length;
                      return (
                        <div key={c.id} draggable
                          onDragStart={() => setDragId(c.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }}
                          onClick={() => setPreview(c)}
                          className={cx("group cursor-grab active:cursor-grabbing rounded-md border bg-card p-2.5 shadow-sm transition-all duration-150 hover:-translate-y-[2px] hover:shadow-md hover:border-pine-400 anim-tick",
                            dragId === c.id ? "opacity-40 border-pine-500" : "border-mist", t.level >= 2 && "border-rust-500/50")}>
                          <div className="flex items-center gap-1.5">
                            <span className="num text-[10px] font-bold text-pine-700">{c.ref}</span>
                            {t.level >= 2 && <span className="w-1.5 h-1.5 rounded-full bg-rust-500 pulse-rust" />}
                            <span className="ml-auto flex items-center -space-x-1.5">
                              <span data-tip={uName(c.ownerId)} className="tip tip-b"><Avatar name={uName(c.ownerId)} size={20} /></span>
                            </span>
                          </div>
                          <p className="text-[12.5px] font-semibold leading-tight mt-1.5 truncate" title={p?.name}>{p?.name}</p>
                          <p className="text-[10.5px] text-ink-soft truncate mt-0.5">
                            <span className="tip" data-tip={state.banks.find((b) => b.id === c.bankId)?.name ?? ""}>{state.banks.find((b) => b.id === c.bankId)?.short}</span>
                            {c.deal ? ` · ${c.deal}` : ""}{c.bankRm ? ` · ${c.bankRm}` : ""}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {c.loanAmount > 0 && <span className="num text-[10px] font-semibold bg-mist/60 rounded px-1.5 py-[2px]">{fmtAED(c.loanAmount)}</span>}
                            {openQ > 0 && <span className="num text-[9.5px] font-bold bg-steel-100 text-steel-700 rounded px-1.5 py-[2px]">{openQ} Q</span>}
                            {t.daysOver > 0 && <span className="num text-[9.5px] font-bold bg-rust-100 text-rust-700 rounded px-1.5 py-[2px]">+{t.daysOver}d</span>}
                            {t.level === 0 && t.trigger && <DueChip iso={t.target} />}
                          </div>
                          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className={cx("text-[8.5px] font-display font-bold tracking-wide rounded px-1.5 py-[2px]", lv.chip)}>{lv.tag}</span>
                            <button onClick={(e) => { e.stopPropagation(); nav.go("cases", { caseId: c.id }); }}
                              className="tip tip-b focusable ml-auto p-1 rounded text-pine-700 hover:bg-pine-100" data-tip="Open Case 360"><Ic n="arrowR" size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                    {cards.length === 0 && (
                      <p className={cx("text-center text-[10.5px] py-5 italic", overCol === s.id ? "text-pine-700 font-semibold" : "text-ink-soft/60")}>
                        {overCol === s.id ? "release to advance here" : closedN ? `${closedN} closed here` : "empty"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10.5px] text-ink-soft mt-2 flex items-center gap-2"><Ic n="help" size={12} /> Drag a card to the next stage — the evidence gate checks documents, tasks, queries & conditions before it moves. A pulsing column is live right now.</p>
        </div>
      )}

      {/* ===== LIST MODE ===== */}
      {mode === "list" && (
        <>
          <div className="bg-card border border-mist rounded-lg overflow-x-auto anim-up">
            <table className="w-full text-[13px] min-w-[980px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
                  <th className="px-4 py-2.5 font-semibold">Case</th>
                  <th className="px-3 py-2.5 font-semibold">Client</th>
                  <th className="px-3 py-2.5 font-semibold">Bank</th>
                  <th className="px-3 py-2.5 font-semibold">Stage</th>
                  <th className="px-3 py-2.5 font-semibold">Finance</th>
                  <th className="px-3 py-2.5 font-semibold">Owner</th>
                  <th className="px-3 py-2.5 font-semibold">Next due</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c, i) => {
                  const p = personOf(c.personId);
                  const t = tatFor(c, c.stage, state.stages, today);
                  const lv = ESC_LEVELS[t.level];
                  return (
                    <tr key={c.id} onClick={() => setPreview(c)}
                      className="group border-b border-mist/60 last:border-0 hover:bg-pine-50/40 cursor-pointer transition-colors anim-tick"
                      style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Ic n="eye" size={14} className="text-ink-soft/50 group-hover:text-pine-700 transition-colors" /><span className="num font-bold text-[12px] text-pine-700">{c.ref}</span></div></td>
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar name={p?.name ?? "?"} size={24} /><div><p className="font-semibold text-[12.5px]">{p?.name}</p>{c.deal && <p className="text-[10.5px] text-amber-700 font-medium">{c.deal}</p>}</div></div></td>
                      <td className="px-3 py-3"><span className="tip" data-tip={state.banks.find((b) => b.id === c.bankId)?.name ?? ""}><span className="text-[12px] font-medium">{state.banks.find((b) => b.id === c.bankId)?.short}</span></span><p className="text-[10.5px] text-ink-soft">{c.bankRm ? `RM ${c.bankRm}` : ""}</p></td>
                      <td className="px-3 py-3"><span className={cx("text-[10px] font-display font-bold uppercase tracking-wide rounded px-2 py-[3px]", STAGE_TONE[c.stage])}>{state.stages.find((s) => s.id === c.stage)?.short}</span>{t.level > 0 && <span className={cx("ml-1.5 text-[9px] font-display font-bold rounded px-1.5 py-[2px]", lv.chip)}>{lv.tag}</span>}</td>
                      <td className="px-3 py-3 num text-[12px]">{c.loanAmount ? fmtAED(c.loanAmount) : <span className="text-ink-soft/50 italic text-[11px]">—</span>}</td>
                      <td className="px-3 py-3"><span className="tip flex items-center gap-1.5 w-fit" data-tip={uName(c.ownerId)}><Avatar name={uName(c.ownerId)} size={22} /><span className="text-[12px]">{uName(c.ownerId).split(" ")[0]}</span></span></td>
                      <td className="px-3 py-3"><DueChip iso={c.nextActionDue} /></td>
                      <td className="px-3 py-3"><Pill tone={c.status === "CLOSED" ? "gr" : "pine"} dot>{c.status === "CLOSED" ? c.outcome === "WON" ? "Won" : "Closed" : "Open"}</Pill></td>
                      <td className="px-3 py-3 text-right"><button onClick={(e) => { e.stopPropagation(); nav.go("cases", { caseId: c.id }); }} className="tip tip-b focusable p-1.5 rounded-md text-ink-soft hover:text-pine-700 hover:bg-pine-100 transition-all opacity-0 group-hover:opacity-100" data-tip="Open Case 360"><Ic n="arrowR" size={15} /></button></td>
                    </tr>
                  );
                })}
                {!pageRows.length && <tr><td colSpan={9} className="px-4 py-14 text-center"><EmptyState icon="briefcase" title="No files match" sub="Adjust the stage filter, scope or search." /></td></tr>}
              </tbody>
            </table>
          </div>
          {/* pagination */}
          <div className="flex flex-wrap items-center gap-2 anim-up">
            <span className="num text-[11.5px] text-ink-soft">Showing <strong className="text-ink">{sorted.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, sorted.length)}</strong> of <strong className="text-ink">{sorted.length}</strong></span>
            <Select value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(0); }} className="w-[110px]"
              options={[{ v: "10", l: "10 / page" }, { v: "25", l: "25 / page" }, { v: "50", l: "50 / page" }]} />
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => setPg(0)} disabled={page === 0} className="focusable p-1.5 rounded-md border border-mist bg-card disabled:opacity-40 hover:border-pine-500 transition-all"><Ic n="chevL" size={12} /></button>
              {pageNums(page, pages).map((p, i) => p === "…"
                ? <span key={"e" + i} className="px-1 text-ink-soft text-[11px]">…</span>
                : <button key={p} onClick={() => setPg(p)} className={cx("focusable num min-w-[30px] h-[30px] rounded-md border text-[12px] font-semibold transition-all", p === page ? "bg-ink text-paper border-ink shadow-sm" : "bg-card border-mist hover:border-pine-500")}>{(p as number) + 1}</button>)}
              <button onClick={() => setPg(pages - 1)} disabled={page >= pages - 1} className="focusable p-1.5 rounded-md border border-mist bg-card disabled:opacity-40 hover:border-pine-500 transition-all"><Ic n="chevR" size={12} /></button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] bg-ink text-paper text-[12px] font-display font-semibold px-4 py-2.5 rounded-full shadow-xl anim-pop">{toast}</div>}

      {preview && <OverviewDrawer c={preview} onClose={() => setPreview(null)} />}
      {gateCase && <GateModal c={gateCase} onClose={() => setGateCase(null)} />}
    </div>
  );
}

/* ---------- Case Overview drawer (the click-through layer) ---------- */
function OverviewDrawer({ c, onClose }: { c: Case; onClose: () => void }) {
  const { state } = useStore();
  const nav = useNav();
  const [handoff, setHandoff] = useState(false);
  const today = todayISO();
  const p = state.persons.find((x) => x.id === c.personId);
  const t = tatFor(c, c.stage, state.stages, today);
  const lv = ESC_LEVELS[t.level];
  const tasks = state.tasks.filter((x) => x.caseId === c.id && x.status === "OPEN");
  const queries = state.queries.filter((x) => x.caseId === c.id && x.status === "OPEN");
  const idx = state.stages.findIndex((s) => s.id === c.stage);
  const chain = c.handoffs ?? [];
  const uName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;
  const last = c.tracker?.length ? c.tracker[c.tracker.length - 1] : undefined;

  return (
    <Drawer open onClose={onClose} width={470}
      title={<span className="flex items-center gap-2"><span className="num text-pine-700">{c.ref}</span><span className={cx("text-[9.5px] font-display font-bold tracking-wide rounded px-2 py-[3px]", lv.chip)}>{lv.tag}</span></span>}
      footer={<>
        <Btn variant="outline" onClick={() => setHandoff(true)}><Ic n="arrowR" size={13} /> Hand off</Btn>
        <Btn onClick={() => nav.go("cases", { caseId: c.id })}><Ic n="briefcase" size={14} /> Open Case 360</Btn>
      </>}>
      <div className="space-y-5">
        <div className="anim-tick">
          <p className="font-display font-bold text-[20px] tracking-tight">{p?.name}</p>
          <p className="text-[12px] text-ink-soft mt-0.5">{state.banks.find((b) => b.id === c.bankId)?.name}{c.deal ? ` · ${c.deal}` : ""}{c.bankRm ? ` · RM ${c.bankRm}` : ""}{c.channel ? ` · ${c.channel}` : ""}</p>
        </div>

        <div className="anim-tick" style={{ animationDelay: "40ms" }}>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft">Where it is</p>
            <span className="num text-[10.5px] text-ink-soft">stage {idx + 1}/{state.stages.length}</span>
          </div>
          <div className="flex gap-[3px]">{state.stages.map((s, j) => <span key={s.id} data-tip={s.name} className={cx("tip h-[6px] flex-1 rounded-full transition-colors", j < idx ? "bg-pine-500" : j === idx ? "bg-ink pulse-dot" : "bg-ink/12")} />)}</div>
          <p className="font-display font-bold text-[15px] mt-2">{state.stages[idx]?.name}{t.target ? <span className="num text-[11px] text-ink-soft font-normal ml-2">target {fmtDate(t.target)}{t.daysOver > 0 ? ` · ${t.daysOver}d over` : ""}</span> : ""}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 anim-tick" style={{ animationDelay: "80ms" }}>
          <KV k="Owner" v={uName(c.ownerId)} mono={false} />
          <KV k="Next action" v={c.nextAction ?? <span className="text-rust-600 font-semibold">not set</span>} mono={false} />
          <KV k="Due" v={c.nextActionDue ? fmtDate(c.nextActionDue) : "—"} />
          <KV k="Waiting for" v={c.waitingFor ?? "—"} mono={false} />
          <KV k="Blocker" v={c.blocker ?? <span className="text-pine-700">none</span>} mono={false} />
          <KV k="Expected revenue" v={fmtAED(c.expectedRevenue)} />
        </div>

        <div className="grid grid-cols-3 gap-2 anim-tick" style={{ animationDelay: "120ms" }}>
          {[
            { l: "Finance", v: c.loanAmount ? fmtAED(c.loanAmount) : "—" },
            { l: "Docs", v: `${c.docs.filter((d) => d.status === "VERIFIED" || d.status === "NA").length}/${c.docs.length}` },
            { l: "Open tasks", v: String(tasks.length) },
          ].map((x) => (
            <div key={x.l} className="rounded-md border border-mist bg-paper/50 px-3 py-2">
              <p className="text-[9.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft">{x.l}</p>
              <p className="num text-[14px] font-semibold mt-0.5 truncate">{x.v}</p>
            </div>
          ))}
        </div>

        {tasks.length > 0 && (
          <div className="anim-tick" style={{ animationDelay: "160ms" }}>
            <p className="text-[10px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft mb-2">Top open tasks</p>
            <div className="space-y-1.5">{tasks.slice(0, 3).map((tk) => (
              <div key={tk.id} className="flex items-center justify-between gap-2 border border-mist rounded-md px-3 py-2 text-[12px]">
                <span className="truncate">{tk.title}</span><DueChip iso={tk.due} />
              </div>))}</div>
          </div>
        )}
        {queries.length > 0 && (
          <div className="border border-steel-500/30 bg-steel-100/40 rounded-md px-3 py-2 text-[12px] anim-tick" style={{ animationDelay: "180ms" }}>
            <strong className="text-steel-700">{queries.length} bank quer{queries.length > 1 ? "ies" : "y"} open</strong> — latest: {queries[0].requirement.slice(0, 70)}…
          </div>
        )}
        {last && (
          <div className="border-l-2 border-pine-500 bg-paper/70 rounded-r px-3 py-2 anim-tick" style={{ animationDelay: "200ms" }}>
            <p className="num text-[9.5px] text-ink-soft font-bold uppercase tracking-[0.08em]">Latest position · {fmtDate(last.date)}</p>
            <p className="text-[12px] leading-snug mt-1">{last.note}</p>
          </div>
        )}
        {chain.length > 0 && (
          <div className="anim-tick" style={{ animationDelay: "220ms" }}>
            <p className="text-[10px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft mb-2">Custody chain</p>
            <div className="space-y-1.5">{[...chain].reverse().slice(0, 4).map((h, i) => (
              <p key={i} className="text-[11.5px] flex items-center gap-1.5"><Avatar name={uName(h.fromId)} size={16} /> <strong>{uName(h.fromId)}</strong> <Ic n="arrowR" size={11} className="text-pine-600" /> <strong>{uName(h.toId)}</strong> <span className="text-ink-soft num">· {h.kind} · {fmtDate(h.at.slice(0, 10))}</span></p>
            ))}</div>
          </div>
        )}
      </div>
      {handoff && <HandoffModal c={c} onClose={() => setHandoff(false)} />}
    </Drawer>
  );
}

/* ---------- Case 360 — spine + tabs workspace ---------- */
export function Case360({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const nav = useNav();
  const c = state.cases.find((x) => x.id === id);
  const [tab, setTab] = useState<string>(() => {
    const p = typeof nav.params.tab === "string" ? nav.params.tab : "";
    return ["docs", "tasks", "queries", "tat", "money", "log", "audit"].includes(p) ? p : "overview";
  });
  const [focus, setFocus] = useState(false);
  const [gate, setGate] = useState(false);
  const [panel, setPanel] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [queryModal, setQueryModal] = useState(false);
  const [closure, setClosure] = useState(false);
  const [auditChecked, setAuditChecked] = useState<boolean[]>([]);
  if (!c) return <EmptyState icon="briefcase" title="Case not found" sub="It may have been deleted." />;

  const p = state.persons.find((x) => x.id === c.personId);
  const today = todayISO();
  const idx = state.stages.findIndex((s) => s.id === c.stage);
  const def = state.stages[idx];
  const t = tatFor(c, c.stage, state.stages, today);
  const lv = ESC_LEVELS[t.level];
  const gates = stageGates(c, state.stages, state.tasks, state.queries);
  const tasks = state.tasks.filter((x) => x.caseId === c.id);
  const queries = state.queries.filter((x) => x.caseId === c.id);
  const uName = (uid2: string) => state.users.find((u) => u.id === uid2)?.name ?? uid2;
  const open = c.status === "OPEN";

  const TABS = [
    { id: "overview", l: "Overview", n: 0 },
    { id: "docs", l: "Documents", n: c.docs.length },
    { id: "tasks", l: "Tasks", n: tasks.filter((x) => x.status === "OPEN").length },
    { id: "queries", l: "Queries", n: queries.filter((x) => x.status === "OPEN").length },
    { id: "tat", l: "TAT", n: t.level },
    { id: "money", l: "Money", n: 0 },
    { id: "log", l: "Log", n: c.tracker?.length ?? 0 },
    { id: "audit", l: "Audit", n: state.audit.filter((a) => a.caseId === c.id).length },
  ];

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="anim-up">
        <button onClick={() => nav.go("cases")} className="focusable inline-flex items-center gap-1 text-[11.5px] font-display font-bold text-ink-soft hover:text-pine-700 transition-colors mb-2"><Ic n="chevL" size={12} /> Back to pipeline</button>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display font-bold text-[24px] tracking-tight leading-none">{p?.name}</h1>
              <span className="num text-[12px] font-bold text-pine-700 bg-pine-100 rounded px-2 py-[3px]">{c.ref}</span>
              <span className={cx("text-[9.5px] font-display font-bold tracking-wide rounded px-2 py-[3px]", lv.chip)}><span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 align-middle" />{lv.tag}</span>
              {!open && <Pill tone={c.outcome === "WON" ? "green" : "gr"} dot>{c.outcome === "WON" ? "Won & closed" : "Closed"}</Pill>}
            </div>
            <p className="text-[12px] text-ink-soft mt-1.5">{state.banks.find((b) => b.id === c.bankId)?.name}{c.deal ? ` · ${c.deal}` : ""}{c.bankRm ? ` · RM ${c.bankRm}` : ""}{c.channel ? ` · ${c.channel}` : ""} · owner {uName(c.ownerId)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setFocus(!focus)} data-tip={focus ? "Exit focus mode" : "Focus mode — hide spine"}
              className="tip tip-b focusable p-2 rounded-md border border-mist bg-card text-ink-soft hover:border-pine-500 hover:text-pine-700 transition-all"><Ic n={focus ? "x" : "target"} size={15} /></button>
            {open && <>
              <Btn variant="outline" onClick={() => setPanel(true)}><Ic n="edit" size={13} /> Control panel</Btn>
              <Btn variant="outline" onClick={() => setHandoff(true)}><Ic n="arrowR" size={13} /> Hand off</Btn>
              <Btn variant={gates.pass ? "primary" : "outline"} onClick={() => setGate(true)}>
                <Ic n={gates.pass ? "check" : "lock"} size={14} /> {gates.pass ? `Advance → ${gates.next?.short ?? ""}` : "Advance…"}
              </Btn>
              <Btn variant="dark" onClick={() => { setAuditChecked(CLOSURE_AUDIT.map(() => false)); setClosure(true); }}><Ic n="check" size={13} /> Close case</Btn>
            </>}
          </div>
        </div>
      </div>

      <div className={cx("gap-4", focus ? "" : "lg:grid lg:grid-cols-[230px_1fr]")}>
        {/* spine */}
        {!focus && (
          <aside className="anim-up space-y-3 mb-4 lg:mb-0">
            <div className="rounded-lg bg-ink text-paper p-4 sidebar-texture">
              <p className="text-[9.5px] uppercase tracking-[0.14em] font-display font-bold text-paper/50">Current stage</p>
              <p className="font-display font-bold text-[17px] tracking-tight mt-1">{def?.name}</p>
              <p className="num text-[10.5px] text-paper/60 mt-0.5">{t.trigger ? `trigger ${fmtDate(t.trigger)}` : "no trigger date"}{t.target ? ` · target ${fmtDate(t.target)}` : ""}</p>
              {/* vertical progress rail with pulsing "now" */}
              <div className="mt-3 space-y-0">
                {state.stages.map((s, j) => (
                  <div key={s.id} className="flex items-center gap-2 group">
                    <div className="flex flex-col items-center">
                      <span className={cx("w-[9px] h-[9px] rounded-full border-2 transition-all",
                        j < idx ? "bg-pine-400 border-pine-400" :
                          j === idx ? "bg-paper border-paper pulse-dot" : "bg-transparent border-paper/30")} />
                      {j < state.stages.length - 1 && <span className={cx("w-[2px] h-[11px]", j < idx ? "bg-pine-400/70" : "bg-paper/15")} />}
                    </div>
                    <span data-tip={`SLA ${s.sla}d`} className={cx("tip -mb-[3px] text-[10px] font-display font-bold tracking-wide truncate",
                      j < idx ? "text-paper/50" : j === idx ? "text-paper" : "text-paper/30")}>
                      <span className="num mr-1 opacity-60">{String(j + 1).padStart(2, "0")}</span>{s.short}
                      {j === idx && <span className="ml-1.5 inline-block w-1 h-1 rounded-full bg-amber-500 pulse-rust align-middle" />}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-mist bg-card p-3.5">
              {[
                ["Owner", uName(c.ownerId)],
                ["Ageing", `${Math.max(0, Math.round((Date.now() - new Date(c.createdAt).getTime()) / 864e5))}d`],
                ["Docs cleared", `${c.docs.filter((d) => d.status === "VERIFIED" || d.status === "NA").length}/${c.docs.length}`],
                ["Stage gates", `${gates.checks.filter((g) => g.pass).length}/${gates.checks.length} green`],
                ["Revenue", fmtAED(c.expectedRevenue)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1 border-b border-mist/50 last:border-0">
                  <span className="text-[10.5px] text-ink-soft">{k}</span>
                  <span className="num text-[11.5px] font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* tabs + content */}
        <section className="min-w-0">
          <div className="flex items-center gap-1 border-b border-mist overflow-x-auto anim-up">
            {TABS.map((tb) => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={cx("focusable relative shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px] font-display font-bold transition-all",
                  tab === tb.id ? "text-ink" : "text-ink-soft hover:text-ink")}>
                {tb.l}
                {tb.n > 0 && <span className={cx("num text-[9.5px] font-bold rounded-full px-1.5 py-[1px]", tab === tb.id ? "bg-pine-700 text-paper" : "bg-mist/70 text-ink-soft")}>{tb.n}</span>}
                {tab === tb.id && <span className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-t-full bg-ink anim-tick" />}
              </button>
            ))}
          </div>
          <div className="pt-4">
            {tab === "overview" && <OverviewTab c={c} idx={idx} gates={gates} tasks={tasks} queries={queries} setTab={setTab} />}
            {tab === "docs" && <DocsTab c={c} />}
            {tab === "tasks" && <TasksTab c={c} onAdd={() => setTaskModal(true)} />}
            {tab === "queries" && <QueriesTab c={c} onAdd={() => setQueryModal(true)} />}
            {tab === "tat" && <TatTab c={c} />}
            {tab === "money" && <MoneyTab c={c} />}
            {tab === "log" && <LogTab c={c} />}
            {tab === "audit" && <AuditTab caseId={c.id} />}
          </div>
        </section>
      </div>

      {gate && <GateModal c={c} onClose={() => setGate(false)} />}
      {panel && <ControlDrawer c={c} onClose={() => setPanel(false)} />}
      {handoff && <HandoffModal c={c} onClose={() => setHandoff(false)} />}
      {taskModal && <AddTaskModal caseId={c.id} stageId={c.stage} onClose={() => setTaskModal(false)} />}
      {queryModal && <AddQueryModal c={c} onClose={() => setQueryModal(false)} />}
      {closure && (
        <Modal open onClose={() => setClosure(false)} title={`Close ${c.ref} — audit checklist`} width={520}
          footer={<><Btn variant="ghost" onClick={() => setClosure(false)}>Cancel</Btn>
            <Btn variant="dark" disabled={auditChecked.some((v) => !v)}
              onClick={() => { dispatch({ t: "CLOSE_CASE", id: c.id, audit: CLOSURE_AUDIT.filter((_, i) => auditChecked[i]) }); setClosure(false); }}>
              <Ic n="check" size={14} /> Confirm & close</Btn></>}>
          <p className="text-[12px] text-ink-soft mb-3">{auditChecked.filter(Boolean).length}/{CLOSURE_AUDIT.length} confirmed. Transaction completion and administrative closure are separate controls — confirm every item.</p>
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {CLOSURE_AUDIT.map((item, i) => (
              <button key={i} onClick={() => setAuditChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                className={cx("focusable w-full flex items-center gap-2.5 px-3 py-2 rounded-md border text-left transition-all",
                  auditChecked[i] ? "border-pine-200 bg-pine-50" : "border-mist bg-card hover:border-pine-400")}>
                <span className={cx("w-[18px] h-[18px] rounded flex items-center justify-center shrink-0", auditChecked[i] ? "bg-pine-600 text-pine-50" : "border border-gr-300")}>{auditChecked[i] && <Ic n="check" size={10} />}</span>
                <span className={cx("text-[12.5px]", auditChecked[i] ? "text-pine-800 font-medium" : "")}>{item}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Overview tab: layered accordions ---------- */
function OverviewTab({ c, idx, gates, tasks, queries, setTab }: {
  c: Case; idx: number; gates: ReturnType<typeof stageGates>;
  tasks: Task[]; queries: BankQuery[]; setTab: (t: string) => void;
}) {
  const { state } = useStore();
  const [open, setOpen] = useState("where");
  const tog = (k: string) => setOpen((o) => (o === k ? "" : k));
  const today = todayISO();
  const t = tatFor(c, c.stage, state.stages, today);
  const def = state.stages[idx];
  const openTasks = tasks.filter((x) => x.status === "OPEN");
  const openQ = queries.filter((x) => x.status === "OPEN");
  const last = c.tracker?.length ? c.tracker[c.tracker.length - 1] : undefined;
  const chain = c.handoffs ?? [];
  const uName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;
  const monthly = c.loanAmount ? emi(c.loanAmount, c.rate, c.tenureMonths) : 0;
  const gatesGreen = gates.checks.filter((g) => g.pass).length;

  const Acc = ({ id: k, title, badge, delay = 0, children }: { id: string; title: string; badge?: React.ReactNode; delay?: number; children: React.ReactNode }) => (
    <div className="border border-mist rounded-lg overflow-hidden anim-up bg-card" style={{ animationDelay: `${delay}ms` }}>
      <button onClick={() => tog(k)} className="focusable w-full flex items-center gap-2.5 px-4 py-3 hover:bg-paper/60 transition-colors text-left">
        <Ic n="chevR" size={13} className={cx("text-ink-soft transition-transform duration-200 shrink-0", open === k && "rotate-90 text-pine-700")} />
        <span className="font-display font-bold text-[13px] tracking-tight flex-1">{title}</span>{badge}
      </button>
      {open === k && <div className="px-4 py-3.5 border-t border-mist anim-tick">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-2.5">
      <Acc id="where" title="Where we are" badge={<DueChip iso={t.target} />}>
        <p className="font-display font-bold text-[18px] tracking-tight">{def?.name}</p>
        <p className="num text-[11px] text-ink-soft mt-0.5">stage {idx + 1}/{state.stages.length} · SLA {def?.sla}d{t.trigger ? ` · trigger ${fmtDate(t.trigger)}` : " · no trigger set"}{t.daysOver > 0 ? ` · ${t.daysOver}d over` : ""}</p>
        <div className="flex gap-[3px] mt-2.5">{state.stages.map((s, j) => <span key={s.id} className={cx("h-[5px] flex-1 rounded-full", j < idx ? "bg-pine-500" : j === idx ? "bg-ink" : "bg-ink/12")} />)}</div>
        {def?.tatNote && <p className="mt-3 text-[11.5px] border-l-2 border-amber-500 bg-amber-100/50 rounded-r px-3 py-2 text-amber-700 font-medium">{def.tatNote}</p>}
        {last && <div className="mt-3 border-l-2 border-pine-500 bg-paper/70 rounded-r px-3 py-2"><p className="num text-[9.5px] text-ink-soft font-bold uppercase tracking-[0.08em]">Latest position · {fmtDate(last.date)}</p><p className="text-[12px] mt-1">{last.note}</p></div>}
      </Acc>

      <Acc id="next" title="What's next" delay={50} badge={c.nextActionDue ? <DueChip iso={c.nextActionDue} /> : <span className="text-[10.5px] font-semibold text-rust-600">no due date</span>}>
        <p className="text-[13px] font-semibold">{c.nextAction ?? <span className="text-rust-600">No next action set — this file will stall. Set one from the control panel.</span>}</p>
        {openTasks.slice(0, 3).map((tk) => (
          <div key={tk.id} className="flex items-center justify-between gap-3 border border-mist rounded-md px-3 py-2 text-[12px] bg-paper/40 mt-2">
            <span className="truncate">{tk.title}</span><DueChip iso={tk.due} />
          </div>
        ))}
        {openTasks.length > 0 && <button onClick={() => setTab("tasks")} className="focusable mt-3 text-[11.5px] font-display font-bold text-pine-700 hover:underline inline-flex items-center gap-1">All {openTasks.length} open tasks <Ic n="chevR" size={11} /></button>}
      </Acc>

      <Acc id="hold" title="Holding us up" delay={100}
        badge={c.waitingFor || c.blocker || openQ.length ? <Pill tone={c.blocker ? "rust" : "amber"}>{c.blocker ? "blocked" : c.waitingFor ? `waiting · ${c.waitingFor}` : `${openQ.length} query`}</Pill> : <Pill tone="pine">clear</Pill>}>
        {c.waitingFor || c.pendingReason || c.blocker || openQ.length ? (
          <div className="space-y-1.5 text-[12.5px]">
            {c.waitingFor && <p><span className="text-ink-soft">Waiting for:</span> <strong>{c.waitingFor}</strong></p>}
            {c.pendingReason && <p><span className="text-ink-soft">Why pending:</span> {c.pendingReason}</p>}
            {c.blocker && <p className="text-rust-600 font-semibold"><span className="text-ink-soft font-normal">Blocker:</span> {c.blocker}</p>}
            {openQ.length > 0 && <p><span className="text-ink-soft">Bank queries:</span> <button onClick={() => setTab("queries")} className="focusable font-bold text-steel-600 hover:underline">{openQ.length} open — view</button></p>}
          </div>
        ) : <p className="text-[12.5px] text-ink-soft">Nothing is blocking this file.</p>}
        <div className={cx("mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-[11.5px] font-semibold", gates.pass ? "bg-pine-50 text-pine-800 border border-pine-200" : "bg-paper/60 border border-mist text-ink-soft")}>
          <Ic n={gates.pass ? "check" : "layers"} size={13} /> Stage gates: {gatesGreen}/{gates.checks.length} green{gates.pass ? " — ready to advance" : " — clear docs, tasks & queries to advance"}
        </div>
      </Acc>

      <Acc id="money" title="Money" delay={150} badge={<span className="num text-[11px] font-semibold text-pine-700">{c.loanAmount ? fmtAED(c.loanAmount) : "—"}</span>}>
        <p className="num text-[12.5px]">{c.loanAmount ? <>loan <strong>{fmtAED(c.loanAmount)}</strong>{c.propertyValue ? <> · LTV <strong>{fmtPct((c.loanAmount / c.propertyValue) * 100, 1)}</strong></> : null} · EMI <strong>{fmtAED(monthly)}</strong>/mo · revenue <strong className="text-pine-700">{fmtAED(c.expectedRevenue)}</strong></> : "No finance recorded for this file."}</p>
        <button onClick={() => setTab("money")} className="focusable mt-2.5 text-[11.5px] font-display font-bold text-pine-700 hover:underline inline-flex items-center gap-1">Full money tab <Ic n="chevR" size={11} /></button>
      </Acc>

      {chain.length > 0 && (
        <Acc id="chain" title="Custody chain" delay={200} badge={<span className="num text-[10px] px-1.5 py-0.5 rounded-full bg-ink/8 text-ink-soft">{chain.length}</span>}>
          <div className="space-y-1.5">{[...chain].reverse().map((h, i) => (
            <p key={i} className="text-[12px] flex items-center gap-2"><Avatar name={uName(h.fromId)} size={18} /> <strong>{uName(h.fromId)}</strong> <Ic n="arrowR" size={11} className="text-pine-600" /> <strong>{uName(h.toId)}</strong> <span className="text-[10.5px] text-ink-soft num">· {h.kind} · {fmtDate(h.at.slice(0, 10))}</span></p>
          ))}</div>
        </Acc>
      )}
    </div>
  );
}

/* ---------- Documents tab ---------- */
function DocsTab({ c }: { c: Case }) {
  const { state, dispatch } = useStore();
  const byStage = state.stages.map((s) => ({ s, docs: c.docs.filter((d) => d.stageId === s.id) })).filter((x) => x.docs.length);
  const done = c.docs.filter((d) => d.status === "VERIFIED" || d.status === "NA").length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 anim-up">
        <div className="flex-1 h-[7px] rounded-full bg-mist overflow-hidden"><div className="h-full bg-pine-600 rounded-full transition-all duration-500" style={{ width: `${c.docs.length ? (done / c.docs.length) * 100 : 0}%` }} /></div>
        <span className="num text-[11.5px] font-semibold text-ink-soft">{done}/{c.docs.length} cleared</span>
      </div>
      {byStage.map(({ s, docs }) => (
        <div key={s.id} className="anim-up">
          <p className="text-[10px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft mb-2">{s.name}</p>
          <div className="grid md:grid-cols-2 gap-2">
            {docs.map((d) => {
              const dt = state.docTypes.find((t) => t.id === d.typeId)?.name ?? d.typeId;
              return (
                <div key={d.id} className="border border-mist rounded-md px-3 py-2.5 bg-card hover:border-pine-300 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-semibold truncate">{dt}</p>
                    <span className={cx("num text-[9.5px] font-bold rounded px-1.5 py-[2px] border", DOC_STATES.find((x) => x.v === d.status)?.chip)}>{d.status}</span>
                  </div>
                  {c.status === "OPEN" && (
                    <div className="flex gap-1 mt-2">
                      {DOC_STATES.map((st) => (
                        <button key={st.v} onClick={() => dispatch({ t: "SET_DOC", caseId: c.id, docId: d.id, status: st.v })}
                          className={cx("focusable text-[9.5px] font-display font-bold rounded px-2 py-[3px] border transition-all",
                            d.status === st.v ? st.chip : "border-mist text-ink-soft hover:border-pine-400 hover:text-pine-700")}>{st.l}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {!byStage.length && <EmptyState icon="file" title="No documents on this file" sub="Advance a stage to generate its checklist." />}
    </div>
  );
}

/* ---------- Tasks tab ---------- */
function TasksTab({ c, onAdd }: { c: Case; onAdd: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const tasks = state.tasks.filter((t) => t.caseId === c.id).sort((a, b) => Number(a.status === "DONE") - Number(b.status === "DONE") || (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const uName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;
  return (
    <div className="space-y-2">
      {c.status === "OPEN" && <div className="flex justify-end anim-up"><Btn variant="outline" onClick={onAdd}><Ic n="plus" size={13} /> New task</Btn></div>}
      {tasks.map((tk, i) => {
        const done = tk.status === "DONE";
        return (
          <div key={tk.id} className={cx("flex items-center gap-3 border rounded-md px-3.5 py-2.5 transition-all anim-tick", done ? "border-mist bg-paper/50 opacity-70" : "border-mist bg-card hover:border-pine-300")} style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}>
            <button onClick={() => dispatch({ t: "UPDATE_TASK", id: tk.id, patch: { status: done ? "OPEN" : "DONE" } })}
              className={cx("focusable w-[20px] h-[20px] rounded flex items-center justify-center shrink-0 transition-all", done ? "bg-pine-600 text-pine-50" : "border-2 border-gr-300 hover:border-pine-500")}>
              {done && <Ic n="check" size={11} />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={cx("text-[12.5px] font-semibold truncate", done && "line-through text-ink-soft")}>{tk.title}</p>
              <p className="num text-[10.5px] text-ink-soft mt-0.5">
                {state.stages.find((s) => s.id === tk.stageId)?.short} · {uName(tk.ownerId)}
                {tk.estimateMinutes ? ` · est ${fmtDur(tk.estimateMinutes)}` : ""}
                {tk.waitingFor ? ` · waiting: ${tk.waitingFor}` : ""}
                {done && tk.completedAt ? ` · done ${fmtTime(tk.completedAt)} by ${tk.completedBy ? uName(tk.completedBy) : "—"}` : ""}
              </p>
            </div>
            <Pill tone={tk.priority === "HIGH" ? "rust" : tk.priority === "MEDIUM" ? "amber" : "gr"}>{tk.priority}</Pill>
            {!done ? <DueChip iso={tk.due} /> : <span className="text-[10.5px] text-ink-soft num">{tk.completedAt ? fmtDate(tk.completedAt.slice(0, 10)) : ""}</span>}
          </div>
        );
      })}
      {!tasks.length && <EmptyState icon="check" title="No tasks yet" sub={c.status === "OPEN" ? "Add the first task for this stage." : "—"} />}
    </div>
  );
}

/* ---------- Queries tab ---------- */
function QueriesTab({ c, onAdd }: { c: Case; onAdd: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const qs = state.queries.filter((q) => q.caseId === c.id);
  return (
    <div className="space-y-2.5">
      {c.status === "OPEN" && <div className="flex justify-end anim-up"><Btn variant="outline" onClick={onAdd}><Ic n="plus" size={13} /> Log query</Btn></div>}
      {qs.map((q, i) => (
        <div key={q.id} className="border border-mist rounded-lg px-4 py-3 bg-card anim-tick" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="num text-[11px] font-bold text-steel-700 bg-steel-100 rounded px-2 py-[3px]">{q.ref}</span>
            <span className="text-[10.5px] text-ink-soft">{state.banks.find((b) => b.id === q.bankId)?.short} · received {fmtDate(q.receivedAt)}{q.due ? ` · due ${fmtDate(q.due)}` : ""}</span>
            <Pill tone={q.status === "OPEN" ? "rust" : q.status === "RESPONDED" ? "amber" : "green"} dot>{q.status.toLowerCase()}</Pill>
          </div>
          <p className="text-[12.5px] font-semibold mt-2">{q.requirement}</p>
          {q.response && <p className="text-[12px] text-ink-soft mt-1 border-l-2 border-pine-400 pl-2.5">Response: {q.response}</p>}
          {c.status === "OPEN" && (
            <div className="flex gap-2 mt-2.5">
              {q.status === "OPEN" && <Btn size="sm" variant="outline" onClick={() => dispatch({ t: "UPDATE_QUERY", id: q.id, patch: { status: "RESPONDED", response: q.response ?? "Response sent to bank" } })}><Ic n="send" size={12} /> Mark responded</Btn>}
              <Btn size="sm" variant="dark" onClick={() => dispatch({ t: "UPDATE_QUERY", id: q.id, patch: { status: "CLOSED" } })}><Ic n="check" size={12} /> QC & close</Btn>
            </div>
          )}
        </div>
      ))}
      {!qs.length && <EmptyState icon="help" title="No bank queries" sub="Queries raised by the bank are logged here." />}
    </div>
  );
}

/* ---------- TAT tab ---------- */
function TatTab({ c }: { c: Case }) {
  const { state, dispatch } = useStore();
  const today = todayISO();
  const hist = c.stageHistory.map((h) => h.stageId).filter((v, i, a) => a.indexOf(v) === i);
  const bank = state.banks.find((b) => b.id === c.bankId)?.short ?? "";
  const client = state.persons.find((p) => p.id === c.personId)?.name ?? "";
  const cur = tatFor(c, c.stage, state.stages, today);
  return (
    <div className="space-y-2.5">
      {hist.map((sid, i) => {
        const def = state.stages.find((s) => s.id === sid);
        const t = tatFor(c, sid, state.stages, today);
        const lv = ESC_LEVELS[t.level];
        const conds = def?.conditions ?? [];
        const done = conds.filter((_, ci) => c.conditionsDone?.[`${sid}:${ci}`]).length;
        const isCur = sid === c.stage;
        return (
          <div key={sid} className={cx("border rounded-lg p-3.5 bg-card anim-up", isCur ? "border-pine-600 shadow-md" : "border-mist")} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-display font-bold text-[13.5px] tracking-tight">{def?.name}</p>
              <span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[9.5px] font-display font-bold tracking-[0.08em]", lv.chip)}><span className={cx("w-1.5 h-1.5 rounded-full", lv.dot, t.level >= 2 && "pulse-rust")} />{lv.tag}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              <div><p className="text-[9.5px] uppercase tracking-[0.08em] font-display font-semibold text-ink-soft">Trigger date</p>
                <input type="date" value={t.trigger ?? ""} onChange={(e) => e.target.value && dispatch({ t: "SET_TRIGGER", caseId: c.id, stageId: sid, date: e.target.value })}
                  className="focusable num mt-0.5 w-full text-[11.5px] bg-transparent border-b border-mist pb-0.5" /></div>
              <div><p className="text-[9.5px] uppercase tracking-[0.08em] font-display font-semibold text-ink-soft">Target (SLA {def?.sla}d)</p><p className="num text-[11.5px] font-semibold mt-1">{t.target ? fmtDate(t.target) : "—"}</p></div>
              <div><p className="text-[9.5px] uppercase tracking-[0.08em] font-display font-semibold text-ink-soft">Elapsed</p><p className={cx("num text-[11.5px] font-semibold mt-1", t.daysOver > 0 && "text-rust-600")}>{t.trigger ? `${t.elapsed}d${t.daysOver > 0 ? ` (+${t.daysOver})` : ""}` : "—"}</p></div>
            </div>
            {conds.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-[0.09em] font-display font-bold text-ink-soft">Stage conditions</p>
                  <span className={cx("num text-[10px] font-bold px-1.5 py-0.5 rounded", done === conds.length ? "bg-pine-100 text-pine-800" : "bg-amber-100 text-amber-700")}>{done}/{conds.length}</span>
                </div>
                <div className="space-y-1">{conds.map((cd, ci) => {
                  const key = `${sid}:${ci}`;
                  const on = !!c.conditionsDone?.[key];
                  return (
                    <button key={key} onClick={() => dispatch({ t: "TOGGLE_CONDITION", caseId: c.id, key, label: cd })} className="focusable w-full flex items-start gap-2 text-left group py-0.5">
                      <span className={cx("mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all", on ? "bg-pine-600 border-pine-600 text-pine-50" : "border-gr-300 group-hover:border-pine-500")}>{on && <Ic n="check" size={10} />}</span>
                      <span className={cx("text-[11.5px] leading-snug", on ? "text-ink-soft line-through" : "")}>{cd}</span>
                    </button>
                  );
                })}</div>
              </div>
            )}
            {isCur && t.level >= 1 && (() => {
              const em = escalationEmail(t.level as 1 | 2 | 3, client, bank, def?.name ?? sid, c.ref, t.daysOver);
              return (
                <div className={cx("mt-3 rounded-md border px-3 py-2.5", t.level >= 2 ? "border-rust-500/50 bg-rust-100/30" : "border-amber-500/50 bg-amber-100/30")}>
                  <p className="text-[11px] font-semibold">{lv.tag} — send: {lv.who} · cc: {lv.copied}</p>
                  <Btn size="sm" variant="dark" className="mt-2" onClick={() => { navigator.clipboard?.writeText(`Subject: ${em.subject}\n\n${em.body}`); }}>
                    <Ic n="copy" size={12} /> Copy escalation email
                  </Btn>
                </div>
              );
            })()}
          </div>
        );
      })}
      {!hist.length && <EmptyState icon="timer" title="No stage history" />}
    </div>
  );
}

/* ---------- Money tab ---------- */
function MoneyTab({ c }: { c: Case }) {
  const { state } = useStore();
  const monthly = c.loanAmount ? emi(c.loanAmount, c.rate, c.tenureMonths) : 0;
  const calcs = state.calcs.filter((x) => x.linkId === c.id);
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-2.5 anim-up">
        {[
          ["Property value", c.propertyValue ? fmtAED(c.propertyValue) : "—"],
          ["Loan amount", c.loanAmount ? fmtAED(c.loanAmount) : "—"],
          ["Applied LTV", c.loanAmount && c.propertyValue ? fmtPct((c.loanAmount / c.propertyValue) * 100, 1) : "—"],
          ["Rate", `${fmtN(c.rate, 2)}%`], ["Tenure", `${c.tenureMonths} mo`],
          ["Monthly EMI", c.loanAmount ? fmtAED(monthly) : "—"],
          ["Expected revenue", fmtAED(c.expectedRevenue)],
          ["Total payments", c.loanAmount ? fmtAED(monthly * c.tenureMonths) : "—"],
          ["Total profit", c.loanAmount ? fmtAED(monthly * c.tenureMonths - c.loanAmount) : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-mist bg-card px-3.5 py-3 hover:border-pine-300 transition-colors">
            <p className="text-[10px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft">{k}</p>
            <p className="num text-[16px] font-semibold mt-1">{v}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft mb-2">Saved calculations (rule-versioned)</p>
        {calcs.length ? calcs.map((x) => (
          <div key={x.id} className="border border-mist rounded-md px-3.5 py-2.5 bg-card mb-2 anim-tick">
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[12.5px] font-semibold">{x.label}</span><span className="num text-[10px] text-ink-soft">{fmtTime(x.at)}</span></div>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">{x.rulesUsed.map((r) => <span key={r.code + r.version} className="num text-[9.5px] font-bold bg-pine-100 text-pine-800 rounded px-1.5 py-[2px]">{r.code} v{r.version}</span>)}</div>
          </div>
        )) : <EmptyState icon="calc" title="No saved calculations" sub="Run a calculator and attach it to this case — the rule versions are stamped." />}
      </div>
    </div>
  );
}

/* ---------- Log tab ---------- */
function LogTab({ c }: { c: Case }) {
  const { state, dispatch } = useStore();
  const [note, setNote] = useState("");
  const today = todayISO();
  const entries = [...(c.tracker ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-4">
      {c.status === "OPEN" && (
        <div className="border border-pine-200 bg-pine-50/60 rounded-md p-3.5 anim-up">
          <p className="font-display font-bold text-[13px] mb-2">Log today's position · <span className="num">{fmtDate(today)}</span></p>
          <div className="flex gap-2">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { dispatch({ t: "SET_TRACKER", caseId: c.id, date: today, note }); setNote(""); } }}
              placeholder="e.g. FOL received — signing booked for Monday…" className="flex-1" />
            <Btn disabled={!note.trim()} onClick={() => { dispatch({ t: "SET_TRACKER", caseId: c.id, date: today, note }); setNote(""); }}><Ic n="check" size={13} /> Save</Btn>
          </div>
        </div>
      )}
      <div className="space-y-2.5">
        {entries.map((e, i) => (
          <div key={e.date} className="flex gap-3 anim-tick" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
            <div className="flex flex-col items-center"><span className={cx("mt-1 w-2.5 h-2.5 rounded-full shrink-0", i === 0 ? "bg-pine-600 pulse-dot" : "bg-pine-300")} /><span className="w-px flex-1 bg-mist" /></div>
            <div className="pb-1 min-w-0"><p className="num text-[11px] font-bold text-pine-700">{fmtDate(e.date)}</p><p className="text-[12.5px] leading-relaxed whitespace-pre-line">{e.note}</p></div>
          </div>
        ))}
        {!entries.length && <EmptyState icon="calendar" title="No daily log yet" sub="Positions logged here also appear on the Morning Board." />}
      </div>
    </div>
  );
}

/* ---------- Audit tab ---------- */
function AuditTab({ caseId }: { caseId: string }) {
  const { state } = useStore();
  const rows = state.audit.filter((a) => a.caseId === caseId);
  const uName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;
  return (
    <div className="space-y-2">
      {rows.map((a, i) => (
        <div key={a.id} className="flex items-start gap-3 border border-mist rounded-md px-3.5 py-2.5 bg-card anim-tick" style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}>
          <Avatar name={uName(a.by)} size={22} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px]"><strong>{a.action}</strong> — {a.target}</p>
            {a.detail && <p className="text-[11px] text-ink-soft truncate">{a.detail}</p>}
          </div>
          <span className="num text-[10px] text-ink-soft shrink-0">{fmtTime(a.at)}</span>
        </div>
      ))}
      {!rows.length && <EmptyState icon="clock" title="No audit entries" />}
    </div>
  );
}

/* ---------- shared modals ---------- */
function GateModal({ c, onClose }: { c: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const gates = stageGates(c, state.stages, state.tasks, state.queries);
  return (
    <Modal open onClose={onClose} title={`Advance ${c.ref} → ${gates.next?.name ?? "?"}`} width={500}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!gates.pass || !gates.next} onClick={() => { dispatch({ t: "ADVANCE_STAGE", id: c.id }); onClose(); }}>
          <Ic n="arrowR" size={14} /> Advance stage</Btn></>}>
      <p className="text-[12px] text-ink-soft mb-3">Evidence-based gate — every check must be green before the file moves. This protects the next owner.</p>
      <div className="space-y-1.5">
        {gates.checks.map((g) => (
          <div key={g.label} className={cx("flex items-center gap-2.5 rounded-md border px-3 py-2.5", g.pass ? "border-pine-200 bg-pine-50" : "border-rust-500/40 bg-rust-100/30")}>
            <Ic n={g.pass ? "check" : "x"} size={14} className={g.pass ? "text-pine-700" : "text-rust-600"} />
            <span className="text-[12.5px] font-semibold flex-1">{g.label}</span>
            <span className={cx("num text-[10.5px] font-bold", g.pass ? "text-pine-700" : "text-rust-600")}>{g.detail}</span>
          </div>
        ))}
      </div>
      {!gates.next && <p className="text-[12px] text-ink-soft mt-3">This is the final stage — close the case instead.</p>}
    </Modal>
  );
}

function HandoffModal({ c, onClose }: { c: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ toId: "", kind: "progression" as HandoffKind, reason: "" });
  const p = state.persons.find((x) => x.id === c.personId);
  return (
    <Modal open onClose={onClose} title={`Hand off ${c.ref} · ${p?.name ?? ""}`} width={460}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.toId || f.reason.trim().length < 4} onClick={() => { dispatch({ t: "HANDOFF_CASE", id: c.id, toId: f.toId, reason: f.reason.trim(), kind: f.kind }); onClose(); }}>
          <Ic n="arrowR" size={14} /> Hand off</Btn></>}>
      <p className="text-[12px] text-ink-soft mb-3">Single active owner — the file lives with one person at a time. The transfer is written to the custody chain and the audit trail.</p>
      <div className="space-y-3.5">
        <Field label="Transfer to" req><Select value={f.toId} onChange={(v) => setF({ ...f, toId: v })} options={[{ v: "", l: "Select…" }, ...state.users.filter((u) => u.active && u.id !== me?.id).map((u) => ({ v: u.id, l: `${u.name} · ${u.role}` }))]} /></Field>
        <Field label="Reason" req><Select value={f.kind} onChange={(v) => setF({ ...f, kind: v as HandoffKind })}
          options={[{ v: "progression", l: "Stage progression" }, { v: "absence", l: "Leave / absence cover" }, { v: "rebalance", l: "Workload rebalance" }, { v: "correction", l: "Return for correction" }]} /></Field>
        <Field label="Note" req><TextArea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Moving to FOL stage — client confirmed terms" /></Field>
      </div>
    </Modal>
  );
}

function ControlDrawer({ c, onClose }: { c: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [f, setF] = useState({
    ownerId: c.ownerId, nextAction: c.nextAction ?? "", nextActionDue: c.nextActionDue ?? todayISO(),
    waitingFor: c.waitingFor ?? "", pendingReason: c.pendingReason ?? "", blocker: c.blocker ?? "", expectedRevenue: c.expectedRevenue,
  });
  return (
    <Drawer open onClose={onClose} title={`Control panel · ${c.ref}`} width={440}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => {
          dispatch({ t: "PATCH_CASE", id: c.id, patch: { ...f, waitingFor: f.waitingFor || undefined, pendingReason: f.pendingReason || undefined, blocker: f.blocker || undefined, nextAction: f.nextAction || undefined, nextActionDue: f.nextActionDue || undefined } });
          onClose();
        }}>Save panel</Btn></>}>
      <p className="text-[12px] text-ink-soft mb-4">Every open case must have an owner, a next action and a due date.</p>
      <div className="space-y-4">
        <Field label="Owner"><Select value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
        <Field label="Next action"><TextInput value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.target.value })} placeholder="e.g. Chase valuation report" /></Field>
        <Field label="Next action due"><DateInput value={f.nextActionDue} onChange={(e) => setF({ ...f, nextActionDue: e.target.value })} /></Field>
        <Field label="Waiting for"><Select value={f.waitingFor} onChange={(v) => setF({ ...f, waitingFor: v })} options={[{ v: "", l: "— not waiting —" }, ...state.waitingTypes.map((w) => ({ v: w, l: w }))]} /></Field>
        <Field label="Why pending"><Select value={f.pendingReason} onChange={(v) => setF({ ...f, pendingReason: v })} options={[{ v: "", l: "— none —" }, ...state.pendingReasons.map((w) => ({ v: w, l: w }))]} /></Field>
        <Field label="Blocker"><TextInput value={f.blocker} onChange={(e) => setF({ ...f, blocker: e.target.value })} placeholder="Optional" /></Field>
        <Field label="Expected revenue"><NumInput value={f.expectedRevenue} onChange={(n) => setF({ ...f, expectedRevenue: n })} suffix="AED" /></Field>
      </div>
    </Drawer>
  );
}

function AddTaskModal({ caseId, stageId, onClose }: { caseId: string; stageId: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ title: "", ownerId: me?.id ?? "", priority: "MEDIUM" as Task["priority"], due: todayISO(), stageId, ed: 0, eh: 0, em: 0 });
  const est = f.ed * 1440 + f.eh * 60 + f.em;
  return (
    <Modal open onClose={onClose} title="New task" width={500}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.title.trim()} onClick={() => {
          dispatch({ t: "ADD_TASK", task: { id: "t" + uid(), caseId, stageId: f.stageId, title: f.title.trim(), ownerId: f.ownerId, priority: f.priority, due: f.due, status: "OPEN", createdAt: nowISO(), estimateMinutes: est || undefined } });
          onClose();
        }}>Create task</Btn></>}>
      <div className="grid grid-cols-2 gap-3.5">
        <div className="col-span-2"><Field label="Task" req><TextInput autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Collect updated bank statements" /></Field></div>
        <Field label="Stage"><Select value={f.stageId} onChange={(v) => setF({ ...f, stageId: v })} options={state.stages.map((s) => ({ v: s.id, l: s.name }))} /></Field>
        <Field label="Owner"><Select value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} options={state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))} /></Field>
        <Field label="Priority"><Select value={f.priority} onChange={(v) => setF({ ...f, priority: v as Task["priority"] })} options={[{ v: "HIGH", l: "High" }, { v: "MEDIUM", l: "Medium" }, { v: "LOW", l: "Low" }]} /></Field>
        <Field label="Due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        <div className="col-span-2"><Field label="Expected time to complete" hint={est ? `= ${fmtDur(est)}` : "days · hours · minutes"}>
          <div className="grid grid-cols-3 gap-2">
            <NumInput value={f.ed} onChange={(n) => setF({ ...f, ed: n })} suffix="d" />
            <NumInput value={f.eh} onChange={(n) => setF({ ...f, eh: n })} suffix="h" />
            <NumInput value={f.em} onChange={(n) => setF({ ...f, em: n })} suffix="m" />
          </div>
        </Field></div>
      </div>
    </Modal>
  );
}

function AddQueryModal({ c, onClose }: { c: Case; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ requirement: "", bankId: c.bankId, due: todayISO(), ownerId: me?.id ?? "" });
  return (
    <Modal open onClose={onClose} title={`Log bank query · ${c.ref}`} width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.requirement.trim()} onClick={() => {
          dispatch({ t: "ADD_QUERY", q: { id: "q" + uid(), caseId: c.id, ref: "BQ-" + (100 + state.queries.length + 1), bankId: f.bankId, requirement: f.requirement.trim(), ownerId: f.ownerId, receivedAt: nowISO(), due: f.due, status: "OPEN" } });
          onClose();
        }}>Log query</Btn></>}>
      <div className="space-y-3.5">
        <Field label="Bank requirement" req><TextArea autoFocus rows={3} value={f.requirement} onChange={(e) => setF({ ...f, requirement: e.target.value })} placeholder="Copy the bank's exact request…" /></Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Bank"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v })} options={state.banks.map((b) => ({ v: b.id, l: b.name }))} /></Field>
          <Field label="Response due"><DateInput value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
}
