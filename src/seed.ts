import type { AppState, BankQuery, Case, DocItem, DocStatus, Lead, Person, Rule, Task, TrackerEntry } from "./types";
import { addDays, todayISO } from "./ui";

export const SEED_VERSION = 5;
const T = todayISO();
const d = (off: number) => addDays(T, off);
const ts = (off: number) => new Date(Date.now() + off * 86400000).toISOString();

/* =====================================================================
   Operational dataset — imported from the HFMC daily case tracker
   (working days 13, 14, 17, 18, 19, 20 Aug 2026). Financial figures are
   only recorded where the tracker states them; everything else is left
   blank rather than invented.
   ===================================================================== */

export const TRACKER_DATES = ["2026-08-13", "2026-08-14", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"];

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

const banks: AppState["banks"] = [
  { id: "b-adib", name: "Abu Dhabi Islamic Bank", short: "ADIB" },
  { id: "b-dib", name: "Dubai Islamic Bank", short: "DIB" },
  { id: "b-enbd", name: "Emirates NBD", short: "ENBD" },
  { id: "b-hsbc", name: "HSBC Middle East", short: "HSBC" },
  { id: "b-mashreq", name: "Mashreq Bank", short: "Mashreq" },
  { id: "b-cbd", name: "Commercial Bank of Dubai", short: "CBD" },
  { id: "b-fab", name: "First Abu Dhabi Bank", short: "FAB" },
  { id: "b-rak", name: "RAKBANK", short: "RAK" },
  { id: "b-scb", name: "Standard Chartered UAE", short: "SCB" },
  { id: "b-arab", name: "Arab Bank UAE", short: "ARAB" },
  { id: "b-nbf", name: "National Bank of Fujairah", short: "NBF" },
  { id: "b-bob", name: "Bank of Baroda UAE", short: "BOB" },
  { id: "b-adcb", name: "Abu Dhabi Commercial Bank", short: "ADCB" },
];
const products: AppState["products"] = [
  { id: "pr-adib-sal", bankId: "b-adib", name: "ADIB Salaried Fixed", rateType: "ISLAMIC", rate: 3.99, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-dib-ijara", bankId: "b-dib", name: "DIB Ijarah", rateType: "ISLAMIC", rate: 3.75, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5, note: "Expat salaried retirement exception: 65" },
  { id: "pr-enbd-sal", bankId: "b-enbd", name: "ENBD Salaried Fixed 3Y", rateType: "FIXED", rate: 3.99, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-hsbc-prem", bankId: "b-hsbc", name: "HSBC Premier Mortgage", rateType: "FIXED", rate: 3.69, maxTenureMonths: 300, maxLoan: 7500000, ccRate: 5 },
  { id: "pr-mash-sal", bankId: "b-mashreq", name: "Mashreq Salaried", rateType: "FIXED", rate: 4.25, maxTenureMonths: 300, maxLoan: 4000000, ccRate: 5 },
  { id: "pr-cbd-sal", bankId: "b-cbd", name: "CBD Home Finance", rateType: "FIXED", rate: 4.15, maxTenureMonths: 300, maxLoan: 4000000, ccRate: 5 },
  { id: "pr-fab-sal", bankId: "b-fab", name: "FAB Salaried Fixed", rateType: "FIXED", rate: 3.89, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-rak-sal", bankId: "b-rak", name: "RAKBANK Salaried", rateType: "FIXED", rate: 4.35, maxTenureMonths: 300, maxLoan: 3500000, ccRate: 5 },
  { id: "pr-scb-sal", bankId: "b-scb", name: "SCB Mortgage Saver", rateType: "VARIABLE", rate: 4.45, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-arab-sal", bankId: "b-arab", name: "Arab Bank Housing Loan", rateType: "FIXED", rate: 4.29, maxTenureMonths: 300, maxLoan: 3000000, ccRate: 5, note: "Credit cards at 5% of limits" },
  { id: "pr-nbf-sal", bankId: "b-nbf", name: "NBF Salaried Mortgage", rateType: "FIXED", rate: 4.4, maxTenureMonths: 300, maxLoan: 3000000, ccRate: 5 },
  { id: "pr-bob-sal", bankId: "b-bob", name: "BOB Home Loan", rateType: "FIXED", rate: 4.5, maxTenureMonths: 240, maxLoan: 2500000, ccRate: 5 },
  { id: "pr-adcb-sal", bankId: "b-adcb", name: "ADCB Salaried Fixed", rateType: "FIXED", rate: 3.89, maxTenureMonths: 300, maxLoan: 4000000, ccRate: 5 },
];

/* ---------- persons (deduplicated clients from the tracker) ---------- */
const CLIENTS = [
  "Faizul Hussain", "Reneez Ahmed Kabeer", "Ante Svagusa", "Yasir Mohhumad", "Jumana Hytham Zin Aldin",
  "Marc Robert Spitzer", "Stephen Geoff Fensham", "Jignesh Kumar Patel", "Walid Elrasoul", "Stanislav Boykov",
  "Gonzalo Tatay Diaz & Carla Viti Munoz", "Bhavesh & Prerna Magnani", "Sona Rawal & Bhavesh Rawal",
  "Ediz Karahasanoglu", "Yaghoub Hassan Pour", "Silvia Torres", "Dharpan Randhawa", "Qingie Yang",
  "Dr Rahat Ghazanfar", "Saurabh Jain", "Sumantra", "Chandan Marianathan Rajah", "Anna Larina",
  "Parvez Ahmed", "Yash Pandya", "Mr Sharafi", "Avinash Nagar", "Rona Nadeem",
  "Mohamed Hengazy I. Aboukhalil", "Spencer Domingos", "Ihab Abdulla Jawad", "Saeed Shah", "Ricardo Laborda",
  "Sangeeth Chemboth", "Karolina & Angie Abbas Issa", "Akram Shah", "Sheree Anne Serilla Sumpay",
  "Andrei Umnov", "Zinah Alkatabi & Ihab Jawad", "Hesham",
];
const persons: Person[] = CLIENTS.map((name, i) => ({
  id: "p" + (i + 1), name, customerType: "EXPAT", nationality: "", employment: "SALARIED",
  dob: "", mobile: "", email: "", employer: "", monthlySalary: 0, otherIncome: 0, financeCount: 1,
  cards: [], liabilities: [], kyc: { passport: false, eid: false, visa: false, address: false }, createdAt: d(-30),
}));
const pid = (name: string) => persons.find((p) => p.name === name)!.id;

/* ---------- daily tracker rows (as received from operations) ---------- */
const rep = (n: string): (string | null)[] => [n, n, n, n, n, n];
const N6: (string | null)[] = [null, null, null, null, null, null];

type Row = { st: string; client: string; bank: string; rm: string; ch: string; deal?: string; notes: (string | null)[] };

const ROWS: Row[] = [
  { st: "Valuation", client: "Faizul Hussain", bank: "b-adib", rm: "Zaffar", ch: "Direct", notes: rep("Waiting for the property to finalize.") },
  { st: "Pre-Approval", client: "Reneez Ahmed Kabeer", bank: "b-hsbc", rm: "Samiksha / Dinesh C", ch: "Huspy", notes: rep("Sir Kiran is following up Dinesh.") },
  { st: "Pre-Approval", client: "Reneez Ahmed Kabeer", bank: "b-hsbc", rm: "Samiksha / Dinesh", ch: "Huspy", notes: ["Sir is directly coordinating with Dinesh — waiting for approval.", "Sir is directly coordinating with Dinesh — waiting for approval.", "Sir is directly coordinating with Dinesh — waiting for approval.", "Sir Kiran is following up Dinesh.", "Sir Kiran is following up Dinesh.", "Sir Kiran is following up Dinesh."] },
  { st: "Valuation", client: "Reneez Ahmed Kabeer", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Waiting for the property to finalize.") },
  { st: "Pre-Approval", client: "Reneez Ahmed Kabeer", bank: "b-mashreq", rm: "Samiksha / Praveen", ch: "Direct", notes: rep("As per bank revert, bonuses cannot be considered for a family business — income not eligible per Mashreq policy. Waiting for Sir's response.") },
  { st: "Pre-Approval", client: "Reneez Ahmed Kabeer", bank: "b-adib", rm: "Zaffar", ch: "Direct", deal: "Land plot", notes: rep("Nothing to do now — no submission, instructed by Sir Kiran.") },
  { st: "Pre-Approval", client: "Ante Svagusa", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Pre-approval received but finance value is less. RCD didn't change the amount — will request amendment after valuation. Share valuation doc.") },
  { st: "Valuation", client: "Ante Svagusa", bank: "b-adib", rm: "Zaffar", ch: "Direct", notes: rep("Waiting for the property to finalize.") },
  { st: "Pre-Approval", client: "Yasir Mohhumad", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Pre-approval received 19-Jan-2026 for less amount and less tenure. Per Sir, submit fresh case with new working.") },
  { st: "Closed", client: "Jumana Hytham Zin Aldin", bank: "b-adib", rm: "Zaffar", ch: "Direct", notes: N6 },
  { st: "Closed", client: "Jumana Hytham Zin Aldin", bank: "b-dib", rm: "Babar", ch: "Direct", notes: N6 },
  { st: "Valuation", client: "Marc Robert Spitzer", bank: "b-cbd", rm: "Samiksha / Praveen", ch: "Huspy", notes: rep("Waiting for the property to finalize.") },
  { st: "Pre-Approval", client: "Marc Robert Spitzer", bank: "b-mashreq", rm: "Samiksha / Praveen", ch: "Huspy", notes: rep("Case on hold due to pre-approval fees — client doesn't want to pay.") },
  { st: "Valuation", client: "Stephen Geoff Fensham", bank: "b-hsbc", rm: "Samiksha", ch: "Huspy", notes: rep("Case is on hold.") },
  { st: "Valuation", client: "Stephen Geoff Fensham", bank: "b-scb", rm: "Samiksha", ch: "Huspy", notes: rep("Case is on hold.") },
  { st: "Valuation", client: "Stephen Geoff Fensham", bank: "b-enbd", rm: "Samiksha", ch: "Huspy", notes: rep("Case is on hold.") },
  { st: "Valuation", client: "Stephen Geoff Fensham", bank: "b-rak", rm: "Farukh", ch: "Prypco", notes: rep("Case is on hold.") },
  { st: "Valuation", client: "Jignesh Kumar Patel", bank: "b-mashreq", rm: "Samiksha / Praveen", ch: "Huspy", notes: rep("ENBD valuation completed; case now in FOL — waiting for client confirmation on the Mashreq transaction.") },
  { st: "Pre-Approval", client: "Walid Elrasoul", bank: "b-dib", rm: "Nawzat", ch: "Direct", notes: rep("Bank query received — waiting for VRM response.") },
  { st: "Valuation", client: "Stanislav Boykov", bank: "b-rak", rm: "Farukh", ch: "Prypco", notes: rep("Sir Kiran coordinating with client — property not yet finalized.") },
  { st: "Won&closed", client: "Gonzalo Tatay Diaz & Carla Viti Munoz", bank: "b-adib", rm: "Zaffar", ch: "Direct", notes: N6 },
  { st: "Valuation", client: "Bhavesh & Prerna Magnani", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Property not finalized — as per Sir, do not follow up.") },
  { st: "Valuation", client: "Sona Rawal & Bhavesh Rawal", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Client wants to hold for now; introduced to our internal real-estate team for assistance.") },
  { st: "Valuation", client: "Ediz Karahasanoglu", bank: "b-hsbc", rm: "Samiksha", ch: "Huspy", notes: rep("Sir Kiran is handling the case.") },
  { st: "Pre-Approval", client: "Yaghoub Hassan Pour", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: rep("Waiting for Sir's reply to the query.") },
  { st: "Pre-Approval", client: "Yaghoub Hassan Pour", bank: "b-cbd", rm: "Burhan", ch: "Direct", notes: rep("Pre-approval received 11-Jun-2026 with conditions — less FAV AED 1,174,000.") },
  { st: "Won&closed", client: "Silvia Torres", bank: "b-enbd", rm: "Tuba", ch: "Huspy", notes: N6 },
  { st: "Final Transfer", client: "Dharpan Randhawa", bank: "b-adib", rm: "Eranga", ch: "Direct", notes: rep("Waiting for TD.") },
  { st: "Won&closed", client: "Qingie Yang", bank: "b-dib", rm: "Babar", ch: "Direct", notes: N6 },
  { st: "Won&closed", client: "Dr Rahat Ghazanfar", bank: "b-dib", rm: "Raouf", ch: "Direct", notes: N6 },
  { st: "Won&closed", client: "Dr Rahat Ghazanfar", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: N6 },
  { st: "Pre-Approval", client: "Yaghoub Hassan Pour", bank: "b-cbd", rm: "Burhan", ch: "Direct", deal: "Second file", notes: rep("Pre-approval received 11-Jun-2026 with conditions — less FAV AED 1,174,000.") },
  { st: "Valuation", client: "Saurabh Jain", bank: "b-bob", rm: "Vikas", ch: "Direct", notes: rep("Waiting for BCC (Building Completion Certificate) report to do property evaluation.") },
  { st: "Won&closed", client: "Sumantra", bank: "b-enbd", rm: "Buddha", ch: "Huspy", notes: N6 },
  { st: "Pre-Approval", client: "Chandan Marianathan Rajah", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Pre-approval received 24-Jun-2026; property not finalized — VRM checking with client. Case on hold.") },
  { st: "Final Transfer", client: "Anna Larina", bank: "b-rak", rm: "Shiji", ch: "Prypco", notes: ["Blocking process done — blocking certificate shared by client. Settlement cheque deposited with HSBC on 13-Aug-2026.", "Blocking process done — blocking certificate shared by client. Settlement cheque deposited with HSBC on 13-Aug-2026.", "Waiting for update on mortgage release letter from HSBC.", "Waiting for update on mortgage release letter from HSBC.", "Waiting for update on mortgage release letter from HSBC.", "Waiting for update on mortgage release letter from HSBC."] },
  { st: "Loan Booking", client: "Parvez Ahmed", bank: "b-dib", rm: "Babar", ch: "Direct", notes: ["Liability letter expected by Friday — follow up to confirm receipt and next steps. Salary certificate shared with banker Babar.", "Liability letter takes 5 days to issue. Seller advised to drop original liability letter at Mr. Babar Zaheer's office (10th Floor, Business Avenue Tower, Salam Street, AD) if issued today; confirm designated FAB branch for settlement cheque.", "Liability letter takes 5 days to issue. Seller advised to drop original liability letter at Mr. Babar Zaheer's office (10th Floor, Business Avenue Tower, Salam Street, AD) if issued today; confirm designated FAB branch for settlement cheque.", "Liability letter received — Sir Kiran sent same to bank. NOC received on WhatsApp and saved in G-drive folder.", "Liability letter received — Sir Kiran sent same to bank. NOC received on WhatsApp and saved in G-drive folder.", "Settlement appointment booked for 24-Aug-2026, 10:03 AM. Bank asked us to confirm branch with seller. Per proposal sheet, cheque to be deposited at FAB Khalifa Street or FAB Khalifa Park branch — verification needed. Email sent to VRM, awaiting confirmation."] },
  { st: "Pre-Approval", client: "Yash Pandya", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Pre-approval received; refund of valuation fees credited to client's account. Case on hold.") },
  { st: "Closed", client: "Mr Sharafi", bank: "b-dib", rm: "Abdul", ch: "Direct", notes: N6 },
  { st: "Loan Booking", client: "Avinash Nagar", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: ["Settlement successfully completed today. Next step: wait for Mortgage Release Letter (approx. 7–10 working days after settlement).", "Settlement successfully completed today. Next step: wait for Mortgage Release Letter (approx. 7–10 working days after settlement).", "Settlement successfully completed on 13-Aug-2026. Waiting for Mortgage Release Letter (approx. 7–10 working days).", "Settlement successfully completed on 13-Aug-2026. Waiting for Mortgage Release Letter (approx. 7–10 working days).", "24th–28th Aug 2026: mortgage release and mortgage registration should be completed.", "24th–28th Aug 2026: mortgage release and registration expected. As per Kiran Sir — nothing to be done for now."] },
  { st: "Valuation", client: "Avinash Nagar", bank: "b-adib", rm: "Ahmed", ch: "Direct", deal: "Second property", notes: ["Valuation initiated — waiting for schedule from realtor. On hold (waiting for handover notification; till 17-Aug no follow-up).", "Valuation initiated — waiting for schedule from realtor. On hold (waiting for handover notification; till 17-Aug no follow-up).", "Valuation initiated — waiting for schedule from realtor. On hold (waiting for handover notification; till 17-Aug no follow-up).", "Valuation initiated — waiting for schedule from realtor. On hold (waiting for handover notification; till 17-Aug no follow-up).", "Wait till Thursday (20-Aug-2026) to put a message — see the response from the realtor today. Based on the realtor's decision, take the valuation ahead.", "Wait till Thursday (20-Aug-2026) to put a message — see the response from the realtor today. Based on the realtor's decision, take the valuation ahead."] },
  { st: "FOL", client: "Rona Nadeem", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: ["FOL on hold for seller title deed copy. Once received, push transaction ahead — wait till Friday for seller update.", "FOL on hold for seller title deed copy. Once received, push transaction ahead — wait till Friday for seller update.", "FOL on hold for seller title deed copy. Once received, push transaction ahead — wait till Friday for seller update.", "FOL on hold for seller title deed copy. Once received, push transaction ahead — wait till Friday for seller update.", "FOL on hold for seller title deed copy. Once received, push transaction ahead — wait till Friday for seller update.", "Waiting for seller's title deed. Per realtor: Aldar RM can't do anything as it's already under municipality. News expected next week Mon/Tue."] },
  { st: "Loan Booking", client: "Mohamed Hengazy I. Aboukhalil", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: ["Per Kiran Sir: take Hegazy to Aldar customer service, show FOL, inform loan booking / drawdown / manager's cheque under preparation — need confirmation from Khalil.", "Per Kiran Sir: take Hegazy to Aldar customer service, show FOL — as per Khalil, handover cheques to Ahmed (ADIB).", "As per bank revert: deal is booked.", "Developer cheque handed over to Aldar 18-Aug-2026.", "Manager's cheque handed over to Aldar on 18-Aug-2026.", "Client to visit Aldar at least once in 2 days for title deed of the apartment — manager's cheque handed over on 18-Aug-2026."] },
  { st: "Loan Booking", client: "Spencer Domingos", bank: "b-dib", rm: "Abdul", ch: "Direct", notes: ["As per bank update: case under process — FOL to be shared soon.", "Case under process; follow-up email sent requesting FOL update.", "FOL received — rechecking done and shared with VRM.", "FOL signing done 18-Aug-2026. Case moves to Loan Booking.", "Loan booking is in process.", "Per banker, transfer of ownership scheduled for 24-Aug-2026; client to confirm convenient date/time on Monday — banker informed by email."] },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-mashreq", rm: "Praveen", ch: "Huspy", deal: "80%", notes: rep("Query received — per Sir's instruction, do not follow up with the bank from 10-Aug-2026.") },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-cbd", rm: "Shiji", ch: "Prypco", deal: "80% Resale", notes: rep("Per Sir's instruction, do not follow up with the bank from 10-Aug-2026.") },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-cbd", rm: "Shiji", ch: "Prypco", deal: "Unit 420 — Commercial 60%", notes: rep("Pre-approval received — waiting for client confirmation to move to next stage.") },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-cbd", rm: "Shiji", ch: "Prypco", deal: "Unit 419 — Commercial 60%", notes: ["Pre-approval received — waiting for client confirmation to move to next stage.", "Pre-approval received — waiting for client confirmation to move to next stage.", "Pre-approval received — waiting for client confirmation to move to next stage.", "Pre-approval received — waiting for client confirmation to move to next stage.", "Per Sir's instruction, do not follow up with the bank from 10-Aug-2026.", "Pre-approval received — waiting for client confirmation to move to next stage."] },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-enbd", rm: "Samiksha", ch: "Huspy", deal: "50%", notes: rep("Case is on hold.") },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-enbd", rm: "Samiksha", ch: "Huspy", deal: "80% Resale", notes: ["As per bank update: case is with credit — decision expected today or by tomorrow.", "Query received from bank — same query sent to Kiran Sir for assist.", "As per Sir's confirmation — don't follow.", "As per Sir's confirmation — don't follow.", "As per Sir's confirmation — don't follow.", "As per Sir's confirmation — don't follow."] },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: rep("Pre-approval received for 65% — waiting for other banks' pre-approval updates. Bank query received.") },
  { st: "Loan Booking", client: "Parvez Ahmed", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: ["DDA activated by client. Loan-booking email shared; settlement requested for 17-Aug-2026. ADIB confirmed deal booked — settlement appointment once PO received.", "DDA activated by client. Loan-booking email shared; settlement requested for 17-Aug-2026. ADIB confirmed deal booked — settlement appointment once PO received.", "Settlement completed today 17-Aug at DIB.", "Settlement completed 17-Aug at DIB — waiting for mortgage release letter.", "Settlement completed 17-Aug at DIB — awaiting mortgage release letter.", "Mortgage Release Letter expected around 26th–31st Aug 2026."] },
  { st: "Valuation", client: "Saeed Shah", bank: "b-adib", rm: "Ahmed", ch: "Direct", deal: "Al Reef — Buyout + Equity", notes: rep("Pre-approval received — valuation payment pending from client's side.") },
  { st: "Valuation", client: "Saeed Shah", bank: "b-adib", rm: "Ahmed", ch: "Direct", deal: "Water Edge — Buyout + Equity", notes: rep("Pre-approval received — valuation payment pending from client's side.") },
  { st: "FOL", client: "Ricardo Laborda", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: rep("Valuation report received but market value came in lower. Waiting for FOL conversion from VRM — Sir Kiran showing more properties to client.") },
  { st: "Valuation", client: "Sangeeth Chemboth", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: rep("Waiting for valuation payment proof.") },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-fab", rm: "Shiji", ch: "Prypco", deal: "80% Resale", notes: ["Case is in credit as per the banker.", "Query received from the bank yesterday.", "Query received — per Sir's instruction, do not follow up with the bank from 17-Aug-2026.", "Query received — per Sir's instruction, do not follow up with the bank from 17-Aug-2026.", "Query received — per Sir's instruction, do not follow up with the bank from 17-Aug-2026.", "Query received — per Sir's instruction, do not follow up with the bank from 17-Aug-2026."] },
  { st: "Closed", client: "Ihab Abdulla Jawad", bank: "b-fab", rm: "Shiji", ch: "Prypco", deal: "Unit 420 — Commercial 70%", notes: N6 },
  { st: "Closed", client: "Ihab Abdulla Jawad", bank: "b-fab", rm: "Shiji", ch: "Prypco", deal: "Unit 419 — Commercial 70%", notes: N6 },
  { st: "FOL", client: "Karolina & Angie Abbas Issa", bank: "b-dib", rm: "Babar", ch: "Direct", notes: ["Valuation amount received AED 1,650,000. Case moved to FOL.", "FOL conversion details shared with bank — awaiting FOL update.", "Per banker Abdul: verification certificate received and FOL processed. Follow-up email sent asking expected FOL timeline.", "FOL received 17-Aug-2026. Signing on 31-Aug-2026, 10:30 AM — Madam Karolina out of UAE till 30-Aug.", "FOL signing on 31-Aug-2026, 10:30 AM — Madam Karolina out of UAE till 30-Aug-2026.", "FOL signing on 31-Aug-2026, 10:30 AM — Madam Karolina out of UAE till 30-Aug-2026."] },
  { st: "Pre-Approval", client: "Akram Shah", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: rep("Bank query received — there is an overdue.") },
  { st: "Pre-Approval", client: "Akram Shah", bank: "b-cbd", rm: "Siji", ch: "Huspy", notes: rep("Case on hold as per Sir's instruction 30-Jul-2026.") },
  { st: "FOL", client: "Jumana Hytham Zin Aldin", bank: "b-dib", rm: "Raouf", ch: "Direct", notes: ["Follow-up email sent to bank for pre-approval status.", "Follow-up email sent requesting pre-approval status; FOL conversion details shared in advance.", "Per Abdul: case at Level-4 approval with credit for pre-approval. FOL conversion + documents shared in advance on 14-Aug so FOL can process immediately on approval.", "Per Alaa: POL today and conversion to be submitted today.", "Pre-approval received — waiting for FOL.", "Pre-approval received yesterday; follow-up email sent to bank for FOL letter."] },
  { st: "Pre-Approval", client: "Sheree Anne Serilla Sumpay", bank: "b-dib", rm: "Raouf", ch: "Direct", notes: ["Follow-up with banker Abdul — file received and in credit review. Query raised for deployed-company ID card; requested from client.", "File under process. Bank query: ID card from deployed company — requested from client; will share and follow up on pre-approval.", "File under process. Bank query: ID card from deployed company — requested from client; will share and follow up on pre-approval.", "ID card received from client and submitted to bank. Follow-up email sent to Abdul for pre-approval status.", "Follow-up email sent to banker for pre-approval status.", "Follow-up email sent to banker for pre-approval status."] },
  { st: "Pre-Approval", client: "Andrei Umnov", bank: "b-cbd", rm: "Santanu", ch: "Prypco", notes: [null, null, "File submitted to the bank.", "Case was logged yesterday — per Santanu Sir, no update yet.", "Santanu Sir following up with bank — awaiting LMF number.", "Santanu Sir following up with bank — awaiting LMF number."] },
  { st: "Pre-Approval", client: "Saeed Shah", bank: "b-dib", rm: "Raouf", ch: "Direct", deal: "Al Reef — Resale", notes: [null, null, null, null, "File submitted to the bank.", "Swathi shared the documents with Abdul — file in process with bank."] },
  { st: "Pre-Approval", client: "Zinah Alkatabi & Ihab Jawad", bank: "b-arab", rm: "Pradipta", ch: "Direct", notes: [null, null, null, null, "File submitted to the bank.", "Query raised by bank for HRA AED 150,000 — credit proof in statement."] },
  { st: "Pre-Approval", client: "Zinah Alkatabi & Ihab Jawad", bank: "b-cbd", rm: "Santanu", ch: "Prypco", notes: [null, null, null, null, null, "File submitted to the bank."] },
  { st: "Pre-Approval", client: "Hesham", bank: "b-arab", rm: "Pradipta", ch: "Direct", notes: [null, null, null, null, null, "Few documents have been shared."] },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-nbf", rm: "Rajeew", ch: "Direct", notes: [null, null, null, null, "Documents submitted to the bank.", "Follow-up mail sent to bank — waiting for response."] },
];

const STAGE_OF: Record<string, string> = {
  "Pre-Approval": "PREAPP", Valuation: "VALUATION", FOL: "FOL", "Loan Booking": "BOOKING", "Final Transfer": "TRANSFER",
  Closed: "CLOSURE", "Won&closed": "CLOSURE",
};

/* stage indices: HANDOVER 0 · INTAKE 1 · FILEQC 2 · SUBMIT 3 · PREAPP 4 · QUERY 5 · VALUATION 6 · FOL 7 · DDA 8 · BOOKING 9 · RELEASE 10 · TRANSFER 11 · TITLEQC 12 · CLOSURE 13 */
let dn = 0;
const mkDocs = (stageIdx: number, o: { folReceived?: boolean; dda?: DocStatus } = {}): DocItem[] => {
  const out: DocItem[] = [];
  const push = (stageId: string, typeId: string, status: DocStatus) =>
    out.push({ id: "sd" + ++dn, typeId, stageId, status, updatedAt: ts(-3), updatedBy: "u4" });
  if (stageIdx >= 1) ["PASSPORT", "EID", "VISA"].forEach((t) => push("INTAKE", t, "VERIFIED"));
  if (stageIdx >= 3) push("SUBMIT", "APPFORM", "VERIFIED");
  if (stageIdx >= 6) push("VALUATION", "VALREP", stageIdx > 6 ? "VERIFIED" : "MISSING");
  if (stageIdx >= 7) push("FOL", "FOL", stageIdx > 7 ? "VERIFIED" : o.folReceived ? "RECEIVED" : "MISSING");
  if (stageIdx >= 8) push("DDA", "DDA", stageIdx > 8 ? "VERIFIED" : o.dda ?? "MISSING");
  if (stageIdx >= 11) push("TRANSFER", "TITLE", stageIdx > 11 ? "VERIFIED" : "MISSING");
  return out;
};

let cn = 0;
const cases: Case[] = ROWS.map((r, i) => {
  cn += 1;
  const closed = r.st === "Closed" || r.st === "Won&closed";
  const stage = STAGE_OF[r.st];
  const prod = products.find((p) => p.bankId === r.bank)!;
  const tracker: TrackerEntry[] = r.notes
    .map((n, k) => ({ date: TRACKER_DATES[k], note: n }))
    .filter((e): e is TrackerEntry => !!e.note)
    .map((e) => ({ ...e, note: e.note as string }));
  const lastNote = tracker.length ? tracker[tracker.length - 1].note : undefined;
  const holdish = /on hold|don'?t follow|nothing to do|do not follow/i.test(lastNote ?? "");
  const waiting =
    /property.*(finalize|finalized)|not yet finalized/i.test(lastNote ?? "") ? { w: "Client", p: "Property not finalized" } :
    /pre-approval fees/i.test(lastNote ?? "") ? { w: "Client", p: "Pre-approval fee objection" } :
    /valuation payment/i.test(lastNote ?? "") ? { w: "Client", p: "Valuation payment pending" } :
    /mortgage release/i.test(lastNote ?? "") ? { w: "Bank", p: "Awaiting mortgage release letter" } :
    /waiting for (sir|kiran)/i.test(lastNote ?? "") || /sir'?s (reply|response)/i.test(lastNote ?? "") ? { w: "Sir Kiran", p: "Awaiting management reply" } :
    /vrms? response/i.test(lastNote ?? "") ? { w: "VRM", p: "Awaiting VRM response" } :
    /query/i.test(lastNote ?? "") ? { w: "Bank", p: "Bank query in progress" } :
    /client confirmation|client'?s confirmation/i.test(lastNote ?? "") ? { w: "Client", p: "Awaiting client confirmation" } :
    /waiting for (td|title deed|seller)/i.test(lastNote ?? "") ? { w: "Seller", p: "Awaiting seller documents" } :
    /bcc/i.test(lastNote ?? "") ? { w: "Developer", p: "Awaiting BCC report" } :
    /realtor/i.test(lastNote ?? "") ? { w: "Realtor", p: "Awaiting realtor update" } :
    holdish ? { w: "Sir Kiran", p: "On instruction — no follow-up" } :
    lastNote ? { w: "Bank", p: "Awaiting bank response" } : undefined;
  const dueSeq = [2, -2, 4, 1, -1, 3, 0, 5][i % 8];
  const base: Case = {
    id: "c" + (3000 + cn), ref: "HF-" + (3000 + cn), personId: pid(r.client), ownerId: i % 2 ? "u4" : "u5",
    bankId: r.bank, productId: prod.id, txType: /buyout \+ equity/i.test(r.deal ?? "") ? "BUYOUT_EQUITY" : /buyout/i.test(r.deal ?? "") ? "BUYOUT" : "PURCHASE",
    deal: r.deal, bankRm: r.rm, channel: r.ch,
    propertyValue: r.client === "Karolina & Angie Abbas Issa" ? 1650000 : 0,
    loanAmount: r.client === "Yaghoub Hassan Pour" && r.deal !== "Second file" ? 1174000 : 0,
    rate: prod.rate, tenureMonths: 300,
    stage, status: closed ? "CLOSED" : "OPEN",
    outcome: r.st === "Won&closed" ? "WON" : r.st === "Closed" ? "LOST" : undefined,
    tracker,
    stageHistory: [{ stageId: stage, at: ts(closed ? -30 : -(10 + (i % 12))), by: i % 2 ? "u4" : "u5" }],
    createdAt: d(closed ? -60 : -(12 + (i % 20))),
    expectedRevenue: 0,
    docs: mkDocs(stages.findIndex((s) => s.id === stage), {
      folReceived: r.client === "Karolina & Angie Abbas Issa",
      dda: (r.client === "Parvez Ahmed" && r.bank === "b-adib") || r.client === "Mohamed Hengazy I. Aboukhalil" ? "VERIFIED" : undefined,
    }),
    ...(closed
      ? { closedAt: d(-1) }
      : {
          nextAction: lastNote ? (holdish ? "Await instruction — no follow-up" : "Update daily tracker & follow up") : "Profile client file",
          nextActionDue: lastNote ? d(dueSeq) : d(1),
          waitingFor: waiting?.w, pendingReason: waiting?.p,
          blocker: /don'?t follow|do not follow|nothing to do/i.test(lastNote ?? "") ? "Instruction from Sir Kiran — do not follow up" : undefined,
        }),
  };
  return base;
});

const byRef = (client: string, bank: string, deal?: string) =>
  cases.find((c) => c.personId === pid(client) && c.bankId === bank && (c.deal ?? undefined) === deal)!;

/* ---------- tasks derived from the tracker's action points ---------- */
let tn = 0;
const task = (c: Case, title: string, o: Partial<Task> = {}): Task => ({
  id: "st" + ++tn, caseId: c.id, stageId: c.stage, type: "Follow up with bank", title,
  ownerId: c.ownerId, priority: "MEDIUM", status: "OPEN", createdAt: ts(-3), ...o,
});
const tasks: Task[] = [
  task(byRef("Parvez Ahmed", "b-dib"), "Confirm FAB settlement branch with seller — appointment 24-Aug, 10:03 AM", { due: d(-1), priority: "HIGH", waitingFor: "VRM" }),
  task(byRef("Avinash Nagar", "b-adib"), "Follow up Mortgage Release Letter (expected 24–28 Aug)", { due: d(2), waitingFor: "Bank" }),
  task(byRef("Avinash Nagar", "b-adib", "Second property"), "Message realtor — decision on valuation schedule", { due: d(-2), priority: "HIGH", waitingFor: "Realtor" }),
  task(byRef("Rona Nadeem", "b-adib"), "Chase seller title deed — Aldar/municipality update Mon–Tue", { due: d(-2), waitingFor: "Seller" }),
  task(byRef("Mohamed Hengazy I. Aboukhalil", "b-adib"), "Client visit to Aldar for apartment title deed", { due: d(1), waitingFor: "Client" }),
  task(byRef("Spencer Domingos", "b-dib"), "Confirm ownership-transfer date with client (bank proposed 24-Aug)", { due: d(0), waitingFor: "Client" }),
  task(byRef("Karolina & Angie Abbas Issa", "b-dib"), "FOL signing 31-Aug, 10:30 AM — reminder before client returns 30-Aug", { due: d(6), waitingFor: "Client" }),
  task(byRef("Jumana Hytham Zin Aldin", "b-dib"), "Follow up bank for FOL letter (pre-approval in)", { due: d(1), priority: "HIGH", waitingFor: "Bank" }),
  task(byRef("Saeed Shah", "b-adib", "Al Reef — Buyout + Equity"), "Collect valuation payment from client", { due: d(-3), priority: "HIGH", waitingFor: "Client", pendingReason: "Valuation payment pending" }),
  task(byRef("Saeed Shah", "b-adib", "Water Edge — Buyout + Equity"), "Collect valuation payment from client", { due: d(-3), priority: "HIGH", waitingFor: "Client", pendingReason: "Valuation payment pending" }),
  task(byRef("Sangeeth Chemboth", "b-adib"), "Collect valuation payment proof", { due: d(-1), waitingFor: "Client" }),
  task(byRef("Anna Larina", "b-rak"), "Chase HSBC mortgage release letter (cheque deposited 13-Aug)", { due: d(0), priority: "HIGH", waitingFor: "Bank" }),
  task(byRef("Dharpan Randhawa", "b-adib"), "Obtain title deed for final transfer", { due: d(2), waitingFor: "Developer" }),
  task(byRef("Ricardo Laborda", "b-adib"), "FOL conversion — VRM to shortlist alternate properties with Sir Kiran", { due: d(3), waitingFor: "Client" }),
  task(byRef("Yasir Mohhumad", "b-dib"), "Resubmit fresh case with new working (less amount & tenure)", { due: d(-4), priority: "HIGH", waitingFor: "Sir Kiran" }),
  task(byRef("Ante Svagusa", "b-dib"), "Request FAV amendment after valuation; share valuation doc", { due: d(2), waitingFor: "Bank" }),
  task(byRef("Reneez Ahmed Kabeer", "b-mashreq"), "Bonus-income eligibility — await Sir's response to bank revert", { due: d(-1), waitingFor: "Sir Kiran", pendingReason: "Income not eligible per Mashreq policy" }),
  task(byRef("Jignesh Kumar Patel", "b-mashreq"), "Client confirmation on Mashreq transaction (ENBD FOL running)", { due: d(1), waitingFor: "Client" }),
  task(byRef("Walid Elrasoul", "b-dib"), "Answer bank query — coordinate VRM response", { due: d(-1), priority: "HIGH", waitingFor: "VRM" }),
  task(byRef("Sheree Anne Serilla Sumpay", "b-dib"), "Follow up pre-approval after ID card submission", { due: d(1), waitingFor: "Bank" }),
  task(byRef("Ihab Abdulla Jawad", "b-nbf"), "Chase bank response to submitted documents", { due: d(2), waitingFor: "Bank" }),
  task(byRef("Andrei Umnov", "b-cbd"), "Obtain LMF number — Santanu Sir following up", { due: d(0), waitingFor: "Bank" }),
  task(byRef("Zinah Alkatabi & Ihab Jawad", "b-arab"), "Provide HRA AED 150,000 credit proof in statement", { due: d(-1), priority: "HIGH", waitingFor: "Client" }),
  // files under explicit hold instruction — keep out of the "ready" bucket
  ...[
    byRef("Reneez Ahmed Kabeer", "b-adib", "Land plot"),
    byRef("Bhavesh & Prerna Magnani", "b-dib"),
    byRef("Ihab Abdulla Jawad", "b-mashreq", "80%"),
    byRef("Ihab Abdulla Jawad", "b-cbd", "80% Resale"),
    byRef("Ihab Abdulla Jawad", "b-enbd", "80% Resale"),
    byRef("Ihab Abdulla Jawad", "b-fab", "80% Resale"),
    byRef("Akram Shah", "b-cbd"),
  ].map((hz) => task(hz, "HOLD — await Sir Kiran's instruction before any bank follow-up", { due: d(5), priority: "LOW", waitingFor: "Sir Kiran", pendingReason: "On instruction — no follow-up", remarks: "Do not contact the bank until the hold is lifted." })),
];

/* ---------- bank queries recorded in the tracker ---------- */
const queries: BankQuery[] = [
  { id: "q101", caseId: byRef("Walid Elrasoul", "b-dib").id, ref: "BQ-101", bankId: "b-dib", requirement: "Query on file — response to be prepared by VRM", actionPoints: "Coordinate VRM response and revert to banker Nawzat", ownerId: "u5", receivedAt: ts(-5), due: d(-1), status: "OPEN" },
  { id: "q102", caseId: byRef("Akram Shah", "b-adib").id, ref: "BQ-102", bankId: "b-adib", requirement: "Overdue facility flagged on customer profile", actionPoints: "Clarify overdue status with client; obtain clearance letter", ownerId: "u4", receivedAt: ts(-6), due: d(-2), status: "OPEN" },
  { id: "q103", caseId: byRef("Zinah Alkatabi & Ihab Jawad", "b-arab").id, ref: "BQ-103", bankId: "b-arab", requirement: "HRA AED 150,000 — credit proof required in bank statement", actionPoints: "Collect statement evidence of HRA credit from client", ownerId: "u4", receivedAt: ts(-1), due: d(-1), status: "OPEN" },
  { id: "q104", caseId: byRef("Ihab Abdulla Jawad", "b-enbd", "80% Resale").id, ref: "BQ-104", bankId: "b-enbd", requirement: "Credit query — escalated to Sir Kiran for assist", actionPoints: "Hold per Sir's confirmation; do not follow up", ownerId: "u5", receivedAt: ts(-4), due: d(3), status: "OPEN" },
  { id: "q105", caseId: byRef("Ihab Abdulla Jawad", "b-fab", "80% Resale").id, ref: "BQ-105", bankId: "b-fab", requirement: "Query received from bank", actionPoints: "Do not follow up from 17-Aug per Sir's instruction", ownerId: "u5", receivedAt: ts(-3), due: d(4), status: "OPEN" },
  { id: "q106", caseId: byRef("Sheree Anne Serilla Sumpay", "b-dib").id, ref: "BQ-106", bankId: "b-dib", requirement: "ID card from deployed company", actionPoints: "Collect from client and submit to banker Abdul", ownerId: "u4", receivedAt: ts(-5), due: d(-3), response: "ID card received from client and submitted to bank", evidence: "Submitted to banker Abdul", qc: "Verified by TL", status: "RESPONDED" },
  { id: "q107", caseId: byRef("Yaghoub Hassan Pour", "b-adib").id, ref: "BQ-107", bankId: "b-adib", requirement: "Query on pre-approval file — Sir's reply pending", actionPoints: "Send Sir Kiran's reply to banker Ahmed", ownerId: "u4", receivedAt: ts(-6), due: d(-2), status: "OPEN" },
];

/* ---------- leads — files that converted during the tracker window ---------- */
let ln = 0;
const conv = (client: string, bank: string, deal: string | undefined, off: number): Lead => {
  ln += 1;
  const caze = byRef(client, bank, deal);
  return { id: "l" + (2000 + ln), ref: "L-" + (2000 + ln), personId: pid(client), source: deal ? "Existing Client" : "Bank Partner", type: caze.txType, status: "CONVERTED", owner: "u6", bankId: bank, createdAt: d(off), notes: `Converted to ${caze.ref}` };
};
const leads: Lead[] = [
  conv("Andrei Umnov", "b-cbd", undefined, -6),
  conv("Saeed Shah", "b-dib", "Al Reef — Resale", -5),
  conv("Zinah Alkatabi & Ihab Jawad", "b-arab", undefined, -5),
  conv("Zinah Alkatabi & Ihab Jawad", "b-cbd", undefined, -4),
  conv("Hesham", "b-arab", undefined, -4),
  conv("Ihab Abdulla Jawad", "b-nbf", undefined, -5),
  conv("Karolina & Angie Abbas Issa", "b-dib", undefined, -20),
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
  { id: "calc1", type: "emi", label: "EMI preview · Yaghoub Hassan Pour · CBD", linkKind: "case", linkId: byRef("Yaghoub Hassan Pour", "b-cbd").id, linkRef: byRef("Yaghoub Hassan Pour", "b-cbd").ref, inputs: { loan: 1174000, rate: 4.15, tenure: 300 }, outputs: { emi: 6291, totalPayments: 1887300 }, rulesUsed: [{ code: "TENURE-MAX", version: 1 }], by: "u4", at: ts(-2) },
  { id: "calc2", type: "buyout", label: "Buyout + Equity structure · Saeed Shah · Al Reef", linkKind: "case", linkId: byRef("Saeed Shah", "b-adib", "Al Reef — Buyout + Equity").id, linkRef: byRef("Saeed Shah", "b-adib", "Al Reef — Buyout + Equity").ref, inputs: { transaction: "Buyout + Equity", property: "Al Reef" }, outputs: { note: "Pre-approval received; valuation payment pending before structure finalised" }, rulesUsed: [{ code: "LTV-EXP-1", version: 2 }], by: "u5", at: ts(-4) },
  { id: "calc3", type: "ltv", label: "LTV check · Karolina & Angie Abbas Issa · DIB", linkKind: "case", linkId: byRef("Karolina & Angie Abbas Issa", "b-dib").id, linkRef: byRef("Karolina & Angie Abbas Issa", "b-dib").ref, inputs: { propertyValue: 1650000, customerType: "EXPAT", financeCount: 1 }, outputs: { ltv: "80%", maxFinance: 1320000 }, rulesUsed: [{ code: "LTV-EXP-1", version: 2 }], by: "u5", at: ts(-6) },
];

const audit: AppState["audit"] = [
  { id: "a1", at: ts(-0.1), by: "u2", module: "IMPORT", action: "Tracker imported", target: `${cases.length} case files from daily tracker`, detail: "Working days 13–20 Aug 2026" },
  { id: "a2", at: ts(-0.3), by: "u4", module: "CASE", action: "Tracker updated", target: byRef("Parvez Ahmed", "b-dib").ref, detail: "Settlement appointment booked 24-Aug, 10:03 AM", caseId: byRef("Parvez Ahmed", "b-dib").id },
  { id: "a3", at: ts(-0.6), by: "u5", module: "DOC", action: "Document received", target: `${byRef("Karolina & Angie Abbas Issa", "b-dib").ref} · FOL`, detail: "FOL received 17-Aug — signing 31-Aug, 10:30 AM", caseId: byRef("Karolina & Angie Abbas Issa", "b-dib").id },
  { id: "a4", at: ts(-1), by: "u4", module: "QUERY", action: "Query received", target: "BQ-103 · Zinah Alkatabi & Ihab Jawad", detail: "Arab Bank: HRA AED 150,000 credit proof", caseId: byRef("Zinah Alkatabi & Ihab Jawad", "b-arab").id },
  { id: "a5", at: ts(-1.4), by: "u5", module: "CASE", action: "Settlement completed", target: byRef("Parvez Ahmed", "b-adib").ref, detail: "Settlement completed 17-Aug at DIB", caseId: byRef("Parvez Ahmed", "b-adib").id },
  { id: "a6", at: ts(-2), by: "u4", module: "CASE", action: "Deal booked", target: byRef("Mohamed Hengazy I. Aboukhalil", "b-adib").ref, detail: "Manager's cheque handed to Aldar 18-Aug", caseId: byRef("Mohamed Hengazy I. Aboukhalil", "b-adib").id },
  { id: "a7", at: ts(-3), by: "u2", module: "RULE", action: "Rule updated", target: "DBR-MAX v1 → v2 (55% → 50%)", detail: "DBR must stay strictly below 50%" },
  { id: "a8", at: ts(-4), by: "u6", module: "LEAD", action: "Lead converted", target: `L-2006 → ${byRef("Ihab Abdulla Jawad", "b-nbf").ref}` },
  { id: "a9", at: ts(-5), by: "u3", module: "CASE", action: "Case closed (won)", target: byRef("Silvia Torres", "b-enbd").ref, caseId: byRef("Silvia Torres", "b-enbd").id },
  { id: "a10", at: ts(-6), by: "u2", module: "RULE", action: "Rule updated", target: "LTV-EXP-1 v1 → v2 (85% → 80%)", detail: "Expat 1st finance tightened" },
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
    waitingTypes: ["Bank", "Client", "Sir Kiran", "VRM", "Seller", "Realtor", "Valuer", "Employer", "Developer", "Trustee Office", "Insurance", "Team Leader"],
    pendingReasons: ["Document missing", "Awaiting bank response", "Client not reachable", "Property not finalized", "Valuation payment pending", "Awaiting mortgage release letter", "On instruction — no follow-up", "Pre-approval fee objection", "Awaiting seller documents", "Employer verification pending", "Terms under negotiation", "Awaiting signatures"],
    leadSources: ["Referral", "Property Portal", "Walk-in", "Bank Partner", "Developer", "Social Media", "Existing Client"],
    cases, tasks, queries, rules, eibor, calcs, audit,
    trackerDates: TRACKER_DATES,
  };
}
