import type { AppState, Case, CustomerType, Employment, Product, Rule, TxType } from "./types";
import { ageYears } from "./ui";

export interface RuleRef { rule: Rule; value: number }

const scopeScore = (r: Rule, scope: Rule["scope"]) => {
  let s = 0;
  if (r.scope.customerType && r.scope.customerType !== scope.customerType) return -1;
  if (r.scope.employment && r.scope.employment !== scope.employment) return -1;
  if (r.scope.bankId && r.scope.bankId !== scope.bankId) return -1;
  if (r.scope.txType && r.scope.txType !== scope.txType) return -1;
  if (r.scope.financeCount && r.scope.financeCount !== scope.financeCount) return -1;
  if (r.scope.customerType) s += 2;
  if (r.scope.employment) s += 2;
  if (r.scope.bankId) s += 4;
  if (r.scope.txType) s += 2;
  if (r.scope.financeCount) s += 2;
  return s;
};

export function findRule(state: AppState, module: Rule["module"], scope: Rule["scope"] = {}): Rule | null {
  let best: Rule | null = null, bestScore = -1;
  for (const r of state.rules) {
    if (!r.active || r.module !== module) continue;
    const s = scopeScore(r, scope);
    if (s >= 0 && s > bestScore) { best = r; bestScore = s; }
  }
  return best;
}

/* ---------- math ---------- */
export function emi(P: number, annualPct: number, months: number): number {
  if (P <= 0 || months <= 0) return 0;
  const r = annualPct / 1200;
  if (r === 0) return P / months;
  const f = Math.pow(1 + r, months);
  return (P * r * f) / (f - 1);
}
export function loanFromEmi(maxEmi: number, annualPct: number, months: number): number {
  if (maxEmi <= 0 || months <= 0) return 0;
  const r = annualPct / 1200;
  if (r === 0) return maxEmi * months;
  const f = Math.pow(1 + r, months);
  return (maxEmi * (f - 1)) / (r * f);
}

/* ---------- rule readers ---------- */
export function ltvFor(state: AppState, ct: CustomerType, fc: 1 | 2, bankId?: string, txType?: TxType) {
  const r = findRule(state, "LTV", { customerType: ct, financeCount: fc, bankId, txType });
  return { pct: r?.value ?? 0, rule: r };
}
export function dbrCapFor(state: AppState, ct?: CustomerType, emp?: Employment) {
  const r = findRule(state, "DBR", { customerType: ct, employment: emp });
  return { pct: r?.value ?? 50, rule: r };
}
export function retireAgeFor(state: AppState, ct: CustomerType, emp: Employment, bankId?: string) {
  const r = findRule(state, "RETIRE", { customerType: ct, employment: emp, bankId });
  return { years: r?.value ?? 60, rule: r };
}
export function tenureCapFor(state: AppState) {
  const r = findRule(state, "TENURE", {});
  return { months: r?.value ?? 300, rule: r };
}
export function ccRateFor(state: AppState, bankId?: string) {
  const r = findRule(state, "CC", { bankId });
  return { pct: r?.value ?? 5, rule: r };
}
export function minSalaryFor(state: AppState, ct: CustomerType) {
  const r = findRule(state, "MIN_SAL", { customerType: ct });
  return { amount: r?.value ?? 0, rule: r };
}
export function settlementFor(state: AppState) {
  const r = findRule(state, "SETTLE", {});
  return { pct: r?.value ?? 1, cap: r?.fee?.cap ?? 10000, rule: r };
}
export function stressFor(state: AppState) {
  const r = findRule(state, "STRESS", {});
  return { pct: r?.value ?? 2, rule: r };
}

export function feeLines(state: AppState, a: { propertyValue: number; loanAmount: number; txType: TxType }) {
  const lines: { name: string; amount: number; rule: Rule }[] = [];
  for (const r of state.rules) {
    if (!r.active || r.module !== "FEE") continue;
    if (r.scope.txType && r.scope.txType !== a.txType) continue;
    const basis = r.fee?.basis ?? "flat";
    let amt = basis === "loan" ? (a.loanAmount * r.value) / 100 : basis === "property" ? (a.propertyValue * r.value) / 100 : r.value;
    if (r.fee?.min) amt = Math.max(amt, r.fee.min);
    if (r.fee?.cap) amt = Math.min(amt, r.fee.cap);
    lines.push({ name: r.name, amount: Math.round(amt), rule: r });
  }
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}

export function ccLiability(state: AppState, limits: number[], bankId?: string) {
  const { pct, rule } = ccRateFor(state, bankId);
  return { amount: (limits.reduce((s, l) => s + l, 0) * pct) / 100, pct, rule };
}

/* ---------- composite calculators ---------- */
export interface AffordabilityInput {
  dob: string; customerType: CustomerType; employment: Employment;
  salary: number; otherIncome: number; propertyValue: number; financeCount: 1 | 2;
  liabilitiesMonthly: number; cardLimits: number[]; bankId?: string; product?: Product;
  proposedLoan?: number; txType: TxType; qualifying?: boolean;
}

export function affordability(state: AppState, i: AffordabilityInput) {
  const rulesUsed: { code: string; version: number }[] = [];
  const use = (r?: Rule | null) => { if (r && !rulesUsed.some((x) => x.code === r.code)) rulesUsed.push({ code: r.code, version: r.version }); };

  const income = i.salary + i.otherIncome;
  const age = ageYears(i.dob);
  const ltv = ltvFor(state, i.customerType, i.financeCount, i.bankId, i.txType); use(ltv.rule);
  const maxByLtv = (i.propertyValue * ltv.pct) / 100;

  const retire = retireAgeFor(state, i.customerType, i.employment, i.bankId); use(retire.rule);
  const tenure = tenureCapFor(state); use(tenure.rule);
  const byAge = Math.max(0, (retire.years - age) * 12);
  const byProduct = i.product?.maxTenureMonths ?? tenure.months;
  const finalTenure = Math.min(tenure.months, byAge, byProduct);

  const rate = i.product?.rate ?? 3.99;
  const stress = stressFor(state); use(stress.rule);
  const qualRate = rate + stress.pct;
  const emiRate = i.qualifying ? qualRate : rate;

  const cc = ccLiability(state, i.cardLimits, i.bankId); use(cc.rule);
  const existing = i.liabilitiesMonthly + cc.amount;

  const dbrCap = dbrCapFor(state, i.customerType, i.employment); use(dbrCap.rule);
  const minSal = minSalaryFor(state, i.customerType); use(minSal.rule);

  const maxEmiAllowed = (income * dbrCap.pct) / 100 - existing;
  const maxByDbr = loanFromEmi(Math.max(0, maxEmiAllowed), emiRate, finalTenure);
  const productCap = i.product?.maxLoan ?? Infinity;
  const maxLoan = Math.max(0, Math.min(maxByLtv, maxByDbr, productCap));

  const loan = Math.min(i.proposedLoan && i.proposedLoan > 0 ? i.proposedLoan : maxLoan, maxByLtv);
  const monthlyEmi = emi(loan, rate, finalTenure);
  const dbr = income > 0 ? ((existing + monthlyEmi) / income) * 100 : 0;
  const downPayment = Math.max(0, i.propertyValue - Math.min(loan, maxByLtv));
  const fees = feeLines(state, { propertyValue: i.propertyValue, loanAmount: loan, txType: i.txType });
  fees.lines.forEach((l) => use(l.rule));
  const cashRequired = downPayment + fees.total;

  const reasons: string[] = [];
  if (i.salary < minSal.amount) reasons.push(`Salary below minimum ${minSal.amount.toLocaleString()} for ${i.customerType}`);
  if (finalTenure <= 0) reasons.push("No eligible tenure at current age");
  if (loan > maxByDbr) reasons.push("Loan exceeds DBR capacity");
  if (dbr >= dbrCap.pct) reasons.push(`DBR must stay strictly below ${dbrCap.pct}%`);

  let status: "ELIGIBLE" | "REVIEW" | "NOT ELIGIBLE" = "ELIGIBLE";
  if (reasons.length > 0 || finalTenure <= 0) status = "NOT ELIGIBLE";
  else if (dbr >= dbrCap.pct - 3 || loan >= maxLoan * 0.97) status = "REVIEW";

  return {
    income, age, ltvPct: ltv.pct, maxByLtv, maxByDbr, productCap: productCap === Infinity ? null : productCap,
    retireAge: retire.years, tenureByAge: byAge, tenureByProduct: byProduct, finalTenure,
    rate, qualRate, emiRate, ccAmount: cc.amount, ccPct: cc.pct, existing, maxEmiAllowed,
    maxLoan, loan, emi: monthlyEmi, dbr, dbrCapPct: dbrCap.pct, availableDbr: Math.max(0, dbrCap.pct - dbr),
    downPayment, fees: fees.lines, feesTotal: fees.total, cashRequired, status, reasons, rulesUsed,
  };
}

export function tenureCalc(state: AppState, i: { dob: string; customerType: CustomerType; employment: Employment; bankId?: string; product?: Product }) {
  const rulesUsed: { code: string; version: number }[] = [];
  const use = (r?: Rule | null) => { if (r) rulesUsed.push({ code: r.code, version: r.version }); };
  const age = ageYears(i.dob);
  const retire = retireAgeFor(state, i.customerType, i.employment, i.bankId); use(retire.rule);
  const tenure = tenureCapFor(state); use(tenure.rule);
  const byAge = Math.max(0, (retire.years - age) * 12);
  const byProduct = i.product?.maxTenureMonths ?? tenure.months;
  const final = Math.min(tenure.months, byAge, byProduct);
  const ageAtMaturity = age + final / 12;
  return { age, retireAge: retire.years, globalCap: tenure.months, byAge, byProduct, final, ageAtMaturity, eligible: final > 0, rulesUsed };
}

export function buyoutCalc(state: AppState, i: {
  propertyValue: number; outstanding: number; customerType: CustomerType; financeCount: 1 | 2;
  rate: number; tenure: number; topUp: number; income: number; existingMonthly: number; cardLimits: number[]; bankId?: string;
}) {
  const rulesUsed: { code: string; version: number }[] = [];
  const use = (r?: Rule | null) => { if (r) rulesUsed.push({ code: r.code, version: r.version }); };
  const ltv = ltvFor(state, i.customerType, i.financeCount, i.bankId, "BUYOUT"); use(ltv.rule);
  const settle = settlementFor(state); use(settle.rule);
  const maxFinance = (i.propertyValue * ltv.pct) / 100;
  const settlementAmount = Math.min((i.outstanding * settle.pct) / 100, settle.cap);
  const needed = i.outstanding + settlementAmount + i.topUp;
  const newLoan = Math.min(needed, maxFinance);
  const equity = Math.max(0, maxFinance - newLoan);
  const fees = feeLines(state, { propertyValue: i.propertyValue, loanAmount: newLoan, txType: i.topUp > 0 ? "BUYOUT_EQUITY" : "BUYOUT" });
  fees.lines.forEach((l) => use(l.rule));
  const monthlyEmi = emi(newLoan, i.rate, i.tenure);
  const cc = ccLiability(state, i.cardLimits, i.bankId); use(cc.rule);
  const dbr = i.income > 0 ? ((i.existingMonthly + cc.amount + monthlyEmi) / i.income) * 100 : 0;
  const dbrCap = dbrCapFor(state, i.customerType); use(dbrCap.rule);
  const netToCustomer = equity - fees.total;
  return { ltvPct: ltv.pct, maxFinance, settlementPct: settle.pct, settlementCap: settle.cap, settlementAmount, newLoan, equity, fees: fees.lines, feesTotal: fees.total, netToCustomer, emi: monthlyEmi, dbr, dbrCapPct: dbrCap.pct, blocked: newLoan < needed, rulesUsed };
}

/* ---------- TAT & escalation engine ---------- */
const dISO = (dt: Date) => dt.toISOString().slice(0, 10);
const addD = (iso: string, n: number) => { const dt = new Date(iso + "T00:00:00"); dt.setDate(dt.getDate() + n); return dISO(dt); };
const dayDiff = (a: string, b: string) => Math.round((new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000);

export interface TatInfo { trigger?: string; target?: string; elapsed: number; daysOver: number; level: 0 | 1 | 2 | 3 }

export function tatFor(c: Case, stageId: string, stageList: { id: string; sla: number }[], today: string): TatInfo {
  const def = stageList.find((s) => s.id === stageId);
  const trigger = c.triggerDates?.[stageId];
  const sla = def?.sla ?? 0;
  if (!trigger) return { elapsed: 0, daysOver: 0, level: 0 };
  const elapsed = Math.max(0, dayDiff(today, trigger));
  const daysOver = Math.max(0, elapsed - sla);
  const level = daysOver < 1 ? 0 : daysOver === 1 ? 1 : daysOver === 2 ? 2 : 3;
  return { trigger, target: addD(trigger, sla), elapsed, daysOver, level };
}

export const ESC_LEVELS: { level: 0 | 1 | 2 | 3; tag: string; label: string; action: string; who: string; copied: string; dot: string; chip: string }[] = [
  { level: 0, tag: "ON TRACK", label: "Deadline not yet reached", action: "Normal follow-up call / email to bank or party — document in audit trail", who: "Team member (VRM/SPO)", copied: "—", dot: "bg-pine-500", chip: "bg-pine-100 text-pine-800" },
  { level: 1, tag: "LEVEL 1", label: "1 day after deadline", action: "Formal follow-up — flag to Team Leader", who: "Team member", copied: "Team Leader", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-700" },
  { level: 2, tag: "LEVEL 2", label: "2 days after deadline", action: "Team Leader sends escalation email", who: "Team Leader", copied: "Department Head", dot: "bg-rust-500", chip: "bg-rust-100 text-rust-700" },
  { level: 3, tag: "LEVEL 3", label: "3+ days after deadline", action: "Department Head escalates to Kiran", who: "Department Head", copied: "Kiran Suvarna (Owner)", dot: "bg-ink", chip: "bg-ink text-paper" },
];

export function escalationEmail(level: 1 | 2 | 3, client: string, bank: string, stage: string, ref: string, daysOver: number): { subject: string; body: string } {
  if (level === 1) return {
    subject: `[Level 1] Stage Overdue — ${client} / ${bank}`,
    body: `Dear Team,\n\nPlease note the ${stage} stage for ${client} (${ref}, ${bank}) is now ${daysOver} day(s) past its target deadline. The TAT tracker is attached.\n\nRequesting urgent follow-up.\n\nRegards,\nHFMC Mortgage Operations`,
  };
  if (level === 2) return {
    subject: `[Level 2 Escalation] — ${client} / ${stage}`,
    body: `Dear Team,\n\nThe ${stage} stage for ${client} (${ref}, ${bank}) has not progressed despite Level 1 follow-up and is ${daysOver} days past its target deadline.\n\nPlease advise on next steps to avoid transaction risk.\n\nRegards,\nHFMC Mortgage Operations`,
  };
  return {
    subject: `[URGENT Level 3] Transaction at Risk — ${client}`,
    body: `Dear Sir,\n\nDespite Level 1 & 2 escalations, the ${stage} stage for ${client} (${ref}, ${bank}) remains unresolved — ${daysOver} days past its target deadline. Transaction risk is HIGH.\n\nRequesting your direct intervention.\n\nRegards,\nHFMC Mortgage Operations`,
  };
}

/* ---------- duration formatting (days · hours · minutes) ---------- */
export const fmtDur = (min?: number) => {
  if (!min || min <= 0) return "—";
  const dd = Math.floor(min / 1440), hh = Math.floor((min % 1440) / 60), mm = min % 60;
  const p: string[] = [];
  if (dd) p.push(`${dd}d`); if (hh) p.push(`${hh}h`); if (mm || !p.length) p.push(`${mm}m`);
  return p.join(" ");
};

/* ---------- stage gates ---------- */
export interface GateCheck { label: string; pass: boolean; detail: string }
export function stageGates(state: AppState, c: Case): { checks: GateCheck[]; pass: boolean; nextStage?: string } {
  const idx = state.stages.findIndex((s) => s.id === c.stage);
  const def = state.stages[idx];
  const next = state.stages[idx + 1];
  const checks: GateCheck[] = [];
  for (const dt of def.docs) {
    const item = c.docs.find((d) => d.typeId === dt && d.stageId === def.id);
    const dtName = state.docTypes.find((t) => t.id === dt)?.name ?? dt;
    const st = item?.status ?? "MISSING";
    checks.push({ label: `${dtName}`, pass: st === "VERIFIED" || st === "NA", detail: st.toLowerCase() });
  }
  const openTasks = state.tasks.filter((t) => t.caseId === c.id && t.stageId === def.id && t.status === "OPEN");
  checks.push({ label: `Stage tasks complete (${def.tasks.length})`, pass: openTasks.length === 0, detail: openTasks.length ? `${openTasks.length} open` : "all done" });
  const openQ = state.queries.filter((q) => q.caseId === c.id && q.status === "OPEN");
  checks.push({ label: "No open bank queries", pass: openQ.length === 0, detail: openQ.length ? `${openQ.length} open` : "clear" });
  return { checks, pass: checks.every((c2) => c2.pass), nextStage: next?.id };
}

export type Bucket = "overdue" | "risk" | "query" | "ready" | "waiting" | "noaction";
export function caseBucket(state: AppState, c: Case): Bucket | null {
  if (c.status !== "OPEN") return null;
  if (state.queries.some((q) => q.caseId === c.id && q.status === "OPEN")) return "query";
  if (stageGates(state, c).pass && c.stage !== state.stages[state.stages.length - 1].id) return "ready";
  if (!c.nextAction) return "noaction";
  const d = c.nextActionDue ? Math.round((new Date(c.nextActionDue + "T00:00:00").getTime() - Date.now()) / 86400000) : null;
  if (d !== null && d < 0) return "overdue";
  if (d !== null && d <= 2) return "risk";
  if (c.waitingFor) return "waiting";
  return null;
}
