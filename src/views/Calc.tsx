import { useMemo, useState } from "react";
import type { CalcRecord, CustomerType, Employment, Person } from "../types";
import { useMe, useNav, useStore } from "../store";
import { ageYears, dbrPct, emi, maxTenure } from "../calc";
import { Btn, Field, Ic, NumInput, Pill, Select, cx, fmtAED, nowISO, todayISO, uid, fmtPct } from "../ui";

const CALCS = [
  { id: "affordability", l: "Affordability", icon: "calc", sub: "The full pre-sales picture" },
  { id: "emi", l: "EMI", icon: "pulse", sub: "Monthly installment" },
  { id: "ltv", l: "LTV & Max Loan", icon: "layers", sub: "From the rule matrix" },
  { id: "dbr", l: "DBR / DSR", icon: "timer", sub: "Debt burden check" },
  { id: "age", l: "Age & Tenure", icon: "calendar", sub: "Retirement-aware term" },
  { id: "cash", l: "Cash Requirement", icon: "briefcase", sub: "Down payment + fees" },
];

export default function CalculatorsView() {
  const { state, dispatch } = useStore();
  const me = useMe();
  const nav = useNav();
  const [active, setActive] = useState<string>(() => (typeof nav.params.calc === "string" ? (nav.params.calc as string) : "affordability"));
  const [link, setLink] = useState<string>(() => {
    const pid = nav.params.personId as string | undefined;
    const lid = nav.params.leadId as string | undefined;
    if (pid) return `person:${pid}`;
    if (lid) return `lead:${lid}`;
    return "";
  });

  const rule = (code: string) => state.rules.find((r) => r.code === code && r.active);
  const used = (codes: string[]) => codes.map((c) => { const r = rule(c); return r ? { code: r.code, version: r.version } : null; }).filter(Boolean) as { code: string; version: number }[];

  /* inputs */
  const [loan, setLoan] = useState(1000000);
  const [rate, setRate] = useState(3.99);
  const [tenure, setTenure] = useState(300);
  const [propVal, setPropVal] = useState<number>(() => (nav.params.propertyValue as number) || 1500000);
  const [ctype, setCtype] = useState<CustomerType>("EXPAT");
  const [finCount, setFinCount] = useState<1 | 2>(1);
  const [salary, setSalary] = useState(30000);
  const [otherIncome, setOtherIncome] = useState(0);
  const [liab, setLiab] = useState(5000);
  const [cardLimits, setCardLimits] = useState(20000);
  const [dob, setDob] = useState("1990-01-01");
  const [emp, setEmp] = useState<Employment>("SALARIED");

  const ltvPct = useMemo(() => {
    if (ctype === "NATIONAL") return finCount === 1 ? (rule("LTV-NAT-1")?.value ?? 85) : 70;
    if (ctype === "NON_RESIDENT") return rule("LTV-NR")?.value ?? 50;
    return finCount === 1 ? (rule("LTV-EXP-1")?.value ?? 80) : 65;
  }, [ctype, finCount, state.rules]);

  const retireAge = ctype === "NATIONAL" ? (rule("RETIRE-NAT")?.value ?? 70) : (rule("RETIRE-EXP")?.value ?? 65);
  const dbrCap = rule("DBR-MAX")?.value ?? 50;
  const ccPct = (rule("CC-LIAB")?.value ?? 5) / 100;

  const emiV = emi(loan, rate, tenure);
  const totalLiab = liab + cardLimits * ccPct;
  const gross = salary + otherIncome;
  const dbrVal = gross ? ((totalLiab + emiV) / gross) * 100 : 0;
  const age = ageYears(dob);
  const eligibleTenure = maxTenure(dob, rule("TENURE-MAX")?.value ?? 300, retireAge);
  const maxByLtv = propVal * (ltvPct / 100);
  const availDbr = Math.max(0, dbrCap - (gross ? (totalLiab / gross) * 100 : 0));
  const maxEmiByDbr = (availDbr / 100) * gross;

  const save = (type: string, label: string, outputs: Record<string, unknown>, codes: string[]) => {
    const [kind, id] = link.split(":");
    const ref = kind === "case" ? state.cases.find((c) => c.id === id)?.ref : kind === "lead" ? state.leads.find((l) => l.id === id)?.ref : undefined;
    dispatch({
      t: "SAVE_CALC", calc: {
        id: "calc" + uid(), type, label: label + (ref ? ` · ${ref}` : ""), linkKind: (kind as "case" | "lead") || undefined,
        linkId: id || undefined, linkRef: ref, inputs: {}, outputs, rulesUsed: used(codes), by: me?.id ?? "", at: nowISO(),
      },
    });
  };

  const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
    <div className={cx("flex justify-between gap-3 border-b border-mist/50 py-2 text-[13px] last:border-0", strong && "bg-pine-50/60 -mx-3 px-3 rounded")}>
      <span className="text-ink-soft">{k}</span><span className={cx("num font-semibold text-right", strong && "text-pine-800 text-[14px]")}>{v}</span>
    </div>
  );

  return (
    <div className="grid lg:grid-cols-12 gap-4">
      {/* rail */}
      <div className="lg:col-span-3 anim-up self-start space-y-1.5">
        <p className="text-[10.5px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft px-1 mb-2">Calculator centre</p>
        {CALCS.map((c) => (
          <button key={c.id} onClick={() => setActive(c.id)}
            className={cx("w-full flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-all", active === c.id ? "bg-ink text-paper border-ink shadow-md" : "bg-card border-mist hover:border-pine-500 hover:-translate-y-px")}>
            <Ic n={c.icon} size={16} className={active === c.id ? "text-pine-400" : "text-ink-soft"} />
            <span className="min-w-0">
              <span className={cx("block font-display font-bold text-[13px] tracking-tight", active === c.id ? "text-paper" : "text-ink")}>{c.l}</span>
              <span className={cx("block text-[10.5px] truncate", active === c.id ? "text-paper/60" : "text-ink-soft")}>{c.sub}</span>
            </span>
          </button>
        ))}
        <div className="pt-2">
          <Field label="Attach to case / lead">
            <Select value={link} onChange={setLink} options={[{ v: "", l: "— not attached —" },
              ...state.cases.filter((c) => c.status === "OPEN").map((c) => ({ v: `case:${c.id}`, l: `${c.ref} · ${state.persons.find((p) => p.id === c.personId)?.name?.split(" ")[0]}` })),
              ...state.leads.filter((l) => l.status !== "CONVERTED").map((l) => ({ v: `lead:${l.id}`, l: `${l.ref} · ${state.persons.find((p) => p.id === l.personId)?.name?.split(" ")[0]}` }))]} />
          </Field>
        </div>
      </div>

      {/* body */}
      <div className="lg:col-span-9 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="anim-up bg-card border border-mist rounded-lg p-4">
            <p className="font-display font-bold text-[14px] tracking-tight mb-3">Inputs</p>
            <div className="grid grid-cols-2 gap-3">
              {(active === "affordability" || active === "ltv" || active === "cash") && (<>
                <Field label="Property value"><NumInput value={propVal} onChange={setPropVal} suffix="AED" /></Field>
                <Field label="Customer type"><Select value={ctype} onChange={(v) => setCtype(v as CustomerType)} options={[{ v: "NATIONAL", l: "UAE National" }, { v: "EXPAT", l: "Expat" }, { v: "NON_RESIDENT", l: "Non-Resident" }]} /></Field>
                <Field label="Finance count"><Select value={String(finCount)} onChange={(v) => setFinCount(Number(v) as 1 | 2)} options={[{ v: "1", l: "1st property" }, { v: "2", l: "2nd or more" }]} /></Field>
              </>)}
              {(active === "emi" || active === "affordability" || active === "dbr" || active === "cash") && (
                <Field label="Loan amount"><NumInput value={loan} onChange={setLoan} suffix="AED" /></Field>
              )}
              {(active === "emi" || active === "affordability" || active === "dbr") && (<>
                <Field label="Rate %"><NumInput value={rate} onChange={setRate} suffix="%" /></Field>
                <Field label="Tenure (months)"><NumInput value={tenure} onChange={setTenure} suffix="mo" /></Field>
              </>)}
              {(active === "dbr" || active === "affordability") && (<>
                <Field label="Monthly salary"><NumInput value={salary} onChange={setSalary} suffix="AED" /></Field>
                <Field label="Other income"><NumInput value={otherIncome} onChange={setOtherIncome} suffix="AED" /></Field>
                <Field label="Existing liabilities"><NumInput value={liab} onChange={setLiab} suffix="AED/mo" /></Field>
                <Field label="Card limits (total)"><NumInput value={cardLimits} onChange={setCardLimits} suffix="AED" /></Field>
              </>)}
              {active === "age" && (<>
                <Field label="Date of birth"><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full h-[34px] rounded-md border border-mist bg-card px-3 text-[13px]" /></Field>
                <Field label="Customer type"><Select value={ctype} onChange={(v) => setCtype(v as CustomerType)} options={[{ v: "NATIONAL", l: "UAE National" }, { v: "EXPAT", l: "Expat" }]} /></Field>
              </>)}
            </div>
          </div>

          <div className="anim-up bg-card border border-mist rounded-lg p-4" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-display font-bold text-[14px] tracking-tight">Result</p>
              <Pill tone="steel">{CALCS.find((c) => c.id === active)?.l}</Pill>
            </div>

            {active === "emi" && (<>
              <Row k="Monthly EMI" v={fmtAED(emiV)} strong />
              <Row k="Total payments" v={fmtAED(emiV * tenure)} />
              <Row k="Total interest" v={fmtAED(emiV * tenure - loan)} />
            </>)}

            {active === "ltv" && (<>
              <Row k="Applicable LTV" v={`${ltvPct}%`} />
              <Row k="Max finance (LTV)" v={fmtAED(maxByLtv)} strong />
              <Row k="Required equity" v={fmtAED(Math.max(0, propVal - maxByLtv))} />
              <p className="text-[10.5px] text-ink-soft mt-2">Read from the Admin rule matrix · {used(["LTV-NAT-1", "LTV-EXP-1", "LTV-NR"]).map((r) => `${r.code} v${r.version}`).join(" · ") || "default"}</p>
            </>)}

            {active === "dbr" && (<>
              <Row k="Gross monthly income" v={fmtAED(gross)} />
              <Row k="Existing obligations" v={fmtAED(totalLiab)} />
              <Row k="Proposed EMI" v={fmtAED(emiV)} />
              <Row k="DBR" v={fmtPct(dbrVal)} strong />
              <Row k="Max allowed DBR" v={`${dbrCap}% (strictly below)`} />
              <p className={cx("text-[12px] font-semibold mt-2", dbrVal >= dbrCap ? "text-rust-600" : "text-pine-700")}>{dbrVal >= dbrCap ? "Exceeds the ceiling — not eligible as structured." : "Within the ceiling — eligible."}</p>
            </>)}

            {active === "age" && (<>
              <Row k="Current age" v={`${age} yrs`} />
              <Row k="Retirement age" v={`${retireAge} yrs`} />
              <Row k="Max tenure (product)" v={`${rule("TENURE-MAX")?.value ?? 300} mo`} />
              <Row k="Max tenure by age" v={`${Math.max(0, (retireAge - age) * 12)} mo`} />
              <Row k="Eligible tenure" v={`${eligibleTenure} mo`} strong />
              <Row k="Age at maturity" v={`${age + Math.round(eligibleTenure / 12)} yrs`} />
            </>)}

            {active === "cash" && (<>
              <Row k="Max finance (LTV)" v={fmtAED(maxByLtv)} />
              <Row k="Down payment" v={fmtAED(Math.max(0, propVal - maxByLtv))} />
              <Row k="Fees (~3% est.)" v={fmtAED(propVal * 0.03)} />
              <Row k="Total cash required" v={fmtAED(Math.max(0, propVal - maxByLtv) + propVal * 0.03)} strong />
            </>)}

            {active === "affordability" && (<>
              <Row k="Max finance (LTV)" v={fmtAED(maxByLtv)} />
              <Row k="Monthly EMI" v={fmtAED(emiV)} />
              <Row k="DBR" v={fmtPct(dbrVal)} />
              <Row k="Eligible tenure" v={`${eligibleTenure} mo`} />
              <Row k="Down payment" v={fmtAED(Math.max(0, propVal - maxByLtv))} />
              <div className={cx("mt-2 rounded-md px-3 py-2 text-[12.5px] font-display font-bold", dbrVal >= dbrCap || loan > maxByLtv ? "bg-rust-100 text-rust-700" : "bg-pine-100 text-pine-800")}>
                {dbrVal >= dbrCap ? "REVIEW — DBR above ceiling" : loan > maxByLtv ? "REVIEW — loan above LTV limit" : "ELIGIBLE — within LTV & DBR limits"}
              </div>
            </>)}

            <div className="mt-4">
              <Btn onClick={() => {
                const codes = active === "ltv" || active === "cash" || active === "affordability" ? ["LTV-NAT-1", "LTV-EXP-1", "LTV-NR", "TENURE-MAX"] : active === "dbr" || active === "affordability" ? ["DBR-MAX", "CC-LIAB"] : active === "age" ? ["TENURE-MAX", "RETIRE-NAT", "RETIRE-EXP"] : [];
                save(active, `${CALCS.find((c) => c.id === active)?.l} — ${active === "emi" ? fmtAED(emiV) + "/mo" : active === "dbr" ? fmtPct(dbrVal) : active === "ltv" ? fmtAED(maxByLtv) : "result"}`, { note: "snapshot" }, codes);
              }}><Ic n="check" size={13} /> Save{link ? " & attach" : " to audit"}</Btn>
              <p className="text-[10.5px] text-ink-soft mt-2">Saved calculations stamp the exact rule versions used — old results never silently re-price.</p>
            </div>
          </div>
        </div>

        {/* recent calculations */}
        <div className="anim-up bg-card border border-mist rounded-lg overflow-hidden" style={{ animationDelay: "100ms" }}>
          <div className="px-4 py-3 border-b border-mist flex items-center justify-between">
            <p className="font-display font-bold text-[13.5px] tracking-tight">Calculation audit</p>
            <span className="num text-[11px] text-ink-soft">{state.calcs.length} saved</span>
          </div>
          {state.calcs.slice(0, 8).map((x) => (
            <div key={x.id} className="px-4 py-2.5 border-b border-mist/60 last:border-0 flex items-center gap-3">
              <Ic n="calc" size={14} className="text-pine-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium truncate">{x.label}</p>
                <p className="num text-[10.5px] text-ink-soft">{x.rulesUsed.map((r) => `${r.code} v${r.version}`).join(" · ") || "no rules"} · by {state.users.find((u) => u.id === x.by)?.name ?? x.by}</p>
              </div>
              {x.linkRef && <button onClick={() => x.linkKind === "case" && nav.go("cases", { caseId: x.linkId })} className="num text-[10.5px] font-bold text-pine-700 hover:underline shrink-0">{x.linkRef}</button>}
            </div>
          ))}
          {state.calcs.length === 0 && <p className="px-4 py-6 text-[12px] text-ink-soft text-center">No saved calculations yet — run one above.</p>}
        </div>
      </div>
    </div>
  );
}
