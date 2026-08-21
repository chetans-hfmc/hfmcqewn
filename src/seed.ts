import type { AppState, BankQuery, Case, DocItem, DocStatus, Lead, Person, Rule, Task } from "./types";
import { addDays, todayISO } from "./ui";

export const SEED_VERSION = 4;
const T = todayISO();
const d = (off: number) => addDays(T, off);
const ts = (off: number) => new Date(Date.now() + off * 86400000).toISOString();

const stages: AppState["stages"] = [
  { id: "HANDOVER", name: "Handover", short: "HO", sla: 2, docs: [], tasks: ["Sales→Ops handover briefing", "Validate lead file & calculator snapshot"] },
  { id: "INTAKE", name: "File Intake / KYC", short: "KYC", sla: 3, docs: ["PASSPORT", "EID", "VISA"], tasks: ["Collect KYC documents", "Run affordability calculator"] },
  { id: "FILEQC", name: "File QC", short: "QC", sla: 2, docs: ["SALCERT", "BANKSTMT", "LIABILITY", "CARDSTMT"], tasks: ["Complete file QC checklist", "QC review by Team Leader"], gate: "QC" },
  { id: "SUBMIT", name: "Bank Submission", short: "SUB", sla: 2, docs: ["APPFORM"], tasks: ["Submit file to bank", "Log submission reference"] },
  { id: "PREAPP", name: "Pre-Approval", short: "PA", sla: 5, docs: [], tasks: ["Follow up with bank", "Capture pre-approval terms"] },
  { id: "QUERY", name: "Bank Query", short: "QRY", sla: 3, docs: [], tasks: ["Respond to bank query"] },
  { id: "VALUATION", name: "Valuation", short: "VAL", sla: 4, docs: ["VALREP"], tasks: ["Order property valuation", "Review valuation report"] },
  { id: "FOL", name: "FOL", short: "FOL", sla: 3, docs: ["FOL"], tasks: ["Review Final Offer Letter", "Clarify FOL conditions"] },
  { id: "DDA", name: "DDA / Signing", short: "DDA", sla: 3, docs: ["DDA"], tasks: ["Sign DDA with client", "Collect security cheques"] },
  { id: "BOOKING", name: "Loan Booking", short: "BKG", sla: 2, docs: [], tasks: ["Book loan with bank"] },
  { id: "RELEASE", name: "Liability / Release", short: "REL", sla: 4, docs: ["NOC"], tasks: ["Settle existing liability", "Obtain mortgage release NOC"] },
  { id: "TRANSFER", name: "Final Transfer", short: "TRF", sla: 3, docs: ["TITLE"], tasks: ["Coordinate trustee transfer", "Pay DLD fees"] },
  { id: "TITLEQC", name: "Title Deed QC", short: "TD", sla: 2, docs: ["NEWTITLE"], tasks: ["QC new title deed", "Verify mortgage registration"] },
  { id: "CLOSURE", name: "Closure", short: "CL", sla: 2, docs: [], tasks: ["File closure review", "Archive golden record"] },
];

const R = (r: Omit<Rule, "active" | "history"> & { active?: boolean; history?: Rule["history"] }): Rule => ({
  active: true, history: [], ...r,
});

const rules: Rule[] = [
  R({ id: "r-ltv1", code: "LTV-NAT-1", module: "LTV", name: "LTV · UAE National · 1st finance", kind: "pct", value: 85, scope: { customerType: "NATIONAL", financeCount: 1 }, version: 2, effectiveFrom: "2026-07-01", history: [{ version: 1, value: 80, effectiveFrom: "2026-01-01" }], note: "Raised to 85% Jul-2026" }),
  R({ id: "r-ltv2", code: "LTV-NAT-2", module: "LTV", name: "LTV · UAE National · 2nd+", kind: "pct", value: 70, scope: { customerType: "NATIONAL", financeCount: 2 }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ltv3", code: "LTV-EXP-1", module: "LTV", name: "LTV · Expat · 1st finance", kind: "pct", value: 80, scope: { customerType: "EXPAT", financeCount: 1 }, version: 2, effectiveFrom: "2026-06-01", history: [{ version: 1, value: 85, effectiveFrom: "2026-01-01" }], note: "Tightened to 80% Jun-2026" }),
  R({ id: "r-ltv4", code: "LTV-EXP-2", module: "LTV", name: "LTV · Expat · 2nd+", kind: "pct", value: 65, scope: { customerType: "EXPAT", financeCount: 2 }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ltv5", code: "LTV-NR-1", module: "LTV", name: "LTV · Non-Resident · 1st", kind: "pct", value: 75, scope: { customerType: "NON_RESIDENT", financeCount: 1 }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ltv6", code: "LTV-NR-2", module: "LTV", name: "LTV · Non-Resident · 2nd+", kind: "pct", value: 60, scope: { customerType: "NON_RESIDENT", financeCount: 2 }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-dbr1", code: "DBR-MAX", module: "DBR", name: "DBR ceiling (all customers)", kind: "pct", value: 50, scope: {}, version: 2, effectiveFrom: "2026-08-01", history: [{ version: 1, value: 55, effectiveFrom: "2026-03-01" }], note: "DBR must stay strictly below 50% — TO VERIFY with compliance" }),
  R({ id: "r-ret1", code: "RET-NAT-SAL", module: "RETIRE", name: "Retirement age · National salaried", kind: "years", value: 60, scope: { customerType: "NATIONAL", employment: "SALARIED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret2", code: "RET-NAT-SE", module: "RETIRE", name: "Retirement age · National self-employed", kind: "years", value: 65, scope: { customerType: "NATIONAL", employment: "SELF_EMPLOYED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret3", code: "RET-EXP-SAL", module: "RETIRE", name: "Retirement age · Expat salaried", kind: "years", value: 60, scope: { customerType: "EXPAT", employment: "SALARIED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret4", code: "RET-EXP-SE", module: "RETIRE", name: "Retirement age · Expat self-employed", kind: "years", value: 70, scope: { customerType: "EXPAT", employment: "SELF_EMPLOYED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret5", code: "RET-NR-SAL", module: "RETIRE", name: "Retirement age · Non-Resident salaried", kind: "years", value: 65, scope: { customerType: "NON_RESIDENT", employment: "SALARIED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret6", code: "RET-NR-SE", module: "RETIRE", name: "Retirement age · Non-Resident self-employed", kind: "years", value: 70, scope: { customerType: "NON_RESIDENT", employment: "SELF_EMPLOYED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret7", code: "RET-DIB-EXP", module: "RETIRE", name: "DIB exception · Expat salaried", kind: "years", value: 65, scope: { customerType: "EXPAT", employment: "SALARIED", bankId: "b-dib" }, version: 1, effectiveFrom: "2026-02-01", note: "DIB accepts expat salaried to 65" }),
  R({ id: "r-ten1", code: "TENURE-MAX", module: "TENURE", name: "Global max tenure", kind: "months", value: 300, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "300 months / 25 years" }),
  R({ id: "r-cc1", code: "CC-RATE", module: "CC", name: "Credit card qualifying liability", kind: "pct", value: 5, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "5% of card limits" }),
  R({ id: "r-ms1", code: "MIN-SAL-EXP", module: "MIN_SAL", name: "Minimum salary · Expat", kind: "amount", value: 15000, scope: { customerType: "EXPAT" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ms2", code: "MIN-SAL-NAT", module: "MIN_SAL", name: "Minimum salary · National", kind: "amount", value: 10000, scope: { customerType: "NATIONAL" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ms3", code: "MIN-SAL-NR", module: "MIN_SAL", name: "Minimum salary · Non-Resident", kind: "amount", value: 25000, scope: { customerType: "NON_RESIDENT" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f1", code: "FEE-PROC", module: "FEE", name: "Bank processing fee", kind: "pct", value: 1, scope: {}, fee: { basis: "loan", min: 2500 }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f2", code: "FEE-VAL", module: "FEE", name: "Valuation fee", kind: "amount", value: 2625, scope: {}, fee: { basis: "flat" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f3", code: "FEE-ADMIN", module: "FEE", name: "Bank admin fee", kind: "amount", value: 1050, scope: {}, fee: { basis: "flat" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f4", code: "FEE-DLD", module: "FEE", name: "DLD transfer fee", kind: "pct", value: 4, scope: { txType: "PURCHASE" }, fee: { basis: "property" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f5", code: "FEE-DLD-BE", module: "FEE", name: "DLD transfer fee (buyout+equity)", kind: "pct", value: 4, scope: { txType: "BUYOUT_EQUITY" }, fee: { basis: "property" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f6", code: "FEE-MREG", module: "FEE", name: "Mortgage registration", kind: "pct", value: 0.25, scope: {}, fee: { basis: "loan" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f7", code: "FEE-AGENCY", module: "FEE", name: "Agency fee", kind: "pct", value: 2, scope: { txType: "PURCHASE" }, fee: { basis: "property" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-s1", code: "SETTLE-1", module: "SETTLE", name: "Early settlement charge", kind: "pct", value: 1, scope: {}, fee: { basis: "loan", cap: 10000 }, version: 1, effectiveFrom: "2026-01-01", note: "1% of outstanding, capped AED 10,000" }),
  R({ id: "r-q1", code: "STRESS-QUAL", module: "STRESS", name: "Qualifying rate stress", kind: "pct", value: 2, scope: {}, version: 1, effectiveFrom: "2026-01-01" }),
];

const P = (p: Omit<Person, "createdAt"> & { createdAt?: string }): Person => ({ createdAt: d(-60), ...p });
const persons: Person[] = [
  P({ id: "p1", name: "Arjun Malhotra", customerType: "EXPAT", nationality: "India", employment: "SALARIED", dob: "1992-04-12", mobile: "+971 50 221 4471", email: "arjun.m@gmail.com", employer: "Gulf Logistics FZE", monthlySalary: 38000, otherIncome: 0, financeCount: 1, cards: [{ bank: "ENBD", limit: 25000 }, { bank: "ADCB", limit: 15000 }], liabilities: [{ type: "Car loan", monthly: 1850 }], kyc: { passport: true, eid: true, visa: true, address: true } }),
  P({ id: "p2", name: "Fatima Al Suwaidi", customerType: "NATIONAL", nationality: "UAE", employment: "SALARIED", dob: "1990-09-23", mobile: "+971 55 887 2034", email: "fatima.suwaidi@outlook.com", employer: "Abu Dhabi Municipality", monthlySalary: 45000, otherIncome: 0, financeCount: 1, cards: [{ bank: "ADCB", limit: 40000 }], liabilities: [], kyc: { passport: true, eid: true, visa: true, address: true } }),
  P({ id: "p3", name: "James Rodriguez", customerType: "NON_RESIDENT", nationality: "Spain", employment: "SELF_EMPLOYED", dob: "1978-01-30", mobile: "+34 612 44 8890", email: "j.rodriguez@rodriguezholdings.es", employer: "Rodriguez Holdings SL", monthlySalary: 60000, otherIncome: 15000, financeCount: 2, cards: [{ bank: "HSBC", limit: 60000 }], liabilities: [], kyc: { passport: true, eid: false, visa: false, address: false } }),
  P({ id: "p4", name: "Deepa Krishnan", customerType: "EXPAT", nationality: "India", employment: "SALARIED", dob: "1996-11-05", mobile: "+971 52 660 1187", email: "deepa.krishnan@yahoo.com", employer: "Mediclinic Middle East", monthlySalary: 22000, otherIncome: 0, financeCount: 1, cards: [{ bank: "Mashreq", limit: 10000 }], liabilities: [{ type: "Personal loan", monthly: 950 }], kyc: { passport: true, eid: true, visa: true, address: true } }),
  P({ id: "p5", name: "Omar Bakri", customerType: "EXPAT", nationality: "Lebanon", employment: "SELF_EMPLOYED", dob: "1985-06-17", mobile: "+971 50 903 5512", email: "omar@bakritrading.com", employer: "Bakri Trading LLC", monthlySalary: 52000, otherIncome: 0, financeCount: 1, cards: [{ bank: "ENBD", limit: 35000 }], liabilities: [], kyc: { passport: true, eid: true, visa: true, address: true } }),
  P({ id: "p6", name: "Elena Petrova", customerType: "NON_RESIDENT", nationality: "Russia", employment: "SALARIED", dob: "1988-03-08", mobile: "+7 916 220 4567", email: "elena.petrova@moscowmail.ru", employer: "Severstal International", monthlySalary: 30000, otherIncome: 0, financeCount: 1, cards: [], liabilities: [], kyc: { passport: true, eid: false, visa: false, address: false } }),
  P({ id: "p7", name: "Saeed Al Mansoori", customerType: "NATIONAL", nationality: "UAE", employment: "SELF_EMPLOYED", dob: "1980-12-02", mobile: "+971 56 445 7789", email: "saeed.mansoori@emaratco.ae", employer: "Al Mansoori Contracting", monthlySalary: 75000, otherIncome: 12000, financeCount: 2, cards: [{ bank: "DIB", limit: 50000 }], liabilities: [{ type: "Car loan", monthly: 3200 }], kyc: { passport: true, eid: true, visa: true, address: true } }),
  P({ id: "p8", name: "Nisha Verma", customerType: "EXPAT", nationality: "India", employment: "SALARIED", dob: "1994-07-19", mobile: "+971 54 310 9923", email: "nisha.verma@gmail.com", employer: "Talabat", monthlySalary: 18500, otherIncome: 0, financeCount: 1, cards: [{ bank: "ADCB", limit: 8000 }], liabilities: [], kyc: { passport: true, eid: false, visa: true, address: true } }),
  P({ id: "p9", name: "Hassan Yousef", customerType: "EXPAT", nationality: "Egypt", employment: "SALARIED", dob: "1991-02-14", mobile: "+971 50 118 6642", email: "h.yousef@gmail.com", employer: "Emirates Airlines", monthlySalary: 27000, otherIncome: 0, financeCount: 1, cards: [{ bank: "ENBD", limit: 12000 }], liabilities: [{ type: "Car loan", monthly: 1200 }], kyc: { passport: true, eid: true, visa: true, address: true } }),
];

const banks: AppState["banks"] = [
  { id: "b-enbd", name: "Emirates NBD", short: "ENBD" },
  { id: "b-adcb", name: "Abu Dhabi Commercial Bank", short: "ADCB" },
  { id: "b-dib", name: "Dubai Islamic Bank", short: "DIB" },
  { id: "b-hsbc", name: "HSBC Middle East", short: "HSBC" },
  { id: "b-mashreq", name: "Mashreq Bank", short: "MSHQ" },
];
const products: AppState["products"] = [
  { id: "pr-enbd-sal", bankId: "b-enbd", name: "ENBD Salaried Fixed 3Y", rateType: "FIXED", rate: 3.99, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-enbd-var", bankId: "b-enbd", name: "ENBD EIBOR Linked", rateType: "VARIABLE", rate: 4.65, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-adcb-sal", bankId: "b-adcb", name: "ADCB Salaried Fixed", rateType: "FIXED", rate: 3.89, maxTenureMonths: 300, maxLoan: 4000000, ccRate: 5 },
  { id: "pr-adcb-self", bankId: "b-adcb", name: "ADCB Business Banking", rateType: "FIXED", rate: 4.49, maxTenureMonths: 240, maxLoan: 3000000, ccRate: 5 },
  { id: "pr-dib-ijara", bankId: "b-dib", name: "DIB Ijarah", rateType: "ISLAMIC", rate: 3.75, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5, note: "Expat salaried retirement exception: 65" },
  { id: "pr-dib-sal", bankId: "b-dib", name: "DIB Salaried Fixed", rateType: "ISLAMIC", rate: 4.1, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-hsbc-prem", bankId: "b-hsbc", name: "HSBC Premier Mortgage", rateType: "FIXED", rate: 3.69, maxTenureMonths: 300, maxLoan: 7500000, ccRate: 5 },
  { id: "pr-mash-sal", bankId: "b-mashreq", name: "Mashreq Salaried", rateType: "FIXED", rate: 4.25, maxTenureMonths: 300, maxLoan: 4000000, ccRate: 5 },
];

/* ----- doc / task builders ----- */
let dn = 0;
const doc = (stageId: string, typeId: string, status: DocStatus, off = -3, by = "u4"): DocItem =>
  ({ id: "sd" + ++dn, typeId, stageId, status, updatedAt: ts(off), updatedBy: by });
let tn = 0;
const task = (caseId: string, stageId: string, type: string, title: string, ownerId: string, createdOff: number,
  o: Partial<Task> = {}): Task => ({
  id: "st" + ++tn, caseId, stageId, type, title, ownerId, priority: "MEDIUM", status: "OPEN",
  createdAt: ts(createdOff), ...o,
});

const verifiedBlock = (caseId: string, stageId: string, docsList: string[], off: number): { docs: DocItem[]; tasks: Task[] } => {
  const def = stages.find((s) => s.id === stageId)!;
  return {
    docs: docsList.map((t) => doc(stageId, t, "VERIFIED", off)),
    tasks: def.tasks.map((t) => task(caseId, stageId, t.split(" ").slice(0, 3).join(" "), t, "u4", off, { status: "DONE", completedAt: ts(off), due: d(off + 2) })),
  };
};

const mkHist = (steps: [string, number][], by = "u4") => steps.map(([s, off]) => ({ stageId: s, at: ts(off), by }));

const C = (c: Omit<Case, "status" | "createdAt" | "expectedRevenue" | "stageHistory"> & { createdAt?: string; expectedRevenue?: number; status?: Case["status"]; stageHistory?: Case["stageHistory"] }): Case =>
  ({ status: "OPEN", createdAt: d(-20), expectedRevenue: 20000, stageHistory: mkHist([[c.stage, -10]]), ...c });

const cases: Case[] = [
  // NO NEXT ACTION — fresh handover
  C({
    id: "c44", ref: "HF-2044", personId: "p1", leadId: "l1004", ownerId: "u4", bankId: "b-enbd", productId: "pr-enbd-sal",
    txType: "PURCHASE", propertyValue: 1600000, loanAmount: 1280000, rate: 3.99, tenureMonths: 300,
    stage: "HANDOVER", createdAt: d(-1), expectedRevenue: 24500, stageHistory: mkHist([["HANDOVER", -1]]),
    docs: [],
  }),
  // READY FOR NEXT STAGE — FILE QC gates all green
  C({
    id: "c29", ref: "HF-2029", personId: "p9", leadId: "l1007", ownerId: "u4", bankId: "b-dib", productId: "pr-dib-sal",
    txType: "PURCHASE", propertyValue: 1100000, loanAmount: 880000, rate: 4.1, tenureMonths: 300,
    stage: "FILEQC", createdAt: d(-12), expectedRevenue: 18500,
    stageHistory: mkHist([["HANDOVER", -12], ["INTAKE", -10], ["FILEQC", -6]]),
    docs: [
      ...verifiedBlock("c29", "INTAKE", ["PASSPORT", "EID", "VISA"], -10).docs,
      ...verifiedBlock("c29", "FILEQC", ["SALCERT", "BANKSTMT", "LIABILITY", "CARDSTMT"], -6).docs,
    ],
    nextAction: "Submit file to DIB", nextActionDue: d(2),
  }),
  // OVERDUE — valuation report chasing
  C({
    id: "c41", ref: "HF-2041", personId: "p4", leadId: "l1001", ownerId: "u5", bankId: "b-mashreq", productId: "pr-mash-sal",
    txType: "PURCHASE", propertyValue: 950000, loanAmount: 760000, rate: 4.25, tenureMonths: 300,
    stage: "VALUATION", createdAt: d(-25), expectedRevenue: 16800,
    stageHistory: mkHist([["HANDOVER", -25], ["INTAKE", -23], ["FILEQC", -19], ["SUBMIT", -16], ["PREAPP", -13], ["VALUATION", -8]]),
    docs: [
      ...verifiedBlock("c41", "INTAKE", ["PASSPORT", "EID", "VISA"], -23).docs,
      ...verifiedBlock("c41", "FILEQC", ["SALCERT", "BANKSTMT", "LIABILITY", "CARDSTMT"], -19).docs,
      doc("SUBMIT", "APPFORM", "VERIFIED", -16),
      doc("VALUATION", "VALREP", "MISSING", -2, "u5"),
    ],
    nextAction: "Chase valuation report from valuer", nextActionDue: d(-2), waitingFor: "Valuer", pendingReason: "Valuation delayed",
  }),
  // AT RISK — pre-approval follow-up due tomorrow
  C({
    id: "c36", ref: "HF-2036", personId: "p8", leadId: "l1002", ownerId: "u4", bankId: "b-adcb", productId: "pr-adcb-sal",
    txType: "PURCHASE", propertyValue: 800000, loanAmount: 640000, rate: 3.89, tenureMonths: 300,
    stage: "PREAPP", createdAt: d(-18), expectedRevenue: 14200,
    stageHistory: mkHist([["HANDOVER", -18], ["INTAKE", -16], ["FILEQC", -12], ["SUBMIT", -9], ["PREAPP", -6]]),
    docs: [
      ...verifiedBlock("c36", "INTAKE", ["PASSPORT", "EID", "VISA"], -16).docs,
      doc("FILEQC", "SALCERT", "VERIFIED", -12), doc("FILEQC", "BANKSTMT", "VERIFIED", -12),
      doc("FILEQC", "LIABILITY", "NA", -12), doc("FILEQC", "CARDSTMT", "VERIFIED", -12),
      doc("SUBMIT", "APPFORM", "VERIFIED", -9),
    ],
    nextAction: "Follow up ADCB pre-approval", nextActionDue: d(1), waitingFor: "Bank",
  }),
  // BANK QUERY — open query on file
  C({
    id: "c38", ref: "HF-2038", personId: "p5", ownerId: "u5", bankId: "b-dib", productId: "pr-dib-ijara",
    txType: "BUYOUT", propertyValue: 2400000, loanAmount: 1800000, rate: 3.75, tenureMonths: 300,
    stage: "QUERY", createdAt: d(-22), expectedRevenue: 29000,
    stageHistory: mkHist([["HANDOVER", -22], ["INTAKE", -20], ["FILEQC", -16], ["SUBMIT", -12], ["PREAPP", -9], ["QUERY", -4]]),
    docs: [
      ...verifiedBlock("c38", "INTAKE", ["PASSPORT", "EID", "VISA"], -20).docs,
      ...verifiedBlock("c38", "FILEQC", ["SALCERT", "BANKSTMT", "LIABILITY", "CARDSTMT"], -16).docs,
      doc("SUBMIT", "APPFORM", "VERIFIED", -12),
    ],
    nextAction: "Send audited financials to DIB", nextActionDue: d(1), waitingFor: "Client", pendingReason: "Document missing",
  }),
  // WAITING — FOL with client
  C({
    id: "c19", ref: "HF-2019", personId: "p2", leadId: "l1008", ownerId: "u4", bankId: "b-adcb", productId: "pr-adcb-sal",
    txType: "PURCHASE", propertyValue: 2100000, loanAmount: 1680000, rate: 3.89, tenureMonths: 300,
    stage: "FOL", createdAt: d(-40), expectedRevenue: 32500,
    stageHistory: mkHist([["HANDOVER", -40], ["INTAKE", -38], ["FILEQC", -34], ["SUBMIT", -30], ["PREAPP", -26], ["VALUATION", -18], ["FOL", -9]]),
    docs: [
      ...verifiedBlock("c19", "INTAKE", ["PASSPORT", "EID", "VISA"], -38).docs,
      ...verifiedBlock("c19", "FILEQC", ["SALCERT", "BANKSTMT", "LIABILITY", "CARDSTMT"], -34).docs,
      doc("SUBMIT", "APPFORM", "VERIFIED", -30),
      doc("VALUATION", "VALREP", "VERIFIED", -18),
      doc("FOL", "FOL", "RECEIVED", -2, "u4"),
    ],
    nextAction: "Client signing appointment for FOL", nextActionDue: d(6), waitingFor: "Client",
  }),
  // RELEASE stage — buyout + equity for a national
  C({
    id: "c47", ref: "HF-2047", personId: "p7", ownerId: "u5", bankId: "b-dib", productId: "pr-dib-ijara",
    txType: "BUYOUT_EQUITY", propertyValue: 3000000, loanAmount: 2100000, rate: 3.75, tenureMonths: 300,
    stage: "RELEASE", createdAt: d(-55), expectedRevenue: 41000,
    stageHistory: mkHist([["HANDOVER", -55], ["INTAKE", -53], ["FILEQC", -49], ["SUBMIT", -45], ["PREAPP", -41], ["VALUATION", -33], ["FOL", -26], ["DDA", -19], ["BOOKING", -14], ["RELEASE", -8]]),
    docs: [
      ...verifiedBlock("c47", "INTAKE", ["PASSPORT", "EID", "VISA"], -53).docs,
      ...verifiedBlock("c47", "FILEQC", ["SALCERT", "BANKSTMT", "LIABILITY", "CARDSTMT"], -49).docs,
      doc("SUBMIT", "APPFORM", "VERIFIED", -45),
      doc("VALUATION", "VALREP", "VERIFIED", -33),
      doc("FOL", "FOL", "VERIFIED", -26),
      doc("DDA", "DDA", "VERIFIED", -19),
      doc("RELEASE", "NOC", "MISSING", -1, "u5"),
    ],
    nextAction: "Obtain mortgage release NOC", nextActionDue: d(4), waitingFor: "Bank", pendingReason: "Awaiting bank response",
  }),
  // CLOSED
  C({
    id: "c12", ref: "HF-2012", personId: "p5", ownerId: "u4", bankId: "b-dib", productId: "pr-dib-ijara",
    txType: "BUYOUT", propertyValue: 2000000, loanAmount: 1500000, rate: 3.99, tenureMonths: 300,
    stage: "CLOSURE", createdAt: d(-90), closedAt: d(-6), expectedRevenue: 27500, status: "CLOSED",
    stageHistory: mkHist([["HANDOVER", -90], ["INTAKE", -88], ["FILEQC", -84], ["SUBMIT", -80], ["PREAPP", -76], ["VALUATION", -66], ["FOL", -58], ["DDA", -50], ["BOOKING", -44], ["RELEASE", -36], ["TRANSFER", -24], ["TITLEQC", -14], ["CLOSURE", -6]]),
    docs: [
      ...verifiedBlock("c12", "INTAKE", ["PASSPORT", "EID", "VISA"], -88).docs,
      doc("SUBMIT", "APPFORM", "VERIFIED", -80), doc("VALUATION", "VALREP", "VERIFIED", -66),
      doc("FOL", "FOL", "VERIFIED", -58), doc("DDA", "DDA", "VERIFIED", -50), doc("RELEASE", "NOC", "VERIFIED", -36),
      doc("TRANSFER", "TITLE", "VERIFIED", -24), doc("TITLEQC", "NEWTITLE", "VERIFIED", -14),
    ],
  }),
];

const tasks: Task[] = [
  ...verifiedBlock("c29", "HANDOVER", [], -12).tasks,
  ...verifiedBlock("c29", "INTAKE", [], -10).tasks,
  ...verifiedBlock("c29", "FILEQC", [], -6).tasks,
  task("c44", "HANDOVER", "Sales→Ops handover briefing", "Sales→Ops handover briefing", "u4", -1, { due: d(1), priority: "HIGH" }),
  task("c44", "HANDOVER", "Validate lead file & calculator snapshot", "Validate lead file & calculator snapshot", "u4", -1, { due: d(1) }),
  task("c41", "VALUATION", "Order property valuation", "Order property valuation", "u5", -8, { status: "DONE", completedAt: ts(-7), due: d(-7) }),
  task("c41", "VALUATION", "Review valuation report", "Review valuation report", "u5", -7, { due: d(-2), priority: "HIGH", waitingFor: "Valuer", pendingReason: "Valuation delayed" }),
  task("c36", "PREAPP", "Follow up with bank", "Follow up ADCB pre-approval", "u4", -6, { due: d(1), waitingFor: "Bank" }),
  task("c36", "PREAPP", "Capture pre-approval terms", "Capture pre-approval terms", "u4", -6, { due: d(3) }),
  task("c38", "QUERY", "Respond to bank query", "Send audited financials to DIB", "u5", -4, { due: d(1), priority: "HIGH", waitingFor: "Client", pendingReason: "Document missing" }),
  task("c19", "FOL", "Review Final Offer Letter", "Review Final Offer Letter", "u4", -9, { status: "DONE", completedAt: ts(-8), due: d(-8) }),
  task("c19", "FOL", "Clarify FOL conditions", "Clarify FOL conditions with ADCB", "u4", -9, { status: "DONE", completedAt: ts(-7), due: d(-7) }),
  task("c19", "DDA", "Sign DDA with client", "Sign DDA with Fatima Al Suwaidi", "u4", -2, { due: d(6), waitingFor: "Client" }),
  task("c47", "RELEASE", "Settle existing liability", "Settle existing liability", "u5", -8, { status: "DONE", completedAt: ts(-5), due: d(-5) }),
  task("c47", "RELEASE", "Obtain mortgage release NOC", "Obtain mortgage release NOC", "u5", -8, { due: d(4), waitingFor: "Bank", pendingReason: "Awaiting bank response", priority: "HIGH" }),
  task("c41", "TRANSFER", "Update client on progress", "Update Deepa on valuation status", "u5", -2, { due: d(0) }),
];

const queries: BankQuery[] = [
  { id: "q31", caseId: "c38", ref: "BQ-031", bankId: "b-dib", requirement: "Clarify trade license vintage and provide 2 years audited financials", actionPoints: "1. Request audit reports from client\n2. Confirm license issue date\n3. Prepare cover note for credit", ownerId: "u5", receivedAt: ts(-4), due: d(1), status: "OPEN" },
  { id: "q28", caseId: "c19", ref: "BQ-028", bankId: "b-adcb", requirement: "Provide updated salary certificate with allowance breakup", actionPoints: "Collect from employer HR portal", ownerId: "u4", receivedAt: ts(-26), due: d(-22), response: "Certificate uploaded to bank portal, ref ADCB-88412", evidence: "Email confirmation from RM", qc: "Verified by TL", status: "CLOSED" },
  { id: "q22", caseId: "c12", ref: "BQ-022", bankId: "b-dib", requirement: "Source of funds declaration for settlement", actionPoints: "Client signed declaration", ownerId: "u4", receivedAt: ts(-70), due: d(-66), response: "Declaration submitted", evidence: "Signed PDF on file", qc: "Verified by TL", status: "CLOSED" },
];

const L = (l: Omit<Lead, "createdAt"> & { createdAt?: string }): Lead => ({ createdAt: d(-8), ...l });
const leads: Lead[] = [
  L({ id: "l1001", ref: "L-1001", personId: "p4", source: "Property Portal", type: "PURCHASE", status: "QUALIFIED", owner: "u6", bankId: "b-mashreq", propertyValue: 950000, nextAction: "Present product shortlist", due: d(-1), createdAt: d(-14) }),
  L({ id: "l1002", ref: "L-1002", personId: "p8", source: "Walk-in", type: "PURCHASE", status: "CONTACTED", owner: "u6", propertyValue: 800000, nextAction: "Collect salary documents", due: d(1), createdAt: d(-10) }),
  L({ id: "l1003", ref: "L-1003", personId: "p3", source: "Referral", type: "BUYOUT_EQUITY", status: "APPOINTMENT", owner: "u7", bankId: "b-hsbc", propertyValue: 3200000, nextAction: "Video KYC appointment", due: d(3), createdAt: d(-6) }),
  L({ id: "l1004", ref: "L-1004", personId: "p1", source: "Property Portal", type: "PURCHASE", status: "CONVERTED", owner: "u6", bankId: "b-enbd", propertyValue: 1600000, createdAt: d(-21), notes: "Converted to HF-2044" }),
  L({ id: "l1005", ref: "L-1005", personId: "p5", source: "Referral", type: "BUYOUT", status: "PROPOSAL", owner: "u7", bankId: "b-dib", propertyValue: 2400000, nextAction: "Proposal review call", due: d(0), createdAt: d(-24) }),
  L({ id: "l1006", ref: "L-1006", personId: "p6", source: "Bank Partner", type: "PURCHASE", status: "NEW", owner: "u7", bankId: "b-hsbc", propertyValue: 1400000, nextAction: "First contact call", due: d(2), createdAt: d(-1) }),
  L({ id: "l1007", ref: "L-1007", personId: "p9", source: "Existing Client", type: "PURCHASE", status: "CONVERTED", owner: "u6", bankId: "b-dib", propertyValue: 1100000, createdAt: d(-30), notes: "Converted to HF-2029" }),
  L({ id: "l1008", ref: "L-1008", personId: "p2", source: "Developer", type: "PURCHASE", status: "CONVERTED", owner: "u6", bankId: "b-adcb", propertyValue: 2100000, createdAt: d(-48), notes: "Converted to HF-2019" }),
];

const eibor: AppState["eibor"] = Array.from({ length: 8 }, (_, i) => {
  const drift = (7 - i) * 0.008;
  return {
    date: d(i - 7),
    d1: +(4.15 + drift).toFixed(3), w1: +(4.28 + drift).toFixed(3), m1: +(4.37 + drift).toFixed(3),
    m3: +(4.46 + drift).toFixed(3), m6: +(4.53 + drift).toFixed(3), y1: +(4.59 + drift).toFixed(3),
    source: "Central Bank UAE", updatedBy: "u2",
  };
});

const calcs: AppState["calcs"] = [
  { id: "calc1", type: "affordability", label: "Affordability · Hassan Yousef · DIB", linkKind: "case", linkId: "c29", linkRef: "HF-2029", inputs: { salary: 27000, propertyValue: 1100000, rate: 4.1 }, outputs: { maxLoan: 880000, emi: 4266, dbr: "22.6%", status: "ELIGIBLE" }, rulesUsed: [{ code: "LTV-EXP-1", version: 2 }, { code: "DBR-MAX", version: 2 }, { code: "TENURE-MAX", version: 1 }], by: "u6", at: ts(-12) },
  { id: "calc2", type: "affordability", label: "Affordability · Arjun Malhotra · ENBD", linkKind: "lead", linkId: "l1004", linkRef: "L-1004", inputs: { salary: 38000, propertyValue: 1600000, rate: 3.99 }, outputs: { maxLoan: 1280000, emi: 6087, dbr: "21.4%", status: "ELIGIBLE" }, rulesUsed: [{ code: "LTV-EXP-1", version: 2 }, { code: "DBR-MAX", version: 2 }], by: "u6", at: ts(-20) },
  { id: "calc3", type: "buyout", label: "Buyout structure · Omar Bakri", linkKind: "case", linkId: "c38", linkRef: "HF-2038", inputs: { outstanding: 1410000, propertyValue: 2400000 }, outputs: { newLoan: 1800000, settlement: 10000, equity: 82000 }, rulesUsed: [{ code: "LTV-EXP-1", version: 2 }, { code: "SETTLE-1", version: 1 }], by: "u5", at: ts(-15) },
  { id: "calc4", type: "dbr", label: "DBR check · Saeed Al Mansoori", linkKind: "case", linkId: "c47", linkRef: "HF-2047", inputs: { income: 87000, obligations: 5750 }, outputs: { dbr: "41.2%", cap: "50%", status: "PASS" }, rulesUsed: [{ code: "DBR-MAX", version: 2 }], by: "u5", at: ts(-30) },
  { id: "calc5", type: "emi", label: "EMI preview · Fatima Al Suwaidi", linkKind: "case", linkId: "c19", linkRef: "HF-2019", inputs: { loan: 1680000, rate: 3.89, tenure: 300 }, outputs: { emi: 8793 }, rulesUsed: [], by: "u4", at: ts(-9) },
];

const audit: AppState["audit"] = [
  { id: "a1", at: ts(-0.2), by: "u2", module: "RULE", action: "Rule updated", target: "DBR-MAX v1 → v2 (55% → 50%)", detail: "DBR must stay strictly below 50%" },
  { id: "a2", at: ts(-0.4), by: "u4", module: "DOC", action: "Document received", target: "HF-2019 · FOL", detail: "FOL RECEIVED, verification pending", caseId: "c19" },
  { id: "a3", at: ts(-0.9), by: "u5", module: "QUERY", action: "Query received", target: "BQ-031 · HF-2038", detail: "DIB: audited financials required", caseId: "c38" },
  { id: "a4", at: ts(-1), by: "u3", module: "CASE", action: "Owner assigned", target: "HF-2044", detail: "Assigned to Sarah Thomas", caseId: "c44" },
  { id: "a5", at: ts(-1.1), by: "u6", module: "LEAD", action: "Lead converted", target: "L-1004 → HF-2044", detail: "Handover to Ops complete", caseId: "c44" },
  { id: "a6", at: ts(-2), by: "u5", module: "DOC", action: "Document verified", target: "HF-2047 · Liability NOC pending", detail: "NOC still MISSING", caseId: "c47" },
  { id: "a7", at: ts(-4), by: "u4", module: "STAGE", action: "Stage advanced", target: "HF-2038 · Pre-Approval → Bank Query", caseId: "c38" },
  { id: "a8", at: ts(-6), by: "u4", module: "CASE", action: "Case closed", target: "HF-2012", detail: "Golden record archived", caseId: "c12" },
  { id: "a9", at: ts(-6), by: "u4", module: "STAGE", action: "Stage advanced", target: "HF-2029 · Intake → File QC", caseId: "c29" },
  { id: "a10", at: ts(-8), by: "u2", module: "RULE", action: "Rule updated", target: "LTV-EXP-1 v1 → v2 (85% → 80%)", detail: "Expat 1st finance tightened" },
  { id: "a11", at: ts(-9), by: "u4", module: "CALC", action: "Calculation saved", target: "EMI preview · HF-2019", caseId: "c19" },
  { id: "a12", at: ts(-12), by: "u6", module: "CALC", action: "Calculation saved", target: "Affordability · HF-2029", detail: "Rule set v2026-08", caseId: "c29" },
];

export function buildSeed(): AppState {
  return {
    version: SEED_VERSION,
    session: null,
    users: [
      { id: "u1", empId: "HF-001", name: "Kiran Nair", email: "kiran@hfmc.ae", mobile: "+971 50 555 0001", role: "HEAD", team: "Management", active: true, createdAt: d(-400) },
      { id: "u2", empId: "HF-002", name: "Amina Al Mansoori", email: "amina@hfmc.ae", mobile: "+971 50 555 0002", role: "ADMIN", team: "Admin", active: true, createdAt: d(-400) },
      { id: "u3", empId: "HF-010", name: "Ravi Menon", email: "ravi@hfmc.ae", mobile: "+971 50 555 0010", role: "TL", team: "Ops Team A", leaderId: "u1", active: true, createdAt: d(-300) },
      { id: "u4", empId: "HF-011", name: "Sarah Thomas", email: "sarah@hfmc.ae", mobile: "+971 50 555 0011", role: "SPO", team: "Ops Team A", leaderId: "u3", active: true, createdAt: d(-250) },
      { id: "u5", empId: "HF-012", name: "Jose Philip", email: "jose@hfmc.ae", mobile: "+971 50 555 0012", role: "SPO", team: "Ops Team A", leaderId: "u3", active: true, createdAt: d(-250) },
      { id: "u6", empId: "HF-021", name: "Priya Sharma", email: "priya@hfmc.ae", mobile: "+971 50 555 0021", role: "VRM", team: "Sales", leaderId: "u1", active: true, createdAt: d(-200) },
      { id: "u7", empId: "HF-022", name: "Omar Farouk", email: "omar.f@hfmc.ae", mobile: "+971 50 555 0022", role: "VRM", team: "Sales", leaderId: "u1", active: true, createdAt: d(-180) },
      { id: "u8", empId: "HF-030", name: "Lina Haddad", email: "lina@hfmc.ae", mobile: "+971 50 555 0030", role: "PA", team: "Admin", leaderId: "u1", active: true, createdAt: d(-160) },
    ],
    persons, leads, banks, products, stages,
    docTypes: [
      { id: "PASSPORT", name: "Passport" }, { id: "EID", name: "Emirates ID" }, { id: "VISA", name: "Residence Visa" },
      { id: "SALCERT", name: "Salary Certificate" }, { id: "BANKSTMT", name: "Bank Statements (3M)" },
      { id: "LIABILITY", name: "Liability Letter" }, { id: "CARDSTMT", name: "Card Statements" },
      { id: "APPFORM", name: "Bank Application Form" }, { id: "VALREP", name: "Valuation Report" },
      { id: "FOL", name: "Final Offer Letter" }, { id: "DDA", name: "DDA & Security Cheques" },
      { id: "NOC", name: "Mortgage Release NOC" }, { id: "TITLE", name: "Transfer Receipt" },
      { id: "NEWTITLE", name: "New Title Deed" },
    ],
    taskTypes: ["Follow up with bank", "Collect documents from client", "Respond to bank query", "Schedule appointment", "Verify original documents", "Update client"],
    waitingTypes: ["Bank", "Client", "Valuer", "Employer", "Developer", "Trustee Office", "Insurance", "Team Leader"],
    pendingReasons: ["Document missing", "Awaiting bank response", "Client not reachable", "Valuation delayed", "Employer verification pending", "Terms under negotiation", "Awaiting signatures", "Fee approval pending"],
    leadSources: ["Referral", "Property Portal", "Walk-in", "Bank Partner", "Developer", "Social Media", "Existing Client"],
    cases, tasks, queries, rules, eibor, calcs, audit,
  };
}
