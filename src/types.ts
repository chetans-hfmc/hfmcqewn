/* ============================================================
   HFMC Mortgage Operating System — domain model
   ============================================================ */
export type RoleId = "ADMIN" | "HEAD" | "TL" | "SPO" | "VRM" | "PA" | "TBD";

export interface User {
  id: string; empId: string; name: string; email: string; mobile: string;
  role: RoleId; team: string; leaderId?: string; active: boolean; createdAt: string; note?: string;
}

export type CustomerType = "NATIONAL" | "EXPAT" | "NON_RESIDENT";
export type Employment = "SALARIED" | "SELF_EMPLOYED";
export type TxType = "PURCHASE" | "RESALE" | "BUYOUT" | "BUYOUT_EQUITY" | "EQUITY" | "REFINANCE" | "TOPUP";
export type LeadStatus = "NEW" | "CONTACTED" | "APPOINTMENT" | "QUALIFIED" | "PROPOSAL" | "CONVERTED" | "LOST";

/* Person — exhaustive client profile across the agreed field groups.
   Legacy fields (monthlySalary/otherIncome) remain the canonical income
   totals; the breakdown below feeds income-recognition rules. */
export interface Person {
  id: string; name: string; customerType: CustomerType; nationality: string;
  employment: Employment; dob: string; mobile: string; email: string; employer?: string;
  monthlySalary: number; otherIncome: number; financeCount: 1 | 2;
  cards: { bank: string; limit: number }[];
  liabilities: { type: string; monthly: number }[];
  createdAt: string;

  /* Customer group */
  preferredName?: string; gender?: string; maritalStatus?: string; dependants?: number;
  countryOfBirth?: string; goldenVisa?: boolean;
  propertiesOwned?: number; developer?: string;   /* for high-risk / top-developer rules */
  existingLoanRate?: number;                      /* customer's current loan rate — top-up pricing scenarios */
  relationship?: "ETB" | "NTB";                   /* existing-to-bank vs new-to-bank */

  /* Contact */
  altMobile?: string; whatsapp?: string;

  /* Residency & Visa group */
  uaeResident?: boolean; residencyStatus?: string; visaType?: string; visaExpiry?: string;
  eidNumber?: string; eidExpiry?: string; passportNo?: string; passportExpiry?: string;
  emirate?: string; currentAddress?: string;

  /* Employment group */
  jobTitle?: string; sector?: string; yearsEmployed?: number; workLocation?: string;
  hrName?: string; hrPhone?: string; salaryTransfer?: boolean;          /* STL / NSTL */
  /* Self-employed specifics */
  businessName?: string; businessActivity?: string;
  lobYears?: number;                  /* length of business */
  losMonths?: number;                 /* length of service in business */
  companyOwnershipPct?: number; annualTurnover?: number; auditedFinancials?: boolean; lowDoc?: boolean;

  /* Income group (breakdown) */
  basicSalary?: number; allowances?: number; commission?: number; bonus?: number;
  rentalIncome?: number; businessIncome?: number;

  /* Credit group */
  aecbScore?: number; negativeBureau?: boolean; homeCountryLiabilitiesMonthly?: number;
  creditScoreBand?: string;

  /* Assignment & registration */
  assignedTeam?: string; assignedRm?: string; dateRegistered?: string; leadSource?: string;
  primaryAccountBank?: string;
}

export interface Lead {
  id: string; ref: string; personId: string; source: string; type: TxType;
  status: LeadStatus; owner: string; bankId?: string; propertyValue?: number;
  nextAction?: string; due?: string; notes?: string; createdAt: string;
}

export interface Bank { id: string; name: string; short: string; }
export interface StageDef { id: string; name: string; short: string; sla: number; docs: string[]; tasks: string[]; conditions: string[]; tatNote?: string; }

export type DocStatus = "MISSING" | "RECEIVED" | "VERIFIED" | "REJECTED" | "NA";
export interface DocItem { id: string; typeId: string; stageId: string; status: DocStatus; updatedAt: string; updatedBy: string; }

export type HandoffKind = "progression" | "absence" | "rebalance" | "correction";
export interface Handoff { at: string; fromId: string; toId: string; reason: string; kind: HandoffKind; }

export interface Case {
  id: string; ref: string; personId: string; ownerId: string;
  bankId: string; txType: TxType; deal?: string; bankRm?: string; channel?: string; outcome?: "WON" | "LOST";
  tracker?: { date: string; note: string }[];
  triggerDates?: Record<string, string>;
  conditionsDone?: Record<string, boolean>;
  caseNotes?: { id: string; at: string; by: string; text: string }[];
  handoffs?: Handoff[];
  propertyValue: number; loanAmount: number; rate: number; tenureMonths: number;
  stage: string; status: "OPEN" | "CLOSED";
  stageHistory: { stageId: string; at: string; by: string }[];
  nextAction?: string; nextActionDue?: string; waitingFor?: string; pendingReason?: string; blocker?: string;
  expectedRevenue: number; docs: DocItem[]; createdAt: string; closedAt?: string;
}

export interface Task {
  id: string; caseId: string; stageId: string; title: string; ownerId: string;
  priority: "HIGH" | "MEDIUM" | "LOW"; due?: string; status: "OPEN" | "DONE";
  waitingFor?: string; createdAt: string; completedAt?: string; completedBy?: string; estimateMinutes?: number;
}

export interface BankQuery {
  id: string; caseId: string; ref: string; bankId: string; requirement: string;
  ownerId: string; receivedAt: string; due?: string; response?: string; status: "OPEN" | "RESPONDED" | "CLOSED";
}

export type RuleModule = "LTV" | "DBR" | "RETIRE" | "TENURE" | "CC" | "MIN_SAL" | "FEE" | "STMT" | "TAT";
export interface Rule {
  id: string; code: string; module: RuleModule; name: string;
  scope: { bankId?: string; customerType?: CustomerType; employment?: Employment; financeCount?: 1 | 2 };
  kind: "pct" | "months" | "years" | "amount" | "number";
  value: number; version: number; effectiveFrom: string; active: boolean; note?: string;
  history: { version: number; value: number; effectiveFrom: string }[];
}

export interface EiborRow { date: string; d1: number; w1: number; m1: number; m3: number; m6: number; y1: number; source: string; updatedBy: string; }

export interface CalcRecord {
  id: string; type: string; label: string; linkKind?: "case" | "lead" | "person"; linkId?: string;
  inputs: Record<string, unknown>; outputs: Record<string, unknown>;
  rulesUsed: { code: string; version: number }[]; by: string; at: string;
}

export interface AuditEntry { id: string; at: string; by: string; module: string; action: string; target: string; detail?: string; caseId?: string; }
export interface EmailTemplate { id: string; name: string; purpose: string; subject: string; body: string; tags: string[]; source: string; }

/* ---------- Bank Rule Engine ---------- */
export interface AxisDef { id: string; name: string; values: { v: string; l: string }[]; }
export type RateIndex = "EIBOR_1M" | "EIBOR_3M" | "EIBOR_6M" | "EIBOR_1Y" | "SCBLR";
export type RateStructure = "FIXED" | "MARGIN_INDEX" | "FIXED_THEN_VAR" | "VAR_DAY1";
export interface RateCell {
  id: string; key: Record<string, string>; structure: RateStructure;
  fixedRate?: number; fixedMonths?: number; margin?: number; index?: RateIndex; floor?: number;
  followOn?: { margin: number; index: RateIndex; floor?: number };
  stressRate?: number;   /* bank-published stress rate for DSR (e.g. Arab Bank per-cell stress grid) */
  note?: string;
}
export interface EligGate {
  id: string; kind: "NATIONALITY_ALLOW" | "NATIONALITY_BLOCK" | "FLAG" | "EMPLOYMENT_BLOCK";
  label: string; values?: string[]; hardStop: boolean; when?: string;
}
/* Nationality / sector risk band — the strictest matching band wins.
   topDeveloperExempt: a real-estate sector is NOT high-risk when the developer
   is on the bank's approved top-developer list. */
export interface HighRiskBand {
  ltv: number;
  nationalities?: string[];
  sectors: string[];               /* display names from the circular */
  sectorKeywords?: string[];       /* matching tokens against client.sector (case-insensitive) */
  topDeveloperExempt?: boolean;
}
export interface ProductVersion {
  version: number; status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "RETIRED";
  effectiveFrom?: string; source?: string; createdAt: string;
  eligibility: {
    minSalary?: number; minLoan?: number; maxLoan?: number;
    /* RAKBANK-style: max loan as a multiple of annual income, per customer type
       (e.g. NATIONAL ×8, EXPAT ×7), capped by maxLoan. */
    maxLoanIncomeMultiple?: Record<string, number>;
    /* Keys tried in order: customerType → residency → STL/NSTL (salary transfer) → employment. */
    minSalaryMatrix?: Record<string, number>;  /* e.g. NATIONAL 8K / EXPAT 15K · or · STL 10K / NSTL 15K */
    maxAgeSalaried?: number; maxAgeSelfEmp?: number; maxLoanByNationality?: Record<string, number>;
    ltvMatrix?: Record<string, number>; restrictedSectors?: string[]; gates: EligGate[]; notes?: string[];
    constructionLtv?: number;                  /* LTV cap for under-construction / off-plan finance */
    landLtv?: number;                          /* LTV cap for land purchase */
    commercialLtv?: number;                    /* LTV cap for commercial property (e.g. DIB shops 62%) */
    maxUnits?: number;                         /* max loan = amount cap OR n units, whichever lower */
    paymentHoliday?: string;                   /* e.g. "STL up to 6 months · NSTL up to 3 months" */
    coApplicantRule?: string;                  /* e.g. "1 blood relation (no siblings)" */
    employerRequirements?: { minYearsEstablished?: number; minEmployees?: number; profileForm?: boolean; note?: string };

    /* Credit-group rules */
    minAecb?: number;                          /* minimum bureau score */
    negativeBureauBlock?: boolean;             /* hard-stop on negative bureau */

    /* Self-employed LOB / LOS rules (computed, not just notes) */
    minLobYears?: number;                      /* minimum length of business */
    minLosMonths?: number;                     /* minimum length of service */
    level3Threshold?: { lobYears: number; losMonths: number };  /* at/above → Level 3 approval (REFER) */

    /* Property-group rules */
    investmentLtv?: number;                    /* LTV cap for investment property */
    secondPropertyLtv?: number;                /* LTV cap for 2nd/subsequent property */
    highAmountThreshold?: number;              /* loan amount above which LTV tightens */
    ltvAboveThreshold?: number;                /* LTV applied above the threshold */
    statementMonths?: number;                  /* required personal bank-statement months */
    multiPropertyRule?: { minCount: number; ltv: number }; /* > minCount properties (AECB/internal) → LTV cap */
    highRiskBands?: HighRiskBand[];            /* nationality/sector risk bands, strictest match wins */
    /* Property-value-banded LTV (CBD: salaried ≤5M→75 / 5–7M→70 / >7M→65; SE ≤5M→70 / >5M→60).
       Bands are evaluated low→high; the first band with eligibleValue ≤ upTo wins.
       An optional employment scopes the band set to that employment type. */
    ltvBands?: { employment?: string; upTo: number; ltv: number }[];
    ltvByEmirate?: Record<string, number>;     /* emirate-conditional LTV (e.g. NR Dubai 60 / Abu Dhabi 50) */

    /* Income-recognition rules (% of each component counted) */
    incomeRecognition?: { basicPct?: number; allowancePct?: number; commissionPct?: number; bonusPct?: number; rentalPct?: number; businessPct?: number };
    variableIncomeCapPct?: number;             /* variable income may not exceed fixed income */
    salaryTransferRequired?: boolean;          /* must client transfer salary to the bank? */
    leaseholdAllowed?: boolean;                /* false → bank cannot finance leasehold (e.g. Emirates Islamic) */
  };
  tenure: { maxMonths?: number; minMonths?: number; note?: string };
  grid: { cells: RateCell[] };
  fees: {
    processingPct?: number; processingMin?: number; processingMax?: number; valuation?: number; preApproval?: number;
    earlySettlement?: string; note?: string;
    ltvDiscounts?: { maxLtv: number; bps: number; label?: string }[];   /* rate discount when LTV at/below threshold */
    valuationByEmirate?: Record<string, number>;   /* e.g. AJMAN: 3500 vs default 3000 */
    lifeAssignmentFee?: number;                    /* one-time life-insurance assignment fee */
    /* Insurance basis: banks quote per-month (PM) or per-annum (PA). Matters for EMI/DBR math. */
    lifeInsuranceBasis?: "PM" | "PA"; propertyInsuranceBasis?: "PM" | "PA";
    vatPct?: number; arrangementFee?: string; partialSettlement?: string;
    lifeInsurancePct?: number; lifeInsuranceNote?: string; propertyInsurancePct?: number; propertyInsuranceNote?: string;
    processingFeeTiers?: { label: string; pct: number }[];          /* segment/visa-based tiers */
    txOverrides?: { txType: TxType; processingPct?: number; valuationWaived?: boolean; note?: string }[];
    feeFinancing?: { allowed: boolean; pct?: number; basis?: string };  /* e.g. 6% DLD & broker fee */
    employerDiscounts?: { label: string; employers: string[]; bps: number }[];  /* rate discount for listed employers */
    /* Generic conditional rate adjustments — positive bps = surcharge, negative = discount.
       All present conditions must match (AND). Generalizes refinance +10bps, >10M +75bps, etc. */
    rateAdjustments?: { id: string; label: string; bps: number; txTypes?: TxType[]; employment?: string; loanGt?: number; loanLt?: number; ltvGt?: number; ageGt?: number; lowDoc?: boolean; financeCount?: number }[];
  };
  affordability: { maxDBR?: number; ccPct?: number; rentalPct?: number; bonusPct?: number; commissionPct?: number;
    dbrIncludesInsurance?: boolean;  /* e.g. DIB adds life-insurance cost to the EMI in the DBR calc */
    stressAddPct?: number;           /* formula-based stress: stress = indicative rate + X (e.g. Emirates Islamic "+2%") */
    stressRecipe?: { margin: number; index: RateIndex };  /* margin-based stress: stress = margin + index (e.g. ENBD "1.79% + 1M EIBOR") */
  };
  documents: { name: string; required: boolean; note?: string }[];
  tat: {
    paDays?: number; valuationDays?: number; folDays?: number; totalDays?: number;
    paValidityDays?: number; folValidityDays?: number; valuationValidityDays?: number;
    accountOpeningDays?: number; disbursalDays?: number; transferDays?: number;
  };
}
export interface ProductDef {
  id: string; bankId: string; name: string; loanType: "ISLAMIC" | "CONVENTIONAL" | "BOTH";
  classes: string[]; txTypes: TxType[]; axes: string[]; tags?: string[];
  versions: ProductVersion[]; createdAt: string; createdBy: string;
}
export interface Promo { id: string; bankId?: string; name: string; from: string; to?: string; summary: string; createdBy: string; createdAt: string; }

/* ---------- Decision Engine: Verdict + Findings contract ---------- */
export type Verdict = "ELIGIBLE" | "ELIGIBLE_WITH_CONDITIONS" | "REFER" | "NOT_ELIGIBLE" | "UNKNOWN";
export type FindingSeverity = "BLOCK" | "WARN" | "INFO" | "APPLIED";
export type FindingCategory = "eligibility" | "financing" | "affordability" | "tenure" | "pricing" | "fees" | "condition";

export interface Finding {
  code: string; severity: FindingSeverity; category: FindingCategory; message: string;
  ruleId?: string; ruleVersion?: number; source?: string;
  previousValue?: string; resultingValue?: string; explanation?: string;
}
export interface Remediation {
  field: "loanAmount" | "tenureMonths" | "income" | "liabilities" | "downPayment" | "bank";
  current: string; required: string; delta?: string; message: string; effort: 1 | 2 | 3;
}

export type RuleSource = "EXCEPTION" | "PRODUCT" | "BANK" | "GLOBAL";
export interface RuleCandidate {
  source: RuleSource; refId: string; refLabel: string; value: number;
  tier: number;            /* EXCEPTION=4 · PRODUCT=3 · BANK=2 · GLOBAL=1 */
  axesMatched: number;     /* specificity */
  priority: number;        /* explicit; >0 must carry justification */
  justification?: string; effectiveFrom?: string; version?: number;
}
export interface Resolution { winner: RuleCandidate; overridden: (RuleCandidate & { reason: string })[]; }

export interface ProductDecision {
  productDefId: string; bankId: string; productName: string; productVersion: number;
  verdict: Verdict; eligibleAmount: number; ltvPct: number; dbrPct: number; tenureMonths: number;
  ratePct: number | null; rateRecipe: string; fees: number; tatDays: number | null;
  headlineFindings: Finding[]; findings: Finding[]; firedRules: Resolution[];
  conditions: string[]; remediations: Remediation[]; score: number;
}

export interface ClientProfile {
  name: string; nationality: string; customerType: CustomerType;
  residency: "RESIDENT" | "NON_RESIDENT"; employment: Employment; age: number;
  monthlyIncome: number; otherIncome: number; monthlyLiabilities: number; creditCardLimits: number;
  propertyValue: number; loanRequested: number; financeCount: 1 | 2;
  propertyType: "RESIDENTIAL" | "COMMERCIAL"; emirate: string; sector: string; yearsEmployed: number;
  propertyTenure?: "FREEHOLD" | "LEASEHOLD";
  hio?: boolean;                       /* RAKBANK: home-insurance-owned pricing split (HIO vs non-HIO margins) */
  propertiesOwned?: number; developer?: string;
  segment?: string;                  /* bank segment: PRIV / ASPIRE / HOMESAVER / PREMIER… */
  employer?: string;                 /* drives employer-based rate discounts */
  preferredFixedYears?: number;      /* 1 / 2 / 3 / 5 — selects the fixed-rate cell */
  existingLoanRate?: number;         /* for top-up pricing scenarios (customer's current rate) */
  relationship?: "ETB" | "NTB";      /* existing-to-bank vs new-to-bank (ENBD pricing dimension) */

  /* Credit group */
  aecbScore?: number; negativeBureau?: boolean; homeCountryLiabilitiesMonthly?: number;
  dependants?: number; goldenVisa?: boolean;

  /* Employment group (self-employed specifics) */
  lobYears?: number;                  /* length of business */
  losMonths?: number;                 /* length of service in business */
  lowDoc?: boolean; salaryTransfer?: boolean;   /* STL / NSTL */

  /* Property group */
  propertyUse?: "OWNER_OCCUPIED" | "INVESTMENT";
  /* ENBD-style property purposes: LAP (loan-against-property), BLDG (building finance),
     SELF_CONST (self construction), RENTAL (rental-income property) join the standard set. */
  propertyStatus?: "READY" | "OFF_PLAN" | "UNDER_CONSTRUCTION" | "LAND" | "LAP" | "BLDG" | "SELF_CONST" | "RENTAL";
  valuation?: number;

  /* Transaction / Finance group */
  txType?: TxType;

  /* Income group (breakdown, for income-recognition rules) */
  incomeBreakdown?: { basic?: number; allowances?: number; commission?: number; bonus?: number; rental?: number; business?: number };
}
export interface EiborFix { date: string; m1: number; m3: number; m6: number; y1: number; }
export interface WeightingProfile { id: string; name: string; weights: { finance: number; rate: number; ltv: number; fees: number; tat: number }; }

export interface DecisionSnapshot {
  id: string; at: string; by: string; client: ClientProfile; resolverVersion: string;
  eiborFix: EiborFix | null; weightingProfileId: string;
  ruleVersions: { refId: string; version: number }[]; decisions: ProductDecision[];
}
export interface GoldenCase {
  id: string; name: string; client: ClientProfile;
  expected: { productDefId: string; verdict: Verdict }[]; note?: string;
}
export interface GoldenResult {
  caseId: string; caseName: string; pass: boolean;
  diffs: { productDefId: string; expected: Verdict; actual: Verdict }[];
}

/* ---------- alerts ---------- */
export interface AlertDef { id: string; kind: "task" | "case" | "query" | "noaction"; severity: 1 | 2 | 3; title: string; sub: string; caseId?: string; }

/* ---------- app state ---------- */
export interface AppState {
  version: number; session: string | null;
  users: User[]; persons: Person[]; leads: Lead[];
  banks: Bank[]; stages: StageDef[]; docTypes: { id: string; name: string }[];
  taskTypes: string[]; waitingTypes: string[]; pendingReasons: string[]; leadSources: string[];
  cases: Case[]; tasks: Task[]; queries: BankQuery[];
  rules: Rule[]; eibor: EiborRow[]; calcs: CalcRecord[]; audit: AuditEntry[];
  templates: EmailTemplate[]; trackerDates: string[]; dismissedAlerts?: string[];
  axes: AxisDef[]; productDefs: ProductDef[]; promos: Promo[];
  weightingProfiles: WeightingProfile[]; decisionSnapshots: DecisionSnapshot[]; goldenCases: GoldenCase[];
  topDevelopers: string[];   /* bank-approved top-developer list — drives high-risk exemptions */
}

export type View =
  | "dashboard" | "capture" | "tracker" | "tat" | "people" | "leads" | "cases" | "tasks" | "documents"
  | "queries" | "decision" | "proposals" | "calculators" | "templates" | "rules" | "bankrules" | "users" | "audit" | "guide";
