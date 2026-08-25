import { useMemo, useState } from "react";
import type { CalcRecord, Person } from "../types";
import { useMe, useStore } from "../store";
import { dbrPct, emi, liabilitiesMonthly, maxTenure, ageYears } from "../calc";
import { Btn, Field, Ic, KV, NumInput, Pill, Select, cx, fmtAED, fmtDate, fmtN, fmtPct, nowISO, todayISO, uid } from "../ui";

export default function CalculatorsView() {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [calc, setCalc] = useState("affordability");
  const [personId, setPersonId] = useState(state.persons[0]?.id ?? "");
  const person = state.persons.find((p) => p.id === personId);

  const [loan, setLoan] = useState(1000000);
  const [rate, setRate] = useState(4.25);
  const [tenure, setTenure] = useState(300);
  const [propValue, setPropValue] = useState(1500000);
  const [extraEmi, setExtraEmi] = useState(0);

  const CALCS = [
    { id: "affordability", l: "Affordability", icon: "calc" },
    { id: "emi", l: "EMI", icon: "calc" },
    { id: "ltv", l: "LTV", icon: "calc" },
    { id: "dbr", l: "DBR / DSR", icon: "calc" },
    { id: "tenure", l: "Age & Tenure", icon: "timer" },
    { id: "history", l: "Saved runs", icon: "clock" },
  ];

  const result = useMemo(() => {
    if (!person) return null;
    const monthly = emi(loan, rate, tenure);
    const income = person.monthlySalary + person.otherIncome;
    const obligations = liabilitiesMonthly(person);
    const dbr = income > 0 ? ((obligations + monthly) / income) * 100 : 0;
    const dbrCap = state.rules.find((r) => r.code === "DBR-MAX" && r.active)?.value ?? 50;
    const ltv = propValue > 0 ? (loan / propValue) * 100 : 0;
    const retireAge = person.customerType === "NATIONAL" ? 70 : 65;
    const mxTen = person.dob ? maxTenure(person.dob, 300, retireAge) : 300;
    return { monthly, income, obligations, dbr, dbrCap, ltv, retireAge, mxTen };
  }, [person, loan, rate, tenure, propValue, state.rules]);

  const saveRun = (label: string, outputs: Record<string, unknown>) => {
    if (!person) return;
    const rec: CalcRecord = {
      id: "calc" + uid(), type: calc, label, linkKind: "person", linkId: person.id,
      inputs: { loan, rate, tenure, propValue }, outputs,
      rulesUsed: [{ code: "DBR-MAX", version: state.rules.find((r) => r.code === "DBR-MAX")?.version ?? 1 }],
      by: me?.id ?? "system", at: nowISO(),
    };
    dispatch({ t: "SAVE_CALC", calc: rec });
  };

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-12 gap-4">
        {/* rail */}
        <div className="lg:col-span-3 anim-up bg-card border border-mist rounded-lg p-3 self-start">
          <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-2 px-1">Calculator centre</p>
          {CALCS.map((c) => (
            <button key={c.id} onClick={() => setCalc(c.id)}
              className={cx("focusable w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12.5px] font-semibold transition-all",
                calc === c.id ? "bg-pine-700 text-paper shadow-sm" : "text-ink-soft hover:bg-paper/70 hover:text-ink")}>
              <Ic n={c.icon} size={14} /> {c.l}
            </button>
          ))}
          <div className="mt-3 pt-3 border-t border-mist px-1">
            <p className="text-[10px] uppercase tracking-wider text-ink-soft font-display font-bold mb-1.5">Client</p>
            <Select value={personId} onChange={setPersonId} options={state.persons.map((p) => ({ v: p.id, l: p.name }))} />
            {person && <p className="num text-[10.5px] text-ink-soft mt-1.5">{person.customerType === "NATIONAL" ? "UAE National" : person.customerType === "EXPAT" ? "Expat" : "Non-Resident"} · {fmtAED(person.monthlySalary)}/mo</p>}
          </div>
        </div>

        {/* workspace */}
        <div className="lg:col-span-9">
          {calc !== "history" && result && person && (
            <div className="space-y-4">
              <div className="anim-up grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Loan amount"><NumInput value={loan} onChange={setLoan} suffix="AED" /></Field>
                <Field label="Rate % p.a."><NumInput value={rate} onChange={setRate} suffix="%" /></Field>
                <Field label="Tenure (months)"><NumInput value={tenure} onChange={setTenure} suffix="mo" /></Field>
                <Field label="Property value"><NumInput value={propValue} onChange={setPropValue} suffix="AED" /></Field>
              </div>

              <div className="anim-up bg-card border border-mist rounded-lg p-5" style={{ animationDelay: "80ms" }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h2 className="font-display font-bold text-[18px] tracking-tight">{CALCS.find((c) => c.id === calc)?.l} — {person.name}</h2>
                  <Btn size="sm" variant="outline" onClick={() => saveRun(`${CALCS.find((c) => c.id === calc)?.l} · ${person.name}`, { emi: Math.round(result.monthly), dbr: +result.dbr.toFixed(1), ltv: +result.ltv.toFixed(1) })}>
                    <Ic n="check" size={13} /> Save run
                  </Btn>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  <div className="bg-pine-50 border border-pine-200 rounded-lg px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-pine-700 font-display font-bold">Monthly EMI</p>
                    <p className="num font-bold text-[22px] text-pine-800 mt-0.5">{fmtAED(result.monthly)}</p>
                  </div>
                  <div className="bg-card border border-mist rounded-lg px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft font-display font-bold">LTV</p>
                    <p className={cx("num font-bold text-[22px] mt-0.5", result.ltv > 80 ? "text-rust-600" : "text-ink")}>{fmtPct(result.ltv)}</p>
                  </div>
                  <div className="bg-card border border-mist rounded-lg px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft font-display font-bold">DBR (with new EMI)</p>
                    <p className={cx("num font-bold text-[22px] mt-0.5", result.dbr >= result.dbrCap ? "text-rust-600" : result.dbr >= result.dbrCap - 5 ? "text-amber-700" : "text-pine-700")}>{fmtPct(result.dbr)}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-6">
                  <KV k="Gross monthly income" v={fmtAED(result.income)} />
                  <KV k="Existing obligations" v={`${fmtAED(result.obligations)}/mo`} />
                  <KV k="DBR ceiling (rule)" v={`${result.dbrCap}% — TO VERIFY`} />
                  <KV k="Total interest over tenure" v={fmtAED(result.monthly * tenure - loan)} />
                  <KV k="Retirement age (rule)" v={`${result.retireAge} yrs`} />
                  <KV k="Max tenure by age" v={`${result.mxTen} mo`} />
                </div>

                <div className={cx("mt-4 rounded-lg px-4 py-3 border",
                  result.dbr >= result.dbrCap ? "bg-rust-100/60 border-rust-500/40" : result.ltv > 80 ? "bg-amber-100/60 border-amber-500/40" : "bg-pine-100/50 border-pine-200")}>
                  <p className={cx("font-display font-bold text-[13px]",
                    result.dbr >= result.dbrCap ? "text-rust-700" : result.ltv > 80 ? "text-amber-700" : "text-pine-800")}>
                    {result.dbr >= result.dbrCap ? `DBR ${fmtPct(result.dbr)} exceeds the ${result.dbrCap}% ceiling — reduce loan or tenure.`
                      : result.ltv > 80 ? `LTV ${fmtPct(result.ltv)} is above the typical 80% cap — higher down payment needed.`
                        : "Within DBR ceiling and typical LTV — eligible on affordability."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {calc === "history" && (
            <div className="anim-up bg-card border border-mist rounded-lg overflow-x-auto">
              <table className="w-full text-[12.5px] min-w-[680px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
                    <th className="px-4 py-2.5 font-semibold">Run</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Outputs</th>
                    <th className="px-3 py-2.5 font-semibold">Rules used</th>
                    <th className="px-3 py-2.5 font-semibold">By</th>
                    <th className="px-3 py-2.5 font-semibold">At</th>
                  </tr>
                </thead>
                <tbody>
                  {state.calcs.map((r) => (
                    <tr key={r.id} className="border-b border-mist/60 last:border-0">
                      <td className="px-4 py-2.5 font-medium">{r.label}</td>
                      <td className="px-3 py-2.5"><Pill tone="steel">{r.type}</Pill></td>
                      <td className="px-3 py-2.5 num text-[11px]">{Object.entries(r.outputs).map(([k, v]) => `${k}: ${v}`).join(" · ")}</td>
                      <td className="px-3 py-2.5 num text-[11px]">{r.rulesUsed.map((x) => `${x.code} v${x.version}`).join(", ")}</td>
                      <td className="px-3 py-2.5 text-[11.5px]">{state.users.find((u) => u.id === r.by)?.name ?? r.by}</td>
                      <td className="px-3 py-2.5 num text-[11px]">{fmtDate(r.at.slice(0, 10))}</td>
                    </tr>
                  ))}
                  {!state.calcs.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-soft text-[12px]">No saved runs yet — run a calculator and save it.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
