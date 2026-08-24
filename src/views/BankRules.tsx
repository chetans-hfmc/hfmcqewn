import { useMemo, useState } from "react";
import type { AxisDef, EligGate, ProductDef, ProductVersion, Promo, RateCell, RateIndex, RateStructure } from "../types";
import { useMe, useStore } from "../store";
import { rateRecipe, resolveCellRate } from "../calc";
import { Btn, DangerModal, Field, Ic, Modal, NumInput, Pill, Select, TextArea, TextInput, cx, fmtAED, fmtDate, nowISO, todayISO, uid } from "../ui";

const STATUS_TONE: Record<string, string> = { DRAFT: "gr", SCHEDULED: "steel", ACTIVE: "pine", RETIRED: "amber" };

function axisLabel(defs: AxisDef[], axisId: string, val: string): string {
  const ax = defs.find((a) => a.id === axisId);
  return ax?.values.find((v) => v.v === val)?.l ?? val;
}

export default function BankRulesView() {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [bankF, setBankF] = useState<string>("ALL");
  const [selDef, setSelDef] = useState<string | null>(state.productDefs[0]?.id ?? null);
  const [selVer, setSelVer] = useState<number | null>(null);
  const [tab, setTab] = useState("grid");
  const [showAxes, setShowAxes] = useState(false);
  const [showPromos, setShowPromos] = useState(false);
  const [draftPv, setDraftPv] = useState<ProductVersion | null>(null);
  const [delDef, setDelDef] = useState<ProductDef | null>(null);
  const [promoModal, setPromoModal] = useState<Promo | null>(null);

  const eibor = state.eibor[state.eibor.length - 1];
  const isAdmin = me?.role === "ADMIN" || me?.role === "HEAD";

  const defs = useMemo(
    () => state.productDefs.filter((p) => (bankF === "ALL" ? true : p.bankId === bankF)),
    [state.productDefs, bankF],
  );
  const prod = state.productDefs.find((p) => p.id === selDef) ?? defs[0] ?? null;
  const activeVer = prod ? prod.versions.find((v) => v.status === "ACTIVE") ?? prod.versions[prod.versions.length - 1] : null;
  const ver = draftPv ?? (prod ? (selVer != null ? prod.versions.find((v) => v.version === selVer) ?? activeVer : activeVer) : null);
  const editable = isAdmin && ver != null && (ver.status === "DRAFT" || draftPv != null);

  const newDraft = () => {
    if (!prod || !activeVer) return;
    const next: ProductVersion = { ...activeVer, version: activeVer.version + 1, status: "DRAFT", createdAt: nowISO(), author: me?.id, effectiveFrom: undefined, source: undefined };
    next.eligibility = { ...activeVer.eligibility, gates: activeVer.eligibility.gates.map((g) => ({ ...g })) };
    next.grid = { cells: activeVer.grid.cells.map((c) => ({ ...c, key: { ...c.key } })) };
    setDraftPv(next); setSelVer(null); setTab("grid");
  };
  const saveDraft = () => {
    if (!prod || !draftPv) return;
    const isNew = !prod.versions.some((v) => v.version === draftPv.version);
    dispatch({ t: "SAVE_PV", productId: prod.id, pv: draftPv, isNew });
    setDraftPv(null); setSelVer(draftPv.version);
  };

  const GROUPS = [
    { id: "grid", l: "Rate Grid" }, { id: "elig", l: "Eligibility" }, { id: "tenure", l: "Tenure & Age" },
    { id: "fees", l: "Fees" }, { id: "afford", l: "Affordability" }, { id: "docs", l: "Documents" }, { id: "tat", l: "TAT" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 anim-up">
        <div>
          <h1 className="font-display font-bold text-[24px] tracking-tight">Bank Rule Engine</h1>
          <p className="text-[12.5px] text-ink-soft mt-0.5">Admin-only · Global → Bank → Product, most specific wins · rates are recipes, resolved live against EIBOR {eibor ? `(3M ${eibor.m3}%)` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" onClick={() => setShowAxes(true)}><Ic n="sliders" size={13} /> Axes ({state.axes.length})</Btn>
          <Btn variant="outline" size="sm" onClick={() => setShowPromos(true)}><Ic n="timer" size={13} /> Promos ({state.promos.length})</Btn>
          {isAdmin && prod && <Btn size="sm" onClick={newDraft}><Ic n="plus" size={13} /> New version draft</Btn>}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-4">
        {/* left: bank tree */}
        <div className="lg:col-span-3 anim-up bg-card border border-mist rounded-lg p-3 self-start">
          <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-2 px-1">Bank → Product</p>
          <button onClick={() => { setBankF("ALL"); }} className={cx("w-full text-left px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-colors", bankF === "ALL" ? "bg-ink text-paper" : "hover:bg-paper/70")}>All banks</button>
          {state.banks.map((b) => {
            const prods = state.productDefs.filter((p) => p.bankId === b.id);
            return (
              <div key={b.id}>
                <button onClick={() => setBankF(bankF === b.id ? "ALL" : b.id)}
                  className={cx("w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-colors mt-0.5", bankF === b.id ? "bg-pine-700 text-paper" : "hover:bg-paper/70")}>
                  <span>{b.short}</span><span className={cx("num text-[10px]", bankF === b.id ? "text-pine-200" : "text-ink-soft")}>{prods.length}</span>
                </button>
                {(bankF === b.id || bankF === "ALL") && prods.map((p) => (
                  <button key={p.id} onClick={() => { setSelDef(p.id); setSelVer(null); setDraftPv(null); }}
                    className={cx("w-full text-left pl-6 pr-2 py-1.5 rounded-md text-[11.5px] transition-colors", prod?.id === p.id ? "bg-pine-50 text-pine-800 font-semibold" : "text-ink-soft hover:bg-paper/70")}>
                    {p.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* right: product editor */}
        <div className="lg:col-span-9 space-y-3">
          {prod && ver ? (
            <>
              {/* product header + version chips */}
              <div className="anim-up bg-card border border-mist rounded-lg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="num text-[11px] font-bold text-pine-700">{state.banks.find((b) => b.id === prod.bankId)?.name} · {prod.loanType}</p>
                    <h2 className="font-display font-bold text-[19px] tracking-tight mt-0.5">{prod.name}</h2>
                    <p className="text-[11px] text-ink-soft mt-0.5 num">axes: {prod.axes.map((a) => state.axes.find((x) => x.id === a)?.name ?? a).join(" · ") || "none"}{prod.tags?.length ? ` · ${prod.tags.join(", ")}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[...prod.versions].reverse().map((v) => (
                      <button key={v.version} onClick={() => { setSelVer(v.version); setDraftPv(null); }}
                        className={cx("px-2.5 py-1 rounded-md border text-[11px] font-display font-bold transition-all", ver.version === v.version && !draftPv ? "bg-ink text-paper border-ink" : "border-mist hover:border-pine-600")}>
                        v{v.version}
                      </button>
                    ))}
                    {draftPv && <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 border border-amber-500/50 text-[11px] font-display font-bold">v{draftPv.version} · editing</span>}
                    <Pill tone={STATUS_TONE[ver.status] ?? "gr"}>{ver.status}</Pill>
                    {isAdmin && !draftPv && ver.status !== "ACTIVE" && (
                      <Btn size="sm" onClick={() => dispatch({ t: "ACTIVATE_PV", productId: prod.id, version: ver.version, effectiveFrom: todayISO() })}><Ic n="check" size={12} /> Activate</Btn>
                    )}
                    {isAdmin && !draftPv && (
                      <button onClick={() => setDelDef(prod)} className="p-1.5 rounded-md text-ink-soft hover:text-rust-600 hover:bg-rust-100 transition-colors" title="Delete product"><Ic n="trash" size={14} /></button>
                    )}
                  </div>
                </div>
                {ver.source && <p className="text-[10.5px] text-ink-soft mt-2 num">source: {ver.source}{ver.effectiveFrom ? ` · effective ${fmtDate(ver.effectiveFrom)}` : ""}{ver.effectiveTo ? ` → ${fmtDate(ver.effectiveTo)}` : ""}</p>}
                {draftPv && (
                  <div className="flex items-center justify-between mt-3 bg-amber-100/50 border border-amber-500/40 rounded-md px-3.5 py-2.5">
                    <p className="text-[11.5px] text-amber-700 font-medium">Editing draft v{draftPv.version} — nothing goes live until you activate it.</p>
                    <div className="flex gap-2">
                      <Btn size="sm" variant="ghost" onClick={() => setDraftPv(null)}>Discard</Btn>
                      <Btn size="sm" variant="dark" onClick={saveDraft}><Ic n="check" size={12} /> Save draft</Btn>
                    </div>
                  </div>
                )}
              </div>

              {/* group tabs */}
              <div className="flex gap-1 border-b border-mist overflow-x-auto anim-up">
                {GROUPS.map((g) => (
                  <button key={g.id} onClick={() => setTab(g.id)}
                    className={cx("relative px-3.5 py-2.5 text-[12.5px] font-display font-bold whitespace-nowrap transition-colors", tab === g.id ? "text-ink" : "text-ink-soft hover:text-ink")}>
                    {g.l}
                    {tab === g.id && <span className="absolute left-2 right-2 -bottom-px h-[2.5px] rounded-full bg-pine-700" />}
                  </button>
                ))}
              </div>

              {/* group body */}
              <div className="anim-tick" key={tab}>
                {tab === "grid" && (
                  <div className="bg-card border border-mist rounded-lg overflow-x-auto">
                    <table className="w-full text-[12px] min-w-[700px]">
                      <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
                        <th className="px-4 py-2.5 font-semibold">Profile ({prod.axes.length ? prod.axes.map((a) => state.axes.find((x) => x.id === a)?.name).join(" × ") : "flat"})</th>
                        <th className="px-3 py-2.5 font-semibold">Structure</th>
                        <th className="px-3 py-2.5 font-semibold">Recipe</th>
                        <th className="px-3 py-2.5 font-semibold">Today's rate</th>
                        <th className="px-3 py-2.5 font-semibold">Note</th>
                      </tr></thead>
                      <tbody>
                        {ver.grid.cells.map((cell) => {
                          const rate = resolveCellRate(cell, eibor);
                          return (
                            <tr key={cell.id} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/40 transition-colors">
                              <td className="px-4 py-2.5 font-medium">
                                {Object.entries(cell.key).length ? Object.entries(cell.key).map(([k, v]) => <span key={k} className="inline-block mr-1.5 mb-0.5 rounded bg-steel-100 text-steel-700 px-1.5 py-[2px] text-[10.5px] font-semibold">{axisLabel(state.axes, k, v)}</span>) : <span className="text-ink-soft">all profiles</span>}
                              </td>
                              <td className="px-3 py-2.5"><Pill tone={cell.structure === "FIXED" ? "pine" : cell.structure === "MARGIN_INDEX" ? "steel" : "amber"}>{cell.structure.replace("_", " ")}</Pill></td>
                              <td className="px-3 py-2.5 num text-[11px]">{rateRecipe(cell)}</td>
                              <td className="px-3 py-2.5 num font-bold text-pine-700">{rate != null ? `${rate.toFixed(2)}%` : "—"}</td>
                              <td className="px-3 py-2.5 text-[11px] text-ink-soft">{cell.note ?? ""}</td>
                            </tr>
                          );
                        })}
                        {ver.grid.cells.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft text-[12px]">No rate cells yet.</td></tr>}
                      </tbody>
                    </table>
                    <p className="px-4 py-2.5 text-[10.5px] text-ink-soft bg-paper/50 border-t border-mist">Rates are stored as recipes (margin + index + floor) and resolved against the latest EIBOR fix — they never go stale.</p>
                  </div>
                )}

                {tab === "elig" && (
                  <div className="grid lg:grid-cols-2 gap-4">
                    <div className="bg-card border border-mist rounded-lg p-4">
                      <p className="font-display font-bold text-[13.5px] tracking-tight mb-3">Eligibility thresholds</p>
                      <div className="grid grid-cols-2 gap-x-4">
                        {[
                          ["Min salary", ver.eligibility.minSalary], ["Min income", ver.eligibility.minIncome],
                          ["Min service (mo)", ver.eligibility.minServiceMonths], ["Min LOB (yrs)", ver.eligibility.minLobYears],
                          ["Max age — salaried", ver.eligibility.maxAgeSalaried], ["Max age — self emp", ver.eligibility.maxAgeSelfEmp],
                          ["Min loan", ver.eligibility.minLoan], ["Max loan", ver.eligibility.maxLoan],
                        ].map(([k, v]) => (
                          <div key={k as string} className="flex justify-between gap-3 border-b border-mist/50 py-1.5 text-[12px]">
                            <span className="text-ink-soft">{k}</span>
                            <span className="num font-semibold">{typeof v === "number" ? (String(k).toLowerCase().includes("loan") || String(k).toLowerCase().includes("salary") || String(k).toLowerCase().includes("income") ? fmtAED(v) : v) : "—"}</span>
                          </div>
                        ))}
                        {ver.eligibility.incomeBasis && <div className="col-span-2 flex justify-between gap-3 border-b border-mist/50 py-1.5 text-[12px]"><span className="text-ink-soft">Income basis</span><span className="font-semibold text-right">{ver.eligibility.incomeBasis}</span></div>}
                      </div>
                      {ver.eligibility.ltvMatrix && Object.keys(ver.eligibility.ltvMatrix).length > 0 && (
                        <>
                          <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mt-3 mb-1.5">LTV matrix</p>
                          {Object.entries(ver.eligibility.ltvMatrix).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-3 border-b border-mist/50 py-1.5 text-[12px]"><span className="text-ink-soft">{k}</span><span className="num font-semibold">{v}%</span></div>
                          ))}
                        </>
                      )}
                      {(ver.eligibility.notes ?? []).map((n, i) => <p key={i} className="text-[11px] text-amber-700 bg-amber-100/50 border-l-2 border-amber-500 rounded-r px-2.5 py-1.5 mt-2">{n}</p>)}
                    </div>
                    <div className="bg-card border border-mist rounded-lg p-4">
                      <p className="font-display font-bold text-[13.5px] tracking-tight mb-1.5">Eligibility gates</p>
                      <p className="text-[10.5px] text-ink-soft mb-3">Evaluated first, fail-fast — before any pricing.</p>
                      <div className="space-y-2">
                        {ver.eligibility.gates.map((g) => (
                          <div key={g.id} className="flex items-start gap-2.5 border border-mist rounded-md px-3 py-2.5 bg-paper/40">
                            <span className={cx("w-2 h-2 rounded-full mt-1.5 shrink-0", g.hardStop ? "bg-rust-500" : "bg-amber-500")} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium">{g.label}</p>
                              <p className="num text-[10.5px] text-ink-soft mt-0.5">{g.kind.replace("_", " ")}{g.values?.length ? ` · ${g.values.join(", ")}` : ""} · {g.hardStop ? "hard stop" : "warn"}</p>
                            </div>
                          </div>
                        ))}
                        {ver.eligibility.gates.length === 0 && <p className="text-[11.5px] text-ink-soft italic">No gates — open to all profiles the bank serves.</p>}
                      </div>
                    </div>
                  </div>
                )}

                {tab === "tenure" && (
                  <div className="bg-card border border-mist rounded-lg p-4 max-w-xl">
                    <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Tenure & age</p>
                    <div className="grid grid-cols-2 gap-x-4">
                      <div className="flex justify-between gap-3 border-b border-mist/50 py-1.5 text-[12px]"><span className="text-ink-soft">Max tenure</span><span className="num font-semibold">{ver.tenure.maxMonths ? `${ver.tenure.maxMonths} mo` : "—"}</span></div>
                      <div className="flex justify-between gap-3 border-b border-mist/50 py-1.5 text-[12px]"><span className="text-ink-soft">Payment holiday</span><span className="font-semibold">{ver.tenure.paymentHoliday ?? "—"}</span></div>
                      <div className="flex justify-between gap-3 py-1.5 text-[12px]"><span className="text-ink-soft">Interest-only year 1</span><span className="font-semibold">{ver.tenure.interestOnlyYear1 ? "Yes" : "No"}</span></div>
                    </div>
                    {ver.tenure.note && <p className="text-[11px] text-ink-soft mt-2">{ver.tenure.note}</p>}
                  </div>
                )}

                {tab === "fees" && (
                  <div className="bg-card border border-mist rounded-lg p-4 max-w-xl">
                    <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Fees & charges</p>
                    {([
                      ["Processing fee", ver.fees.processingPct != null ? `${ver.fees.processingPct}%${ver.fees.processingMin ? ` (min ${fmtAED(ver.fees.processingMin)})` : ""}` : "—"],
                      ["Valuation fee", ver.fees.valuation != null ? fmtAED(ver.fees.valuation) : "—"],
                      ["Pre-approval fee", ver.fees.preApproval != null ? (ver.fees.preApproval === 0 ? "Free" : fmtAED(ver.fees.preApproval)) : "—"],
                      ["Early settlement", ver.fees.earlySettlement ?? "—"],
                      ["Partial settlement", ver.fees.partialSettlement ?? "—"],
                      ["Life insurance", ver.fees.lifeInsurance ?? "—"],
                      ["Property insurance", ver.fees.propertyInsurance ?? "—"],
                      ["Fee financing", ver.fees.feeFinancing ? "Yes" : "No"],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-mist/50 py-1.5 text-[12px] last:border-0"><span className="text-ink-soft">{k}</span><span className="font-semibold text-right">{v}</span></div>
                    ))}
                    {ver.fees.processingNote && <p className="text-[11px] text-ink-soft mt-2">{ver.fees.processingNote}</p>}
                  </div>
                )}

                {tab === "afford" && (
                  <div className="bg-card border border-mist rounded-lg p-4 max-w-xl">
                    <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Affordability / DBR</p>
                    {([
                      ["Max DBR", ver.affordability.maxDBR != null ? `${ver.affordability.maxDBR}%` : "—"],
                      ["Credit card liability", ver.affordability.ccPct != null ? `${ver.affordability.ccPct}% of limit` : "—"],
                      ["Stress mode", ver.affordability.stressMode ?? "—"],
                      ["Rental income counted", ver.affordability.rentalPct != null ? `${ver.affordability.rentalPct}%` : "—"],
                      ["Bonus counted", ver.affordability.bonusPct != null ? `${ver.affordability.bonusPct}%` : "—"],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-mist/50 py-1.5 text-[12px] last:border-0"><span className="text-ink-soft">{k}</span><span className="num font-semibold">{v}</span></div>
                    ))}
                  </div>
                )}

                {tab === "docs" && (
                  <div className="bg-card border border-mist rounded-lg overflow-hidden max-w-2xl">
                    {ver.documents.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-mist/60 last:border-0">
                        <Ic n="file" size={15} className="text-ink-soft" />
                        <span className="flex-1 text-[12.5px] font-medium">{d.name}</span>
                        <Pill tone={d.required ? "pine" : "gr"}>{d.required ? "required" : "optional"}</Pill>
                      </div>
                    ))}
                    {ver.documents.length === 0 && <p className="px-4 py-6 text-[12px] text-ink-soft">No bank-specific documents — the generic stage checklist applies.</p>}
                  </div>
                )}

                {tab === "tat" && (
                  <div className="bg-card border border-mist rounded-lg p-4 max-w-xl">
                    <p className="font-display font-bold text-[13.5px] tracking-tight mb-2">Bank TAT & validity (working days)</p>
                    {([
                      ["Pre-approval TAT", ver.tat.paDays], ["Valuation TAT", ver.tat.valuationDays],
                      ["FOL TAT", ver.tat.folDays], ["Disbursal TAT", ver.tat.disbursalDays],
                      ["Total expected TAT", ver.tat.totalDays],
                    ] as [string, number | undefined][]).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-mist/50 py-1.5 text-[12px]"><span className="text-ink-soft">{k}</span><span className="num font-semibold">{v != null ? `${v}d` : "—"}</span></div>
                    ))}
                    {([
                      ["PA validity", ver.tat.paValidityDays], ["FOL validity", ver.tat.folValidityDays],
                    ] as [string, number | undefined][]).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-mist/50 py-1.5 text-[12px]"><span className="text-ink-soft">{k}</span><span className="num font-semibold">{v != null ? `${v} days` : "—"}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-card border border-mist rounded-lg anim-up">
              <div className="px-6 py-12 text-center">
                <Ic n="layers" size={26} className="mx-auto text-ink-soft/50" />
                <p className="font-display font-bold text-[15px] mt-2">No product selected</p>
                <p className="text-[12px] text-ink-soft mt-1">Pick a bank product from the left, or ingest a bank's sheet to create one.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* axes modal */}
      <Modal open={showAxes} onClose={() => setShowAxes(false)} title="Pricing axis registry" width={560}>
        <p className="text-[12px] text-ink-soft mb-3">Shared pricing dimensions. Each product picks which axes its rate grid keys on. {state.axes.length} registered.</p>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {state.axes.map((a) => (
            <div key={a.id} className="border border-mist rounded-md px-3.5 py-2.5">
              <p className="font-display font-bold text-[12.5px]">{a.name} <span className="num text-[10px] text-ink-soft font-normal">· {a.id}</span></p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {a.values.map((v) => <span key={v.v} className="rounded bg-steel-100 text-steel-700 px-1.5 py-[2px] text-[10.5px] font-semibold">{v.l}</span>)}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* promos modal */}
      <Modal open={showPromos} onClose={() => setShowPromos(false)} title="Promotions (time-bound overlays)" width={620}>
        <p className="text-[12px] text-ink-soft mb-3">Overlays that override product rules within a window, then auto-expire.</p>
        <div className="space-y-2">
          {state.promos.map((p) => {
            const live = p.from <= todayISO() && (!p.to || p.to >= todayISO());
            return (
              <div key={p.id} className="border border-mist rounded-md px-3.5 py-2.5 flex items-start gap-3">
                <Pill tone={live ? "pine" : "gr"}>{live ? "live" : p.to && p.to < todayISO() ? "expired" : "upcoming"}</Pill>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[12.5px]">{p.name} <span className="text-ink-soft font-normal num text-[10.5px]">· {state.banks.find((b) => b.id === p.bankId)?.short ?? "all banks"}</span></p>
                  <p className="text-[11.5px] text-ink-soft mt-0.5">{p.summary}</p>
                  <p className="num text-[10.5px] text-ink-soft mt-0.5">{fmtDate(p.from)} → {p.to ? fmtDate(p.to) : "open"}</p>
                </div>
                {isAdmin && <button onClick={() => dispatch({ t: "DELETE_PROMO", id: p.id })} className="p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="trash" size={13} /></button>}
              </div>
            );
          })}
          {state.promos.length === 0 && <p className="text-[12px] text-ink-soft italic">No promotions.</p>}
        </div>
      </Modal>

      {delDef && (
        <DangerModal open onClose={() => setDelDef(null)} title="Delete product" target={delDef.name}
          warn="The product and all its versions are removed from the rule engine. Calculations already saved keep their stamped versions."
          confirmLabel="Delete product"
          onConfirm={(reason) => { dispatch({ t: "DELETE_PRODUCT_DEF", id: delDef.id, reason }); setSelDef(null); setDelDef(null); }} />
      )}
    </div>
  );
}
