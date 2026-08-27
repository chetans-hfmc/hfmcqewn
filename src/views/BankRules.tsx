import { useMemo, useState } from "react";
import type { AxisDef, ProductDef, ProductVersion, Promo, RateCell, RateIndex, RateStructure } from "../types";
import { useMe, useStore } from "../store";
import { cellRate, cellRecipe, currentEiborFix } from "../decision";
import { Btn, DangerModal, Field, Ic, Modal, NumInput, Pill, Select, TextArea, TextInput, cx, fmtDate, nowISO, todayISO, uid } from "../ui";

const STATUS_TONE: Record<string, string> = { DRAFT: "gr", SCHEDULED: "steel", ACTIVE: "pine", RETIRED: "amber" };

function axisLabel(defs: AxisDef[], axisId: string, val: string): string {
  const ax = defs.find((a) => a.id === axisId);
  return ax?.values.find((v) => v.v === val)?.l ?? val;
}

const blankPv = (): ProductVersion => ({
  version: 1, status: "DRAFT", createdAt: nowISO(),
  eligibility: { gates: [], ltvMatrix: {} }, tenure: { maxMonths: 300 }, grid: { cells: [] },
  fees: {}, affordability: { maxDBR: 50, ccPct: 5 }, documents: [], tat: {},
});

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
  const [newProd, setNewProd] = useState(false);
  const [promoModal, setPromoModal] = useState(false);

  const eibor = currentEiborFix(state.eibor);
  const isAdmin = me?.role === "ADMIN" || me?.role === "HEAD";

  const defs = useMemo(() => state.productDefs.filter((p) => (bankF === "ALL" ? true : p.bankId === bankF)), [state.productDefs, bankF]);
  const prod = state.productDefs.find((p) => p.id === selDef) ?? defs[0] ?? null;
  const activeVer = prod ? prod.versions.find((v) => v.status === "ACTIVE") ?? [...prod.versions].sort((a, b) => b.version - a.version)[0] : null;
  const ver = draftPv ?? (prod ? (selVer != null ? prod.versions.find((v) => v.version === selVer) ?? activeVer : activeVer) : null);
  const editable = isAdmin && ver != null && (ver.status === "DRAFT" || draftPv != null);

  const newDraft = () => {
    if (!prod || !activeVer) return;
    const next: ProductVersion = { ...activeVer, version: activeVer.version + 1, status: "DRAFT", createdAt: nowISO(), effectiveFrom: undefined, source: undefined };
    next.eligibility = { ...activeVer.eligibility, gates: activeVer.eligibility.gates.map((g) => ({ ...g })), ltvMatrix: { ...(activeVer.eligibility.ltvMatrix ?? {}) } };
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
  const setPv = (patch: Partial<ProductVersion>) => {
    if (!editable || !ver) return;
    const next = { ...ver, ...patch };
    if (draftPv) setDraftPv(next);
    else if (prod) { setDraftPv({ ...next, status: next.status === "ACTIVE" ? "DRAFT" : next.status }); }
  };
  const V = ({ children }: { children: React.ReactNode }) => <span className="text-[12.5px] font-medium">{children}</span>;
  const Txt = ({ get, put, w = 200, placeholder }: { get: string | undefined; put: (s: string) => void; w?: number; placeholder?: string }) =>
    editable ? <span style={{ display: "inline-block", width: w }}><TextInput className="w-full h-[30px] text-[12px]" value={get ?? ""} onChange={(e) => put(e.target.value)} placeholder={placeholder} /></span>
      : <V>{get || "—"}</V>;

  return (
    <div className="space-y-4">
      <div className="anim-up flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[24px] tracking-tight">Bank Rule Engine</h1>
          <p className="text-[12.5px] text-ink-soft mt-0.5">Admin-only · Global → Bank → Product, most specific wins · rates are recipes resolved live against EIBOR {eibor ? `3M ${eibor.m3}%` : "(fix unpublished — pricing UNKNOWN)"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="outline" size="sm" onClick={() => setShowAxes(true)}><Ic n="sliders" size={13} /> Axes ({state.axes.length})</Btn>
          <Btn variant="outline" size="sm" onClick={() => setShowPromos(true)}><Ic n="timer" size={13} /> Promos ({state.promos.length})</Btn>
          {isAdmin && <Btn variant="outline" size="sm" onClick={() => setNewProd(true)}><Ic n="plus" size={13} /> New product</Btn>}
          {isAdmin && prod && <Btn size="sm" onClick={newDraft}><Ic n="plus" size={13} /> New version draft</Btn>}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-4">
        {/* bank tree */}
        <div className="lg:col-span-3 anim-up bg-card border border-mist rounded-lg p-3 self-start">
          <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-2 px-1">Bank → Product</p>
          <button onClick={() => setBankF("ALL")} className={cx("focusable w-full text-left px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-colors", bankF === "ALL" ? "bg-ink text-paper" : "hover:bg-paper/70")}>All banks</button>
          {state.banks.map((b) => {
            const prods = state.productDefs.filter((p) => p.bankId === b.id);
            return (
              <div key={b.id}>
                <button onClick={() => setBankF(bankF === b.id ? "ALL" : b.id)}
                  className={cx("focusable w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-colors mt-0.5", bankF === b.id ? "bg-pine-700 text-paper" : "hover:bg-paper/70")}>
                  <span>{b.short}</span><span className={cx("num text-[10px]", bankF === b.id ? "text-pine-200" : "text-ink-soft")}>{prods.length}</span>
                </button>
                {(bankF === b.id || bankF === "ALL") && prods.map((p) => (
                  <button key={p.id} onClick={() => { setSelDef(p.id); setSelVer(null); setDraftPv(null); }}
                    className={cx("focusable w-full text-left pl-6 pr-2 py-1.5 rounded-md text-[11.5px] transition-colors", prod?.id === p.id ? "bg-pine-50 text-pine-800 font-semibold" : "text-ink-soft hover:bg-paper/70")}>
                    {p.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* product editor */}
        <div className="lg:col-span-9 space-y-3">
          {prod && ver ? (
            <>
              <div className="anim-up bg-card border border-mist rounded-lg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="num text-[11px] font-bold text-pine-700">{state.banks.find((b) => b.id === prod.bankId)?.name} · {prod.loanType}</p>
                    <h2 className="font-display font-bold text-[19px] tracking-tight mt-0.5">{prod.name}</h2>
                    <p className="text-[11px] text-ink-soft mt-0.5 num">axes: {prod.axes.map((a) => state.axes.find((x) => x.id === a)?.name ?? a).join(" · ") || "none"}{prod.tags?.length ? ` · ${prod.tags.join(", ")}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[...prod.versions].sort((a, b) => b.version - a.version).map((v) => (
                      <button key={v.version} onClick={() => { setSelVer(v.version); setDraftPv(null); }}
                        className={cx("focusable px-2.5 py-1 rounded-md border text-[11px] font-display font-bold transition-all", ver.version === v.version && !draftPv ? "bg-ink text-paper border-ink" : "border-mist hover:border-pine-600")}>
                        v{v.version}
                      </button>
                    ))}
                    {draftPv && <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 border border-amber-500/50 text-[11px] font-display font-bold">v{draftPv.version} · editing</span>}
                    <Pill tone={STATUS_TONE[ver.status] ?? "gr"}>{ver.status}</Pill>
                    {isAdmin && !draftPv && ver.status !== "ACTIVE" && (
                      <Btn size="sm" onClick={() => dispatch({ t: "ACTIVATE_PV", productId: prod.id, version: ver.version, effectiveFrom: todayISO() })}><Ic n="check" size={12} /> Activate</Btn>
                    )}
                    {isAdmin && !draftPv && (
                      <button onClick={() => setDelDef(prod)} title="Delete product" className="focusable p-1.5 rounded-md text-ink-soft hover:text-rust-600 hover:bg-rust-100 transition-colors"><Ic n="trash" size={14} /></button>
                    )}
                  </div>
                </div>
                {ver.source && <p className="text-[10.5px] text-ink-soft mt-2 num">source: {ver.source}{ver.effectiveFrom ? ` · effective ${fmtDate(ver.effectiveFrom)}` : ""}</p>}
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
                    className={cx("focusable relative px-3.5 py-2.5 text-[12.5px] font-display font-bold whitespace-nowrap transition-colors", tab === g.id ? "text-ink" : "text-ink-soft hover:text-ink")}>
                    {g.l}
                    {tab === g.id && <span className="absolute left-2 right-2 -bottom-px h-[2.5px] rounded-full bg-pine-700" />}
                  </button>
                ))}
              </div>

              <div className="anim-tick" key={tab}>
                {tab === "grid" && (
                  <div className="bg-card border border-mist rounded-lg overflow-x-auto">
                    <table className="w-full text-[12px] min-w-[760px]">
                      <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
                        <th className="px-4 py-2.5 font-semibold">Profile</th>
                        <th className="px-3 py-2.5 font-semibold">Structure</th>
                        <th className="px-3 py-2.5 font-semibold">Recipe</th>
                        <th className="px-3 py-2.5 font-semibold">Today's rate</th>
                        <th className="px-3 py-2.5 font-semibold">Note</th>
                        {editable && <th className="px-3 py-2.5" />}
                      </tr></thead>
                      <tbody>
                        {ver.grid.cells.map((cell, ci) => {
                          const rate = cellRate(cell, eibor);
                          return (
                            <tr key={cell.id} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/40 transition-colors">
                              <td className="px-4 py-2.5 font-medium">
                                {Object.entries(cell.key).length ? Object.entries(cell.key).map(([k, v]) => <span key={k} className="inline-block mr-1.5 mb-0.5 rounded bg-steel-100 text-steel-700 px-1.5 py-[2px] text-[10.5px] font-semibold">{axisLabel(state.axes, k, v)}</span>) : <span className="text-ink-soft">all profiles</span>}
                              </td>
                              <td className="px-3 py-2.5"><Pill tone={cell.structure === "FIXED" ? "pine" : cell.structure === "MARGIN_INDEX" ? "steel" : "amber"}>{cell.structure.replace(/_/g, " ")}</Pill></td>
                              <td className="px-3 py-2.5 num text-[11px]">{cellRecipe(cell)}</td>
                              <td className="px-3 py-2.5 num font-bold text-pine-700">{rate != null ? `${rate.toFixed(2)}%` : "—"}</td>
                              <td className="px-3 py-2.5 text-[11px] text-ink-soft">{cell.note ?? ""}</td>
                              {editable && <td className="px-3 py-2.5"><button onClick={() => setPv({ grid: { cells: ver.grid.cells.filter((_, j) => j !== ci) } })} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={12} /></button></td>}
                            </tr>
                          );
                        })}
                        {ver.grid.cells.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-soft text-[12px]">No rate cells yet.</td></tr>}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-between px-4 py-2.5 bg-paper/50 border-t border-mist">
                      <p className="text-[10.5px] text-ink-soft">Rates are recipes (margin + index + floor) — never stale snapshots.</p>
                      {editable && <AddCellBtn prodAxes={prod.axes} axes={state.axes} onAdd={(cell) => setPv({ grid: { cells: [...ver.grid.cells, cell] } })} />}
                    </div>
                  </div>
                )}

                {tab === "elig" && (
                  <div className="grid lg:grid-cols-2 gap-4">
                    <div className="bg-card border border-mist rounded-lg p-4">
                      <p className="font-display font-bold text-[13.5px] tracking-tight mb-3">Eligibility thresholds</p>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Min salary"><NumInput disabled={!editable} value={ver.eligibility.minSalary ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, minSalary: n || undefined } })} suffix="AED" /></Field>
                          <Field label="Min loan"><NumInput disabled={!editable} value={ver.eligibility.minLoan ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, minLoan: n || undefined } })} suffix="AED" /></Field>
                          <Field label="Max loan"><NumInput disabled={!editable} value={ver.eligibility.maxLoan ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, maxLoan: n || undefined } })} suffix="AED" /></Field>
                          <Field label="Max age — salaried"><NumInput disabled={!editable} value={ver.eligibility.maxAgeSalaried ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, maxAgeSalaried: n || undefined } })} suffix="yrs" /></Field>
                          <Field label="Max age — self emp"><NumInput disabled={!editable} value={ver.eligibility.maxAgeSelfEmp ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, maxAgeSelfEmp: n || undefined } })} suffix="yrs" /></Field>
                          <Field label="Construction LTV"><NumInput disabled={!editable} value={ver.eligibility.constructionLtv ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, constructionLtv: n || undefined } })} suffix="%" /></Field>
                          <Field label="Min LOS (months)"><NumInput disabled={!editable} value={ver.eligibility.minLosMonths ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, minLosMonths: n || undefined } })} suffix="mo" /></Field>
                        </div>
                        {/* per-customer-type minimum salary */}
                        <div>
                          <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-1.5">Min salary by customer type</p>
                          {Object.entries(ver.eligibility.minSalaryMatrix ?? {}).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2 mb-1.5">
                              <span className="num text-[11px] font-semibold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 w-[150px]">{k}</span>
                              {editable
                                ? <span className="w-[120px]"><NumInput value={v} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, minSalaryMatrix: { ...(ver.eligibility.minSalaryMatrix ?? {}), [k]: n } } })} suffix="AED" /></span>
                                : <span className="num font-bold text-pine-700">{v.toLocaleString()} AED</span>}
                              {editable && <button onClick={() => { const m = { ...(ver.eligibility.minSalaryMatrix ?? {}) }; delete m[k]; setPv({ eligibility: { ...ver.eligibility, minSalaryMatrix: m } }); }} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={12} /></button>}
                            </div>
                          ))}
                          {!Object.keys(ver.eligibility.minSalaryMatrix ?? {}).length && <p className="text-[11px] text-ink-soft italic">Uses the flat min salary above.</p>}
                        </div>
                        {/* co-applicant + employer requirements */}
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Co-applicant rule"><TextInput disabled={!editable} value={ver.eligibility.coApplicantRule ?? ""} onChange={(e) => setPv({ eligibility: { ...ver.eligibility, coApplicantRule: e.target.value || undefined } })} placeholder="e.g. 1 blood relation (no siblings)" /></Field>
                          <Field label="Employer — min years"><NumInput disabled={!editable} value={ver.eligibility.employerRequirements?.minYearsEstablished ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, employerRequirements: { ...(ver.eligibility.employerRequirements ?? {}), minYearsEstablished: n || undefined } } })} suffix="yrs" /></Field>
                          <Field label="Employer — min employees"><NumInput disabled={!editable} value={ver.eligibility.employerRequirements?.minEmployees ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, employerRequirements: { ...(ver.eligibility.employerRequirements ?? {}), minEmployees: n || undefined } } })} suffix="#" /></Field>
                          <Field label="Profile form required"><Select disabled={!editable} value={ver.eligibility.employerRequirements?.profileForm ? "yes" : "no"} onChange={(v) => setPv({ eligibility: { ...ver.eligibility, employerRequirements: { ...(ver.eligibility.employerRequirements ?? {}), profileForm: v === "yes" } } })} options={[{ v: "no", l: "No" }, { v: "yes", l: "Yes" }]} /></Field>
                        </div>
                        <div>
                          <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-1.5">LTV matrix (key → %)</p>
                          {Object.entries(ver.eligibility.ltvMatrix ?? {}).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2 mb-1.5">
                              <span className="num text-[11px] font-semibold bg-steel-100 text-steel-700 rounded px-1.5 py-0.5 w-[150px]">{k}</span>
                              {editable
                                ? <span className="w-[90px]"><NumInput value={v} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, ltvMatrix: { ...(ver.eligibility.ltvMatrix ?? {}), [k]: n } } })} suffix="%" /></span>
                                : <span className="num font-bold text-pine-700">{v}%</span>}
                              {editable && <button onClick={() => { const m = { ...(ver.eligibility.ltvMatrix ?? {}) }; delete m[k]; setPv({ eligibility: { ...ver.eligibility, ltvMatrix: m } }); }} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={12} /></button>}
                            </div>
                          ))}
                          {editable && <AddLtvBtn onAdd={(k, v) => setPv({ eligibility: { ...ver.eligibility, ltvMatrix: { ...(ver.eligibility.ltvMatrix ?? {}), [k]: v } } })} />}
                        </div>
                      </div>
                    </div>
                    <div className="bg-card border border-mist rounded-lg p-4">
                      <p className="font-display font-bold text-[13.5px] tracking-tight mb-1.5">Eligibility gates</p>
                      <p className="text-[10.5px] text-ink-soft mb-3">Evaluated first, fail-fast — before any pricing.</p>
                      <div className="space-y-2">
                        {ver.eligibility.gates.map((g, gi) => (
                          <div key={g.id} className="border border-mist rounded-md px-3 py-2.5 bg-paper/40">
                            <div className="flex items-start gap-2.5">
                              <span className={cx("w-2 h-2 rounded-full mt-1.5 shrink-0", g.hardStop ? "bg-rust-500" : "bg-amber-500")} />
                              <div className="flex-1 min-w-0">
                                {editable
                                  ? <TextInput className="h-[30px] text-[12px]" value={g.label} onChange={(e) => setPv({ eligibility: { ...ver.eligibility, gates: ver.eligibility.gates.map((x, j) => j === gi ? { ...x, label: e.target.value } : x) } })} />
                                  : <p className="text-[12px] font-medium">{g.label}</p>}
                                <p className="num text-[10.5px] text-ink-soft mt-0.5">{g.kind.replace(/_/g, " ")}{g.values?.length ? ` · ${g.values.join(", ")}` : ""} · {g.hardStop ? "hard stop" : "warn"}</p>
                              </div>
                              {editable && <button onClick={() => setPv({ eligibility: { ...ver.eligibility, gates: ver.eligibility.gates.filter((_, j) => j !== gi) } })} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={12} /></button>}
                            </div>
                          </div>
                        ))}
                        {ver.eligibility.gates.length === 0 && <p className="text-[11.5px] text-ink-soft italic">No gates — open to all profiles the bank serves.</p>}
                        {editable && (
                          <Btn size="sm" variant="outline" onClick={() => setPv({ eligibility: { ...ver.eligibility, gates: [...ver.eligibility.gates, { id: "g" + uid(), kind: "FLAG", label: "New gate", hardStop: true }] } })}>
                            <Ic n="plus" size={12} /> Add gate
                          </Btn>
                        )}
                      </div>
                    </div>

                    {/* High-risk bands + additional LTV limits */}
                    <div className="bg-card border border-mist rounded-lg p-4 lg:col-span-2">
                      <p className="font-display font-bold text-[13.5px] tracking-tight mb-1.5">High-risk bands & LTV limits</p>
                      <p className="text-[10.5px] text-ink-soft mb-3">Strictest matching band wins. Top-developer exemption removes real-estate from the risk band.</p>
                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <Field label="Statement months"><NumInput disabled={!editable} value={ver.eligibility.statementMonths ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, statementMonths: n || undefined } })} suffix="mo" /></Field>
                        <Field label="Multi-property: more than"><NumInput disabled={!editable} value={ver.eligibility.multiPropertyRule?.minCount ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, multiPropertyRule: { minCount: n, ltv: ver.eligibility.multiPropertyRule?.ltv ?? 50 } } })} suffix="props" /></Field>
                        <Field label="…cap LTV at"><NumInput disabled={!editable} value={ver.eligibility.multiPropertyRule?.ltv ?? 0} onChange={(n) => setPv({ eligibility: { ...ver.eligibility, multiPropertyRule: { minCount: ver.eligibility.multiPropertyRule?.minCount ?? 2, ltv: n } } })} suffix="%" /></Field>
                      </div>
                      {(ver.eligibility.highRiskBands ?? []).length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-3">
                          {(ver.eligibility.highRiskBands ?? []).map((b, bi) => (
                            <div key={bi} className="border border-mist rounded-md px-3 py-2.5 bg-paper/40">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="num text-[11px] font-bold bg-rust-100 text-rust-700 rounded px-1.5 py-0.5">LTV {b.ltv}%</span>
                                {b.topDeveloperExempt && <span className="text-[10px] font-display font-bold text-pine-700 bg-pine-100 rounded px-1.5 py-0.5">top-developer exempt</span>}
                                {editable && <button onClick={() => setPv({ eligibility: { ...ver.eligibility, highRiskBands: (ver.eligibility.highRiskBands ?? []).filter((_, j) => j !== bi) } })} className="focusable ml-auto p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={12} /></button>}
                              </div>
                              {(b.nationalities ?? []).length > 0 && <p className="text-[11px] text-ink-soft"><strong className="text-ink">Nationalities:</strong> {b.nationalities!.join(", ")}</p>}
                              <p className="text-[11px] text-ink-soft mt-0.5"><strong className="text-ink">Sectors:</strong> {b.sectors.join("; ")}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11.5px] text-ink-soft italic">No high-risk bands — standard policy applies to all sectors.</p>
                      )}
                      <p className="num text-[10.5px] text-ink-soft mt-3">Approved top-developer list: {state.topDevelopers.length} names (maintained in Master Data).</p>
                    </div>
                  </div>
                )}

                {tab === "tenure" && (
                  <div className="bg-card border border-mist rounded-lg p-4 max-w-xl">
                    <p className="font-display font-bold text-[13.5px] tracking-tight mb-3">Tenure & age</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Max tenure"><NumInput disabled={!editable} value={ver.tenure.maxMonths ?? 0} onChange={(n) => setPv({ tenure: { ...ver.tenure, maxMonths: n || undefined } })} suffix="mo" /></Field>
                    </div>
                    <div className="mt-3"><Field label="Note"><TextInput disabled={!editable} value={ver.tenure.note ?? ""} onChange={(e) => setPv({ tenure: { ...ver.tenure, note: e.target.value || undefined } })} placeholder="optional" /></Field></div>
                  </div>
                )}

                {tab === "fees" && (
                  <div className="bg-card border border-mist rounded-lg p-4 max-w-xl">
                    <p className="font-display font-bold text-[13.5px] tracking-tight mb-3">Fees & charges</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Processing %"><NumInput disabled={!editable} value={ver.fees.processingPct ?? 0} onChange={(n) => setPv({ fees: { ...ver.fees, processingPct: n || undefined } })} suffix="%" /></Field>
                      <Field label="Processing min"><NumInput disabled={!editable} value={ver.fees.processingMin ?? 0} onChange={(n) => setPv({ fees: { ...ver.fees, processingMin: n || undefined } })} suffix="AED" /></Field>
                      <Field label="Valuation"><NumInput disabled={!editable} value={ver.fees.valuation ?? 0} onChange={(n) => setPv({ fees: { ...ver.fees, valuation: n || undefined } })} suffix="AED" /></Field>
                      <Field label="Pre-approval"><NumInput disabled={!editable} value={ver.fees.preApproval ?? 0} onChange={(n) => setPv({ fees: { ...ver.fees, preApproval: n || undefined } })} suffix="AED" /></Field>
                    </div>
                    <div className="mt-3"><Field label="Early settlement"><TextInput disabled={!editable} value={ver.fees.earlySettlement ?? ""} onChange={(e) => setPv({ fees: { ...ver.fees, earlySettlement: e.target.value || undefined } })} placeholder="e.g. 1% or 10k, whichever lower" /></Field></div>

                    {/* processing fee tiers */}
                    <div className="mt-4">
                      <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-1.5">Processing fee tiers</p>
                      {(ver.fees.processingFeeTiers ?? []).map((t, ti) => (
                        <div key={ti} className="flex items-center gap-2 mb-1.5">
                          {editable
                            ? <TextInput className="h-[30px] text-[12px] flex-1" value={t.label} onChange={(e) => setPv({ fees: { ...ver.fees, processingFeeTiers: (ver.fees.processingFeeTiers ?? []).map((x, j) => j === ti ? { ...x, label: e.target.value } : x) } })} />
                            : <span className="text-[12px] font-medium flex-1">{t.label}</span>}
                          <span className={cx("num font-bold", editable ? "" : "text-pine-700")}>{t.pct}%</span>
                          {editable && <button onClick={() => setPv({ fees: { ...ver.fees, processingFeeTiers: (ver.fees.processingFeeTiers ?? []).filter((_, j) => j !== ti) } })} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={12} /></button>}
                        </div>
                      ))}
                      {editable && <Btn size="sm" variant="outline" onClick={() => setPv({ fees: { ...ver.fees, processingFeeTiers: [...(ver.fees.processingFeeTiers ?? []), { label: "New tier", pct: 0.5 }] } })}><Ic n="plus" size={12} /> Add tier</Btn>}
                    </div>

                    {/* transaction overrides */}
                    <div className="mt-4">
                      <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-1.5">Transaction overrides</p>
                      {(ver.fees.txOverrides ?? []).map((o, oi) => (
                        <div key={oi} className="border border-mist rounded-md px-3 py-2 mb-1.5 bg-paper/40">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-display font-bold bg-steel-100 text-steel-700 rounded px-1.5 py-0.5">{o.txType.replace(/_/g, " ")}</span>
                            {o.processingPct != null && <span className="num text-[11px]">proc {o.processingPct}%</span>}
                            {o.valuationWaived && <span className="text-[10.5px] font-semibold text-pine-700">valuation waived</span>}
                            <span className="text-[10.5px] text-ink-soft flex-1">{o.note}</span>
                            {editable && <button onClick={() => setPv({ fees: { ...ver.fees, txOverrides: (ver.fees.txOverrides ?? []).filter((_, j) => j !== oi) } })} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={12} /></button>}
                          </div>
                        </div>
                      ))}
                      {editable && <Btn size="sm" variant="outline" onClick={() => setPv({ fees: { ...ver.fees, txOverrides: [...(ver.fees.txOverrides ?? []), { txType: "BUYOUT", processingPct: 0, note: "" }] } })}><Ic n="plus" size={12} /> Add override</Btn>}
                    </div>

                    {/* fee financing + employer discounts */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <Field label="Fee finance allowed"><Select disabled={!editable} value={ver.fees.feeFinancing?.allowed ? "yes" : "no"} onChange={(v) => setPv({ fees: { ...ver.fees, feeFinancing: { ...(ver.fees.feeFinancing ?? {}), allowed: v === "yes" } } })} options={[{ v: "no", l: "No" }, { v: "yes", l: "Yes" }]} /></Field>
                      <Field label="Fee finance %"><NumInput disabled={!editable} value={ver.fees.feeFinancing?.pct ?? 0} onChange={(n) => setPv({ fees: { ...ver.fees, feeFinancing: { allowed: ver.fees.feeFinancing?.allowed ?? false, ...(ver.fees.feeFinancing ?? {}), pct: n || undefined } } })} suffix="%" /></Field>
                    </div>
                    <div className="mt-4">
                      <p className="text-[10.5px] uppercase tracking-wider text-ink-soft font-display font-bold mb-1.5">Employer rate discounts</p>
                      {(ver.fees.employerDiscounts ?? []).map((ed, ei) => (
                        <div key={ei} className="border border-mist rounded-md px-3 py-2 mb-1.5 bg-paper/40">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11.5px] font-semibold flex-1">{ed.label}</span>
                            <span className="num text-[11px] font-bold text-pine-700">−{(ed.bps / 100).toFixed(2)}%</span>
                            {editable && <button onClick={() => setPv({ fees: { ...ver.fees, employerDiscounts: (ver.fees.employerDiscounts ?? []).filter((_, j) => j !== ei) } })} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={12} /></button>}
                          </div>
                          <p className="text-[10.5px] text-ink-soft mt-1">{ed.employers.join(", ")}</p>
                        </div>
                      ))}
                      {editable && <Btn size="sm" variant="outline" onClick={() => setPv({ fees: { ...ver.fees, employerDiscounts: [...(ver.fees.employerDiscounts ?? []), { label: "Approved companies", employers: [], bps: 25 }] } })}><Ic n="plus" size={12} /> Add discount</Btn>}
                    </div>
                  </div>
                )}

                {tab === "afford" && (
                  <div className="bg-card border border-mist rounded-lg p-4 max-w-xl">
                    <p className="font-display font-bold text-[13.5px] tracking-tight mb-3">Affordability / DBR</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Max DBR"><NumInput disabled={!editable} value={ver.affordability.maxDBR ?? 0} onChange={(n) => setPv({ affordability: { ...ver.affordability, maxDBR: n || undefined } })} suffix="%" /></Field>
                      <Field label="Credit card %"><NumInput disabled={!editable} value={ver.affordability.ccPct ?? 0} onChange={(n) => setPv({ affordability: { ...ver.affordability, ccPct: n || undefined } })} suffix="%" /></Field>
                      <Field label="Rental counted %"><NumInput disabled={!editable} value={ver.affordability.rentalPct ?? 0} onChange={(n) => setPv({ affordability: { ...ver.affordability, rentalPct: n || undefined } })} suffix="%" /></Field>
                      <Field label="Bonus counted %"><NumInput disabled={!editable} value={ver.affordability.bonusPct ?? 0} onChange={(n) => setPv({ affordability: { ...ver.affordability, bonusPct: n || undefined } })} suffix="%" /></Field>
                    </div>
                  </div>
                )}

                {tab === "docs" && (
                  <div className="bg-card border border-mist rounded-lg overflow-hidden max-w-2xl">
                    {ver.documents.map((d, di) => (
                      <div key={di} className="flex items-center gap-3 px-4 py-2.5 border-b border-mist/60 last:border-0">
                        <Ic n="file" size={15} className="text-ink-soft" />
                        {editable
                          ? <span className="flex-1"><TextInput className="h-[30px] text-[12px]" value={d.name} onChange={(e) => setPv({ documents: ver.documents.map((x, j) => j === di ? { ...x, name: e.target.value } : x) })} /></span>
                          : <span className="flex-1 text-[12.5px] font-medium">{d.name}</span>}
                        <Pill tone={d.required ? "pine" : "gr"}>{d.required ? "required" : "optional"}</Pill>
                        {editable && <button onClick={() => setPv({ documents: ver.documents.filter((_, j) => j !== di) })} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={12} /></button>}
                      </div>
                    ))}
                    {ver.documents.length === 0 && <p className="px-4 py-6 text-[12px] text-ink-soft">No bank-specific documents.</p>}
                    {editable && (
                      <div className="px-4 py-2.5 bg-paper/50 border-t border-mist">
                        <Btn size="sm" variant="outline" onClick={() => setPv({ documents: [...ver.documents, { name: "New document", required: true }] })}><Ic n="plus" size={12} /> Add document</Btn>
                      </div>
                    )}
                  </div>
                )}

                {tab === "tat" && (
                  <div className="bg-card border border-mist rounded-lg p-4 max-w-xl">
                    <p className="font-display font-bold text-[13.5px] tracking-tight mb-3">Bank TAT & validity (working days)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Pre-approval TAT"><NumInput disabled={!editable} value={ver.tat.paDays ?? 0} onChange={(n) => setPv({ tat: { ...ver.tat, paDays: n || undefined } })} suffix="d" /></Field>
                      <Field label="Valuation TAT"><NumInput disabled={!editable} value={ver.tat.valuationDays ?? 0} onChange={(n) => setPv({ tat: { ...ver.tat, valuationDays: n || undefined } })} suffix="d" /></Field>
                      <Field label="FOL TAT"><NumInput disabled={!editable} value={ver.tat.folDays ?? 0} onChange={(n) => setPv({ tat: { ...ver.tat, folDays: n || undefined } })} suffix="d" /></Field>
                      <Field label="Total TAT"><NumInput disabled={!editable} value={ver.tat.totalDays ?? 0} onChange={(n) => setPv({ tat: { ...ver.tat, totalDays: n || undefined } })} suffix="d" /></Field>
                      <Field label="PA validity"><NumInput disabled={!editable} value={ver.tat.paValidityDays ?? 0} onChange={(n) => setPv({ tat: { ...ver.tat, paValidityDays: n || undefined } })} suffix="d" /></Field>
                      <Field label="FOL validity"><NumInput disabled={!editable} value={ver.tat.folValidityDays ?? 0} onChange={(n) => setPv({ tat: { ...ver.tat, folValidityDays: n || undefined } })} suffix="d" /></Field>
                      <Field label="Valuation validity"><NumInput disabled={!editable} value={ver.tat.valuationValidityDays ?? 0} onChange={(n) => setPv({ tat: { ...ver.tat, valuationValidityDays: n || undefined } })} suffix="d" /></Field>
                      <Field label="Account opening"><NumInput disabled={!editable} value={ver.tat.accountOpeningDays ?? 0} onChange={(n) => setPv({ tat: { ...ver.tat, accountOpeningDays: n || undefined } })} suffix="d" /></Field>
                      <Field label="Disbursal"><NumInput disabled={!editable} value={ver.tat.disbursalDays ?? 0} onChange={(n) => setPv({ tat: { ...ver.tat, disbursalDays: n || undefined } })} suffix="d" /></Field>
                      <Field label="Transfer"><NumInput disabled={!editable} value={ver.tat.transferDays ?? 0} onChange={(n) => setPv({ tat: { ...ver.tat, transferDays: n || undefined } })} suffix="d" /></Field>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-card border border-mist rounded-lg anim-up px-6 py-14 text-center">
              <Ic n="layers" size={26} className="mx-auto text-ink-soft/50" />
              <p className="font-display font-bold text-[15px] mt-2">No product selected</p>
              <p className="text-[12px] text-ink-soft mt-1">Pick a bank product from the left, or create a new one.</p>
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
      <Modal open={showPromos} onClose={() => setShowPromos(false)} title="Promotions (time-bound overlays)" width={620}
        footer={isAdmin ? <Btn size="sm" onClick={() => { setPromoModal(true); }}><Ic n="plus" size={13} /> New promo</Btn> : undefined}>
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
                {isAdmin && <button onClick={() => dispatch({ t: "DELETE_PROMO", id: p.id })} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="trash" size={13} /></button>}
              </div>
            );
          })}
          {state.promos.length === 0 && <p className="text-[12px] text-ink-soft italic">No promotions.</p>}
        </div>
      </Modal>

      {promoModal && <PromoForm onClose={() => setPromoModal(false)} />}
      {newProd && prod != null && <NewProductForm onClose={() => setNewProd(false)} defaultBankId={prod.bankId} />}
      {newProd && prod == null && <NewProductForm onClose={() => setNewProd(false)} defaultBankId={state.banks[0]?.id ?? ""} />}

      {delDef && (
        <DangerModal open onClose={() => setDelDef(null)} title="Delete product" target={delDef.name}
          warn="The product and all its versions are removed from the rule engine. Saved decision snapshots keep their recorded versions."
          confirmLabel="Delete product"
          onConfirm={(reason) => { dispatch({ t: "DELETE_PRODUCT_DEF", id: delDef.id, reason }); setSelDef(null); setDelDef(null); }} />
      )}
    </div>
  );
}

/* ---------- add rate cell ---------- */
function AddCellBtn({ prodAxes, axes, onAdd }: { prodAxes: string[]; axes: AxisDef[]; onAdd: (c: RateCell) => void }) {
  const [open, setOpen] = useState(false);
  const [structure, setStructure] = useState<RateStructure>("FIXED");
  const [fixedRate, setFixedRate] = useState(4.0);
  const [margin, setMargin] = useState(2.0);
  const [index, setIndex] = useState<RateIndex>("EIBOR_3M");
  const [floor, setFloor] = useState(0);
  const [key, setKey] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const keyAxes = prodAxes.length ? prodAxes : axes.slice(0, 3).map((a) => a.id);
  return (
    <>
      <Btn size="sm" variant="outline" onClick={() => setOpen(true)}><Ic n="plus" size={12} /> Add rate cell</Btn>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="New rate cell" width={520}
          footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn onClick={() => { onAdd({ id: "c" + uid(), key, structure, fixedRate: structure === "FIXED" || structure === "FIXED_THEN_VAR" ? fixedRate : undefined, fixedMonths: structure === "FIXED_THEN_VAR" ? 36 : undefined, margin: structure === "MARGIN_INDEX" || structure === "VAR_DAY1" ? margin : undefined, index: structure === "MARGIN_INDEX" || structure === "VAR_DAY1" ? index : undefined, floor: floor || undefined, note: note || undefined }); setOpen(false); }}>Add cell</Btn></>}>
          <div className="grid grid-cols-2 gap-4">
            {keyAxes.map((axId) => {
              const ax = axes.find((a) => a.id === axId);
              return (
                <Field key={axId} label={ax?.name ?? axId}>
                  <Select value={key[axId] ?? ""} onChange={(v) => setKey((k) => { const n = { ...k }; if (v) n[axId] = v; else delete n[axId]; return n; })}
                    options={[{ v: "", l: "Any" }, ...(ax?.values ?? []).map((v) => ({ v: v.v, l: v.l }))]} />
                </Field>
              );
            })}
            <Field label="Structure">
              <Select value={structure} onChange={(v) => setStructure(v as RateStructure)} options={[
                { v: "FIXED", l: "Fixed" }, { v: "MARGIN_INDEX", l: "Margin + index" },
                { v: "FIXED_THEN_VAR", l: "Fixed then variable" }, { v: "VAR_DAY1", l: "Variable day 1" },
              ]} />
            </Field>
            {(structure === "FIXED" || structure === "FIXED_THEN_VAR") && <Field label="Fixed rate %"><NumInput value={fixedRate} onChange={setFixedRate} suffix="%" /></Field>}
            {(structure === "MARGIN_INDEX" || structure === "VAR_DAY1") && (<>
              <Field label="Margin %"><NumInput value={margin} onChange={setMargin} suffix="%" /></Field>
              <Field label="Index"><Select value={index} onChange={(v) => setIndex(v as RateIndex)} options={[{ v: "EIBOR_1M", l: "1M EIBOR" }, { v: "EIBOR_3M", l: "3M EIBOR" }, { v: "EIBOR_6M", l: "6M EIBOR" }, { v: "EIBOR_1Y", l: "1Y EIBOR" }]} /></Field>
              <Field label="Floor %"><NumInput value={floor} onChange={setFloor} suffix="%" /></Field>
            </>)}
            <div className="col-span-2"><Field label="Note"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></Field></div>
          </div>
        </Modal>
      )}
    </>
  );
}

function AddLtvBtn({ onAdd }: { onAdd: (key: string, v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState("EXPAT:1");
  const [v, setV] = useState(80);
  return (
    <>
      <Btn size="sm" variant="outline" onClick={() => setOpen(true)}><Ic n="plus" size={12} /> Add LTV key</Btn>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="New LTV matrix key" width={420}
          footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn disabled={!k.trim()} onClick={() => { onAdd(k.trim(), v); setOpen(false); }}>Add</Btn></>}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Key" hint="e.g. EXPAT:1, NON_RESIDENT, SELF_EMPLOYED"><TextInput value={k} onChange={(e) => setK(e.target.value)} /></Field>
            <Field label="LTV %"><NumInput value={v} onChange={setV} suffix="%" /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}

function PromoForm({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ bankId: "", name: "", from: todayISO(), to: "", summary: "" });
  return (
    <Modal open onClose={onClose} title="New promotion" width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.name.trim() || !f.summary.trim()} onClick={() => {
          const promo: Promo = { id: "promo" + uid(), bankId: f.bankId || undefined, name: f.name.trim(), from: f.from, to: f.to || undefined, summary: f.summary.trim(), createdBy: me?.id ?? "", createdAt: nowISO() };
          dispatch({ t: "SAVE_PROMO", promo, isNew: true }); onClose();
        }}><Ic n="plus" size={13} /> Create promo</Btn></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Name" req><TextInput autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
        <Field label="Bank"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v })} options={[{ v: "", l: "All banks" }, ...state.banks.map((b) => ({ v: b.id, l: b.name }))]} /></Field>
        <Field label="From"><TextInput type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To (optional)"><TextInput type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <div className="col-span-2"><Field label="Summary" req><TextArea rows={2} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field></div>
      </div>
    </Modal>
  );
}

function NewProductForm({ onClose, defaultBankId }: { onClose: () => void; defaultBankId: string }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [f, setF] = useState({ bankId: defaultBankId, name: "", loanType: "CONVENTIONAL" as ProductDef["loanType"], classes: ["SALARIED"], txTypes: ["PURCHASE"] as ProductDef["txTypes"], axes: ["employment"] });
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <Modal open onClose={onClose} title="New bank product" width={560}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.name.trim() || f.classes.length === 0}
          onClick={() => {
            const id = "pd-" + uid();
            dispatch({ t: "SAVE_PRODUCT_DEF", isNew: true, def: { id, bankId: f.bankId, name: f.name.trim(), loanType: f.loanType, classes: f.classes, txTypes: f.txTypes, axes: f.axes, createdAt: nowISO(), createdBy: me?.id ?? "", versions: [blankPv()] } });
            onClose();
          }}><Ic n="check" size={13} /> Create product (v1 draft)</Btn></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bank"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v })} options={state.banks.map((b) => ({ v: b.id, l: b.name }))} /></Field>
          <Field label="Loan type"><Select value={f.loanType} onChange={(v) => setF({ ...f, loanType: v as ProductDef["loanType"] })} options={[{ v: "ISLAMIC", l: "Islamic" }, { v: "CONVENTIONAL", l: "Conventional" }, { v: "BOTH", l: "Both" }]} /></Field>
        </div>
        <Field label="Product name" req><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Home Finance — Residential" /></Field>
        <Field label="Customer classes">
          <div className="flex gap-2">{["SALARIED", "SELF_EMPLOYED", "NON_RESIDENT"].map((c) => (
            <button key={c} onClick={() => setF({ ...f, classes: toggle(f.classes, c) })}
              className={cx("focusable px-3 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all", f.classes.includes(c) ? "bg-pine-700 text-paper border-pine-700" : "bg-card border-mist text-ink-soft hover:border-pine-600")}>{c.replace(/_/g, " ")}</button>
          ))}</div>
        </Field>
        <Field label="Transaction types">
          <div className="flex flex-wrap gap-2">{(["PURCHASE", "BUYOUT", "BUYOUT_EQUITY", "EQUITY"] as ProductDef["txTypes"]).map((t) => (
            <button key={t} onClick={() => setF({ ...f, txTypes: (f.txTypes.includes(t) ? f.txTypes.filter((x) => x !== t) : [...f.txTypes, t]) })}
              className={cx("focusable px-3 py-1.5 rounded-full border text-[11.5px] font-display font-bold transition-all", f.txTypes.includes(t) ? "bg-ink text-paper border-ink" : "bg-card border-mist text-ink-soft hover:border-ink/40")}>{t.replace(/_/g, " ")}</button>
          ))}</div>
        </Field>
        <Field label="Pricing axes">
          <div className="flex flex-wrap gap-2">{state.axes.map((a) => (
            <button key={a.id} onClick={() => setF({ ...f, axes: toggle(f.axes, a.id) })}
              className={cx("focusable px-2.5 py-1 rounded-full border text-[10.5px] font-semibold transition-all", f.axes.includes(a.id) ? "bg-steel-600 text-paper border-steel-600" : "bg-card border-mist text-ink-soft hover:border-steel-600")}>{a.name}</button>
          ))}</div>
        </Field>
      </div>
    </Modal>
  );
}
