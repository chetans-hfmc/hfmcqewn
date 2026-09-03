/* ============================================================
   Client Capture — journey-first intake wizard
   Collects exactly the fields the bank decision engine needs,
   then hands off to eligibility. No module hunting.
   ============================================================ */
import { useMemo, useState } from "react";
import type { ClientProfile, CustomerType, Employment, TxType } from "../types";
import { useMe, useNav, useStore } from "../store";
import { currentEiborFix, evaluateAll } from "../decision";
import { Btn, Field, Ic, NumInput, Pill, Select, TextInput, cx, fmtAED, fmtPct, nowISO, todayISO, uid } from "../ui";

const STEPS = [
  { id: 1, title: "The client", sub: "Who are we helping?", icon: "user" },
  { id: 2, title: "Income & service", sub: "What can they afford?", icon: "calc" },
  { id: 3, title: "The property & ask", sub: "What do they want to borrow?", icon: "home" },
];

interface Draft {
  name: string; nationality: string; customerType: CustomerType;
  residency: "RESIDENT" | "NON_RESIDENT"; employment: Employment;
  mobile: string; email: string;
  monthlyIncome: number; otherIncome: number; yearsEmployed: number;
  losMonths?: number; lobYears?: number; lowDoc?: boolean;
  propertyValue: number; loanRequested: number; emirate: string;
  propertyType: "RESIDENTIAL" | "COMMERCIAL"; financeCount: 1 | 2;
  txType: TxType; sector: string;
}

const blank: Draft = {
  name: "", nationality: "", customerType: "EXPAT", residency: "RESIDENT", employment: "SALARIED",
  mobile: "", email: "", monthlyIncome: 0, otherIncome: 0, yearsEmployed: 2,
  propertyValue: 0, loanRequested: 0, emirate: "DUBAI", propertyType: "RESIDENTIAL", financeCount: 1,
  txType: "PURCHASE", sector: "",
};

export default function CaptureView() {
  const { state, dispatch } = useStore();
  const me = useMe();
  const nav = useNav();
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>(blank);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  /* Live profile for the engine preview — built from whatever is filled in. */
  const profile: ClientProfile = useMemo(() => ({
    name: d.name || "Draft client", nationality: d.nationality, customerType: d.customerType,
    residency: d.residency, employment: d.employment, age: 35,
    monthlyIncome: d.monthlyIncome, otherIncome: d.otherIncome,
    monthlyLiabilities: 0, creditCardLimits: 0,
    propertyValue: d.propertyValue, loanRequested: d.loanRequested, financeCount: d.financeCount,
    propertyType: d.propertyType, emirate: d.emirate, sector: d.sector, yearsEmployed: d.yearsEmployed,
    losMonths: d.losMonths, lobYears: d.lobYears, lowDoc: d.lowDoc,
  }), [d]);

  const ready = d.propertyValue > 0 && d.loanRequested > 0 && d.monthlyIncome > 0;
  const preview = useMemo(() => {
    if (!ready) return [];
    try {
      const eibor = currentEiborFix(state.eibor);
      return evaluateAll(state.productDefs, profile, { eibor, rules: state.rules, promos: state.promos, today: todayISO(), topDevelopers: state.topDevelopers });
    } catch { return []; }
  }, [ready, profile, state.productDefs, state.rules, state.promos, state.eibor, state.topDevelopers]);

  const eligible = preview.filter((p) => p.verdict === "ELIGIBLE" || p.verdict === "ELIGIBLE_WITH_CONDITIONS");
  const best = eligible.slice().sort((a, b) => b.eligibleAmount - a.eligibleAmount)[0];
  const maxBankOffer = best?.eligibleAmount ?? 0;
  const ltv = d.propertyValue > 0 ? (d.loanRequested / d.propertyValue) * 100 : 0;
  const shortfall = Math.max(0, d.loanRequested - maxBankOffer);

  const canNext = step === 1 ? d.name.trim().length >= 2
    : step === 2 ? d.monthlyIncome > 0
    : d.propertyValue > 0 && d.loanRequested > 0;

  const saveAndFinish = (goto?: "decision" | "leads") => {
    const personId = "p" + uid();
    dispatch({
      t: "ADD_PERSON",
      person: {
        id: personId, name: d.name.trim(), nationality: d.nationality, customerType: d.customerType,
        employment: d.employment, dob: "", mobile: d.mobile, email: d.email,
        monthlySalary: d.monthlyIncome, otherIncome: d.otherIncome, financeCount: d.financeCount,
        cards: [], liabilities: [], createdAt: todayISO(),
        emirate: d.emirate, sector: d.sector, yearsEmployed: d.yearsEmployed,
        losMonths: d.losMonths, lobYears: d.lobYears, lowDoc: d.lowDoc,
        residencyStatus: d.residency, leadSource: "Capture wizard", dateRegistered: todayISO(),
      },
    });
    dispatch({
      t: "ADD_LEAD",
      lead: {
        id: "l" + uid(), ref: "L-" + (1000 + state.leads.length + 1), personId,
        source: "Capture wizard", type: d.txType, status: "NEW", owner: me?.id ?? "",
        propertyValue: d.propertyValue || undefined, nextAction: "Run eligibility", due: todayISO(),
        createdAt: nowISO().slice(0, 10),
      },
    });
    setSaved(true);
    if (goto === "decision") nav.go("decision");
    else if (goto === "leads") nav.go("leads");
  };

  if (saved) {
    return (
      <div className="max-w-xl mx-auto pt-16 px-4 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-pine-600 text-paper flex items-center justify-center anim-pop">
          <Ic n="check" size={26} />
        </div>
        <h1 className="font-display font-bold text-[26px] tracking-tight mt-4">Client captured</h1>
        <p className="text-[13px] text-ink-soft mt-2">
          {d.name.trim()} is now in your pipeline. The decision engine is ready to tell you which banks will take this file — and how much.
        </p>
        <div className="flex justify-center gap-2 mt-6">
          <Btn onClick={() => nav.go("decision")}><Ic n="spark" size={14} /> Run eligibility</Btn>
          <Btn variant="outline" onClick={() => nav.go("leads")}>View leads</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6">
      {/* header */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-pine-700">New client</p>
          <h1 className="font-display font-bold text-[26px] tracking-tight leading-tight mt-1">Capture a client, see the banks instantly</h1>
          <p className="text-[12.5px] text-ink-soft mt-1 max-w-xl">Three short steps. As you type, the decision engine checks every bank's rules live — no separate eligibility screen needed.</p>
        </div>
        <Btn variant="ghost" onClick={() => nav.go("dashboard")}><Ic n="chevL" size={14} /> Back</Btn>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* wizard card */}
        <div className="bg-card border border-mist rounded-lg overflow-hidden">
          {/* step rail */}
          <div className="flex border-b border-mist bg-paper/60">
            {STEPS.map((s, i) => {
              const active = step === s.id;
              const done = step > s.id;
              return (
                <button key={s.id} onClick={() => setStep(s.id)}
                  className={cx("flex-1 flex items-center gap-2.5 px-4 py-3.5 text-left transition-colors focusable",
                    active ? "bg-card" : "hover:bg-mist/40", i > 0 && "border-l border-mist")}>
                  <span className={cx("w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[12px] font-display font-bold transition-colors",
                    done ? "bg-pine-600 text-paper" : active ? "bg-ink text-paper" : "bg-mist text-ink-soft")}>
                    {done ? <Ic n="check" size={14} /> : s.id}
                  </span>
                  <span className="min-w-0">
                    <span className={cx("block text-[12.5px] font-display font-bold leading-tight", active ? "text-ink" : "text-ink-soft")}>{s.title}</span>
                    <span className="block text-[10.5px] text-ink-soft truncate">{s.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {step === 1 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <div className="col-span-2"><Field label="Full name" req><TextInput autoFocus value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Omar Al Mansouri" /></Field></div>
                <Field label="Mobile"><TextInput value={d.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="+971 5x xxx xxxx" /></Field>
                <Field label="Email"><TextInput value={d.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email.com" /></Field>
                <Field label="Nationality"><TextInput value={d.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. Indian" /></Field>
                <Field label="Customer type">
                  <Select value={d.customerType} onChange={(v) => set("customerType", v as CustomerType)}
                    options={[{ v: "NATIONAL", l: "UAE National" }, { v: "EXPAT", l: "Expat" }, { v: "NON_RESIDENT", l: "Non-resident" }]} />
                </Field>
                <Field label="Residency">
                  <Select value={d.residency} onChange={(v) => set("residency", v as Draft["residency"])}
                    options={[{ v: "RESIDENT", l: "UAE resident" }, { v: "NON_RESIDENT", l: "Non-resident" }]} />
                </Field>
                <Field label="Employment">
                  <Select value={d.employment} onChange={(v) => set("employment", v as Employment)}
                    options={[{ v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self-employed" }]} />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <Field label="Monthly salary / income" req><NumInput value={d.monthlyIncome} onChange={(n) => set("monthlyIncome", n)} suffix="AED" /></Field>
                <Field label="Other monthly income"><NumInput value={d.otherIncome} onChange={(n) => set("otherIncome", n)} suffix="AED" /></Field>
                {d.employment === "SALARIED" ? (
                  <>
                    <Field label="Years with employer"><NumInput value={d.yearsEmployed} onChange={(n) => set("yearsEmployed", n)} suffix="yr" /></Field>
                    <Field label="Length of service (months)"><NumInput value={d.losMonths ?? 0} onChange={(n) => set("losMonths", n || undefined)} suffix="mo" /></Field>
                  </>
                ) : (
                  <>
                    <Field label="Length of business (years)"><NumInput value={d.lobYears ?? 0} onChange={(n) => set("lobYears", n || undefined)} suffix="yr" /></Field>
                    <Field label="Low-doc program?">
                      <Select value={d.lowDoc ? "1" : "0"} onChange={(v) => set("lowDoc", v === "1" || undefined)}
                        options={[{ v: "0", l: "Full doc" }, { v: "1", l: "Low doc" }]} />
                    </Field>
                  </>
                )}
                <Field label="Business sector" hint="Used for high-risk sector rules"><TextInput value={d.sector} onChange={(e) => set("sector", e.target.value)} placeholder="e.g. Trading, Hospitality…" /></Field>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <Field label="Property value" req><NumInput value={d.propertyValue} onChange={(n) => set("propertyValue", n)} suffix="AED" /></Field>
                <Field label="Loan requested" req><NumInput value={d.loanRequested} onChange={(n) => set("loanRequested", n)} suffix="AED" /></Field>
                <Field label="Emirate">
                  <Select value={d.emirate} onChange={(v) => set("emirate", v)}
                    options={["DUBAI", "ABU_DHABI", "SHARJAH", "AJMAN", "RAK"].map((e) => ({ v: e, l: e.replace(/_/g, " ") }))} />
                </Field>
                <Field label="Property type">
                  <Select value={d.propertyType} onChange={(v) => set("propertyType", v as Draft["propertyType"])}
                    options={[{ v: "RESIDENTIAL", l: "Residential" }, { v: "COMMERCIAL", l: "Commercial" }]} />
                </Field>
                <Field label="Transaction">
                  <Select value={d.txType} onChange={(v) => set("txType", v as TxType)}
                    options={[{ v: "PURCHASE", l: "New purchase" }, { v: "RESALE", l: "Resale" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + equity" }, { v: "EQUITY", l: "Equity release" }, { v: "REFINANCE", l: "Refinance" }]} />
                </Field>
                <Field label="Finance count">
                  <Select value={String(d.financeCount)} onChange={(v) => set("financeCount", (v === "2" ? 2 : 1) as 1 | 2)}
                    options={[{ v: "1", l: "1st property" }, { v: "2", l: "2nd / subsequent" }]} />
                </Field>
              </div>
            )}

            {/* footer nav */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-mist">
              <Btn variant="ghost" disabled={step === 1} onClick={() => setStep(step - 1)}><Ic n="chevL" size={14} /> Previous</Btn>
              {step < 3 ? (
                <Btn disabled={!canNext} onClick={() => setStep(step + 1)}>Next <Ic n="chevR" size={14} /></Btn>
              ) : (
                <Btn disabled={!canNext} onClick={() => saveAndFinish()}><Ic n="check" size={14} /> Save client</Btn>
              )}
            </div>
          </div>
        </div>

        {/* live engine preview */}
        <aside className="bg-ink text-paper rounded-lg p-5 lg:sticky lg:top-6">
          <p className="flex items-center gap-2 text-[11px] font-display font-bold uppercase tracking-[0.14em] text-paper/60">
            <Ic n="spark" size={14} className="text-pine-400" /> Live engine read
          </p>
          <p className="text-[11.5px] text-paper/50 mt-1">Updates as you type, straight from the 18-bank rule engine.</p>

          <div className="mt-4 space-y-3">
            <div>
              <p className="text-[10.5px] text-paper/50">Requested LTV</p>
              <p className={cx("num text-[22px] font-bold", ltv > 80 ? "text-rust-300" : "text-paper")}>{d.propertyValue ? fmtPct(ltv, 1) : "—"}</p>
            </div>
            <div className="border-t border-paper/10 pt-3">
              <p className="text-[10.5px] text-paper/50">Best bank offer</p>
              {best ? (
                <>
                  <p className="num text-[22px] font-bold text-pine-300">{fmtAED(maxBankOffer)}</p>
                  <p className="text-[11px] text-paper/60">{best.productName} · {best.ratePct != null ? fmtPct(best.ratePct, 2) + " p.a." : "rate on request"}</p>
                </>
              ) : (
                <p className="text-[12px] text-paper/50 italic mt-1">{ready ? "No eligible bank yet — adjust the ask." : "Fill income, property value & loan to preview."}</p>
              )}
            </div>

            {ready && (
              <div className="border-t border-paper/10 pt-3">
                <p className="text-[10.5px] text-paper/50 mb-2">Eligible banks · {eligible.length}</p>
                <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                  {eligible.slice().sort((a, b) => b.eligibleAmount - a.eligibleAmount).slice(0, 6).map((p) => (
                    <div key={p.productDefId} className="flex items-center justify-between gap-2 rounded-md bg-paper/5 px-2.5 py-1.5">
                      <span className="text-[11.5px] font-semibold truncate">{p.productName}</span>
                      <span className="num text-[11px] text-pine-300 shrink-0">{fmtAED(p.eligibleAmount)}</span>
                    </div>
                  ))}
                  {eligible.length === 0 && <p className="text-[11px] text-paper/50 italic">None at this ask.</p>}
                </div>
              </div>
            )}

            {shortfall > 0 && (
              <div className="border-t border-paper/10 pt-3">
                <p className="text-[10.5px] text-rust-300 font-semibold">Shortfall vs best offer</p>
                <p className="num text-[16px] font-bold text-rust-300">{fmtAED(shortfall)}</p>
              </div>
            )}
          </div>

          {step === 3 && canNext && (
            <button onClick={() => saveAndFinish("decision")}
              className="focusable w-full mt-4 rounded-md bg-pine-500 hover:bg-pine-400 text-ink font-display font-bold text-[12.5px] py-2.5 transition-colors">
              Save & run full eligibility →
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
