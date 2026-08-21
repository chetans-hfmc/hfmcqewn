import { useMemo, useState } from "react";
import type { CustomerType, Employment, TxType } from "../types";
import { useMe, useNav, useStore } from "../store";
import { affordability, buyoutCalc, ccLiability, dbrCapFor, emi as emiFn, feeLines, ltvFor, retireAgeFor, settlementFor, stressFor, tenureCalc, loanFromEmi } from "../calc";
import { Btn, DateInput, Field, Ic, NumInput, Pill, Select, TextInput, Toggle, cx, fmtAED, fmtDate, fmtN, fmtPct, fmtTime, nowISO, todayISO, uid, useCountUp, ageYears } from "../ui";

type CalcId = "affordability" | "cash" | "ltv" | "emi" | "age" | "dbr" | "maxloan" | "fees" | "eibor" | "buyout" | "equity" | "auditlog";

const GROUPS: { g: string; items: { id: CalcId; l: string; d: string }[] }[] = [
  { g: "Customer", items: [
    { id: "affordability", l: "Combined Eligibility", d: "The VRM pre-sales screen — LTV, EMI, DBR, tenure, cash in one pass" },
    { id: "cash", l: "Cash Requirement", d: "Down payment + charges = total cash the client needs" },
    { id: "dbr", l: "DBR / DSR", d: "Total obligations ÷ income, checked against the admin ceiling" },
    { id: "age", l: "Age & Tenure", d: "Retirement rules, month-by-month tenure resolution" },
  ]},
  { g: "Loan", items: [
    { id: "emi", l: "EMI", d: "Monthly instalment, total payments and profit/interest" },
    { id: "ltv", l: "LTV", d: "Reads the customer-type matrix from the rule engine" },
    { id: "maxloan", l: "Maximum Eligible Loan", d: "LTV ∩ DBR ∩ age ∩ product — the binding constraint wins" },
    { id: "fees", l: "Fees & Cash Required", d: "Finance and charges kept separate, as Ops requires" },
  ]},
  { g: "Structures", items: [
    { id: "buyout", l: "Buyout", d: "Settlement, new finance and net cash position" },
    { id: "equity", l: "Pure Equity / Refinance", d: "Release equity against an existing property" },
  ]},
  { g: "Market", items: [
    { id: "eibor", l: "EIBOR", d: "Published tenors + bank margin = customer rate" },
  ]},
  { g: "Governance", items: [
    { id: "auditlog", l: "Calculation Audit", d: "Every saved run with the rule versions it used" },
  ]},
];

function Out({ k, v, big, tone }: { k: string; v: string; big?: boolean; tone?: string }) {
  const num = parseFloat(v.replace(/[^0-9.-]/g, ""));
  const anim = useCountUp(isNaN(num) ? 0 : num, 450);
  const display = isNaN(num) ? v : v.replace(/-?[\d,]+(\.\d+)?/, fmtN(anim, v.includes(".") ? 1 : 0));
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-mist/60 last:border-0">
      <span className="text-[11px] font-display font-semibold uppercase tracking-[0.06em] text-ink-soft">{k}</span>
      <span className={cx("num font-semibold text-right", big ? "text-[17px]" : "text-[13px]", tone ?? "text-ink")}>{display}</span>
    </div>
  );
}

function RuleChips({ rules }: { rules: { code: string; version: number }[] }) {
  if (!rules.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-mist/70">
      <span className="text-[10px] font-display font-semibold uppercase tracking-wide text-ink-soft flex items-center gap-1"><Ic n="scale" size={11} /> Rules used</span>
      {rules.map((r) => <span key={r.code} className="num text-[10.5px] bg-ink/6 rounded px-1.5 py-0.5">{r.code} v{r.version}</span>)}
    </div>
  );
}

function SaveBar({ onLabel, outputs, rules, defaultLink }: { onLabel: (label: string) => string; outputs: Record<string, unknown>; rules: { code: string; version: number }[]; defaultLink?: string }) {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [link, setLink] = useState(defaultLink ?? "");
  const [saved, setSaved] = useState(false);
  const links = [
    { v: "", l: "— save standalone —" },
    ...state.cases.filter((c) => c.status === "OPEN").map((c) => ({ v: `case:${c.id}`, l: `${c.ref} · ${state.persons.find((p) => p.id === c.personId)?.name}` })),
    ...state.leads.filter((l) => l.status !== "CONVERTED" && l.status !== "LOST").map((l) => ({ v: `lead:${l.id}`, l: `${l.ref} · ${state.persons.find((p) => p.id === l.personId)?.name}` })),
  ];
  return (
    <div className="flex items-center gap-2 mt-4">
      <Select className="flex-1" value={link} onChange={setLink} options={links} />
      <Btn variant="dark" onClick={() => {
        const [kind, id] = link.split(":");
        const ref = kind === "case" ? state.cases.find((c) => c.id === id)?.ref : kind === "lead" ? state.leads.find((l) => l.id === id)?.ref : undefined;
        const type = onLabel("").split(" · ")[0].split(" ")[0].toLowerCase() || "calc";
        dispatch({ t: "SAVE_CALC", calc: { id: "calc" + uid(), type, label: onLabel(ref ?? ""), linkKind: (kind as "case" | "lead") || undefined, linkId: id || undefined, linkRef: ref, inputs: {}, outputs, rulesUsed: rules, by: me?.id ?? "", at: nowISO() } });
        setSaved(true); setTimeout(() => setSaved(false), 1600);
      }}>{saved ? <><Ic n="check" size={13} /> Saved</> : <><Ic n="layers" size={13} /> Save snapshot</>}</Btn>
    </div>
  );
}

function Shell({ title, desc, children, results, rules, save }: { title: string; desc: string; children: React.ReactNode; results: React.ReactNode; rules: { code: string; version: number }[]; save?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <div className="xl:col-span-3 anim-up">
        <h2 className="font-display font-bold text-xl tracking-tight">{title}</h2>
        <p className="text-[12.5px] text-ink-soft mt-0.5 mb-4">{desc}</p>
        <div className="bg-card border border-mist rounded-lg p-4">{children}</div>
      </div>
      <div className="xl:col-span-2 anim-up" style={{ animationDelay: "80ms" }}>
        <div className="bg-ink text-paper rounded-lg p-4 sticky top-4">
          <p className="text-[10px] font-display font-semibold uppercase tracking-[0.14em] text-paper/50 mb-2">Result</p>
          {results}
          <div className="mt-3 pt-3 border-t border-paper/10">
            <p className="text-[10px] font-display font-semibold uppercase tracking-[0.1em] text-paper/50 mb-1.5">Rule versions applied</p>
            <div className="flex flex-wrap gap-1">{rules.length ? rules.map((r) => <span key={r.code} className="num text-[10px] bg-paper/10 rounded px-1.5 py-0.5">{r.code} v{r.version}</span>) : <span className="text-[11px] text-paper/50">pure formula — no admin rules</span>}</div>
          </div>
          {save && <div className="mt-3 pt-3 border-t border-paper/10">{save}</div>}
        </div>
      </div>
    </div>
  );
}

function DarkOut({ k, v, big, tone }: { k: string; v: string; big?: boolean; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-paper/10 last:border-0">
      <span className="text-[11px] text-paper/60">{k}</span>
      <span className={cx("num font-semibold", big ? "text-[18px]" : "text-[13px]", tone ?? "text-paper")}>{v}</span>
    </div>
  );
}

export default function CalculatorsView() {
  const nav = useNav();
  const [active, setActive] = useState<CalcId>((nav.params.calc as CalcId) ?? "affordability");
  const item = GROUPS.flatMap((g) => g.items).find((i) => i.id === active)!;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 anim-up">
        <div>
          <h1 className="font-display font-bold text-[26px] tracking-tight">Calculator Centre</h1>
          <p className="text-[13px] text-ink-soft mt-0.5">Decision support, not hardcoded numbers — every calculator reads live admin rules and snapshots the versions it used.</p>
        </div>
        <Pill tone="amber"><Ic n="alert" size={12} /> EMI · DBR · LTV · age rules TO VERIFY before production</Pill>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="anim-up space-y-4">
          {GROUPS.map((g) => (
            <div key={g.g}>
              <p className="text-[10px] font-display font-semibold uppercase tracking-[0.14em] text-ink-soft mb-1.5 px-1">{g.g}</p>
              <div className="space-y-1">
                {g.items.map((i) => (
                  <button key={i.id} onClick={() => setActive(i.id)}
                    className={cx("w-full text-left px-3 py-2 rounded-md border transition-all duration-150 focusable",
                      active === i.id ? "bg-ink text-paper border-ink shadow-md" : "bg-card border-mist hover:border-ink/30")}>
                    <p className={cx("font-display font-semibold text-[12.5px] tracking-tight", active === i.id ? "text-paper" : "text-ink")}>{i.l}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-3">
          {active === "affordability" && <Affordability />}
          {active === "cash" && <CashReq />}
          {active === "ltv" && <LtvCalc />}
          {active === "emi" && <EmiCalc />}
          {active === "age" && <AgeCalc />}
          {active === "dbr" && <DbrCalc />}
          {active === "maxloan" && <MaxLoan />}
          {active === "fees" && <FeesCalc />}
          {active === "eibor" && <EiborCalc />}
          {active === "buyout" && <BuyoutCalc />}
          {active === "equity" && <EquityCalc />}
          {active === "auditlog" && <AuditLog />}
        </div>
      </div>
    </div>
  );
}

/* ---------- shared person-based form state ---------- */
function usePersonForm() {
  const { state } = useStore();
  const nav = useNav();
  const pid = nav.params.personId as string | undefined;
  const person = state.persons.find((p) => p.id === pid);
  const [f, setF] = useState({
    personId: pid ?? "",
    customerType: person?.customerType ?? ("EXPAT" as CustomerType),
    employment: person?.employment ?? ("SALARIED" as Employment),
    dob: person?.dob ?? "1992-01-01",
    salary: person?.monthlySalary ?? 25000,
    otherIncome: person?.otherIncome ?? 0,
    financeCount: person?.financeCount ?? (1 as 1 | 2),
    liabilities: person?.liabilities.reduce((s, l) => s + l.monthly, 0) ?? 0,
    cards: person?.cards.map((c) => c.limit).join(", ") ?? "",
    propertyValue: (nav.params.propertyValue as number) ?? 1200000,
    bankId: state.banks[0].id,
    productId: state.products[0].id,
    txType: "PURCHASE" as TxType,
    proposedLoan: 0,
    qualifying: false,
  });
  const applyPerson = (id: string) => {
    const p = state.persons.find((x) => x.id === id);
    setF((prev) => p ? {
      ...prev, personId: id, customerType: p.customerType, employment: p.employment, dob: p.dob,
      salary: p.monthlySalary, otherIncome: p.otherIncome, financeCount: p.financeCount,
      liabilities: p.liabilities.reduce((s, l) => s + l.monthly, 0), cards: p.cards.map((c) => c.limit).join(", "),
    } : { ...prev, personId: id });
  };
  return { f, setF, applyPerson, persons: state.persons };
}

const cardArr = (s: string) => s.split(",").map((x) => parseFloat(x.trim())).filter((n) => !isNaN(n) && n > 0);

/* ================= calculators ================= */

function Affordability() {
  const { state } = useStore();
  const nav = useNav();
  const { f, setF, applyPerson, persons } = usePersonForm();
  const product = state.products.find((p) => p.id === f.productId);
  const res = useMemo(() => affordability(state, {
    dob: f.dob, customerType: f.customerType, employment: f.employment, salary: f.salary, otherIncome: f.otherIncome,
    propertyValue: f.propertyValue, financeCount: f.financeCount, liabilitiesMonthly: f.liabilities,
    cardLimits: cardArr(f.cards), bankId: f.bankId, product, proposedLoan: f.proposedLoan, txType: f.txType, qualifying: f.qualifying,
  }), [state, f, product]);
  const statusCls = res.status === "ELIGIBLE" ? "bg-pine-600" : res.status === "REVIEW" ? "bg-amber-500" : "bg-rust-500";
  return (
    <Shell title="HFMC Mortgage Eligibility" desc={GROUPS[0].items[0].d}
      rules={res.rulesUsed}
      results={<>
        <div className={cx("rounded-md px-3 py-2 mb-3 flex items-center justify-between", statusCls)}>
          <span className="font-display font-bold text-[14px] tracking-tight">{res.status}</span>
          <span className="num text-[11px] opacity-80">DBR {fmtPct(res.dbr, 1)} / cap {fmtN(res.dbrCapPct, 0)}%</span>
        </div>
        {res.reasons.length > 0 && <ul className="mb-2 space-y-1">{res.reasons.map((r, i) => <li key={i} className="text-[11px] text-rust-100 bg-rust-500/30 rounded px-2 py-1">{r}</li>)}</ul>}
        <DarkOut k="Applicable LTV" v={fmtPct(res.ltvPct, 0)} />
        <DarkOut k="Max finance (LTV)" v={fmtAED(res.maxByLtv)} />
        <DarkOut k="Max finance (DBR)" v={fmtAED(res.maxByDbr)} />
        <DarkOut k="Final maximum loan" v={fmtAED(res.maxLoan)} big tone="text-pine-300" />
        <DarkOut k="Loan used" v={fmtAED(res.loan)} />
        <DarkOut k="Monthly EMI" v={fmtAED(res.emi)} big />
        <DarkOut k="Eligible tenure" v={`${res.finalTenure} months`} />
        <DarkOut k="Down payment" v={fmtAED(res.downPayment)} />
        <DarkOut k="Other charges" v={fmtAED(res.feesTotal)} />
        <DarkOut k="Total cash required" v={fmtAED(res.cashRequired)} big tone="text-amber-100" />
      </>}
      save={<SaveBar defaultLink={nav.params.caseId ? `case:${nav.params.caseId}` : nav.params.leadId ? `lead:${nav.params.leadId}` : undefined}
        rules={res.rulesUsed}
        outputs={{ maxLoan: Math.round(res.maxLoan), emi: Math.round(res.emi), dbr: fmtPct(res.dbr, 1), ltv: fmtPct(res.ltvPct, 0), tenure: res.finalTenure, cashRequired: Math.round(res.cashRequired), status: res.status }}
        onLabel={(ref) => `Affordability · ${persons.find((p) => p.id === f.personId)?.name ?? f.customerType}${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        <div className="sm:col-span-2"><Field label="Client profile (optional)"><Select value={f.personId} onChange={applyPerson} options={[{ v: "", l: "— manual entry —" }, ...persons.map((p) => ({ v: p.id, l: p.name }))]} /></Field></div>
        <Field label="Customer type"><Select value={f.customerType} onChange={(v) => setF({ ...f, customerType: v as CustomerType })} options={[{ v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "UAE National" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="Date of birth"><DateInput value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
        <Field label="Employment"><Select value={f.employment} onChange={(v) => setF({ ...f, employment: v as Employment })} options={[{ v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self-Employed" }]} /></Field>
        <Field label="Finance count"><Select value={String(f.financeCount)} onChange={(v) => setF({ ...f, financeCount: Number(v) as 1 | 2 })} options={[{ v: "1", l: "1st property" }, { v: "2", l: "2nd or more" }]} /></Field>
        <Field label="Monthly salary"><NumInput value={f.salary} onChange={(n) => setF({ ...f, salary: n })} suffix="AED" /></Field>
        <Field label="Other income"><NumInput value={f.otherIncome} onChange={(n) => setF({ ...f, otherIncome: n })} suffix="AED" /></Field>
        <Field label="Property value"><NumInput value={f.propertyValue} onChange={(n) => setF({ ...f, propertyValue: n })} suffix="AED" /></Field>
        <Field label="Transaction"><Select value={f.txType} onChange={(v) => setF({ ...f, txType: v as TxType })} options={[{ v: "PURCHASE", l: "Purchase" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + Equity" }, { v: "EQUITY", l: "Pure Equity" }]} /></Field>
        <Field label="Existing liabilities /mo"><NumInput value={f.liabilities} onChange={(n) => setF({ ...f, liabilities: n })} suffix="AED" /></Field>
        <Field label="Card limits (comma sep.)"><TextInput value={f.cards} onChange={(e) => setF({ ...f, cards: e.target.value })} placeholder="25000, 15000" className="num" /></Field>
        <Field label="Bank"><Select value={f.bankId} onChange={(v) => { setF({ ...f, bankId: v, productId: state.products.find((p) => p.bankId === v)?.id ?? f.productId }); }} options={state.banks.map((b) => ({ v: b.id, l: b.name }))} /></Field>
        <Field label="Product"><Select value={f.productId} onChange={(v) => setF({ ...f, productId: v })} options={state.products.filter((p) => p.bankId === f.bankId).map((p) => ({ v: p.id, l: `${p.name} · ${p.rate}%` }))} /></Field>
        <Field label="Proposed loan (0 = max)"><NumInput value={f.proposedLoan} onChange={(n) => setF({ ...f, proposedLoan: n })} suffix="AED" /></Field>
        <div className="flex items-end pb-2"><Toggle on={f.qualifying} onChange={(v) => setF({ ...f, qualifying: v })} label={`Qualifying rate (+${stressFor(state).pct}% stress)`} /></div>
      </div>
    </Shell>
  );
}

function CashReq() {
  const { state } = useStore();
  const [f, setF] = useState({ pv: 1500000, ct: "EXPAT" as CustomerType, fc: 1 as 1 | 2, tx: "PURCHASE" as TxType });
  const r = useMemo(() => {
    const ltv = ltvFor(state, f.ct, f.fc, undefined, f.tx);
    const maxFin = (f.pv * ltv.pct) / 100;
    const fees = feeLines(state, { propertyValue: f.pv, loanAmount: maxFin, txType: f.tx });
    return { ltv, maxFin, down: f.pv - maxFin, fees, total: f.pv - maxFin + fees.total, rules: [ltv.rule, ...fees.lines.map((l) => l.rule)].filter(Boolean).map((x) => ({ code: x!.code, version: x!.version })) };
  }, [state, f]);
  return (
    <Shell title="Cash Requirement" desc={GROUPS[0].items[1].d} rules={r.rules}
      results={<>
        <DarkOut k="Applicable LTV" v={fmtPct(r.ltv.pct, 0)} />
        <DarkOut k="Maximum finance" v={fmtAED(r.maxFin)} big tone="text-pine-300" />
        <DarkOut k="Down payment (equity)" v={fmtAED(r.down)} />
        {r.fees.lines.map((l) => <DarkOut key={l.name} k={l.name} v={fmtAED(l.amount)} />)}
        <DarkOut k="Total cash required" v={fmtAED(r.total)} big tone="text-amber-100" />
      </>}
      save={<SaveBar rules={r.rules} outputs={{ ltv: fmtPct(r.ltv.pct, 0), maxFinance: Math.round(r.maxFin), downPayment: Math.round(r.down), charges: Math.round(r.fees.total), cashRequired: Math.round(r.total) }} onLabel={(ref) => `Cash requirement · ${fmtAED(f.pv)} property${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Property value"><NumInput value={f.pv} onChange={(n) => setF({ ...f, pv: n })} suffix="AED" /></Field>
        <Field label="Customer type"><Select value={f.ct} onChange={(v) => setF({ ...f, ct: v as CustomerType })} options={[{ v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "UAE National" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="Property finance count"><Select value={String(f.fc)} onChange={(v) => setF({ ...f, fc: Number(v) as 1 | 2 })} options={[{ v: "1", l: "1st property" }, { v: "2", l: "2nd or more" }]} /></Field>
        <Field label="Transaction"><Select value={f.tx} onChange={(v) => setF({ ...f, tx: v as TxType })} options={[{ v: "PURCHASE", l: "Purchase" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + Equity" }]} /></Field>
      </div>
    </Shell>
  );
}

function LtvCalc() {
  const { state } = useStore();
  const [f, setF] = useState({ ct: "EXPAT" as CustomerType, fc: 1 as 1 | 2, tx: "PURCHASE" as TxType, bankId: "", pv: 1500000 });
  const r = useMemo(() => {
    const ltv = ltvFor(state, f.ct, f.fc, f.bankId || undefined, f.tx);
    return { ltv, maxFin: (f.pv * ltv.pct) / 100, equity: f.pv - (f.pv * ltv.pct) / 100, rules: ltv.rule ? [{ code: ltv.rule.code, version: ltv.rule.version }] : [] };
  }, [state, f]);
  return (
    <Shell title="LTV Calculator" desc="Percentages are read from the Admin rule database — never hardcoded in the app." rules={r.rules}
      results={<>
        <DarkOut k="Applicable LTV" v={fmtPct(r.ltv.pct, 0)} big tone="text-pine-300" />
        <DarkOut k="Maximum finance" v={fmtAED(r.maxFin)} big />
        <DarkOut k="Required equity" v={fmtAED(r.equity)} tone="text-amber-100" />
      </>}
      save={<SaveBar rules={r.rules} outputs={{ ltv: fmtPct(r.ltv.pct, 0), maxFinance: Math.round(r.maxFin), equity: Math.round(r.equity) }} onLabel={(ref) => `LTV · ${f.ct} · ${f.fc === 1 ? "1st" : "2nd+"}${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Customer type"><Select value={f.ct} onChange={(v) => setF({ ...f, ct: v as CustomerType })} options={[{ v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "UAE National" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="Finance count"><Select value={String(f.fc)} onChange={(v) => setF({ ...f, fc: Number(v) as 1 | 2 })} options={[{ v: "1", l: "1st property" }, { v: "2", l: "2nd or more" }]} /></Field>
        <Field label="Transaction"><Select value={f.tx} onChange={(v) => setF({ ...f, tx: v as TxType })} options={[{ v: "PURCHASE", l: "Purchase" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + Equity" }, { v: "EQUITY", l: "Pure Equity" }]} /></Field>
        <Field label="Bank override"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v })} options={[{ v: "", l: "Standard matrix" }, ...state.banks.map((b) => ({ v: b.id, l: b.name }))]} /></Field>
        <Field label="Property value"><NumInput value={f.pv} onChange={(n) => setF({ ...f, pv: n })} suffix="AED" /></Field>
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-display font-semibold uppercase tracking-[0.12em] text-ink-soft mb-1.5">Live rule matrix</p>
        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
          {state.rules.filter((x) => x.module === "LTV" && x.active).map((x) => (
            <div key={x.id} className={cx("rounded border px-2 py-1.5", x.scope.customerType === f.ct && x.scope.financeCount === f.fc ? "border-pine-500 bg-pine-50" : "border-mist bg-paper/60")}>
              <p className="text-ink-soft">{x.scope.customerType?.replace("_", "-")} · {x.scope.financeCount === 1 ? "1st" : "2nd+"}</p>
              <p className="num font-bold text-[14px]">{x.value}%</p>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function EmiCalc() {
  const { state } = useStore();
  const latest = state.eibor[state.eibor.length - 1];
  const [f, setF] = useState({ loan: 1000000, mode: "FIXED", rate: 3.99, margin: 1.75, tenure: 300, qualifying: false });
  const rate = f.mode === "FIXED" ? f.rate : (latest?.m3 ?? 4.46) + f.margin;
  const stress = stressFor(state);
  const effRate = f.qualifying ? rate + stress.pct : rate;
  const e = emiFn(f.loan, effRate, f.tenure);
  const total = e * f.tenure;
  const rules = f.qualifying ? [{ code: stress.rule?.code ?? "STRESS-QUAL", version: stress.rule?.version ?? 1 }] : [];
  return (
    <Shell title="EMI Calculator" desc="Monthly instalment on a reducing balance. Switch to qualifying rate to stress-test affordability." rules={rules}
      results={<>
        <DarkOut k="Applied rate" v={fmtPct(effRate, 2)} />
        <DarkOut k="Monthly EMI" v={fmtAED(e)} big tone="text-pine-300" />
        <DarkOut k="Total payments" v={fmtAED(total)} />
        <DarkOut k="Total interest / profit" v={fmtAED(total - f.loan)} tone="text-amber-100" />
      </>}
      save={<SaveBar rules={rules} outputs={{ emi: Math.round(e), rate: fmtPct(effRate, 2), tenure: f.tenure, totalInterest: Math.round(total - f.loan) }} onLabel={(ref) => `EMI · ${fmtAED(f.loan)} @ ${fmtPct(effRate, 2)}${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Loan amount"><NumInput value={f.loan} onChange={(n) => setF({ ...f, loan: n })} suffix="AED" /></Field>
        <Field label="Rate type"><Select value={f.mode} onChange={(v) => setF({ ...f, mode: v })} options={[{ v: "FIXED", l: "Fixed / profit rate" }, { v: "VARIABLE", l: "EIBOR + margin" }]} /></Field>
        {f.mode === "FIXED"
          ? <Field label="Interest / profit rate"><NumInput value={f.rate} onChange={(n) => setF({ ...f, rate: n })} suffix="% p.a." /></Field>
          : <>
            <Field label={`EIBOR 3M (${fmtDate(latest?.date)})`}><TextInput className="num" disabled value={`${latest?.m3 ?? "—"}%`} /></Field>
            <Field label="Bank margin"><NumInput value={f.margin} onChange={(n) => setF({ ...f, margin: n })} suffix="%" /></Field>
          </>}
        <Field label="Tenure (months)"><NumInput value={f.tenure} onChange={(n) => setF({ ...f, tenure: Math.min(300, n) })} suffix="mo" /></Field>
        <div className="flex items-end pb-2"><Toggle on={f.qualifying} onChange={(v) => setF({ ...f, qualifying: v })} label={`Qualifying rate (+${stress.pct}%)`} /></div>
      </div>
    </Shell>
  );
}

function AgeCalc() {
  const { state } = useStore();
  const [f, setF] = useState({ dob: "1992-01-01", ct: "EXPAT" as CustomerType, emp: "SALARIED" as Employment, bankId: "", productId: state.products[0].id });
  const product = state.products.find((p) => p.id === f.productId);
  const r = useMemo(() => tenureCalc(state, { dob: f.dob, customerType: f.ct, employment: f.emp, bankId: f.bankId || undefined, product }), [state, f, product]);
  return (
    <Shell title="Age & Tenure" desc="Resolves retirement age by customer type, employment and bank exceptions — then caps tenure month-by-month." rules={r.rulesUsed}
      results={<>
        <DarkOut k="Current age" v={`${r.age} yrs`} />
        <DarkOut k="Retirement age (rule)" v={`${r.retireAge} yrs`} />
        <DarkOut k="Global tenure cap" v={`${r.globalCap} mo`} />
        <DarkOut k="Max tenure by age" v={`${r.byAge} mo`} />
        <DarkOut k="Max tenure by product" v={`${r.byProduct} mo`} />
        <DarkOut k="Final eligible tenure" v={`${r.final} mo`} big tone="text-pine-300" />
        <DarkOut k="Age at loan maturity" v={`${fmtN(r.ageAtMaturity, 1)} yrs`} tone={r.ageAtMaturity > r.retireAge ? "text-rust-100" : undefined} />
        <div className={cx("mt-2 rounded px-2.5 py-1.5 font-display font-bold text-[12px]", r.eligible ? "bg-pine-600" : "bg-rust-500")}>{r.eligible ? "ELIGIBLE" : "NOT ELIGIBLE — tenure exhausted"}</div>
      </>}
      save={<SaveBar rules={r.rulesUsed} outputs={{ age: r.age, retireAge: r.retireAge, finalTenure: r.final, ageAtMaturity: fmtN(r.ageAtMaturity, 1) }} onLabel={(ref) => `Age & tenure · DOB ${f.dob}${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Date of birth"><DateInput value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
        <Field label="Application date"><TextInput className="num" disabled value={fmtDate(todayISO())} /></Field>
        <Field label="Customer type"><Select value={f.ct} onChange={(v) => setF({ ...f, ct: v as CustomerType })} options={[{ v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "UAE National" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="Employment"><Select value={f.emp} onChange={(v) => setF({ ...f, emp: v as Employment })} options={[{ v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self-Employed" }]} /></Field>
        <Field label="Bank (for exceptions)"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v })} options={[{ v: "", l: "No bank selected" }, ...state.banks.map((b) => ({ v: b.id, l: b.name }))]} /></Field>
        <Field label="Product"><Select value={f.productId} onChange={(v) => setF({ ...f, productId: v })} options={state.products.map((p) => ({ v: p.id, l: `${p.name} · ${p.maxTenureMonths}mo` }))} /></Field>
      </div>
      {f.bankId === "b-dib" && f.ct === "EXPAT" && f.emp === "SALARIED" && (
        <p className="mt-3 text-[11.5px] bg-pine-50 border border-pine-200 text-pine-800 rounded px-2.5 py-1.5"><Ic n="scale" size={12} className="inline mr-1" /> DIB exception applied — expat salaried retirement age 65 (rule RET-DIB-EXP).</p>
      )}
    </Shell>
  );
}

function DbrCalc() {
  const { state } = useStore();
  const [f, setF] = useState({ salary: 30000, other: 0, car: 1500, personal: 0, cards: "20000", otherLiab: 0, emi: 6000, ct: "EXPAT" as CustomerType, emp: "SALARIED" as Employment, bankId: "" });
  const r = useMemo(() => {
    const income = f.salary + f.other;
    const cc = ccLiability(state, cardArr(f.cards), f.bankId || undefined);
    const existing = f.car + f.personal + f.otherLiab + cc.amount;
    const cap = dbrCapFor(state, f.ct, f.emp);
    const dbr = income ? ((existing + f.emi) / income) * 100 : 0;
    const maxAddEmi = Math.max(0, (income * cap.pct) / 100 - existing);
    const rules = [cc.rule, cap.rule].filter(Boolean).map((x) => ({ code: x!.code, version: x!.version }));
    return { income, cc, existing, cap, dbr, maxAddEmi, rules, status: dbr >= cap.pct ? "BLOCKED" : dbr >= cap.pct - 5 ? "REVIEW" : "PASS" };
  }, [state, f]);
  const tone = r.status === "BLOCKED" ? "bg-rust-500" : r.status === "REVIEW" ? "bg-amber-500" : "bg-pine-600";
  return (
    <Shell title="DBR / DSR" desc="DBR = total monthly obligations ÷ gross monthly income × 100. The ceiling is an admin rule — currently strict-below enforcement." rules={r.rules}
      results={<>
        <div className={cx("rounded px-2.5 py-1.5 font-display font-bold text-[12px] mb-2", tone)}>{r.status}{r.status === "BLOCKED" && " — exceeds permitted level"}</div>
        <DarkOut k="Gross monthly income" v={fmtAED(r.income)} />
        <DarkOut k="Card liability @5%" v={fmtAED(r.cc.amount)} />
        <DarkOut k="Existing obligations" v={fmtAED(r.existing)} />
        <DarkOut k="Proposed EMI" v={fmtAED(f.emi)} />
        <DarkOut k="DBR" v={fmtPct(r.dbr, 1)} big tone={r.dbr >= r.cap.pct ? "text-rust-100" : "text-pine-300"} />
        <DarkOut k="Max allowed DBR" v={fmtPct(r.cap.pct, 0)} />
        <DarkOut k="Available DBR headroom" v={fmtPct(Math.max(0, r.cap.pct - r.dbr), 1)} />
        <DarkOut k="Max additional EMI" v={fmtAED(r.maxAddEmi)} tone="text-amber-100" />
      </>}
      save={<SaveBar rules={r.rules} outputs={{ dbr: fmtPct(r.dbr, 1), cap: fmtPct(r.cap.pct, 0), obligations: Math.round(r.existing), status: r.status }} onLabel={(ref) => `DBR check · income ${fmtAED(r.income)}${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        <Field label="Monthly salary"><NumInput value={f.salary} onChange={(n) => setF({ ...f, salary: n })} suffix="AED" /></Field>
        <Field label="Other income"><NumInput value={f.other} onChange={(n) => setF({ ...f, other: n })} suffix="AED" /></Field>
        <Field label="Car loan /mo"><NumInput value={f.car} onChange={(n) => setF({ ...f, car: n })} suffix="AED" /></Field>
        <Field label="Personal loan /mo"><NumInput value={f.personal} onChange={(n) => setF({ ...f, personal: n })} suffix="AED" /></Field>
        <Field label="Card limits (comma sep.)"><TextInput className="num" value={f.cards} onChange={(e) => setF({ ...f, cards: e.target.value })} /></Field>
        <Field label="Other liabilities /mo"><NumInput value={f.otherLiab} onChange={(n) => setF({ ...f, otherLiab: n })} suffix="AED" /></Field>
        <Field label="Proposed EMI"><NumInput value={f.emi} onChange={(n) => setF({ ...f, emi: n })} suffix="AED" /></Field>
        <Field label="Customer type"><Select value={f.ct} onChange={(v) => setF({ ...f, ct: v as CustomerType })} options={[{ v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "UAE National" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="Bank"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v })} options={[{ v: "", l: "Standard rules" }, ...state.banks.map((b) => ({ v: b.id, l: b.name }))]} /></Field>
      </div>
    </Shell>
  );
}

function MaxLoan() {
  const { state } = useStore();
  const { f, setF, applyPerson, persons } = usePersonForm();
  const product = state.products.find((p) => p.id === f.productId);
  const res = useMemo(() => affordability(state, { ...f, dob: f.dob, customerType: f.customerType, employment: f.employment, salary: f.salary, otherIncome: f.otherIncome, propertyValue: f.propertyValue, financeCount: f.financeCount, liabilitiesMonthly: f.liabilities, cardLimits: cardArr(f.cards), bankId: f.bankId, product, proposedLoan: 0, txType: f.txType, qualifying: false }), [state, f, product]);
  const binding = res.maxByLtv <= res.maxByDbr ? "LTV" : "DBR / income";
  return (
    <Shell title="Maximum Eligible Loan" desc="LTV limit ∩ DBR limit ∩ age/tenure limit ∩ product cap — the tightest constraint decides." rules={res.rulesUsed}
      results={<>
        <DarkOut k="Max by LTV" v={fmtAED(res.maxByLtv)} />
        <DarkOut k="Max by DBR" v={fmtAED(res.maxByDbr)} />
        <DarkOut k="Max by age / tenure" v={`${res.finalTenure} mo eligible`} />
        <DarkOut k="Product ceiling" v={res.productCap ? fmtAED(res.productCap) : "—"} />
        <DarkOut k="Final maximum loan" v={fmtAED(res.maxLoan)} big tone="text-pine-300" />
        <DarkOut k="Binding constraint" v={binding} tone="text-amber-100" />
        <DarkOut k="EMI at max" v={fmtAED(emiFn(res.maxLoan, res.rate, res.finalTenure))} />
      </>}
      save={<SaveBar rules={res.rulesUsed} outputs={{ maxByLTV: Math.round(res.maxByLtv), maxByDBR: Math.round(res.maxByDbr), finalMax: Math.round(res.maxLoan), binding }} onLabel={(ref) => `Max loan · ${persons.find((p) => p.id === f.personId)?.name ?? f.customerType}${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        <div className="sm:col-span-2"><Field label="Client profile"><Select value={f.personId} onChange={applyPerson} options={[{ v: "", l: "— manual entry —" }, ...persons.map((p) => ({ v: p.id, l: p.name }))]} /></Field></div>
        <Field label="Customer type"><Select value={f.customerType} onChange={(v) => setF({ ...f, customerType: v as CustomerType })} options={[{ v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "UAE National" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="Date of birth"><DateInput value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
        <Field label="Monthly salary"><NumInput value={f.salary} onChange={(n) => setF({ ...f, salary: n })} suffix="AED" /></Field>
        <Field label="Property value"><NumInput value={f.propertyValue} onChange={(n) => setF({ ...f, propertyValue: n })} suffix="AED" /></Field>
        <Field label="Liabilities /mo"><NumInput value={f.liabilities} onChange={(n) => setF({ ...f, liabilities: n })} suffix="AED" /></Field>
        <Field label="Card limits"><TextInput className="num" value={f.cards} onChange={(e) => setF({ ...f, cards: e.target.value })} /></Field>
        <Field label="Bank"><Select value={f.bankId} onChange={(v) => setF({ ...f, bankId: v, productId: state.products.find((p) => p.bankId === v)?.id ?? f.productId })} options={state.banks.map((b) => ({ v: b.id, l: b.name }))} /></Field>
        <Field label="Product"><Select value={f.productId} onChange={(v) => setF({ ...f, productId: v })} options={state.products.filter((p) => p.bankId === f.bankId).map((p) => ({ v: p.id, l: p.name }))} /></Field>
      </div>
    </Shell>
  );
}

function FeesCalc() {
  const { state } = useStore();
  const [f, setF] = useState({ pv: 1500000, ct: "EXPAT" as CustomerType, fc: 1 as 1 | 2, tx: "PURCHASE" as TxType, loan: 0 });
  const r = useMemo(() => {
    const ltv = ltvFor(state, f.ct, f.fc, undefined, f.tx);
    const loan = f.loan > 0 ? Math.min(f.loan, (f.pv * ltv.pct) / 100) : (f.pv * ltv.pct) / 100;
    const fees = feeLines(state, { propertyValue: f.pv, loanAmount: loan, txType: f.tx });
    return { ltv, loan, down: f.pv - loan, fees, total: f.pv - loan + fees.total, rules: [ltv.rule, ...fees.lines.map((l) => l.rule)].filter(Boolean).map((x) => ({ code: x!.code, version: x!.version })) };
  }, [state, f]);
  return (
    <Shell title="Fees & Cash Required" desc="Finance and charges are kept separate — processing, valuation, DLD, registration — then summed into cash required." rules={r.rules}
      results={<>
        <p className="text-[10px] font-display font-semibold uppercase tracking-[0.12em] text-paper/50 mb-1">Finance</p>
        <DarkOut k="Loan" v={fmtAED(r.loan)} />
        <DarkOut k="Down payment" v={fmtAED(r.down)} />
        <p className="text-[10px] font-display font-semibold uppercase tracking-[0.12em] text-paper/50 mb-1 mt-3">Charges</p>
        {r.fees.lines.map((l) => <DarkOut key={l.name} k={l.name} v={fmtAED(l.amount)} />)}
        <DarkOut k="Customer cash required" v={fmtAED(r.total)} big tone="text-amber-100" />
      </>}
      save={<SaveBar rules={r.rules} outputs={{ loan: Math.round(r.loan), downPayment: Math.round(r.down), charges: Math.round(r.fees.total), cashRequired: Math.round(r.total) }} onLabel={(ref) => `Fees · ${f.tx.replace("_", "+")}${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Property value"><NumInput value={f.pv} onChange={(n) => setF({ ...f, pv: n })} suffix="AED" /></Field>
        <Field label="Loan (0 = LTV max)"><NumInput value={f.loan} onChange={(n) => setF({ ...f, loan: n })} suffix="AED" /></Field>
        <Field label="Customer type"><Select value={f.ct} onChange={(v) => setF({ ...f, ct: v as CustomerType })} options={[{ v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "UAE National" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="Finance count"><Select value={String(f.fc)} onChange={(v) => setF({ ...f, fc: Number(v) as 1 | 2 })} options={[{ v: "1", l: "1st property" }, { v: "2", l: "2nd or more" }]} /></Field>
        <Field label="Transaction"><Select value={f.tx} onChange={(v) => setF({ ...f, tx: v as TxType })} options={[{ v: "PURCHASE", l: "Purchase" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + Equity" }, { v: "EQUITY", l: "Pure Equity" }]} /></Field>
      </div>
    </Shell>
  );
}

function EiborCalc() {
  const { state } = useStore();
  const rows = [...state.eibor].reverse();
  const [f, setF] = useState({ date: rows[0]?.date ?? todayISO(), tenor: "m3", margin: 1.99, loan: 1000000, tenure: 300 });
  const row = state.eibor.find((x) => x.date === f.date) ?? rows[0];
  const eibor = row ? (row as never as Record<string, number>)[f.tenor] : 0;
  const rate = eibor + f.margin;
  const e = emiFn(f.loan, rate, f.tenure);
  return (
    <Shell title="EIBOR Calculator" desc="Daily published tenors from the EIBOR master + bank margin = customer rate. History is retained." rules={[]}
      results={<>
        <DarkOut k={`EIBOR (${f.tenor.toUpperCase()}, ${fmtDate(row?.date)})`} v={fmtPct(eibor, 3)} />
        <DarkOut k="Bank margin" v={fmtPct(f.margin, 2)} />
        <DarkOut k="Customer rate" v={fmtPct(rate, 2)} big tone="text-pine-300" />
        <DarkOut k="EMI on this rate" v={fmtAED(e)} big />
      </>}
      save={<SaveBar rules={[]} outputs={{ eibor: fmtPct(eibor, 3), customerRate: fmtPct(rate, 2), emi: Math.round(e) }} onLabel={(ref) => `EIBOR ${f.tenor.toUpperCase()} + ${f.margin}%${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        <Field label="Publication date"><Select value={f.date} onChange={(v) => setF({ ...f, date: v })} options={rows.map((x) => ({ v: x.date, l: fmtDate(x.date) }))} /></Field>
        <Field label="Tenor"><Select value={f.tenor} onChange={(v) => setF({ ...f, tenor: v })} options={[{ v: "d1", l: "Overnight" }, { v: "w1", l: "1 Week" }, { v: "m1", l: "1 Month" }, { v: "m3", l: "3 Month" }, { v: "m6", l: "6 Month" }, { v: "y1", l: "1 Year" }]} /></Field>
        <Field label="Bank margin"><NumInput value={f.margin} onChange={(n) => setF({ ...f, margin: n })} suffix="%" /></Field>
        <Field label="Loan amount"><NumInput value={f.loan} onChange={(n) => setF({ ...f, loan: n })} suffix="AED" /></Field>
        <Field label="Tenure"><NumInput value={f.tenure} onChange={(n) => setF({ ...f, tenure: n })} suffix="mo" /></Field>
      </div>
      <div className="mt-4 overflow-x-auto">
        <p className="text-[10px] font-display font-semibold uppercase tracking-[0.12em] text-ink-soft mb-1.5">EIBOR master (latest)</p>
        <table className="w-full text-[11.5px] num">
          <thead><tr className="text-left text-ink-soft border-b border-mist">{["Date", "O/N", "1W", "1M", "3M", "6M", "1Y"].map((h) => <th key={h} className="py-1.5 pr-3 font-display text-[10px] uppercase tracking-wide">{h}</th>)}</tr></thead>
          <tbody>
            {rows.slice(0, 5).map((x) => (
              <tr key={x.date} className={cx("border-b border-mist/60 cursor-pointer hover:bg-pine-50", x.date === f.date && "bg-pine-50")} onClick={() => setF({ ...f, date: x.date })}>
                <td className="py-1.5 pr-3 font-semibold">{fmtDate(x.date)}</td>
                <td className="pr-3">{fmtN(x.d1, 3)}</td><td className="pr-3">{fmtN(x.w1, 3)}</td><td className="pr-3">{fmtN(x.m1, 3)}</td>
                <td className="pr-3 font-semibold text-pine-700">{fmtN(x.m3, 3)}</td><td className="pr-3">{fmtN(x.m6, 3)}</td><td>{fmtN(x.y1, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function BuyoutCalc() {
  const { state } = useStore();
  const [f, setF] = useState({ pv: 2400000, outstanding: 1410000, topUp: 0, rate: 3.75, tenure: 300, ct: "EXPAT" as CustomerType, fc: 1 as 1 | 2, income: 52000, existing: 0, cards: "35000", bankId: "" });
  const r = useMemo(() => buyoutCalc(state, { propertyValue: f.pv, outstanding: f.outstanding, customerType: f.ct, financeCount: f.fc, rate: f.rate, tenure: f.tenure, topUp: f.topUp, income: f.income, existingMonthly: f.existing, cardLimits: cardArr(f.cards), bankId: f.bankId || undefined }), [state, f]);
  const st = settlementFor(state);
  return (
    <Shell title="Buyout" desc="Settles the existing liability at the new bank — settlement charge, new finance, equity and the new DBR in one view." rules={r.rulesUsed}
      results={<>
        {r.blocked && <div className="rounded px-2.5 py-1.5 font-display font-bold text-[12px] mb-2 bg-amber-500">STRUCTURE TIGHT — request exceeds {fmtPct(r.ltvPct, 0)} LTV</div>}
        <DarkOut k="Applicable LTV" v={fmtPct(r.ltvPct, 0)} />
        <DarkOut k="Max new finance" v={fmtAED(r.maxFinance)} />
        <DarkOut k="Existing liability" v={fmtAED(f.outstanding)} />
        <DarkOut k={`Settlement (${fmtN(r.settlementPct, 0)}% cap ${fmtAED(r.settlementCap)})`} v={fmtAED(r.settlementAmount)} />
        <DarkOut k="New finance" v={fmtAED(r.newLoan)} big tone="text-pine-300" />
        <DarkOut k="Additional equity" v={fmtAED(r.equity)} />
        <DarkOut k="Fees" v={fmtAED(r.feesTotal)} />
        <DarkOut k="Net cash to customer" v={fmtAED(r.netToCustomer)} tone={r.netToCustomer < 0 ? "text-rust-100" : "text-amber-100"} />
        <DarkOut k="New EMI" v={fmtAED(r.emi)} />
        <DarkOut k="DBR after buyout" v={`${fmtPct(r.dbr, 1)} / ${fmtN(r.dbrCapPct, 0)}%`} tone={r.dbr >= r.dbrCapPct ? "text-rust-100" : undefined} />
      </>}
      save={<SaveBar rules={r.rulesUsed} outputs={{ newFinance: Math.round(r.newLoan), settlement: Math.round(r.settlementAmount), equity: Math.round(r.equity), emi: Math.round(r.emi), dbr: fmtPct(r.dbr, 1) }} onLabel={(ref) => `Buyout · outstanding ${fmtAED(f.outstanding)}${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        <Field label="Property value"><NumInput value={f.pv} onChange={(n) => setF({ ...f, pv: n })} suffix="AED" /></Field>
        <Field label="Outstanding balance"><NumInput value={f.outstanding} onChange={(n) => setF({ ...f, outstanding: n })} suffix="AED" /></Field>
        <Field label="Top-up requested"><NumInput value={f.topUp} onChange={(n) => setF({ ...f, topUp: n })} suffix="AED" /></Field>
        <Field label="New rate"><NumInput value={f.rate} onChange={(n) => setF({ ...f, rate: n })} suffix="%" /></Field>
        <Field label="New tenure"><NumInput value={f.tenure} onChange={(n) => setF({ ...f, tenure: n })} suffix="mo" /></Field>
        <Field label="Customer type"><Select value={f.ct} onChange={(v) => setF({ ...f, ct: v as CustomerType })} options={[{ v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "UAE National" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="Monthly income"><NumInput value={f.income} onChange={(n) => setF({ ...f, income: n })} suffix="AED" /></Field>
        <Field label="Other obligations /mo"><NumInput value={f.existing} onChange={(n) => setF({ ...f, existing: n })} suffix="AED" /></Field>
        <Field label="Card limits"><TextInput className="num" value={f.cards} onChange={(e) => setF({ ...f, cards: e.target.value })} /></Field>
      </div>
    </Shell>
  );
}

function EquityCalc() {
  const { state } = useStore();
  const [f, setF] = useState({ pv: 3000000, outstanding: 1200000, ct: "NATIONAL" as CustomerType, fc: 1 as 1 | 2, rate: 3.75, tenure: 300, income: 75000, obligations: 3200, cards: "50000" });
  const r = useMemo(() => {
    const ltv = ltvFor(state, f.ct, f.fc, undefined, "EQUITY");
    const maxFin = (f.pv * ltv.pct) / 100;
    const gross = Math.max(0, maxFin - f.outstanding);
    const fees = feeLines(state, { propertyValue: f.pv, loanAmount: maxFin, txType: "EQUITY" });
    const e = emiFn(maxFin, f.rate, f.tenure);
    const cc = ccLiability(state, cardArr(f.cards));
    const cap = dbrCapFor(state, f.ct);
    const dbr = f.income ? ((f.obligations + cc.amount + e) / f.income) * 100 : 0;
    const rules = [ltv.rule, ...fees.lines.map((l) => l.rule), cc.rule, cap.rule].filter(Boolean).map((x) => ({ code: x!.code, version: x!.version }));
    return { ltv, maxFin, gross, fees, net: gross - fees.total, e, dbr, cap, rules };
  }, [state, f]);
  return (
    <Shell title="Pure Equity / Refinance" desc="Release equity against a property you already own — borrow to the LTV ceiling, settle the existing loan, take the rest." rules={r.rules}
      results={<>
        <DarkOut k="Applicable LTV" v={fmtPct(r.ltv.pct, 0)} />
        <DarkOut k="Maximum finance" v={fmtAED(r.maxFin)} />
        <DarkOut k="Existing liability" v={fmtAED(f.outstanding)} />
        <DarkOut k="Gross equity released" v={fmtAED(r.gross)} big tone="text-pine-300" />
        <DarkOut k="Fees" v={fmtAED(r.fees.total)} />
        <DarkOut k="Net equity to customer" v={fmtAED(r.net)} big tone="text-amber-100" />
        <DarkOut k="New EMI" v={fmtAED(r.e)} />
        <DarkOut k="DBR" v={`${fmtPct(r.dbr, 1)} / ${fmtN(r.cap.pct, 0)}%`} tone={r.dbr >= r.cap.pct ? "text-rust-100" : undefined} />
      </>}
      save={<SaveBar rules={r.rules} outputs={{ maxFinance: Math.round(r.maxFin), grossEquity: Math.round(r.gross), netEquity: Math.round(r.net), emi: Math.round(r.e) }} onLabel={(ref) => `Equity release · ${fmtAED(f.pv)} property${ref ? ` · ${ref}` : ""}`} />}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        <Field label="Property value"><NumInput value={f.pv} onChange={(n) => setF({ ...f, pv: n })} suffix="AED" /></Field>
        <Field label="Existing loan"><NumInput value={f.outstanding} onChange={(n) => setF({ ...f, outstanding: n })} suffix="AED" /></Field>
        <Field label="Customer type"><Select value={f.ct} onChange={(v) => setF({ ...f, ct: v as CustomerType })} options={[{ v: "EXPAT", l: "Expat" }, { v: "NATIONAL", l: "UAE National" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
        <Field label="New rate"><NumInput value={f.rate} onChange={(n) => setF({ ...f, rate: n })} suffix="%" /></Field>
        <Field label="Tenure"><NumInput value={f.tenure} onChange={(n) => setF({ ...f, tenure: n })} suffix="mo" /></Field>
        <Field label="Finance count"><Select value={String(f.fc)} onChange={(v) => setF({ ...f, fc: Number(v) as 1 | 2 })} options={[{ v: "1", l: "1st property" }, { v: "2", l: "2nd or more" }]} /></Field>
        <Field label="Monthly income"><NumInput value={f.income} onChange={(n) => setF({ ...f, income: n })} suffix="AED" /></Field>
        <Field label="Obligations /mo"><NumInput value={f.obligations} onChange={(n) => setF({ ...f, obligations: n })} suffix="AED" /></Field>
        <Field label="Card limits"><TextInput className="num" value={f.cards} onChange={(e) => setF({ ...f, cards: e.target.value })} /></Field>
      </div>
    </Shell>
  );
}

function AuditLog() {
  const { state } = useStore();
  const nav = useNav();
  const user = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";
  return (
    <div className="anim-up">
      <h2 className="font-display font-bold text-xl tracking-tight">Calculation Audit</h2>
      <p className="text-[12.5px] text-ink-soft mt-0.5 mb-4">If a rule changes tomorrow, this log tells you exactly which rule version produced each historical result.</p>
      <div className="bg-card border border-mist rounded-lg overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[760px]">
          <thead><tr className="text-left text-[10.5px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/60">
            <th className="px-4 py-2.5 font-semibold">When</th><th className="px-3 py-2.5 font-semibold">Calculation</th><th className="px-3 py-2.5 font-semibold">Linked to</th><th className="px-3 py-2.5 font-semibold">Key outputs</th><th className="px-3 py-2.5 font-semibold">Rule versions</th>
          </tr></thead>
          <tbody>
            {state.calcs.map((c) => (
              <tr key={c.id} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/50 transition-colors">
                <td className="px-4 py-2.5 num text-[11px] whitespace-nowrap">{fmtTime(c.at)}<br /><span className="text-ink-soft">{user(c.by)}</span></td>
                <td className="px-3 py-2.5 font-semibold max-w-[220px]">{c.label}</td>
                <td className="px-3 py-2.5">
                  {c.linkRef
                    ? <button className="num font-semibold text-pine-700 hover:underline" onClick={() => { if (c.linkKind === "case") nav.go("cases", { caseId: c.linkId }); if (c.linkKind === "lead") nav.go("leads"); }}>{c.linkRef}</button>
                    : <span className="text-ink-soft/60">standalone</span>}
                </td>
                <td className="px-3 py-2.5 num text-[11px] max-w-[220px]">{Object.entries(c.outputs).slice(0, 3).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</td>
                <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{c.rulesUsed.length ? c.rulesUsed.map((r) => <span key={r.code} className="num text-[10px] bg-ink/6 rounded px-1.5 py-0.5">{r.code} v{r.version}</span>) : <span className="text-[11px] text-ink-soft">formula only</span>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
