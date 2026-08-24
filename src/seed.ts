import type {
  AppState, AxisDef, Bank, Case, DocItem, DocStatus, EiborRow, EmailTemplate, Handoff,
  Lead, Person, ProductDef, ProductVersion, Promo, Rule, StageDef, Task, BankQuery, BankMatrixRule,
} from "./types";

export const SEED_VERSION = 14;

export const SUPER_ADMIN = {
  id: "hfmm-00", empId: "hfmm-00", name: "Super Admin", email: "admin@hfmc.ae", mobile: "",
  role: "ADMIN" as const, team: "Management", active: true, createdAt: new Date().toISOString(),
  note: "Management-assigned seat — reassign to any staff member",
};

const d = (off: number) => { const dt = new Date(); dt.setDate(dt.getDate() + off); return dt.toISOString().slice(0, 10); };
const ts = (offDays: number) => { const dt = new Date(); dt.setDate(dt.getDate() + offDays); return dt.toISOString(); };

/* ---------- stages (evidence-gated workflow) ---------- */
const STAGES: StageDef[] = [
  { id: "HANDOVER", name: "Handover", short: "HO", sla: 2, docs: [], tasks: ["Receive file from VRM", "Confirm transaction type"], conditions: ["Transaction type identified", "Document checklist prepared"] },
  { id: "INTAKE", name: "File Intake", short: "IN", sla: 2, docs: ["PASSPORT", "EID", "VISA"], tasks: ["Organize KYC", "Check completeness"], conditions: ["Client profile completed", "Personal docs received", "File saved in folder"] },
  { id: "FILEQC", name: "File QC", short: "QC", sla: 2, docs: ["SALCERT", "BANKSTMT"], tasks: ["Verify income docs", "Reconcile salary credit"], conditions: ["Salary matches certificate", "Statements correct period", "Forms complete & signed"] },
  { id: "SUBMIT", name: "Bank Submission", short: "SUB", sla: 2, docs: ["APPFORM"], tasks: ["Submit to bank/Huspy", "Confirm receipt"], conditions: ["Route confirmed", "Submission evidence retained", "Receipt confirmed"] },
  { id: "PREAPP", name: "Pre-Approval", short: "PA", sla: 5, docs: ["PALETTER"], tasks: ["Daily bank follow-up", "Resolve queries"], conditions: ["Letter received", "Name/amount/tenure/ROI checked", "Conditions recorded"] },
  { id: "QUERY", name: "Bank Query", short: "QRY", sla: 3, docs: [], tasks: ["Log query", "Respond to bank"], conditions: ["Query answered", "Response submitted"] },
  { id: "VALUATION", name: "Valuation", short: "VAL", sla: 4, docs: ["VALPAYPROOF", "VALREP"], tasks: ["Collect valuation fee", "Schedule inspection"], conditions: ["Fee paid & proof received", "Inspection completed", "Positive report received"] },
  { id: "FOL", name: "FOL", short: "FOL", sla: 5, docs: ["CLIENTCONF", "FOL"], tasks: ["Confirm terms with client", "Request FOL"], conditions: ["Client confirmation received", "FOL QC passed", "FOL shared & signed"] },
  { id: "DDA", name: "FOL Signing / DDA", short: "DDA", sla: 3, docs: ["DDA"], tasks: ["Arrange signing", "Confirm DDA"], conditions: ["Signing completed", "DDA confirmed (client + bank)"] },
  { id: "BOOKING", name: "Loan Booking", short: "BK", sla: 4, docs: ["MANCHEQUE"], tasks: ["Book loan", "Arrange manager's cheque"], conditions: ["Loan booked", "Manager's cheque prepared"] },
  { id: "RELEASE", name: "Liability / Release", short: "REL", sla: 6, docs: ["LIABILITY", "RELEASELETTER"], tasks: ["Track settlement", "Obtain release letter"], conditions: ["Settlement completed", "Release letter collected"] },
  { id: "TRANSFER", name: "Final Transfer", short: "TRF", sla: 4, docs: ["NOCDEV", "TITLE"], tasks: ["Book transfer date", "Complete transfer"], conditions: ["Transfer completed", "Title deed requested"] },
  { id: "TITLEQC", name: "Title Deed QC", short: "TD", sla: 2, docs: ["NEWTITLE", "TDQC"], tasks: ["QC title deed", "Send QC email"], conditions: ["Title deed received", "QC email sent"] },
  { id: "CLOSURE", name: "Closure", short: "CL", sla: 2, docs: [], tasks: ["Run closure audit", "Archive record"], conditions: ["Closure audit passed", "Record archived"] },
];

/* ---------- banks & products ---------- */
const BANKS: Bank[] = [
  { id: "b-dib", name: "Dubai Islamic Bank", short: "DIB" },
  { id: "b-adib", name: "Abu Dhabi Islamic Bank", short: "ADIB" },
  { id: "b-enbd", name: "Emirates NBD", short: "ENBD" },
  { id: "b-hsbc", name: "HSBC", short: "HSBC" },
  { id: "b-mashreq", name: "Mashreq", short: "Mashreq" },
  { id: "b-cbd", name: "Commercial Bank of Dubai", short: "CBD" },
  { id: "b-fab", name: "First Abu Dhabi Bank", short: "FAB" },
  { id: "b-rak", name: "RAKBANK", short: "RAK" },
  { id: "b-scb", name: "Standard Chartered", short: "SCB" },
  { id: "b-arab", name: "Arab Bank", short: "Arab" },
  { id: "b-nbf", name: "National Bank of Fujairah", short: "NBF" },
  { id: "b-bob", name: "Bank of Baroda", short: "BOB" },
  { id: "b-adcb", name: "Abu Dhabi Commercial Bank", short: "ADCB" },
];

const PRODUCTS = BANKS.flatMap((b, i) => [
  { id: `p-${b.id}-res`, bankId: b.id, name: "Home Finance — Residential", rateType: (i % 3 === 0 ? "ISLAMIC" : i % 3 === 1 ? "FIXED" : "VARIABLE") as "ISLAMIC" | "FIXED" | "VARIABLE", rate: 3.99 + (i % 4) * 0.25, maxTenureMonths: 300, maxLoan: 20000000, ccRate: 5 },
]);

const BANK_MATRIX: BankMatrixRule[] = [
  { bankId: "b-adib", route: "DIRECT", statementMonths: 3, routing: "Self-attested KYC; working Excel sheet attached", verified: false },
  { bankId: "b-rak", route: "DIRECT", statementMonths: 6, routing: "mortgagereferrals, CC Burhan", verified: false },
  { bankId: "b-mashreq", route: "HUSPY", statementMonths: 6, routing: "Submit through Huspy portal", verified: false },
  { bankId: "b-fab", route: "HUSPY", statementMonths: 6, routing: "Submit through Huspy portal", verified: false },
  { bankId: "b-adcb", route: "HUSPY", statementMonths: 6, routing: "Submit through Huspy portal", verified: false },
  { bankId: "b-dib", route: "DIRECT", statementMonths: 6, routing: "Direct to banker", verified: false },
];

/* ---------- Bank Rule Engine: axis registry (14 axes) ---------- */
const AXES: AxisDef[] = [
  { id: "stl", name: "Salary transfer", values: [{ v: "STL", l: "STL" }, { v: "NSTL", l: "NSTL" }] },
  { id: "segment", name: "Segment", values: [{ v: "ELITE", l: "Elite" }, { v: "PREMIER", l: "Premier" }, { v: "STANDARD", l: "Standard" }, { v: "EXCELLENCY", l: "Excellency" }, { v: "THARWA", l: "Tharwa" }] },
  { id: "employment", name: "Employment", values: [{ v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self Employed" }] },
  { id: "residency", name: "Residency", values: [{ v: "RESIDENT", l: "UAE Resident" }, { v: "NON_RESIDENT", l: "Non Resident" }] },
  { id: "propertyStatus", name: "Property status", values: [{ v: "READY", l: "Completed / Ready" }, { v: "UNDER_CONSTRUCTION", l: "Under Construction" }, { v: "OFF_PLAN", l: "Off Plan" }, { v: "LAND", l: "Land" }] },
  { id: "transaction", name: "Transaction", values: [{ v: "PURCHASE", l: "New Purchase" }, { v: "RESALE", l: "Resale" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + Equity" }, { v: "EQUITY", l: "Equity Release" }, { v: "REFINANCE", l: "Refinance" }] },
  { id: "tenure", name: "Fixed tenure", values: [{ v: "1", l: "1 yr" }, { v: "2", l: "2 yr" }, { v: "3", l: "3 yr" }, { v: "5", l: "5 yr" }] },
  { id: "amountBand", name: "Loan amount band", values: [{ v: "LT2M", l: "Below 2M" }, { v: "2TO35M", l: "2M – 3.49M" }, { v: "GE35M", l: "3.5M+" }] },
  { id: "emirate", name: "Emirate", values: [{ v: "ALL", l: "All Emirates" }, { v: "DUBAI", l: "Dubai" }, { v: "ABU_DHABI", l: "Abu Dhabi" }, { v: "AJMAN", l: "Ajman" }] },
  { id: "relationship", name: "Relationship", values: [{ v: "ETB", l: "ETB" }, { v: "NTB", l: "NTB" }] },
  { id: "ftvBand", name: "FTV / LTV band", values: [{ v: "LE50", l: "≤ 50%" }, { v: "LE60", l: "≤ 60%" }, { v: "GT60", l: "> 60%" }] },
  { id: "tenureType", name: "Property tenure", values: [{ v: "FREEHOLD", l: "Freehold" }, { v: "LEASEHOLD", l: "Leasehold" }] },
  { id: "channel", name: "Channel", values: [{ v: "DIRECT", l: "Direct" }, { v: "HUSPY", l: "Huspy" }] },
  { id: "developerPromo", name: "Developer promo", values: [{ v: "STANDARD", l: "Standard" }, { v: "GCEO", l: "GCEO approved" }, { v: "AUH_DEV", l: "AUH Developers" }] },
];

const pv = (over: Partial<ProductVersion> & { version: number; status: ProductVersion["status"] }): ProductVersion => ({
  effectiveFrom: undefined, effectiveTo: undefined, source: undefined, author: "hfmm-15", createdAt: ts(-60),
  eligibility: { gates: [] }, tenure: {}, grid: { cells: [] }, adjustments: [],
  fees: {}, affordability: {}, documents: [], tat: {},
  ...over,
});

const PRODUCT_DEFS: ProductDef[] = [
  {
    id: "pd-rak-buyout", bankId: "b-rak", name: "Buyout — Conventional", loanType: "CONVENTIONAL",
    classes: ["SALARIED", "SELF_EMPLOYED"], txTypes: ["BUYOUT"], axes: ["employment", "residency"],
    tags: ["Buyout"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [pv({
      version: 1, status: "ACTIVE", effectiveFrom: d(-60), source: "RAKBANK commercial card",
      eligibility: {
        minSalary: 15000, minLoan: 250000, maxAgeSalaried: 65, maxAgeSelfEmp: 70,
        ltvMatrix: { "BUYOUT": 65 },
        gates: [{ id: "g1", kind: "FLAG", label: "Not offered to Non-Residents", hardStop: true }],
      },
      tenure: { maxMonths: 300 },
      grid: { cells: [
        { id: "c1", key: { employment: "SALARIED", residency: "RESIDENT" }, structure: "FIXED", fixedRate: 4.99, fixedMonths: 12, followOn: { margin: 3.5, index: "EIBOR_6M" }, note: "w/ salary transfer" },
        { id: "c2", key: { employment: "SELF_EMPLOYED", residency: "RESIDENT" }, structure: "FIXED", fixedRate: 5.19, fixedMonths: 12, followOn: { margin: 3.7, index: "EIBOR_6M" } },
      ]},
      fees: { valuation: 3150, preApproval: 0, processingPct: 0, earlySettlement: "1% or 10k, whichever lower", partialSettlement: "Up to 30% every year", propertyInsurance: "0.042% p.a of property value" },
      affordability: { maxDBR: 50, ccPct: 5 },
      tat: { totalDays: 26, paValidityDays: 60, folValidityDays: 30 },
    })],
  },
  {
    id: "pd-mash-buyout", bankId: "b-mashreq", name: "Buyout — Salaried & SE", loanType: "CONVENTIONAL",
    classes: ["SALARIED", "SELF_EMPLOYED"], txTypes: ["BUYOUT"], axes: ["employment", "ftvBand"],
    tags: ["Buyout", "FTV-banded"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [pv({
      version: 1, status: "ACTIVE", effectiveFrom: d(-60), source: "Mashreq pricing card",
      eligibility: { gates: [{ id: "g1", kind: "NATIONALITY_ALLOW", label: "Saudi Nationals only (buyout)", values: ["Saudi"], hardStop: true }] },
      grid: { cells: [
        { id: "c1", key: { employment: "SALARIED", ftvBand: "LE60" }, structure: "MARGIN_INDEX", margin: 2.24814, index: "EIBOR_3M" },
        { id: "c2", key: { employment: "SALARIED", ftvBand: "GT60" }, structure: "MARGIN_INDEX", margin: 2.49814, index: "EIBOR_3M" },
        { id: "c3", key: { employment: "SELF_EMPLOYED", ftvBand: "LE60" }, structure: "MARGIN_INDEX", margin: 2.74814, index: "EIBOR_3M" },
        { id: "c4", key: { employment: "SELF_EMPLOYED", ftvBand: "GT60" }, structure: "MARGIN_INDEX", margin: 3.74814, index: "EIBOR_3M" },
      ]},
      fees: { valuation: 2500, preApproval: 1575, processingPct: 1, processingNote: "1% of loan amount for all transaction types" },
      affordability: { maxDBR: 50, ccPct: 5 },
    })],
  },
  {
    id: "pd-adib-nr", bankId: "b-adib", name: "NR Home Finance — Islamic", loanType: "ISLAMIC",
    classes: ["NON_RESIDENT"], txTypes: ["PURCHASE", "BUYOUT"], axes: ["tenure", "employment"],
    tags: ["Non-Resident", "Islamic"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [pv({
      version: 1, status: "ACTIVE", effectiveFrom: d(-60), source: "ADIB NR card",
      eligibility: {
        minSalary: 15000, incomeBasis: "10,000 USD equiv post-tax", minLoan: 250000, maxLoan: 5000000,
        maxAgeSalaried: 55, maxAgeSelfEmp: 60, ltvMatrix: { "NON_RESIDENT": 50 },
        gates: [
          { id: "g1", kind: "NATIONALITY_ALLOW", label: "GCC residents only (Bahrain, Kuwait, Oman, Saudi)", values: ["Bahrain", "Kuwait", "Oman", "Saudi"], hardStop: true },
          { id: "g2", kind: "FLAG", label: "NR holding a resident visa is not eligible as non-resident", hardStop: true },
        ],
        notes: ["Docs to be translated; credit bureau from home country + UAE (valid 1 month). Salaried only."],
      },
      tenure: { maxMonths: 300 },
      grid: { cells: [
        { id: "c1", key: { tenure: "3" }, structure: "FIXED_THEN_VAR", fixedRate: 4.69, fixedMonths: 36, followOn: { margin: 2.25, index: "EIBOR_1M", floor: 3.75 } },
        { id: "c2", key: { tenure: "5" }, structure: "FIXED_THEN_VAR", fixedRate: 5.19, fixedMonths: 60, followOn: { margin: 2.25, index: "EIBOR_1M", floor: 3.75 } },
      ]},
      fees: { processingPct: 0.5, valuation: 2625, earlySettlement: "1% or 10k, whichever lower", partialSettlement: "Up to 30% every year", propertyInsurance: "Complimentary" },
      affordability: { maxDBR: 50, rentalPct: 70, bonusPct: 50 },
      documents: [
        { name: "Passport (PDF)", required: true }, { name: "Salary Certificate", required: true },
        { name: "Payslips — 6 months (English)", required: true }, { name: "Bank Statements — 6 months", required: true },
        { name: "Credit Bureau — home country + UAE (valid 1 month)", required: true },
      ],
      tat: { paDays: 3, valuationDays: 4, folDays: 6, totalDays: 25, paValidityDays: 60 },
    })],
  },
];

const PROMOS: Promo[] = [
  { id: "promo-1", bankId: "b-adib", name: "HM Promotion — processing fee zero", from: d(-200), to: d(100), summary: "Zero processing fee on salaried home finance (HM Promotion).", createdBy: "hfmm-15", createdAt: ts(-60) },
  { id: "promo-2", bankId: "b-cbd", name: "Aug–Sep 2026 pricing window", from: "2026-08-24", to: "2026-09-30", summary: "CBD updated mortgage pricing for applications submitted 24 Aug → 30 Sep 2026.", createdBy: "hfmm-15", createdAt: ts(-60) },
  { id: "promo-3", bankId: "b-dib", name: "Q1 2026 AUH Developers", from: "2026-01-01", to: "2026-03-31", summary: "AUH developer promotion — NSTL 3.95% fixed 3yr, zero processing fee.", createdBy: "hfmm-15", createdAt: ts(-60) },
];

/* ---------- rules (versioned, TO VERIFY) ---------- */
const R = (r: Omit<Rule, "history">): Rule => ({ ...r, history: [{ version: r.version, value: r.value, effectiveFrom: r.effectiveFrom }] });
const RULES: Rule[] = [
  R({ id: "r-ltv-n1", code: "LTV-NAT-1", module: "LTV", name: "National — 1st finance", kind: "pct", value: 85, scope: { customerType: "NATIONAL", financeCount: 1 }, version: 2, effectiveFrom: "2026-01-01", active: true, note: "TO VERIFY" }),
  R({ id: "r-ltv-e1", code: "LTV-EXP-1", module: "LTV", name: "Expat — 1st finance", kind: "pct", value: 80, scope: { customerType: "EXPAT", financeCount: 1 }, version: 2, effectiveFrom: "2026-01-01", active: true, note: "TO VERIFY" }),
  R({ id: "r-ltv-nr", code: "LTV-NR", module: "LTV", name: "Non-resident", kind: "pct", value: 50, scope: { customerType: "NON_RESIDENT" }, version: 1, effectiveFrom: "2026-01-01", active: true, note: "TO VERIFY" }),
  R({ id: "r-dbr", code: "DBR-MAX", module: "DBR", name: "DBR ceiling", kind: "pct", value: 50, scope: {}, version: 2, effectiveFrom: "2026-09-01", active: true, note: "Strictly below 50% — TO VERIFY" }),
  R({ id: "r-ret-n", code: "RETIRE-NAT", module: "RETIRE", name: "Retirement age — National", kind: "years", value: 70, scope: { customerType: "NATIONAL" }, version: 1, effectiveFrom: "2026-01-01", active: true }),
  R({ id: "r-ret-e", code: "RETIRE-EXP", module: "RETIRE", name: "Retirement age — Expat", kind: "years", value: 65, scope: { customerType: "EXPAT" }, version: 1, effectiveFrom: "2026-01-01", active: true }),
  R({ id: "r-ten", code: "TENURE-MAX", module: "TENURE", name: "Max tenure", kind: "months", value: 300, scope: {}, version: 1, effectiveFrom: "2026-01-01", active: true }),
  R({ id: "r-cc", code: "CC-LIAB", module: "CC", name: "Credit card liability", kind: "pct", value: 5, scope: {}, version: 1, effectiveFrom: "2026-01-01", active: true, note: "Arab Bank 5% — TO VERIFY" }),
  R({ id: "r-stmt", code: "STMT-ADIB", module: "STMT", name: "Statement period — ADIB", kind: "months", value: 3, scope: { bankId: "b-adib" }, version: 1, effectiveFrom: "2026-01-01", active: true }),
  R({ id: "r-t1", code: "PREAPP-TAT", module: "TAT", name: "Pre-Approval expectation", kind: "number", value: 5, scope: {}, version: 1, effectiveFrom: "2026-01-01", active: true, note: "4–5 days, not a bank SLA" }),
];

/* ---------- people & cases (tracker-derived) ---------- */
let pn = 0;
const P = (name: string, over: Partial<Person> = {}): Person => ({
  id: "p" + ++pn, name, customerType: "EXPAT", nationality: "—", employment: "SALARIED",
  dob: "", mobile: "", email: "", monthlySalary: 0, otherIncome: 0, financeCount: 1,
  cards: [], liabilities: [], kyc: { passport: false, eid: false, visa: false, address: false },
  createdAt: ts(-30), ...over,
});

const persons: Person[] = [
  P("Dharpan Randhawa & Mrs. Amanda", { nationality: "India", dob: "1988-04-12", monthlySalary: 42000, mobile: "+971 50 111 2001" }),
  P("Chandan Rajah", { nationality: "India", dob: "1985-09-03", monthlySalary: 55000 }),
  P("Parvez Ahmed", { nationality: "Pakistan", dob: "1982-01-25", monthlySalary: 38000 }),
  P("Anna Larina", { nationality: "Russia", dob: "1990-06-18", monthlySalary: 30000 }),
  P("Ihab Abdulla Jawad", { nationality: "Egypt", dob: "1980-11-30", monthlySalary: 60000 }),
  P("Saeed Shah", { nationality: "Pakistan", dob: "1978-03-08", monthlySalary: 45000 }),
  P("Spencer Domingos Guiao", { nationality: "Philippines", dob: "1992-07-22", monthlySalary: 25000 }),
  P("Yaghoub Hassan Pour", { nationality: "Iran", dob: "1975-12-05", monthlySalary: 48000 }),
  P("Walid Elrasoul", { nationality: "Lebanon", dob: "1986-05-14", monthlySalary: 33000 }),
  P("Rona Nadeem", { nationality: "Egypt", dob: "1989-10-09", monthlySalary: 28000 }),
  P("Avinash Nagar", { nationality: "India", dob: "1987-02-17", monthlySalary: 35000 }),
  P("Ricardo Laborda", { nationality: "Spain", dob: "1983-08-28", monthlySalary: 50000 }),
  P("Karolina & Angie Abbas Issa", { nationality: "Lebanon", dob: "1988-01-11", monthlySalary: 40000 }),
  P("Akram Shah", { nationality: "Pakistan", dob: "1981-04-30", monthlySalary: 36000 }),
  P("Sheree Anne Serilla Sumpay", { nationality: "Philippines", dob: "1991-09-19", monthlySalary: 22000 }),
  P("Jumana Hytham Zin Aldin", { nationality: "Syria", dob: "1984-06-06", monthlySalary: 31000 }),
  P("Mohamed Hengazy I. Aboukhalil", { nationality: "Egypt", dob: "1979-12-12", monthlySalary: 44000 }),
  P("Dina Khalid Saeed Alalami", {
    nationality: "UAE", customerType: "NATIONAL", dob: "1973-08-22", employment: "SALARIED",
    mobile: "+971 52 696 9845", email: "dina.alalami@gmail.com", employer: "Abu Dhabi School of Government",
    sector: "Government", monthlySalary: 60679, preferredName: "Dina", emirate: "Abu Dhabi",
    eidNumber: "784-1973-0613762-7", passportNo: "AA0076779", creditScore: "Good",
    assignedTeam: "VRM2", assignedRm: "Adnan Mahmood",
    liabilities: [{ type: "Existing financing", monthly: 30842 }],
    kyc: { passport: true, eid: true, visa: true, address: true },
  }),
];
const pid = (name: string) => {
  const hit = persons.find((p) => p.name === name) ?? persons.find((p) => p.name.toLowerCase().includes(name.toLowerCase()));
  return (hit ?? P(name)).id;
};

const SPOS = ["hfmm-01", "hfmm-02", "hfmm-03", "hfmm-04", "hfmm-05", "hfmm-06"];
let cn = 0; let dn = 0;
const mkDocs = (stageIdx: number): DocItem[] => {
  const out: DocItem[] = [];
  const push = (stageId: string, typeId: string, status: DocStatus) => out.push({ id: "sd" + ++dn, typeId, stageId, status, updatedAt: ts(-3), updatedBy: "hfmm-01" });
  if (stageIdx >= 1) ["PASSPORT", "EID", "VISA"].forEach((t) => push("INTAKE", t, "VERIFIED"));
  if (stageIdx >= 3) push("SUBMIT", "APPFORM", "VERIFIED");
  if (stageIdx >= 4) push("PREAPP", "PALETTER", stageIdx > 4 ? "VERIFIED" : "MISSING");
  if (stageIdx >= 6) { push("VALUATION", "VALPAYPROOF", stageIdx > 6 ? "VERIFIED" : "RECEIVED"); push("VALUATION", "VALREP", stageIdx > 6 ? "VERIFIED" : "MISSING"); }
  if (stageIdx >= 7) { push("FOL", "CLIENTCONF", "VERIFIED"); push("FOL", "FOL", stageIdx > 7 ? "VERIFIED" : "MISSING"); }
  if (stageIdx >= 8) push("DDA", "DDA", stageIdx > 8 ? "VERIFIED" : "MISSING");
  return out;
};

interface Row { client: string; stage: string; bank: string; rm: string; channel: string; txType: Case["txType"]; amount?: number; prop?: number; note: string; closed?: "WON" | "LOST"; deal?: string; }
const ROWS: Row[] = [
  { client: "Dharpan Randhawa & Mrs. Amanda", stage: "TRANSFER", bank: "b-adib", rm: "Eranga", channel: "Direct", txType: "PURCHASE", amount: 1328445, prop: 1660000, note: "Waiting for the Title Deed" },
  { client: "Chandan Rajah", stage: "VALUATION", bank: "b-dib", rm: "Babar", channel: "Direct", txType: "PURCHASE", amount: 3960000, prop: 4950000, note: "Property Not Finalised" },
  { client: "Parvez Ahmed", stage: "FOL", bank: "b-dib", rm: "Babar", channel: "Direct", txType: "PURCHASE", amount: 1120000, prop: 1400000, note: "LL will be shared maximum by tomorrow" },
  { client: "Parvez Ahmed", stage: "FOL", bank: "b-adib", rm: "Ahmed", channel: "Direct", txType: "BUYOUT_EQUITY", amount: 920000, prop: 1150000, note: "FOL Signing Done 10/08/2026", deal: "Buyout + Equity" },
  { client: "Anna Larina", stage: "TRANSFER", bank: "b-rak", rm: "Shiji", channel: "Prypco", txType: "PURCHASE", amount: 1128000, prop: 1410000, note: "Loan Settlement done waiting for Title Deed" },
  { client: "Ihab Abdulla Jawad", stage: "VALUATION", bank: "b-cbd", rm: "Santunu", channel: "Prypco", txType: "PURCHASE", amount: 3200000, prop: 4000000, note: "Pre-approval in credit LMF2807260657" },
  { client: "Ihab Abdulla Jawad", stage: "PREAPP", bank: "b-enbd", rm: "Samiksha", channel: "Huspy", txType: "PURCHASE", amount: 3200000, prop: 4000000, note: "Received Query replied by Kiran sir" },
  { client: "Ihab Abdulla Jawad", stage: "PREAPP", bank: "b-adib", rm: "Ahmed", channel: "Direct", txType: "PURCHASE", amount: 3200000, prop: 4000000, note: "Pre approval received for 65%" },
  { client: "Saeed Shah", stage: "VALUATION", bank: "b-adib", rm: "Ahmed", channel: "Direct", txType: "BUYOUT_EQUITY", amount: 1200000, prop: 1500000, note: "Al Reef PA received; valuation payment pending", deal: "Al Reef — Buyout + Equity" },
  { client: "Spencer Domingos Guiao", stage: "FOL", bank: "b-dib", rm: "Abdul", channel: "Direct", txType: "PURCHASE", amount: 312000, prop: 390000, note: "Pre Approval Received today" },
  { client: "Yaghoub Hassan Pour", stage: "PREAPP", bank: "b-cbd", rm: "Burhan", channel: "Direct", txType: "PURCHASE", amount: 1174000, prop: 1467000, note: "PA received with conditions — less FAV 1,174,000 on 11th June" },
  { client: "Walid Elrasoul", stage: "PREAPP", bank: "b-dib", rm: "Nawzat", channel: "Direct", txType: "PURCHASE", amount: 850000, prop: 1062000, note: "Bank query received waiting for VRM response" },
  { client: "Rona Nadeem", stage: "FOL", bank: "b-adib", rm: "Ahmed", channel: "Direct", txType: "PURCHASE", amount: 1072000, prop: 1340000, note: "FOL on hold for seller title deed copy" },
  { client: "Avinash Nagar", stage: "BOOKING", bank: "b-adib", rm: "Ahmed", channel: "Direct", txType: "PURCHASE", amount: 1200000, prop: 1500000, note: "Settlement completed 13th Aug; awaiting mortgage release letter" },
  { client: "Ricardo Laborda", stage: "FOL", bank: "b-adib", rm: "Ahmed", channel: "Direct", txType: "BUYOUT_EQUITY", amount: 2080000, prop: 2600000, note: "VR received — market value less; FOL conversion pending", deal: "Buyout + Equity" },
  { client: "Karolina & Angie Abbas Issa", stage: "FOL", bank: "b-dib", rm: "Abdul", channel: "Direct", txType: "PURCHASE", amount: 1320000, prop: 1650000, note: "FOL received 17-08; signing 31st Aug 10.30am" },
  { client: "Akram Shah", stage: "PREAPP", bank: "b-adib", rm: "Ahmed", channel: "Direct", txType: "PURCHASE", amount: 900000, prop: 1125000, note: "Bank query received — overdue flagged" },
  { client: "Sheree Anne Serilla Sumpay", stage: "PREAPP", bank: "b-dib", rm: "Raouf", channel: "Direct", txType: "PURCHASE", amount: 1560000, prop: 1950000, note: "File submitted 12/08; ID card query raised" },
  { client: "Jumana Hytham Zin Aldin", stage: "FOL", bank: "b-dib", rm: "Raouf", channel: "Direct", txType: "PURCHASE", amount: 334920, prop: 418000, note: "Pre-approval received; waiting for FOL" },
  { client: "Mohamed Hengazy I. Aboukhalil", stage: "BOOKING", bank: "b-adib", rm: "Ahmed", channel: "Direct", txType: "PURCHASE", amount: 1450000, prop: 1812000, note: "Deal booked; manager cheque handed to Aldar 18-08" },
  { client: "Dina Khalid Saeed Alalami", stage: "FOL", bank: "b-dib", rm: "Babar", channel: "Direct", txType: "BUYOUT", amount: 990000, prop: 1320000, note: "FOL received 17-Aug; signing booked 31-Aug 10:30am" },
  { client: "Ihab Abdulla Jawad", stage: "CLOSURE", bank: "b-fab", rm: "Shiji", channel: "Prypco", txType: "PURCHASE", amount: 2400000, prop: 3000000, note: "Completed & booked", closed: "WON" },
  { client: "Saeed Shah", stage: "CLOSURE", bank: "b-dib", rm: "Babar", channel: "Direct", txType: "PURCHASE", amount: 2560000, prop: 3200000, note: "Water Edge — completed", closed: "WON", deal: "Water Edge" },
];

const cases: Case[] = ROWS.map((r, i) => {
  cn += 1;
  const stageIdx = STAGES.findIndex((s) => s.id === r.stage);
  const closed = !!r.closed;
  const owner = SPOS[i % SPOS.length];
  const prod = PRODUCTS.find((p) => p.bankId === r.bank) ?? PRODUCTS[0];
  return {
    id: "c" + (3000 + cn), ref: "HF-" + (3000 + cn), personId: pid(r.client), ownerId: owner,
    bankId: r.bank, productId: prod.id, txType: r.txType, deal: r.deal, bankRm: r.rm, channel: r.channel,
    outcome: r.closed, propertyValue: r.prop ?? 0, loanAmount: r.amount ?? 0,
    rate: 3.99 + (i % 4) * 0.25, tenureMonths: 300, stage: r.stage,
    status: closed ? "CLOSED" as const : "OPEN" as const,
    stageHistory: [{ stageId: r.stage, at: ts(closed ? -30 : -(10 + (i % 12))), by: owner }],
    triggerDates: { [r.stage]: d(closed ? -40 : -(2 + (i % 6))) },
    nextAction: closed ? undefined : (r.note.split(";")[0] || "Follow up with bank"),
    nextActionDue: closed ? undefined : d(i % 3 === 0 ? -1 : 2),
    waitingFor: r.note.toLowerCase().includes("waiting") ? (r.channel === "Direct" ? "Bank" : "Client") : undefined,
    expectedCompletion: closed ? undefined : d(20 + i), expectedRevenue: closed ? 25000 + i * 1000 : 18000 + i * 800,
    createdAt: d(closed ? -60 : -(12 + (i % 20))), closedAt: closed ? d(-2) : undefined,
    docs: mkDocs(stageIdx),
    tracker: [{ date: d(0), note: r.note }],
  };
});

/* handoff + closure-audit examples */
{
  const c = cases.find((x) => x.personId === pid("Karolina & Angie Abbas Issa") && x.stage === "FOL");
  if (c) c.handoffs = [{ at: ts(-5), fromId: "hfmm-09", toId: c.ownerId, reason: "Stage progression — FOL", kind: "progression" } as Handoff];
  const won = cases.find((x) => x.status === "CLOSED");
  if (won) won.closureAudit = ["Transfer completed", "Title deed received", "Title deed QC sent"];
}

/* ---------- tasks ---------- */
let tn = 0;
const task = (caze: Case, title: string, over: Partial<Task> = {}): Task => ({
  id: "t" + ++tn, caseId: caze.id, stageId: caze.stage, type: "Follow-up", title,
  ownerId: caze.ownerId, priority: "MEDIUM", due: d(2), status: "OPEN", createdAt: ts(-3), ...over,
});
const tasks: Task[] = [
  ...cases.filter((c) => c.status === "OPEN").slice(0, 12).map((c, i) => task(c, c.nextAction ?? "Follow up", { due: c.nextActionDue, priority: i % 3 === 0 ? "HIGH" : "MEDIUM" })),
  task(cases[0], "Chase developer for Title Deed", { priority: "HIGH", due: d(-1), waitingFor: "Developer" }),
  task(cases[3], "Verify FOL terms vs pre-approval", { estimateMinutes: 240 }),
];

/* ---------- queries ---------- */
const Q = (client: string, bank: string, req: string, over: Partial<BankQuery> = {}): BankQuery => {
  const caze = cases.find((c) => c.personId === pid(client) && c.bankId === bank && c.status === "OPEN") ?? cases[0];
  return { id: "q" + ++tn, caseId: caze.id, ref: "BQ-" + (100 + tn), bankId: bank, requirement: req, actionPoints: "Coordinate response with VRM", ownerId: caze.ownerId, receivedAt: ts(-3), due: d(1), status: "OPEN", ...over };
};
const queries: BankQuery[] = [
  Q("Walid Elrasoul", "b-dib", "Clarify source of funds for down payment"),
  Q("Akram Shah", "b-adib", "Overdue facility flagged on customer profile"),
  Q("Sheree Anne Serilla Sumpay", "b-dib", "ID card from deployed company", { status: "RESPONDED", response: "ID card submitted to banker" }),
  Q("Yaghoub Hassan Pour", "b-adib", "Query on pre-approval file — Sir's reply pending"),
];

/* ---------- leads ---------- */
let ln = 0;
const L = (client: string, over: Partial<Lead> = {}): Lead => ({
  id: "l" + ++ln, ref: "L-" + (2000 + ln), personId: pid(client), source: "Referral", type: "PURCHASE",
  status: "NEW", owner: "hfmm-07", nextAction: "First contact call", due: d(2), createdAt: d(-2), ...over,
});
const leads: Lead[] = [
  L("Dina Khalid Saeed Alalami", { status: "CONVERTED", owner: "hfmm-11", notes: "Converted to DIB buyout case", bankId: "b-dib" }),
  L("Aref Beyed", { status: "QUALIFIED", owner: "hfmm-08", nextAction: "Collect income docs" }),
  L("Hesham (20MM mandate)", { status: "APPOINTMENT", owner: "hfmm-09", nextAction: "Multi-bank submission", propertyValue: 20000000 }),
  L("Roshan Rohra", { status: "NEW", owner: "hfmm-10", nextAction: "Awaiting pending docs" }),
  L("Yashwardhan Ganediwal", { status: "NEW", owner: "hfmm-07", nextAction: "60% LTV low-doc structure" }),
  L("Dr. Kamran Ahmed", { status: "NEW", owner: "hfmm-13", nextAction: "Share pending doc list" }),
];

/* ---------- EIBOR ---------- */
const EIBOR: EiborRow[] = [-6, -5, -4, -3, -2, -1, 0].map((off, i) => ({
  date: d(off), d1: 4.30 + i * 0.005, w1: 4.32 + i * 0.005, m1: 4.35 + i * 0.004,
  m3: 4.27 + i * 0.003, m6: 4.20 + i * 0.002, y1: 4.10 + i * 0.001,
  source: "Central Bank UAE", updatedBy: "hfmm-16",
}));

/* ---------- email templates ---------- */
const TEMPLATES: EmailTemplate[] = [
  { id: "tpl-1", name: "Direct Bank Submission", purpose: "Send complete file to bank RM", subject: "Pre-Approval Submission – [Client Name] – [Bank]", body: "Dear [Bank RM],\n\nPlease find attached the complete documents and required bank forms for the Pre-Approval of [Client Name]. Kindly confirm receipt and proceed with the review.\n\nRegards,\n[Name]\nHFMC", tags: ["submission", "pre-approval"], source: "Guide Book §127.1" },
  { id: "tpl-2", name: "Huspy Submission to Areeb", purpose: "Confirm portal submission", subject: "Huspy Submission – [Client Name] – [Bank]", body: "Dear Areeb,\n\nWe have submitted the file for [Client Name] on the Huspy portal for [Bank]. Please review and proceed with submission to the bank. Screenshot of the final step attached.\n\nRegards,\n[Name]\nHFMC", tags: ["huspy", "submission"], source: "Guide Book §127.3" },
  { id: "tpl-3", name: "Bank Query Response", purpose: "Answer a bank query", subject: "Re: Bank Query – [Client Name] – [Reference]", body: "Dear [Bank RM],\n\nPlease find attached the requested document/clarification.\n\nQuery: [Brief query]\nResponse: [Explanation]\n\nKindly confirm if the query is resolved.\n\nRegards,\n[Name]", tags: ["query"], source: "Guide Book §127.4" },
  { id: "tpl-4", name: "Client FOL Confirmation", purpose: "Confirm FOL terms with client", subject: "FOL Terms Confirmation – [Client Name]", body: "Dear [Client],\n\nPlease confirm the final terms: Finance amount [AED], Tenor [yrs], ROI [%], EMI [AED], Life & Property insurance.\n\nReply to confirm so we may request the FOL.\n\nRegards,\n[Name]\nHFMC", tags: ["fol", "client"], source: "Guide Book Batch 5" },
];

export const TRACKER_DATES = [-5, -4, -3, -2, -1, 0].map((o) => d(o));

export function buildSeed(): AppState {
  return {
    version: SEED_VERSION, session: null,
    users: [
      { ...SUPER_ADMIN },
      { id: "hfmm-15", empId: "hfmm-15", name: "Sir Kiran", email: "kiran@hfmc.ae", mobile: "+971 50 555 0015", role: "HEAD", team: "Management", active: true, createdAt: d(-400), note: "Head" },
      { id: "hfmm-14", empId: "hfmm-14", name: "Swathi Naverkar", email: "swathi@hfmc.ae", mobile: "", role: "TL", team: "Sales & Ops", leaderId: "hfmm-15", active: true, createdAt: d(-350), note: "VRM & SPO Head" },
      { id: "hfmm-01", empId: "hfmm-01", name: "Vijya", email: "", mobile: "", role: "TL", team: "Ops Team (SPO)", leaderId: "hfmm-14", active: true, createdAt: d(-300), note: "SPO Team Leader" },
      { id: "hfmm-12", empId: "hfmm-12", name: "Sameer", email: "", mobile: "", role: "TL", team: "Sales Team (VRM)", leaderId: "hfmm-14", active: true, createdAt: d(-300), note: "VRM Team Leader" },
      { id: "hfmm-02", empId: "hfmm-02", name: "Vaibhavi", email: "", mobile: "", role: "SPO", team: "Ops Team (SPO)", leaderId: "hfmm-01", active: true, createdAt: d(-260) },
      { id: "hfmm-03", empId: "hfmm-03", name: "Vijay", email: "", mobile: "", role: "SPO", team: "Ops Team (SPO)", leaderId: "hfmm-01", active: true, createdAt: d(-260) },
      { id: "hfmm-04", empId: "hfmm-04", name: "Chetan", email: "", mobile: "", role: "SPO", team: "Ops Team (SPO)", leaderId: "hfmm-01", active: true, createdAt: d(-260) },
      { id: "hfmm-05", empId: "hfmm-05", name: "Rohan", email: "", mobile: "", role: "SPO", team: "Ops Team (SPO)", leaderId: "hfmm-01", active: true, createdAt: d(-260) },
      { id: "hfmm-06", empId: "hfmm-06", name: "Mayur", email: "", mobile: "", role: "SPO", team: "Ops Team (SPO)", leaderId: "hfmm-01", active: true, createdAt: d(-260) },
      { id: "hfmm-07", empId: "hfmm-07", name: "Gaurav", email: "", mobile: "", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-08", empId: "hfmm-08", name: "Ani", email: "", mobile: "", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-09", empId: "hfmm-09", name: "Edwin", email: "", mobile: "", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-10", empId: "hfmm-10", name: "Omprakash", email: "", mobile: "", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-11", empId: "hfmm-11", name: "Sona", email: "", mobile: "", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-13", empId: "hfmm-13", name: "Sneha", email: "", mobile: "", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-16", empId: "hfmm-16", name: "Binish", email: "", mobile: "", role: "PA", team: "Management", leaderId: "hfmm-15", active: true, createdAt: d(-200), note: "PA to Sir Kiran" },
      { id: "hfmm-17", empId: "hfmm-17", name: "Omkar", email: "", mobile: "", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-30), note: "New joiner" },
      { id: "hfmm-18", empId: "hfmm-18", name: "Extra 2", email: "", mobile: "", role: "TBD", team: "—", active: false, createdAt: d(-1), note: "Designation to be provided" },
    ],
    persons, leads, banks: BANKS, products: PRODUCTS, stages: STAGES, bankMatrix: BANK_MATRIX,
    docTypes: [
      { id: "PASSPORT", name: "Passport" }, { id: "EID", name: "Emirates ID" }, { id: "VISA", name: "Residence Visa" },
      { id: "SALCERT", name: "Salary Certificate" }, { id: "BANKSTMT", name: "Bank Statements" },
      { id: "APPFORM", name: "Bank Application Form" }, { id: "PALETTER", name: "Pre-Approval Letter" },
      { id: "VALPAYPROOF", name: "Valuation Payment Proof" }, { id: "VALREP", name: "Valuation Report" },
      { id: "CLIENTCONF", name: "Client Confirmation (FOL terms)" }, { id: "FOL", name: "Final Offer Letter" },
      { id: "DDA", name: "DDA & Security Cheques" }, { id: "MANCHEQUE", name: "Manager's Cheque" },
      { id: "LIABILITY", name: "Liability Letter" }, { id: "RELEASELETTER", name: "Mortgage Release Letter" },
      { id: "NOCDEV", name: "Developer NOC" }, { id: "TITLE", name: "Transfer Receipt" },
      { id: "NEWTITLE", name: "New Title Deed" }, { id: "TDQC", name: "Title Deed QC Email" },
    ],
    taskTypes: ["Follow-up", "Document collection", "Bank coordination", "Client call", "QC review"],
    waitingTypes: ["Client", "Bank", "VRM", "Developer", "Valuer", "Sir Kiran"],
    pendingReasons: ["Documents pending", "Awaiting bank revert", "Client to confirm", "On instruction — no follow-up", "Payment pending"],
    leadSources: ["Referral", "Bank Partner", "Walk-in", "Existing Client", "Huspy", "Online"],
    cases, tasks, queries, rules: RULES, eibor: EIBOR, calcs: [], templates: TEMPLATES,
    trackerDates: TRACKER_DATES, axes: AXES, productDefs: PRODUCT_DEFS, promos: PROMOS,
    audit: [
      { id: "a1", at: ts(-0.1), by: "hfmm-00", module: "IMPORT", action: "Tracker imported", target: `${cases.length} case files from daily tracker` },
      { id: "a2", at: ts(-0.3), by: "hfmm-06", module: "CASE", action: "Daily tracker updated", target: cases[0]?.ref ?? "", detail: "Waiting for the Title Deed", caseId: cases[0]?.id },
      { id: "a3", at: ts(-1), by: "hfmm-15", module: "RULE", action: "Rule updated", target: "DBR-MAX v1 → v2 (55% → 50%)", detail: "Strictly below 50% — TO VERIFY" },
    ],
  };
}
