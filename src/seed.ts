/* ============================================================
   HFMC — seed data: real roster, workflow, banks, rules, products,
   golden cases, and the tracker-derived pipeline.
   ============================================================ */
import type {
  AppState, AxisDef, Bank, BankQuery, Case, EiborRow, EligGate, EmailTemplate, GoldenCase, Lead, Person,
  ProductDef, ProductVersion, Promo, Rule, StageDef, Task, User, WeightingProfile,
} from "./types";

export const SEED_VERSION = 21;

/* ---------- date helpers (relative to today, so the tower is always live) ---------- */
const d = (offsetDays: number) => { const dt = new Date(); dt.setDate(dt.getDate() + offsetDays); return dt.toISOString().slice(0, 10); };
const ts = (offsetDays: number) => { const dt = new Date(); dt.setDate(dt.getDate() + offsetDays); dt.setHours(9 + Math.floor(Math.abs(offsetDays) % 8), 15, 0, 0); return dt.toISOString(); };

export const SUPER_ADMIN: User = {
  id: "hfmm-00", empId: "hfmm-00", name: "Super Admin", email: "admin@hfmc.ae", mobile: "",
  role: "ADMIN", team: "Management", active: true, createdAt: d(-400), note: "Management-assigned slot",
};

/* ---------- 14-stage workflow with evidence gates ---------- */
const STAGES: StageDef[] = [
  { id: "HANDOVER", name: "Handover", short: "HO", sla: 2, docs: [], tasks: ["Receive file from VRM", "Confirm transaction type"], conditions: ["Transaction type identified", "Document checklist prepared"] },
  { id: "INTAKE", name: "File Intake", short: "IN", sla: 2, docs: ["PASSPORT", "EID", "VISA"], tasks: ["Organize KYC", "Check completeness"], conditions: ["Client profile completed", "Personal docs received", "File saved in folder"] },
  { id: "FILEQC", name: "File QC", short: "QC", sla: 2, docs: ["SALCERT", "BANKSTMT"], tasks: ["Verify income docs", "Reconcile salary credit"], conditions: ["Salary matches certificate", "Statements correct period", "Forms complete & signed"] },
  { id: "SUBMIT", name: "Bank Submission", short: "SUB", sla: 2, docs: ["APPFORM"], tasks: ["Submit to bank/Huspy", "Confirm receipt"], conditions: ["Route confirmed", "Submission evidence retained", "Receipt confirmed"] },
  { id: "PREAPP", name: "Pre-Approval", short: "PA", sla: 5, docs: ["PALETTER"], tasks: ["Daily bank follow-up", "Resolve queries"], conditions: ["Letter received", "Name/amount/tenure/ROI checked", "Conditions recorded"], tatNote: "Pre-approval normally takes 3–5 working days for a complete file." },
  { id: "QUERY", name: "Bank Query", short: "QRY", sla: 3, docs: [], tasks: ["Log query", "Respond to bank"], conditions: ["Query answered", "Response submitted"] },
  { id: "VALUATION", name: "Valuation", short: "VAL", sla: 4, docs: ["VALPAYPROOF", "VALREP"], tasks: ["Collect valuation fee", "Schedule inspection"], conditions: ["Fee paid & proof received", "Inspection completed", "Positive report received"], tatNote: "Evaluator contact expected within 24h; report usually within 48h of inspection." },
  { id: "FOL", name: "FOL", short: "FOL", sla: 5, docs: ["CLIENTCONF", "FOL"], tasks: ["Confirm terms with client", "Request FOL"], conditions: ["Client confirmation received", "FOL QC passed", "FOL shared & signed"], tatNote: "FOL must be received within 3–5 working days. Respond same day to any query." },
  { id: "DDA", name: "FOL Signing / DDA", short: "DDA", sla: 3, docs: ["DDA"], tasks: ["Arrange signing", "Confirm DDA"], conditions: ["Signing completed", "DDA confirmed (client + bank)"] },
  { id: "BOOKING", name: "Loan Booking", short: "BK", sla: 4, docs: ["MANCHEQUE"], tasks: ["Book loan", "Arrange manager's cheque"], conditions: ["Loan booked", "Manager's cheque prepared"], tatNote: "Manager's cheque to developer due by D+4 to D+7." },
  { id: "RELEASE", name: "Liability / Release", short: "REL", sla: 6, docs: ["LIABILITY", "RELEASELETTER"], tasks: ["Track settlement", "Obtain release letter"], conditions: ["Settlement completed", "Release letter collected"] },
  { id: "TRANSFER", name: "Final Transfer", short: "TRF", sla: 4, docs: ["NOCDEV", "TITLE"], tasks: ["Book transfer date", "Complete transfer"], conditions: ["Transfer completed", "Title deed requested"] },
  { id: "TITLEQC", name: "Title Deed QC", short: "TD", sla: 2, docs: ["NEWTITLE", "TDQC"], tasks: ["QC title deed", "Send QC email"], conditions: ["Title deed received", "QC email sent"] },
  { id: "CLOSURE", name: "Closure", short: "CL", sla: 2, docs: [], tasks: ["Run closure audit", "Archive record"], conditions: ["Closure audit passed", "Record archived"] },
];

const BANKS: Bank[] = [
  { id: "b-dib", name: "Dubai Islamic Bank", short: "DIB" }, { id: "b-adib", name: "Abu Dhabi Islamic Bank", short: "ADIB" },
  { id: "b-enbd", name: "Emirates NBD", short: "ENBD" }, { id: "b-hsbc", name: "HSBC", short: "HSBC" },
  { id: "b-mashreq", name: "Mashreq", short: "Mashreq" }, { id: "b-cbd", name: "Commercial Bank of Dubai", short: "CBD" },
  { id: "b-fab", name: "First Abu Dhabi Bank", short: "FAB" }, { id: "b-rak", name: "RAKBANK", short: "RAK" },
  { id: "b-scb", name: "Standard Chartered", short: "SCB" }, { id: "b-arab", name: "Arab Bank", short: "Arab" },
  { id: "b-nbf", name: "National Bank of Fujairah", short: "NBF" }, { id: "b-bob", name: "Bank of Baroda", short: "BOB" },
  { id: "b-adcb", name: "Abu Dhabi Commercial Bank", short: "ADCB" },
];

/* ---------- pricing axes registry ---------- */
const AXES: AxisDef[] = [
  { id: "stl", name: "Salary transfer", values: [{ v: "STL", l: "STL" }, { v: "NSTL", l: "NSTL" }] },
  { id: "segment", name: "Segment", values: [{ v: "ELITE", l: "Elite" }, { v: "PREMIER", l: "Premier" }, { v: "STANDARD", l: "Standard" }, { v: "EXCELLENCY", l: "Excellency" }, { v: "THARWA", l: "Tharwa" }, { v: "PRIV", l: "Private" }, { v: "ASPIRE", l: "Aspire / Privilege" }, { v: "HOMESAVER", l: "Home Saver" }, { v: "EMIRATI", l: "Emirati Customer" }] },
  { id: "employment", name: "Employment", values: [{ v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self Employed" }] },
  { id: "residency", name: "Residency", values: [{ v: "RESIDENT", l: "UAE Resident" }, { v: "NON_RESIDENT", l: "Non Resident" }] },
  { id: "customerType", name: "Customer type", values: [{ v: "NATIONAL", l: "UAE National" }, { v: "EXPAT", l: "Expat" }, { v: "NON_RESIDENT", l: "Non Resident" }] },
  { id: "propertyStatus", name: "Property status", values: [{ v: "READY", l: "Completed / Ready" }, { v: "UNDER_CONSTRUCTION", l: "Under Construction" }, { v: "OFF_PLAN", l: "Off Plan" }, { v: "LAND", l: "Land" }] },
  { id: "transaction", name: "Transaction", values: [{ v: "PURCHASE", l: "New Purchase" }, { v: "RESALE", l: "Resale" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + Equity" }, { v: "EQUITY", l: "Equity Release" }, { v: "REFINANCE", l: "Refinance" }] },
  { id: "tenure", name: "Fixed tenure", values: [{ v: "1", l: "1 yr" }, { v: "2", l: "2 yr" }, { v: "3", l: "3 yr" }, { v: "5", l: "5 yr" }] },
  { id: "amountBand", name: "Loan amount band", values: [{ v: "LT2M", l: "Below 2M" }, { v: "2TO35M", l: "2M – 3.49M" }, { v: "GE35M", l: "3.5M+" }] },
  { id: "emirate", name: "Emirate", values: [{ v: "ALL", l: "All Emirates" }, { v: "DUBAI", l: "Dubai" }, { v: "ABU_DHABI", l: "Abu Dhabi" }, { v: "AJMAN", l: "Ajman" }] },
  { id: "relationship", name: "Relationship", values: [{ v: "ETB", l: "ETB" }, { v: "NTB", l: "NTB" }] },
  { id: "ftvBand", name: "FTV / LTV band", values: [{ v: "LE50", l: "≤ 50%" }, { v: "LE60", l: "≤ 60%" }, { v: "GT60", l: "> 60%" }] },
  { id: "tenureType", name: "Property tenure", values: [{ v: "FREEHOLD", l: "Freehold" }, { v: "LEASEHOLD", l: "Leasehold" }] },
  { id: "channel", name: "Channel", values: [{ v: "DIRECT", l: "Direct" }, { v: "HUSPY", l: "Huspy" }] },
];

/* ---------- bank product versions (rates are RECIPES, resolved vs EIBOR) ---------- */
const pv = (over: Partial<ProductVersion> & { version: number; status: ProductVersion["status"] }): ProductVersion => ({
  effectiveFrom: undefined, source: undefined, createdAt: ts(-60),
  eligibility: { gates: [] }, tenure: {}, grid: { cells: [] },
  fees: {}, affordability: {}, documents: [], tat: {},
  ...over,
});

/* ---------- Mashreq Interim Policy Proposed (circular) ----------
   Encoded as v2 SCHEDULED versions — v1 (current policy) stays ACTIVE.
   On activation it applies to fresh logins & WIP; pre-approved / final-approved
   cases keep v1 via their decision snapshots, per the circular's note. */
const MASHREQ_HIGH_RISK_SECTORS = [
  "Jewelry", "Aviation / Airlines / Airport", "Real Estate / Developers (incl. top listed)",
  "Construction / Contracting / Interior Design", "Collectors / Collection Agency Owners",
  "Hospitality / Hotels / Resorts", "Furnished Apartments / Holiday Homes", "Restaurants / Cafe",
  "Taxi / Rent A Car", "Manpower Supply", "Investment Companies", "Event Management",
  "Travel & Tourism", "Shipping / Logistics / Transportation", "Oil & Gas", "Trading (Self-Employed)",
];
const mashreqInterimGates = (forBuyout: boolean): EligGate[] => [
  { id: "i1", kind: "FLAG", label: "Max 2 properties — strict, no deviations (was 4)", hardStop: true },
  { id: "i2", kind: "FLAG", label: "Salaried minimum income AED 25K (was 15K) — no deviation allowed", when: "SALARIED", hardStop: true },
  { id: "i3", kind: "FLAG", label: "Self-employed minimum income AED 40K (was 20K) — no deviation allowed", when: "SELF_EMPLOYED", hardStop: true },
  { id: "i4", kind: "FLAG", label: "Variable income must not exceed fixed income — no deviation allowed", hardStop: true },
  { id: "i5", kind: "FLAG", label: "SE full-doc: LOB ≥ 3y & LOS ≥ 18m; LOB ≥ 2y & LOS ≥ 12m → Level 3 approval; below → not allowed", when: "SELF_EMPLOYED", hardStop: false },
  { id: "i6", kind: "FLAG", label: "SE low-doc: LOB ≥ 3y, LOS ≥ 18m (DOJ basis); LOB/LOS ≥ 1y → Level 3 approval; < 1y → not allowed", when: "SELF_EMPLOYED", hardStop: false },
  { id: "i7", kind: "FLAG", label: "High-risk nationalities (Iranian & Israeli): LTV capped at 60% — no deviations", hardStop: false },
  { id: "i8", kind: "FLAG", label: "High-risk sectors (16 categories): LTV capped at 60% — no deviations", hardStop: false },
  { id: "i9", kind: "FLAG", label: "Self-employed: completed residential only — commercial no longer eligible, no deviations", when: "SELF_EMPLOYED", hardStop: true },
  ...(forBuyout ? [
    { id: "i10", kind: "FLAG" as const, label: "Non-resident buyout: NOT ALLOWED (interim) — no deviations", when: "NON_RESIDENT", hardStop: true },
    { id: "i11", kind: "FLAG" as const, label: "Seller buyout: Dubai only as per PPG criteria (was Dubai & Abu Dhabi)", hardStop: true },
  ] : []),
];
/* ---------- ADCB Salaried — approved-companies rate discount ---------- */
const ADCB_DISCOUNT_EMPLOYERS = [
  "Mubadala", "Abu Dhabi Police", "ADP", "General Command of the Civil Defence", "Civil Defence",
  "ADNOC", "Abu Dhabi National Oil Company", "ADIA", "Abu Dhabi Investment Authority",
  "Department of Culture & Tourism", "Culture & Tourism", "Etihad", "Air Arabia", "Emirates",
  "Fly Dubai", "Aldar Properties", "Aldar", "Roads & Transport Authority", "RTA",
];

const MASHREQ_INTERIM_NOTES = [
  "NR LTV bands (interim): First/owner-occupied — ≤ AED 5Mn: 65% · > AED 5Mn: 55% | Second/investment — ≤ AED 5Mn: 60% · > AED 5Mn: 55%",
  "Max loan AED 15Mn (unchanged); amounts > AED 10Mn require business recommendation",
  "Underwriting: high-risk segments — employment validation within 30 days (salary credits / salary certificate / call verification, each within last 30 days)",
  "Underwriting: prevailing stress-rate methodology applies — no affordability relaxations",
  "Applies to all fresh logins & WIP cases immediately on activation; pre-approved & final-approved cases continue under existing policy (v1)",
];

/* ---------- Approved top-developer list (drives the real-estate high-risk exemption) ---------- */
const TOP_DEVELOPERS = [
  "Al Futtaim Real Estate", "Al Habtoor Real Estate", "Aldar", "Azizi Developments",
  "Binghatti Developers", "DAMAC Properties", "Dubai Holding Real Estate (Meraas, Nakheel, Dubai Properties, Meydan)",
  "Dubai South", "Dubai Sports City", "Emaar PJSC", "Expo City Dubai", "Majid Al Futtaim Real Estate",
  "Nshama", "Omniyat", "Sobha Realty", "TDIC (Tourism Development & Investment Company)", "Wasl Properties",
];

/* ---------- September 2026 revision: high-risk bands (effective immediately) ---------- */
const MASHREQ_HR_60 = {
  ltv: 60, topDeveloperExempt: true,
  nationalities: ["Iranian", "Israeli"],
  sectors: ["Jewelry", "Real Estate / Developers (excluding top developers)", "Construction / Contracting", "Hospitality / Hotels / Resorts", "Furnished Apartments / Holiday Homes", "Travel & Tourism"],
  sectorKeywords: ["jewelry", "real estate", "developer", "construction", "contracting", "hospitality", "hotel", "resort", "holiday home", "furnished apartment", "travel", "tourism"],
};
const MASHREQ_HR_70 = {
  ltv: 70,
  sectors: ["Aviation / Airlines / Airport", "Restaurants / Café", "Taxi / Rent A Car", "Manpower Supply", "Investment Companies", "Event Management", "Shipping / Logistics / Transportation", "Oil & Gas", "Trading (Self-Employed)"],
  sectorKeywords: ["aviation", "airline", "airport", "restaurant", "cafe", "café", "taxi", "rent a car", "manpower", "investment", "event management", "shipping", "logistics", "transportation", "oil & gas", "oil and gas", "trading"],
};
const MASHREQ_SEPT_NOTES = [
  "High-risk borrower segment revised & effective immediately; all other industries reinstated to standard policy parameters.",
  "Real estate / developers assessed at 60% LTV EXCEPT approved top developers (standard policy).",
  "Approved top-developer list updated (17 names) — maintained in Master Data, not per-product.",
];
const MASHREQ_NR_SEPT_NOTES = [
  "NR revised policy effective for all new applications logged from 1 September 2026 onwards.",
  "WIP cases proposed under the revised policy: updated criteria considered by credit on a best-effort basis, subject to assessment & approval.",
  "NR bank statements: latest 6 months; minimum-balance criterion must be met in at least 4 of the last 6 months.",
  "NR customers holding more than two properties (AECB/internal records): max LTV restricted to 50%.",
];

const PRODUCT_DEFS: ProductDef[] = [
  {
    id: "pd-dib-res", bankId: "b-dib", name: "Home Finance — Residential (Islamic)", loanType: "ISLAMIC",
    classes: ["SALARIED", "SELF_EMPLOYED"], txTypes: ["PURCHASE", "BUYOUT", "BUYOUT_EQUITY"], axes: ["employment", "residency", "tenure"],
    tags: ["Residential"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [pv({
      version: 1, status: "ACTIVE", effectiveFrom: d(-60), source: "DIB pricing card",
      eligibility: {
        minSalary: 10000, minLoan: 250000, maxLoan: 20000000, maxAgeSalaried: 70, maxAgeSelfEmp: 70,
        ltvMatrix: { "NATIONAL:1": 85, "NATIONAL:2": 70, "EXPAT:1": 80, "EXPAT:2": 65, "NON_RESIDENT": 50, "SELF_EMPLOYED": 70 },
        gates: [],
        salaryTransferRequired: false,
        notes: ["AUH developer promo: NSTL 3.95% fixed 3yr, zero processing fee (Q window)."],
      },
      tenure: { maxMonths: 300 },
      grid: { cells: [
        { id: "c1", key: { employment: "SALARIED", tenure: "3" }, structure: "FIXED", fixedRate: 4.1, fixedMonths: 36, note: "NSTL — fixed 3 years (proposal sheet)" },
        { id: "c2", key: { employment: "SALARIED" }, structure: "MARGIN_INDEX", margin: 1.5, index: "EIBOR_3M", note: "NSTL — bank margin 1.50% + 3M EIBOR (variable)" },
        { id: "c3", key: { employment: "SELF_EMPLOYED", tenure: "3" }, structure: "FIXED_THEN_VAR", fixedRate: 4.6, fixedMonths: 36, followOn: { margin: 1.5, index: "EIBOR_3M", floor: 1.5 } },
      ]},
      fees: {
        processingPct: 0.5, valuation: 2500, preApproval: 0, vatPct: 5,
        earlySettlement: "1.05% of outstanding (incl. VAT) or AED 10,500 — whichever is lower",
        partialSettlement: "1.05% of outstanding, max AED 10,500 (incl. 5% VAT)",
        arrangementFee: "Not applicable",
        lifeInsurancePct: 0.03, lifeInsuranceNote: "monthly, on outstanding loan amount",
        propertyInsurancePct: 0.03325, propertyInsuranceNote: "yearly, on property value",
        note: "Processing fee plus VAT @ 5%",
      },
      affordability: { maxDBR: 50, ccPct: 5, rentalPct: 70 },
      documents: [{ name: "Salary Certificate", required: true }, { name: "Bank Statements — 6 months", required: true }, { name: "EID + Passport + Visa", required: true }],
      tat: { paDays: 4, valuationDays: 3, folDays: 5, totalDays: 22, paValidityDays: 60 },
    })],
  },
  {
    id: "pd-cbd-res", bankId: "b-cbd", name: "Mortgage — Residential", loanType: "CONVENTIONAL",
    classes: ["SALARIED", "SELF_EMPLOYED"], txTypes: ["PURCHASE", "BUYOUT", "EQUITY"], axes: ["employment", "tenure"],
    tags: ["Residential"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [pv({
      version: 1, status: "ACTIVE", effectiveFrom: d(-60), source: "CBD Aug–Sep pricing window",
      eligibility: {
        minSalary: 12000, minLoan: 250000, maxLoan: 20000000, maxAgeSalaried: 65, maxAgeSelfEmp: 70,
        ltvMatrix: { "NATIONAL:1": 85, "EXPAT:1": 80, "EXPAT:2": 65, "SELF_EMPLOYED": 70 },
        gates: [],
      },
      tenure: { maxMonths: 300 },
      grid: { cells: [
        { id: "c1", key: { employment: "SALARIED", tenure: "1" }, structure: "FIXED", fixedRate: 4.89, fixedMonths: 12 },
        { id: "c2", key: { employment: "SALARIED", tenure: "3" }, structure: "FIXED", fixedRate: 3.99, fixedMonths: 36, note: "Introductory — completed properties" },
        { id: "c3", key: { employment: "SALARIED", tenure: "5" }, structure: "FIXED", fixedRate: 4.19, fixedMonths: 60 },
        { id: "c4", key: { employment: "SELF_EMPLOYED", tenure: "3" }, structure: "FIXED", fixedRate: 4.64, fixedMonths: 36 },
      ]},
      fees: { processingPct: 1, processingMin: 2500, valuation: 3150, preApproval: 0, earlySettlement: "1% or 10k, whichever lower" },
      affordability: { maxDBR: 50, ccPct: 5 },
      documents: [{ name: "Salary Certificate", required: true }, { name: "Bank Statements — 6 months", required: true }],
      tat: { paDays: 5, valuationDays: 2, folDays: 2, totalDays: 14, paValidityDays: 60 },
    })],
  },
  {
    id: "pd-enbd-res", bankId: "b-enbd", name: "Home Loan — Residential", loanType: "CONVENTIONAL",
    classes: ["SALARIED"], txTypes: ["PURCHASE", "BUYOUT"], axes: ["employment", "tenure", "stl"],
    tags: ["Residential", "Salaried only"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [pv({
      version: 1, status: "ACTIVE", effectiveFrom: d(-60), source: "ENBD pricing card",
      eligibility: {
        minSalary: 15000, minLoan: 250000, maxLoan: 15000000, maxAgeSalaried: 65,
        ltvMatrix: { "NATIONAL:1": 85, "EXPAT:1": 80, "EXPAT:2": 65 },
        gates: [{ id: "g1", kind: "EMPLOYMENT_BLOCK", label: "Self-employed not accepted on this product", values: ["SELF_EMPLOYED"], hardStop: true }],
      },
      tenure: { maxMonths: 300 },
      grid: { cells: [
        { id: "c1", key: { employment: "SALARIED", tenure: "3" }, structure: "MARGIN_INDEX", margin: 2.05, index: "EIBOR_3M", floor: 4.39 },
        { id: "c2", key: { employment: "SALARIED", tenure: "5" }, structure: "MARGIN_INDEX", margin: 2.15, index: "EIBOR_3M", floor: 4.59 },
      ]},
      fees: { processingPct: 1, processingMin: 2500, valuation: 3150, preApproval: 0, earlySettlement: "1% or 10k, whichever lower" },
      affordability: { maxDBR: 50, ccPct: 5 },
      documents: [{ name: "Salary Certificate", required: true }, { name: "Bank Statements — 3 months", required: true }],
      tat: { paDays: 5, valuationDays: 3, folDays: 2, totalDays: 29 },
    })],
  },
  {
    id: "pd-rak-buyout", bankId: "b-rak", name: "Buyout — Conventional", loanType: "CONVENTIONAL",
    classes: ["SALARIED", "SELF_EMPLOYED"], txTypes: ["BUYOUT"], axes: ["employment", "residency"],
    tags: ["Buyout"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [pv({
      version: 1, status: "ACTIVE", effectiveFrom: d(-60), source: "RAKBANK commercial card",
      eligibility: {
        minSalary: 15000, minLoan: 250000, maxAgeSalaried: 65, maxAgeSelfEmp: 70,
        ltvMatrix: { "BUYOUT": 65 },
        minAecb: 651, negativeBureauBlock: true,
        gates: [{ id: "g1", kind: "FLAG", label: "Not offered to Non-Residents", when: "NON_RESIDENT", hardStop: true }],
      },
      tenure: { maxMonths: 300 },
      grid: { cells: [
        { id: "c1", key: { employment: "SALARIED", residency: "RESIDENT" }, structure: "FIXED", fixedRate: 4.99, fixedMonths: 12, followOn: { margin: 3.5, index: "EIBOR_6M" }, note: "w/ salary transfer" },
        { id: "c2", key: { employment: "SELF_EMPLOYED", residency: "RESIDENT" }, structure: "FIXED", fixedRate: 5.19, fixedMonths: 12, followOn: { margin: 3.7, index: "EIBOR_6M" } },
      ]},
      fees: { valuation: 3150, preApproval: 0, processingPct: 0, earlySettlement: "1% or 10k, whichever lower" },
      affordability: { maxDBR: 50, ccPct: 5 },
      tat: { totalDays: 26, paValidityDays: 60 },
    })],
  },
  {
    id: "pd-mash-buyout", bankId: "b-mashreq", name: "Buyout — Salaried & SE", loanType: "CONVENTIONAL",
    classes: ["SALARIED", "SELF_EMPLOYED"], txTypes: ["BUYOUT"], axes: ["employment", "ftvBand"],
    tags: ["Buyout", "FTV-banded"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [
      pv({
        version: 1, status: "RETIRED", effectiveFrom: d(-60), source: "Mashreq current policy (superseded by Sept 2026 revision)",
        eligibility: {
          minSalary: 15000, maxLoan: 15000000,
          ltvMatrix: { "SALARIED": 80, "SELF_EMPLOYED": 70, "NON_RESIDENT": 50 },
          gates: [], notes: ["Superseded — high-risk & NR revised Sept 2026"],
        },
        grid: { cells: [
          { id: "c1", key: { employment: "SALARIED", ftvBand: "LE60" }, structure: "MARGIN_INDEX", margin: 2.25, index: "EIBOR_3M" },
          { id: "c2", key: { employment: "SALARIED", ftvBand: "GT60" }, structure: "MARGIN_INDEX", margin: 2.5, index: "EIBOR_3M" },
        ]},
        fees: { valuation: 2500, preApproval: 1575, processingPct: 1 },
        affordability: { maxDBR: 50, ccPct: 5 },
      }),
      pv({
        version: 2, status: "RETIRED", source: "Mashreq Interim Policy Circular — proposed (withdrawn, replaced by Sept 2026 revision)",
        eligibility: { minSalary: 25000, maxLoan: 15000000, gates: [], notes: ["Withdrawn — replaced by the Sept 2026 revision (v3/v4)"] },
        grid: { cells: [] }, fees: {}, affordability: { maxDBR: 50 },
      }),
      pv({
        version: 3, status: "ACTIVE", effectiveFrom: d(0), source: "Sept 2026 revision — High-Risk Segment (effective immediately)",
        eligibility: {
          minSalary: 15000, maxLoan: 15000000,
          ltvMatrix: { "SALARIED": 80, "SELF_EMPLOYED": 70, "NON_RESIDENT": 50 },
          highRiskBands: [MASHREQ_HR_60, MASHREQ_HR_70],
          gates: [
            { id: "g1", kind: "FLAG", label: "NR buyout allowed", when: "NON_RESIDENT", hardStop: false },
          ],
          notes: MASHREQ_SEPT_NOTES,
        },
        grid: { cells: [
          { id: "c1", key: { employment: "SALARIED", ftvBand: "LE60" }, structure: "MARGIN_INDEX", margin: 2.25, index: "EIBOR_3M" },
          { id: "c2", key: { employment: "SALARIED", ftvBand: "GT60" }, structure: "MARGIN_INDEX", margin: 2.5, index: "EIBOR_3M" },
          { id: "c3", key: { employment: "SELF_EMPLOYED", ftvBand: "LE60" }, structure: "MARGIN_INDEX", margin: 2.75, index: "EIBOR_3M" },
          { id: "c4", key: { employment: "SELF_EMPLOYED", ftvBand: "GT60" }, structure: "MARGIN_INDEX", margin: 3.75, index: "EIBOR_3M" },
        ]},
        fees: { valuation: 2500, preApproval: 1575, processingPct: 1, note: "1% of loan amount for all transaction types" },
        affordability: { maxDBR: 50, ccPct: 5 },
      }),
      pv({
        version: 4, status: "SCHEDULED", effectiveFrom: "2026-09-01", source: "Sept 2026 revision — Non-Resident Segment (effective 1 Sept 2026)",
        eligibility: {
          minSalary: 15000, maxLoan: 15000000,
          ltvMatrix: { "SALARIED": 80, "SELF_EMPLOYED": 70, "NON_RESIDENT": 60 },
          highAmountThreshold: 5000000, ltvAboveThreshold: 50,   /* NR: ≤5M → 60%, >5M → 50% */
          multiPropertyRule: { minCount: 2, ltv: 50 },            /* >2 properties → 50% */
          statementMonths: 6,
          highRiskBands: [MASHREQ_HR_60, MASHREQ_HR_70],
          gates: [
            { id: "g1", kind: "FLAG", label: "NR minimum monthly income AED 40,000", when: "NON_RESIDENT", hardStop: true },
            { id: "g2", kind: "FLAG", label: "NR bank statements: latest 6 months; minimum-balance criterion met in ≥ 4 of last 6 months", when: "NON_RESIDENT", hardStop: false },
            { id: "g3", kind: "FLAG", label: "NR buyout allowed", when: "NON_RESIDENT", hardStop: false },
          ],
          notes: MASHREQ_NR_SEPT_NOTES,
        },
        grid: { cells: [
          { id: "c1", key: { employment: "SALARIED", ftvBand: "LE60" }, structure: "MARGIN_INDEX", margin: 2.25, index: "EIBOR_3M" },
          { id: "c2", key: { employment: "SALARIED", ftvBand: "GT60" }, structure: "MARGIN_INDEX", margin: 2.5, index: "EIBOR_3M" },
          { id: "c3", key: { employment: "SELF_EMPLOYED", ftvBand: "LE60" }, structure: "MARGIN_INDEX", margin: 2.75, index: "EIBOR_3M" },
          { id: "c4", key: { employment: "SELF_EMPLOYED", ftvBand: "GT60" }, structure: "MARGIN_INDEX", margin: 3.75, index: "EIBOR_3M" },
        ]},
        fees: { valuation: 2500, preApproval: 1575, processingPct: 1, note: "1% of loan amount for all transaction types" },
        affordability: { maxDBR: 50, ccPct: 5 },
      }),
    ],
  },
  {
    id: "pd-mash-res", bankId: "b-mashreq", name: "Home Finance — Residential", loanType: "CONVENTIONAL",
    classes: ["SALARIED", "SELF_EMPLOYED"], txTypes: ["PURCHASE", "BUYOUT", "BUYOUT_EQUITY"], axes: ["employment", "residency"],
    tags: ["Residential", "Interim policy scheduled"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [
      pv({
        version: 1, status: "ACTIVE", effectiveFrom: d(-60), source: "Mashreq current policy",
        eligibility: {
          minSalary: 15000, maxLoan: 15000000,
          ltvMatrix: { "SALARIED": 80, "SELF_EMPLOYED": 70, "NON_RESIDENT": 50 },
          gates: [
            { id: "c1", kind: "FLAG", label: "Current: max 4 properties", hardStop: false },
            { id: "c2", kind: "FLAG", label: "Current: high-risk — LTV capped 65%", hardStop: false },
            { id: "c3", kind: "FLAG", label: "Current: SE eligible for completed residential & commercial", when: "SELF_EMPLOYED", hardStop: false },
          ],
          notes: ["Current policy — see v2 (SCHEDULED) for the Interim Policy Proposed"],
        },
        tenure: { maxMonths: 300 },
        grid: { cells: [
          { id: "r1", key: { employment: "SALARIED", residency: "RESIDENT" }, structure: "MARGIN_INDEX", margin: 2.1, index: "EIBOR_3M" },
          { id: "r2", key: { employment: "SELF_EMPLOYED", residency: "RESIDENT" }, structure: "MARGIN_INDEX", margin: 2.6, index: "EIBOR_3M" },
          { id: "r3", key: { residency: "NON_RESIDENT" }, structure: "MARGIN_INDEX", margin: 2.9, index: "EIBOR_3M" },
        ]},
        fees: { processingPct: 1, valuation: 2500, preApproval: 1575, note: "1% of loan amount for all transaction types" },
        affordability: { maxDBR: 50, ccPct: 5 },
      }),
      pv({
        version: 2, status: "SCHEDULED", source: "Mashreq Interim Policy Circular — proposed",
        eligibility: {
          minSalary: 25000, maxLoan: 15000000,
          restrictedSectors: MASHREQ_HIGH_RISK_SECTORS,
          ltvMatrix: { "SALARIED": 80, "SELF_EMPLOYED": 70, "NON_RESIDENT": 55 },
          gates: mashreqInterimGates(false),
          notes: MASHREQ_INTERIM_NOTES,
        },
        tenure: { maxMonths: 300 },
        grid: { cells: [
          { id: "r1", key: { employment: "SALARIED", residency: "RESIDENT" }, structure: "MARGIN_INDEX", margin: 2.1, index: "EIBOR_3M" },
          { id: "r2", key: { employment: "SELF_EMPLOYED", residency: "RESIDENT" }, structure: "MARGIN_INDEX", margin: 2.6, index: "EIBOR_3M" },
          { id: "r3", key: { residency: "NON_RESIDENT" }, structure: "MARGIN_INDEX", margin: 2.9, index: "EIBOR_3M" },
        ]},
        fees: { processingPct: 1, valuation: 2500, preApproval: 1575, note: "1% of loan amount for all transaction types" },
        affordability: { maxDBR: 50, ccPct: 5 },
      }),
    ],
  },
  {
    /* ---------------- ADCB · Salaried (full sheet mapped) ---------------- */
    id: "pd-adcb-sal", bankId: "b-adcb", name: "Home Finance — Salaried", loanType: "BOTH",
    classes: ["SALARIED"], txTypes: ["PURCHASE", "BUYOUT", "BUYOUT_EQUITY", "EQUITY"],
    axes: ["segment", "tenure", "customerType"],
    tags: ["Salaried", "Segment-priced"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [pv({
      version: 1, status: "ACTIVE", effectiveFrom: d(-60), source: "ADCB salaried pricing card (Aug 2026)",
      eligibility: {
        minSalaryMatrix: { NATIONAL: 8000, EXPAT: 15000 },       /* joint borrowers 12k + 8k — note */
        minLoan: 250000, maxLoan: 24000000,
        ltvMatrix: { NATIONAL: 85, EXPAT: 80 },
        constructionLtv: 70,
        maxAgeSalaried: 70,
        minLosMonths: 3,                                          /* with confirmation + experience letter */
        coApplicantRule: "1 blood relation (no siblings) — Expat & Local",
        employerRequirements: { minYearsEstablished: 2, minEmployees: 50, profileForm: true, note: "Company well established, proper office, decent profile" },
        incomeRecognition: { rentalPct: 83, bonusPct: 50, commissionPct: 50 },
        restrictedSectors: ["Small Real Estate Companies", "Tourism", "Hotel"],
        gates: [
          { id: "a1", kind: "FLAG", label: "Bonuses counted only if company is listed + 2 yrs bonus history → 50% of average", hardStop: false },
          { id: "a2", kind: "FLAG", label: "Commission: lowest received in last 6 months considered", hardStop: false },
          { id: "a3", kind: "FLAG", label: "Total monthly debts must not exceed fixed salary", hardStop: false },
          { id: "a4", kind: "FLAG", label: "Rental income add-back 83% — up to primary income only", hardStop: false },
          { id: "a5", kind: "FLAG", label: "Hotel-apartment finance: Expats salaried only, self-occupancy declaration, Abu Dhabi & Dubai excl. remote areas", hardStop: false },
          { id: "a6", kind: "FLAG", label: "Russia & Belarus — basis compliance approval", hardStop: false },
          { id: "a7", kind: "FLAG", label: "Salary certificate must be within 30 days", hardStop: false },
        ],
        notes: [
          "Rental income: customer to provide undertaking for self-occupancy/investment, no sale during tenor.",
          "Emirates Airline staff: 50% of accommodation allowance; variable pay not considered; salary reference no. required.",
          "Sheikh Zayed Housing Program: linked to 1M EIBOR (SZHP_Zero −20%, SZHP_INT −20%).",
          "Dubai properties: registration based on Oqood applicable.",
          "No payment holidays. Non-spousal applicants: 1 blood relation (no siblings).",
          "Buyout: ADCB does not provide equity except on handover payment; B+E can settle another mortgage loan.",
          "Equity release: amount to purchase another property (3rd-party payment); residential only (villa/apartment/plot).",
        ],
      },
      tenure: { maxMonths: 300 },                                 /* 25 years */
      grid: { cells: [
        /* Private / Excellency / Emirati */
        { id: "p1", key: { segment: "PRIV", tenure: "1" }, structure: "FIXED_THEN_VAR", fixedRate: 4.99, fixedMonths: 12, followOn: { margin: 1.99, index: "EIBOR_3M" } },
        { id: "p3", key: { segment: "PRIV", tenure: "3" }, structure: "FIXED_THEN_VAR", fixedRate: 4.50, fixedMonths: 36, followOn: { margin: 2.25, index: "EIBOR_3M" } },
        { id: "p5", key: { segment: "PRIV", tenure: "5" }, structure: "FIXED_THEN_VAR", fixedRate: 4.50, fixedMonths: 60, followOn: { margin: 1.99, index: "EIBOR_3M" } },
        /* Aspire / Privilege */
        { id: "a1y", key: { segment: "ASPIRE", tenure: "1" }, structure: "FIXED_THEN_VAR", fixedRate: 4.99, fixedMonths: 12, followOn: { margin: 2.25, index: "EIBOR_3M" } },
        { id: "a3y", key: { segment: "ASPIRE", tenure: "3" }, structure: "FIXED_THEN_VAR", fixedRate: 4.74, fixedMonths: 36, followOn: { margin: 2.25, index: "EIBOR_3M" } },
        { id: "a5y", key: { segment: "ASPIRE", tenure: "5" }, structure: "FIXED_THEN_VAR", fixedRate: 4.74, fixedMonths: 60, followOn: { margin: 1.99, index: "EIBOR_3M" } },
        /* Home Saver */
        { id: "hs2", key: { segment: "HOMESAVER", tenure: "2" }, structure: "FIXED_THEN_VAR", fixedRate: 4.74, fixedMonths: 24, followOn: { margin: 2.99, index: "EIBOR_3M", floor: 6.5 }, note: "Floor rate 6.50%" },
        /* Fully variable — Day 1 */
        { id: "dv-priv", key: { segment: "PRIV", tenure: "1" }, structure: "VAR_DAY1", margin: 1.50, index: "EIBOR_3M", note: "Fully variable Day 1 (1M/3M both 1.50%)" },
        { id: "dv-asp", key: { segment: "ASPIRE", tenure: "1" }, structure: "VAR_DAY1", margin: 1.75, index: "EIBOR_3M" },
        { id: "dv-hs", key: { segment: "HOMESAVER", tenure: "1" }, structure: "VAR_DAY1", margin: 2.99, index: "EIBOR_3M", floor: 5 },
      ]},
      fees: {
        processingPct: 0.7875, valuation: 3150, preApproval: 0, vatPct: 5,
        earlySettlement: "1.05% of outstanding (incl. VAT) or AED 10,500, whichever lower",
        partialSettlement: "Free partial up to 30% of principal outstanding per year",
        lifeInsurancePct: 0.0184, lifeInsuranceNote: "p.m. on loan outstanding",
        propertyInsurancePct: 0.042, propertyInsuranceNote: "p.a. of property value",
        processingFeeTiers: [
          { label: "Standard", pct: 0.7875 },
          { label: "Golden Visa holders", pct: 0.5375 },
          { label: "Excellency", pct: 0.525 },
          { label: "Excellency + Golden Visa", pct: 0.275 },
        ],
        txOverrides: [
          { txType: "BUYOUT", processingPct: 0, valuationWaived: true, note: "Buyout promo — NIL processing & NIL valuation fees" },
          { txType: "EQUITY", processingPct: 0.75, note: "0.50% for Excellency" },
        ],
        feeFinancing: { allowed: true, pct: 6, basis: "DLD & broker fee" },
        employerDiscounts: [{ label: "Approved companies — 0.25% off fixed pricing", employers: ADCB_DISCOUNT_EMPLOYERS, bps: 25 }],
        note: "Stress test for DSR: follow-on margin + 3M EIBOR · floor 1.99%",
      },
      affordability: { maxDBR: 50, rentalPct: 83, bonusPct: 50 },
      documents: [
        { name: "Passport, Visa & EID (PDF)", required: true },
        { name: "Mortgage Referral Form", required: true },
        { name: "Salary Certificate (within 30 days)", required: true },
        { name: "Payslips — 6 months (only if pay varies)", required: false },
        { name: "Bank Statements — 6 months (E-statements)", required: true },
        { name: "Latest CC statement / liability statements", required: true },
        { name: "Confirmation + experience letter (LOS 3 months)", required: true },
        { name: "Company profile form", required: true },
      ],
      tat: {
        paDays: 3, valuationDays: 3, folDays: 3, totalDays: 17,
        paValidityDays: 30, folValidityDays: 60, valuationValidityDays: 30,
        accountOpeningDays: 1, disbursalDays: 5, transferDays: 2,
      },
    })],
  },
  {
    id: "pd-adib-nr", bankId: "b-adib", name: "NR Home Finance — Islamic", loanType: "ISLAMIC",
    classes: ["SALARIED", "SELF_EMPLOYED"], txTypes: ["PURCHASE", "BUYOUT"], axes: ["tenure", "employment"],
    tags: ["Non-Resident", "Islamic"], createdAt: ts(-60), createdBy: "hfmm-15",
    versions: [pv({
      version: 1, status: "ACTIVE", effectiveFrom: d(-60), source: "ADIB NR card",
      eligibility: {
        minSalary: 15000, minLoan: 250000, maxLoan: 5000000,
        maxAgeSalaried: 55, maxAgeSelfEmp: 60, ltvMatrix: { "NON_RESIDENT": 50 },
        gates: [
          { id: "g1", kind: "NATIONALITY_ALLOW", label: "GCC residents only (Bahrain, Kuwait, Oman, Saudi)", values: ["Bahrain", "Kuwait", "Oman", "Saudi"], hardStop: true },
          { id: "g2", kind: "FLAG", label: "NR holding a resident visa is not eligible as non-resident", when: "NON_RESIDENT", hardStop: false },
        ],
        notes: ["Docs to be translated; credit bureau from home country + UAE (valid 1 month)."],
      },
      tenure: { maxMonths: 300 },
      grid: { cells: [
        { id: "c1", key: { tenure: "3" }, structure: "FIXED_THEN_VAR", fixedRate: 4.69, fixedMonths: 36, followOn: { margin: 2.25, index: "EIBOR_1M", floor: 3.75 } },
        { id: "c2", key: { tenure: "5" }, structure: "FIXED_THEN_VAR", fixedRate: 5.19, fixedMonths: 60, followOn: { margin: 2.25, index: "EIBOR_1M", floor: 3.75 } },
      ]},
      fees: { processingPct: 0.5, valuation: 2625, earlySettlement: "1% or 10k, whichever lower" },
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
  { id: "promo-1", bankId: "b-adib", name: "HM Promotion — processing fee zero", from: d(-200), to: d(100), summary: "Zero processing fee on salaried home finance.", createdBy: "hfmm-15", createdAt: ts(-60) },
  { id: "promo-2", bankId: "b-cbd", name: "Aug–Sep pricing window", from: "2026-08-24", to: "2026-09-30", summary: "CBD updated mortgage pricing for applications in window.", createdBy: "hfmm-15", createdAt: ts(-60) },
  { id: "promo-3", bankId: "b-dib", name: "AUH Developers — Q window", from: d(-90), to: d(45), summary: "NSTL 3.95% fixed 3yr, zero processing fee.", createdBy: "hfmm-15", createdAt: ts(-60) },
];

/* ---------- global rules (versioned, TO VERIFY) ---------- */
const R = (r: Omit<Rule, "history"> & { history?: Rule["history"] }): Rule => ({ history: [{ version: r.version, value: r.value, effectiveFrom: r.effectiveFrom }], ...r });
const RULES: Rule[] = [
  R({ id: "r-ltv-n1", code: "LTV-NAT-1", module: "LTV", name: "National — 1st finance", kind: "pct", value: 85, scope: { customerType: "NATIONAL", financeCount: 1 }, version: 2, effectiveFrom: "2026-01-01", active: true, note: "TO VERIFY", history: [{ version: 1, value: 80, effectiveFrom: "2025-01-01" }, { version: 2, value: 85, effectiveFrom: "2026-01-01" }] }),
  R({ id: "r-ltv-e1", code: "LTV-EXP-1", module: "LTV", name: "Expat — 1st finance", kind: "pct", value: 80, scope: { customerType: "EXPAT", financeCount: 1 }, version: 2, effectiveFrom: "2026-01-01", active: true, note: "TO VERIFY" }),
  R({ id: "r-ltv-nr", code: "LTV-NR", module: "LTV", name: "Non-resident", kind: "pct", value: 50, scope: { customerType: "NON_RESIDENT" }, version: 1, effectiveFrom: "2026-01-01", active: true, note: "TO VERIFY" }),
  R({ id: "r-dbr", code: "DBR-MAX", module: "DBR", name: "DBR ceiling", kind: "pct", value: 50, scope: {}, version: 2, effectiveFrom: "2026-09-01", active: true, note: "Strictly below 50% — TO VERIFY", history: [{ version: 1, value: 55, effectiveFrom: "2025-01-01" }, { version: 2, value: 50, effectiveFrom: "2026-09-01" }] }),
  R({ id: "r-ret-n", code: "RETIRE-NAT", module: "RETIRE", name: "Retirement age — National", kind: "years", value: 70, scope: { customerType: "NATIONAL" }, version: 1, effectiveFrom: "2026-01-01", active: true }),
  R({ id: "r-ret-e", code: "RETIRE-EXP", module: "RETIRE", name: "Retirement age — Expat", kind: "years", value: 65, scope: { customerType: "EXPAT" }, version: 1, effectiveFrom: "2026-01-01", active: true }),
  R({ id: "r-ret-nr", code: "RETIRE-NR", module: "RETIRE", name: "Retirement age — Non-Resident", kind: "years", value: 65, scope: { customerType: "NON_RESIDENT" }, version: 1, effectiveFrom: "2026-01-01", active: true, note: "TO VERIFY" }),
  R({ id: "r-ret-dib-se", code: "RETIRE-DIB-SE", module: "RETIRE", name: "Retirement age — DIB Self-Employed", kind: "years", value: 70, scope: { bankId: "b-dib", employment: "SELF_EMPLOYED" }, version: 1, effectiveFrom: "2026-01-01", active: true, note: "Bank-specific: SE mature to 70 at DIB (overrides customer-type rule) — TO VERIFY" }),
  R({ id: "r-ten", code: "TENURE-MAX", module: "TENURE", name: "Max tenure", kind: "months", value: 300, scope: {}, version: 1, effectiveFrom: "2026-01-01", active: true }),
  R({ id: "r-cc", code: "CC-LIAB", module: "CC", name: "Credit card liability", kind: "pct", value: 5, scope: {}, version: 1, effectiveFrom: "2026-01-01", active: true, note: "Arab Bank 5% — TO VERIFY" }),
  R({ id: "r-stmt", code: "STMT-ADIB", module: "STMT", name: "Statement period — ADIB", kind: "months", value: 3, scope: { bankId: "b-adib" }, version: 1, effectiveFrom: "2026-01-01", active: true }),
  R({ id: "r-t1", code: "PREAPP-TAT", module: "TAT", name: "Pre-Approval expectation", kind: "number", value: 5, scope: {}, version: 1, effectiveFrom: "2026-01-01", active: true, note: "4–5 days, not a bank SLA" }),
];

/* ---------- EIBOR ---------- */
const EIBOR: EiborRow[] = [-9, -6, -3, -1, 0].map((o, i) => ({
  date: d(o), d1: 4.02 + i * 0.01, w1: 4.08 + i * 0.01, m1: 4.15 + i * 0.012, m3: 4.27 + i * 0.011, m6: 4.35 + i * 0.01, y1: 4.42 + i * 0.009,
  source: "Central Bank UAE", updatedBy: "hfmm-16",
}));

/* ---------- people (tracker-derived clients) ---------- */
let pn = 0;
const PERSON = (name: string, customerType: Person["customerType"], employment: Person["employment"], salary: number, nationality = "India", dob = "1988-04-12", over: Partial<Person> = {}): Person => ({
  id: "p" + ++pn, name, customerType, nationality, employment, dob, mobile: "+971 5" + (10000000 + pn * 137).toString().slice(0, 7),
  email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@mail.com", monthlySalary: salary, otherIncome: 0, financeCount: 1,
  cards: [], liabilities: [], createdAt: d(-30 - pn), ...over,
});
const PERSONS: Person[] = [
  PERSON("Dharpan Randhawa & Amanda", "EXPAT", "SALARIED", 45000, "India"),
  PERSON("Chandan Rajah", "EXPAT", "SALARIED", 60000, "India"),
  PERSON("Akram Chalich", "EXPAT", "SELF_EMPLOYED", 52000, "Egypt"),
  PERSON("Dina Khalid", "NATIONAL", "SALARIED", 60679, "UAE", "1973-08-22", {
    preferredName: "Dina", gender: "Female", maritalStatus: "Married", dependants: 2, countryOfBirth: "UAE",
    uaeResident: true, residencyStatus: "Citizen", eidNumber: "784-1973-0613762-7", passportNo: "AA0076779",
    emirate: "Abu Dhabi", jobTitle: "Senior Manager", sector: "Government", yearsEmployed: 7, salaryTransfer: true,
    basicSalary: 48000, allowances: 12679, aecbScore: 742, assignedTeam: "VRM2", assignedRm: "Adnan Mahmood", leadSource: "Referral",
  }),
  PERSON("Zeynap Erdogan", "EXPAT", "SALARIED", 38000, "Turkey"),
  PERSON("Parvez Ahmed", "EXPAT", "SALARIED", 42000, "Pakistan"),
  PERSON("Yash Pandya", "EXPAT", "SALARIED", 35000, "India"),
  PERSON("Anna Larina", "EXPAT", "SALARIED", 40000, "Russia"),
  PERSON("Ihab Abdulla Jawad", "EXPAT", "SELF_EMPLOYED", 70000, "Jordan", "1985-06-20", {
    businessName: "Jawad Trading LLC", businessActivity: "General Trading", lobYears: 5, losMonths: 48,
    companyOwnershipPct: 100, annualTurnover: 2400000, auditedFinancials: true, lowDoc: false,
    businessIncome: 70000, aecbScore: 690, salaryTransfer: false,
  }),
  PERSON("Ante Svagusa", "EXPAT", "SALARIED", 48000, "Croatia"),
  PERSON("Yasir Mohhumad", "EXPAT", "SALARIED", 33000, "Sri Lanka"),
  PERSON("Jumana Hytham Zin Aldin", "NATIONAL", "SALARIED", 55000, "UAE"),
  PERSON("Marc Robert Spitzer", "EXPAT", "SALARIED", 62000, "Germany"),
  PERSON("Stephen Geoff Fensham", "EXPAT", "SALARIED", 58000, "UK"),
  PERSON("Jigneshkumar Patel", "EXPAT", "SELF_EMPLOYED", 66000, "India"),
  PERSON("Walid Elrasoul", "EXPAT", "SALARIED", 37000, "Lebanon"),
  PERSON("Stanislav Boykov", "EXPAT", "SALARIED", 44000, "Bulgaria"),
  PERSON("Gonzalo Tatay Diaz & Carla Viti Munoz", "EXPAT", "SALARIED", 51000, "Spain"),
  PERSON("Bhavesh & Prerna Magnani", "EXPAT", "SALARIED", 47000, "India"),
  PERSON("Sona Rawal & Bhavesh Rawal", "EXPAT", "SALARIED", 39000, "India"),
  PERSON("Ediz Karahasanoglu", "EXPAT", "SELF_EMPLOYED", 72000, "Turkey"),
  PERSON("Yaghoub Hassan Pour", "EXPAT", "SALARIED", 56000, "Iran"),
  PERSON("Silvia Torres", "EXPAT", "SALARIED", 43000, "Spain"),
  PERSON("Qingie Yang", "EXPAT", "SALARIED", 50000, "China"),
  PERSON("Dr Rahat Ghazanfar", "EXPAT", "SELF_EMPLOYED", 85000, "Pakistan"),
  PERSON("Saurabh Jain", "EXPAT", "SALARIED", 36000, "India"),
  PERSON("Sumantra", "EXPAT", "SALARIED", 41000, "India"),
  PERSON("Chandan Marianathan Rajah", "EXPAT", "SALARIED", 46000, "India"),
  PERSON("Avinash Nagar", "EXPAT", "SALARIED", 53000, "India"),
  PERSON("Rona Nadeem", "EXPAT", "SALARIED", 34000, "Lebanon"),
  PERSON("Mohamed Hengazy I. Aboukhalil", "EXPAT", "SALARIED", 57000, "Egypt"),
  PERSON("Spencer Domingos Guiao", "EXPAT", "SALARIED", 30000, "Philippines"),
  PERSON("Saeed Shah", "EXPAT", "SELF_EMPLOYED", 78000, "Pakistan"),
  PERSON("Sangeeth Chemboth", "EXPAT", "SALARIED", 49000, "India"),
  PERSON("Ricardo Laborda", "EXPAT", "SALARIED", 54000, "Spain"),
  PERSON("Karolina Abbas Issa & Angie Abbas Issa", "EXPAT", "SALARIED", 61000, "Lebanon"),
  PERSON("Akram Shah", "EXPAT", "SELF_EMPLOYED", 68000, "Pakistan", "1990-02-14", {
    businessName: "Shah Contracting", businessActivity: "Construction / Contracting", lobYears: 1.5, losMonths: 14,
    companyOwnershipPct: 60, annualTurnover: 1100000, auditedFinancials: false, lowDoc: true,
    businessIncome: 68000, aecbScore: 615, sector: "Construction / Contracting", salaryTransfer: false,
  }),
  PERSON("Sheree Anne Serilla Sumpay", "EXPAT", "SALARIED", 32000, "Philippines"),
  PERSON("Andrei Umnov", "EXPAT", "SALARIED", 59000, "Russia"),
  PERSON("Zinah Alkatabi & Ihab Jawad", "EXPAT", "SALARIED", 64000, "Jordan"),
  PERSON("Hesham", "EXPAT", "SELF_EMPLOYED", 90000, "Egypt"),
];

/* ---------- cases (tracker-derived, spread across stages) ---------- */
let cn = 0;
const SPOS = ["hfmm-01", "hfmm-02", "hfmm-03", "hfmm-04", "hfmm-05", "hfmm-06"];
const CASE = (personIdx: number, bankId: string, stageId: string, opts: Partial<Case> = {}): Case => {
  cn++;
  const p = PERSONS[personIdx];
  const idx = STAGES.findIndex((s) => s.id === stageId);
  const prop = opts.propertyValue ?? 1500000 + (personIdx % 7) * 250000;
  const loan = opts.loanAmount ?? Math.floor(prop * 0.75);
  const owner = SPOS[personIdx % SPOS.length];
  return {
    id: "c" + (3000 + cn), ref: "HF-" + (3000 + cn), personId: p.id, ownerId: owner,
    bankId, txType: "PURCHASE", propertyValue: prop, loanAmount: loan, rate: 4.25, tenureMonths: 300,
    stage: stageId, status: "OPEN", expectedRevenue: Math.round(loan * 0.011),
    stageHistory: STAGES.slice(0, idx + 1).map((s, i) => ({ stageId: s.id, at: ts(-(idx - i + 1) * 3 - 2), by: owner })),
    triggerDates: { [stageId]: d(-(2 + (personIdx % 6))) },
    conditionsDone: {},
    tracker: [{ date: d(-(personIdx % 5)), note: "Following up with bank RM — awaiting revert on current stage." }],
    docs: STAGES.slice(0, idx + 1).flatMap((s) => s.docs.map((typeId, di) => ({
      id: `d${cn}-${s.id}-${di}`, typeId, stageId: s.id,
      status: (personIdx + di) % 4 === 0 && s.id === stageId ? "RECEIVED" : "VERIFIED",
      updatedAt: ts(-2), updatedBy: owner,
    }))),
    nextAction: STAGES[idx].tasks[0] ?? "Follow up", nextActionDue: d(1 + (personIdx % 3)),
    waitingFor: (personIdx % 3 === 0) ? "Bank" : undefined,
    createdAt: d(-14 - (personIdx % 10)),
    ...opts,
  };
};

const CASES: Case[] = [
  CASE(0, "b-adib", "TRANSFER", { deal: "Off Plan Handover", bankRm: "Eranga", channel: "Direct", waitingFor: "Developer", nextAction: "Chase title deed", propertyValue: 1770000, loanAmount: 1328445 }),
  CASE(1, "b-dib", "VALUATION", { deal: "Resale", bankRm: "Babar", channel: "Direct", propertyValue: 3960000 * 0.0 + 3300000, loanAmount: 2640000, waitingFor: "Client" }),
  CASE(2, "b-adib", "HANDOVER", { deal: "Docs pending", waitingFor: "Client" }),
  CASE(3, "b-dib", "FOL", { deal: "Resale", bankRm: "Babar", channel: "Direct", propertyValue: 2200000, loanAmount: 1650000, nextAction: "Confirm FOL terms with client", propertyValue2: undefined } as Partial<Case>),
  CASE(4, "b-hsbc", "HANDOVER", { deal: "On hold — handover late", waitingFor: "Developer" }),
  CASE(5, "b-dib", "FOL", { deal: "Resale Transaction", bankRm: "Babar", channel: "Direct", propertyValue: 1493000, loanAmount: 1120000 }),
  CASE(6, "b-dib", "HANDOVER", { deal: "Property not finalised", waitingFor: "Client" }),
  CASE(7, "b-rak", "TRANSFER", { deal: "Resale", bankRm: "Farukh", channel: "Prypco", propertyValue: 1504000, loanAmount: 1128000, nextAction: "Await mortgage release letter" }),
  CASE(8, "b-cbd", "VALUATION", { deal: "Resale", bankRm: "Santunu", channel: "Prypco", propertyValue: 4267000, loanAmount: 3200000 }),
  CASE(9, "b-dib", "PREAPP", { deal: "Buyout + Equity", bankRm: "Abdul", channel: "Direct", waitingFor: "Bank" }),
  CASE(10, "b-adib", "PREAPP", { deal: "Resale", bankRm: "Zaffar", channel: "Direct" }),
  CASE(11, "b-dib", "FOL", { deal: "Handover Payment", bankRm: "Raouf", channel: "Direct", propertyValue: 446000, loanAmount: 334920 }),
  CASE(12, "b-cbd", "VALUATION", { deal: "Resale", bankRm: "Burhan", channel: "Direct" }),
  CASE(13, "b-hsbc", "VALUATION", { deal: "Resale", bankRm: "Samiksha", channel: "Huspy", waitingFor: "Client" }),
  CASE(14, "b-mashreq", "VALUATION", { deal: "Buyout", bankRm: "Praveen", channel: "Huspy", propertyValue: 2100000, loanAmount: 1575000 }),
  CASE(15, "b-dib", "PREAPP", { deal: "Resale", bankRm: "Nawzat", channel: "Direct", waitingFor: "VRM" }),
  CASE(16, "b-rak", "VALUATION", { deal: "Buyout", bankRm: "Farukh", channel: "Prypco", waitingFor: "Client" }),
  CASE(17, "b-adib", "CLOSURE", { deal: "Won & closed", status: "OPEN" }),
  CASE(18, "b-dib", "VALUATION", { deal: "Buyout + Equity", bankRm: "Babar", channel: "Direct", propertyValue: 3413000, loanAmount: 2560000 }),
  CASE(19, "b-dib", "VALUATION", { deal: "Resale", bankRm: "Babar", channel: "Direct", waitingFor: "Client" }),
  CASE(20, "b-hsbc", "VALUATION", { deal: "Resale", bankRm: "Samiksha", channel: "Huspy" }),
  CASE(21, "b-adib", "PREAPP", { deal: "Resale", bankRm: "Ahmed", channel: "Direct", waitingFor: "Sir Kiran" }),
  CASE(22, "b-enbd", "BOOKING", { deal: "Resale", bankRm: "Tuba", channel: "Huspy" }),
  CASE(23, "b-dib", "CLOSURE", { deal: "Won & closed" }),
  CASE(24, "b-dib", "RELEASE", { deal: "Buyout", bankRm: "Raouf", channel: "Direct" }),
  CASE(25, "b-bob", "VALUATION", { deal: "Resale", bankRm: "Vikas", channel: "Direct", waitingFor: "Developer", nextAction: "Chase BCC report" }),
  CASE(26, "b-enbd", "CLOSURE", { deal: "Won & closed" }),
  CASE(27, "b-dib", "PREAPP", { deal: "Resale", bankRm: "Babar", channel: "Direct", waitingFor: "Client" }),
  CASE(28, "b-adib", "BOOKING", { deal: "Buyout + Equity", bankRm: "Ahmed", channel: "Direct", propertyValue: 3520000, loanAmount: 2640000, nextAction: "Await mortgage release letter" }),
  CASE(29, "b-adib", "FOL", { deal: "Resale Handover", bankRm: "Ahmed", channel: "Direct", propertyValue: 1429000, loanAmount: 1072000, waitingFor: "Seller" }),
  CASE(30, "b-adib", "BOOKING", { deal: "Handover Payment", bankRm: "Ahmed", channel: "Direct", propertyValue: 1600000, loanAmount: 1200000, nextAction: "Confirm settlement appointment" }),
  CASE(31, "b-dib", "FOL", { deal: "Resale Transaction", bankRm: "Abdul", channel: "Direct", propertyValue: 416000, loanAmount: 312000 }),
  CASE(32, "b-adib", "VALUATION", { deal: "Al Reef — Buyout + Equity", bankRm: "Ahmed", channel: "Direct", propertyValue: 1600000, loanAmount: 1200000, waitingFor: "Client", nextAction: "Collect valuation payment proof" }),
  CASE(33, "b-adib", "VALUATION", { deal: "Pure Buyout", bankRm: "Ahmed", channel: "Direct", propertyValue: 1080000, loanAmount: 810000, waitingFor: "Client" }),
  CASE(34, "b-adib", "FOL", { deal: "Buyout + Equity", bankRm: "Ahmed", channel: "Direct", propertyValue: 2773000, loanAmount: 2080000, waitingFor: "VRM" }),
  CASE(35, "b-dib", "FOL", { deal: "Resale Transaction", bankRm: "Abdul", channel: "Direct", propertyValue: 2200000, loanAmount: 1650000, nextAction: "Schedule FOL signing" }),
  CASE(36, "b-adib", "PREAPP", { deal: "Resale", bankRm: "Ahmed", channel: "Direct", waitingFor: "Bank" }),
  CASE(37, "b-dib", "PREAPP", { deal: "Resale — Al Reef 3 Bed", bankRm: "Abdul", channel: "Direct", propertyValue: 2080000, loanAmount: 1560000 }),
  CASE(38, "b-cbd", "PREAPP", { deal: "Resale", bankRm: "Santunu", channel: "Prypco", waitingFor: "Bank" }),
  CASE(39, "b-arab", "PREAPP", { deal: "Resale", bankRm: "Pradipta", channel: "Direct", waitingFor: "Client", nextAction: "Collect HRA credit proof" }),
  CASE(40, "b-dib", "SUBMIT", { deal: "Buyout + Equity — 20MM", bankRm: "Babar", channel: "Direct", propertyValue: 26667000, loanAmount: 12000000, waitingFor: "Client" }),
];

/* ---------- tasks & queries ---------- */
let tn = 0;
const TASK = (caseIdx: number, title: string, opts: Partial<Task> = {}): Task => {
  const c = CASES[caseIdx];
  return {
    id: "t" + ++tn, caseId: c.id, stageId: c.stage, title, ownerId: c.ownerId,
    priority: "MEDIUM", due: d(1 + (tn % 4)), status: "OPEN", createdAt: ts(-3), ...opts,
  };
};
const TASKS: Task[] = [
  TASK(0, "Chase title deed from developer", { priority: "HIGH", due: d(-1) }),
  TASK(1, "Collect valuation fee proof", { due: d(0) }),
  TASK(3, "Confirm FOL terms with client", { priority: "HIGH" }),
  TASK(5, "Request FOL from bank", {}),
  TASK(7, "Follow up mortgage release letter", { priority: "HIGH", due: d(-2) }),
  TASK(8, "Schedule valuation inspection", {}),
  TASK(11, "Follow up pre-approval status", {}),
  TASK(14, "Coordinate valuation appointment", { due: d(1) }),
  TASK(18, "Collect valuation payment proof", { priority: "HIGH", due: d(0) }),
  TASK(25, "Chase BCC report from developer", { waitingFor: "Developer", due: d(-1), priority: "HIGH" }),
  TASK(28, "Confirm settlement appointment with bank", { priority: "HIGH" }),
  TASK(30, "Prepare manager's cheque", { due: d(2) }),
  TASK(32, "Collect valuation payment proof", { waitingFor: "Client", priority: "HIGH", due: d(0) }),
  TASK(35, "Schedule FOL signing", { due: d(3) }),
  TASK(39, "Collect HRA AED 150,000 credit proof", { waitingFor: "Client", priority: "HIGH", due: d(-1) }),
  TASK(40, "Collect client financials for 20MM facility", { waitingFor: "Client" }),
];
let qn = 0;
const QUERY = (caseIdx: number, requirement: string, opts: Partial<BankQuery> = {}): BankQuery => {
  const c = CASES[caseIdx];
  return {
    id: "q" + ++qn, caseId: c.id, ref: "BQ-" + (100 + qn), bankId: c.bankId, requirement,
    ownerId: c.ownerId, receivedAt: ts(-2), due: d(1), status: "OPEN", ...opts,
  };
};
const QUERIES: BankQuery[] = [
  QUERY(15, "Provide clarification on salary credit variance", { actionPoints: undefined } as Partial<BankQuery>),
  QUERY(21, "Explain overdue facility flagged on profile", { due: d(-1) }),
  QUERY(36, "Submit updated bank statements", {}),
  QUERY(38, "Provide tenancy income evidence", {}),
  QUERY(39, "HRA AED 150,000 — credit proof in statement", { due: d(-1) }),
];

/* ---------- leads ---------- */
let ln = 0;
const LEAD = (personIdx: number, status: Lead["status"], owner: string, opts: Partial<Lead> = {}): Lead => {
  ln++;
  return {
    id: "l" + (2000 + ln), ref: "L-" + (2000 + ln), personId: PERSONS[personIdx].id,
    source: ["Referral", "Bank Partner", "Walk-in", "Existing Client", "Huspy", "Online"][personIdx % 6],
    type: "PURCHASE", status, owner, propertyValue: 1600000 + (personIdx % 5) * 300000,
    nextAction: "First contact call", due: d(2 + (personIdx % 3)), createdAt: d(-(personIdx % 12)), ...opts,
  };
};
const VRMS = ["hfmm-07", "hfmm-08", "hfmm-09", "hfmm-10", "hfmm-11", "hfmm-13"];
const LEADS: Lead[] = [
  LEAD(0, "CONVERTED", VRMS[0], { nextAction: undefined, due: undefined, notes: `Converted to ${CASES[0].ref}` }),
  LEAD(1, "CONVERTED", VRMS[1], { nextAction: undefined, due: undefined, notes: `Converted to ${CASES[1].ref}` }),
  LEAD(3, "CONVERTED", VRMS[2], { nextAction: undefined, due: undefined, notes: `Converted to ${CASES[3].ref}` }),
  LEAD(8, "CONVERTED", VRMS[3], { nextAction: undefined, due: undefined, notes: `Converted to ${CASES[8].ref}` }),
  LEAD(14, "QUALIFIED", VRMS[0]),
  LEAD(20, "APPOINTMENT", VRMS[1]),
  LEAD(25, "NEW", VRMS[2]),
  LEAD(30, "CONTACTED", VRMS[3]),
  LEAD(34, "PROPOSAL", VRMS[4]),
  LEAD(38, "NEW", VRMS[5]),
  LEAD(40, "QUALIFIED", VRMS[0]),
];

/* ---------- email templates ---------- */
const TEMPLATES: EmailTemplate[] = [
  { id: "tpl-1", name: "Direct Bank Submission", purpose: "Send complete file to bank RM", subject: "Pre-Approval Submission – [Client Name] – [Bank]", body: "Dear [Bank RM],\n\nPlease find attached the complete documents and required bank forms for the Pre-Approval of [Client Name]. Kindly confirm receipt and proceed with the review.\n\nRegards,\n[Name]\nHFMC", tags: ["submission", "pre-approval"], source: "Guide Book §127.1" },
  { id: "tpl-2", name: "Huspy Submission to Areeb", purpose: "Confirm portal submission", subject: "Huspy Submission – [Client Name] – [Bank]", body: "Dear Areeb,\n\nWe have submitted the file for [Client Name] on the Huspy portal for [Bank]. Screenshot of the final step attached.\n\nRegards,\n[Name]", tags: ["huspy", "submission"], source: "Guide Book §127.3" },
  { id: "tpl-3", name: "Bank Query Response", purpose: "Answer a bank query", subject: "Re: Bank Query – [Client Name] – [Reference]", body: "Dear [Bank RM],\n\nPlease find attached the requested document/clarification.\n\nQuery: [Brief query]\nResponse: [Explanation]\n\nKindly confirm if the query is resolved.\n\nRegards,\n[Name]", tags: ["query"], source: "Guide Book §127.4" },
  { id: "tpl-4", name: "Client FOL Confirmation", purpose: "Confirm FOL terms with client", subject: "FOL Terms Confirmation – [Client Name]", body: "Dear [Client],\n\nPlease confirm the final terms: Finance amount [AED], Tenor [yrs], ROI [%], EMI [AED], Life & Property insurance.\n\nReply to confirm so we may request the FOL.\n\nRegards,\n[Name]\nHFMC", tags: ["fol", "client"], source: "Guide Book Batch 5" },
  { id: "tpl-5", name: "Level 1 Escalation", purpose: "Stage overdue — notify Team Leader", subject: "[Level 1] Stage Overdue — [Client Name] / [Bank]", body: "Dear Team,\n\nPlease note the [Stage] stage for [Client Name] is now 1 day past its target deadline. Requesting urgent follow-up.\n\nRegards,\nHFMC Mortgage Operations", tags: ["escalation"], source: "TAT Escalation Matrix" },
];

/* ---------- Decision Engine seeds ---------- */
const baseProfile = {
  nationality: "India", customerType: "EXPAT" as const, residency: "RESIDENT" as const,
  employment: "SALARIED" as const, propertyType: "RESIDENTIAL" as const, emirate: "DUBAI",
  sector: "Trading", yearsEmployed: 4, otherIncome: 0, creditCardLimits: 20000, financeCount: 1 as const,
};
const WEIGHTING_PROFILES: WeightingProfile[] = [
  { id: "wp-balanced", name: "Balanced", weights: { finance: 30, rate: 25, ltv: 20, fees: 15, tat: 10 } },
  { id: "wp-cheapest", name: "Lowest rate", weights: { finance: 15, rate: 50, ltv: 10, fees: 15, tat: 10 } },
  { id: "wp-maxfinance", name: "Highest finance", weights: { finance: 55, rate: 10, ltv: 20, fees: 10, tat: 5 } },
  { id: "wp-fastest", name: "Fastest TAT", weights: { finance: 20, rate: 15, ltv: 15, fees: 10, tat: 40 } },
];
const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "golden-1", name: "Strong salaried expat — eligible broadly",
    client: { ...baseProfile, name: "Golden · Salaried 40k", age: 34, monthlyIncome: 40000, monthlyLiabilities: 3000, propertyValue: 1500000, loanRequested: 1100000 },
    expected: [
      { productDefId: "pd-dib-res", verdict: "ELIGIBLE" },
      { productDefId: "pd-cbd-res", verdict: "ELIGIBLE" },
      { productDefId: "pd-enbd-res", verdict: "ELIGIBLE" },
    ],
    note: "Clean profile — should pass residential products.",
  },
  {
    id: "golden-2", name: "Self-employed — ENBD refers (product gate)",
    client: { ...baseProfile, name: "Golden · Self-employed", employment: "SELF_EMPLOYED" as const, age: 38, monthlyIncome: 55000, monthlyLiabilities: 5000, propertyValue: 2000000, loanRequested: 1400000 },
    expected: [
      { productDefId: "pd-enbd-res", verdict: "NOT_ELIGIBLE" },
      { productDefId: "pd-dib-res", verdict: "ELIGIBLE" },
    ],
    note: "ENBD residential is salaried-only → gate blocks SE.",
  },
  {
    id: "golden-3", name: "Over-leveraged — DBR ceiling bites",
    client: { ...baseProfile, name: "Golden · High liabilities", age: 41, monthlyIncome: 25000, monthlyLiabilities: 11000, creditCardLimits: 60000, propertyValue: 1200000, loanRequested: 900000 },
    expected: [{ productDefId: "pd-dib-res", verdict: "REFER" }],
    note: "Existing obligations leave little DBR headroom → refer, not a clean yes.",
  },
  {
    id: "golden-4", name: "Iranian national — high-risk band caps LTV, does not block",
    client: { ...baseProfile, name: "Golden · Iranian buyout", nationality: "Iranian", age: 36, monthlyIncome: 50000, monthlyLiabilities: 4000, propertyValue: 2000000, loanRequested: 1100000 },
    expected: [{ productDefId: "pd-mash-buyout", verdict: "ELIGIBLE" }],
    note: "60% high-risk band caps finance to 1.2M — still above the 1.1M request, so ELIGIBLE (cap ≠ block).",
  },
  {
    id: "golden-5", name: "Real-estate sector + top developer — exempt from risk band",
    client: { ...baseProfile, name: "Golden · Emaar RE", sector: "Real Estate / Developers", developer: "Emaar PJSC", age: 35, monthlyIncome: 50000, monthlyLiabilities: 4000, propertyValue: 2000000, loanRequested: 1500000 },
    expected: [{ productDefId: "pd-mash-buyout", verdict: "ELIGIBLE" }],
    note: "Emaar is on the approved top-developer list → standard 80% LTV (1.6M) applies, not the 60% band.",
  },
  {
    id: "golden-6", name: "Multi-property (>2) — LTV restricted to 50%",
    client: { ...baseProfile, name: "Golden · 3 properties", customerType: "NON_RESIDENT" as const, residency: "NON_RESIDENT" as const, propertiesOwned: 3, age: 40, monthlyIncome: 60000, monthlyLiabilities: 5000, propertyValue: 2000000, loanRequested: 900000 },
    expected: [{ productDefId: "pd-mash-buyout", verdict: "ELIGIBLE" }],
    note: "Mashreq v4 NR: >2 properties (AECB/internal) caps LTV at 50%.",
  },
  {
    id: "golden-7", name: "ADCB — ADNOC employee gets 0.25% employer discount",
    client: { ...baseProfile, name: "Golden · ADNOC salaried", customerType: "EXPAT" as const, employer: "ADNOC", segment: "PRIV", preferredFixedYears: 3, age: 33, monthlyIncome: 45000, monthlyLiabilities: 4000, propertyValue: 2000000, loanRequested: 1400000 },
    expected: [{ productDefId: "pd-adcb-sal", verdict: "ELIGIBLE" }],
    note: "ADCB salaried: Private segment 3yr fixed 4.50%, minus 0.25% employer discount (ADNOC) → 4.25%.",
  },
];

export const TRACKER_DATES = [-5, -4, -3, -2, -1, 0].map((o) => d(o));

/* ---------- users (real HFMC roster) ---------- */
const USERS: User[] = [
  SUPER_ADMIN,
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
];

export function buildSeed(): AppState {
  return {
    version: SEED_VERSION, session: null,
    users: USERS, persons: PERSONS, leads: LEADS,
    banks: BANKS, stages: STAGES,
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
    cases: CASES, tasks: TASKS, queries: QUERIES, rules: RULES, eibor: EIBOR, calcs: [], templates: TEMPLATES,
    trackerDates: TRACKER_DATES, axes: AXES, productDefs: PRODUCT_DEFS, promos: PROMOS,
    weightingProfiles: WEIGHTING_PROFILES, decisionSnapshots: [], goldenCases: GOLDEN_CASES,
    topDevelopers: TOP_DEVELOPERS,
    audit: [
      { id: "a0", at: ts(-0.05), by: "hfmm-15", module: "RULE", action: "Policy revised", target: "Mashreq — Sept 2026 revision", detail: "High-risk bands (60%/70%) effective immediately + top-developer exemption; NR segment scheduled 1 Sept 2026" },
      { id: "a-adcb", at: ts(-0.02), by: "hfmm-00", module: "IMPORT", action: "Bank sheet mapped", target: "ADCB · Home Finance — Salaried (pd-adcb-sal v1)", detail: "Segment pricing (Priv/Aspire/Home Saver) + fixed-term grid, employer discount −0.25%, fee tiers, 9-field TAT" },
      { id: "a1", at: ts(-0.1), by: "hfmm-00", module: "IMPORT", action: "Tracker imported", target: `${CASES.length} case files from daily tracker` },
      { id: "a2", at: ts(-0.3), by: "hfmm-06", module: "CASE", action: "Daily tracker updated", target: CASES[0]?.ref ?? "", detail: "Chasing title deed from developer", caseId: CASES[0]?.id },
      { id: "a3", at: ts(-1), by: "hfmm-15", module: "RULE", action: "Rule updated", target: "DBR-MAX v1 → v2 (55% → 50%)", detail: "Strictly below 50% — TO VERIFY" },
    ],
  };
}
