export type RoleId = "ADMIN" | "HEAD" | "TL" | "SPO" | "VRM" | "PA" | "TBD";

export interface User {
  id: string; empId: string; name: string; email: string; mobile: string;
  role: RoleId; team: string; leaderId?: string; active: boolean; createdAt: string;
  note?: string;
}

export type CustomerType = "NATIONAL" | "EXPAT" | "NON_RESIDENT";
export type Employment = "SALARIED" | "SELF_EMPLOYED";
export type TxType = "PURCHASE" | "BUYOUT" | "BUYOUT_EQUITY" | "EQUITY";

export interface Person {
  id: string; name: string; customerType: CustomerType; nationality: string;
  employment: Employment; dob: string; mobile: string; email: string; employer?: string;
  monthlySalary: number; otherIncome: number; financeCount: 1 | 2;
  cards: { bank: string; limit: number }[];
  liabilities: { type: string; monthly: number }[];
  kyc: { passport: boolean; eid: boolean; visa: boolean; address: boolean };
  createdAt: string;
}

export type LeadStatus = "NEW" | "CONTACTED" | "APPOINTMENT" | "QUALIFIED" | "PROPOSAL" | "CONVERTED" | "LOST";

export interface Lead {
  id: string; ref: string; personId: string; source: string; type: TxType;
  status: LeadStatus; owner: string; bankId?: string; propertyValue?: number;
  nextAction?: string; due?: string; notes?: string; createdAt: string;
}

export interface Bank { id: string; name: string; short: string; }

export interface Product {
  id: string; bankId: string; name: string; rateType: "FIXED" | "VARIABLE" | "ISLAMIC";
  rate: number; maxTenureMonths: number; maxLoan: number; ccRate: number; note?: string;
}

export interface StageDef {
  id: string; name: string; short: string; sla: number;
  docs: string[]; tasks: string[]; gate?: string;
}

export interface DocType { id: string; name: string; }

export type DocStatus = "MISSING" | "RECEIVED" | "VERIFIED" | "REJECTED" | "NA";

export interface DocItem {
  id: string; typeId: string; stageId: string; status: DocStatus;
  note?: string; expiry?: string; updatedAt: string; updatedBy: string;
}

export interface TrackerEntry { date: string; note: string; }

export interface Case {
  id: string; ref: string; personId: string; leadId?: string; ownerId: string;
  bankId: string; productId: string; txType: TxType;
  deal?: string; bankRm?: string; channel?: string; outcome?: "WON" | "LOST";
  tracker?: TrackerEntry[];
  propertyValue: number; loanAmount: number; rate: number; tenureMonths: number;
  stage: string; status: "OPEN" | "CLOSED";
  stageHistory: { stageId: string; at: string; by: string; note?: string }[];
  nextAction?: string; nextActionDue?: string; waitingFor?: string;
  pendingReason?: string; blocker?: string; expectedCompletion?: string;
  expectedRevenue: number; docs: DocItem[]; createdAt: string; closedAt?: string;
}

export interface Task {
  id: string; caseId: string; stageId: string; type: string; title: string;
  ownerId: string; priority: "HIGH" | "MEDIUM" | "LOW"; due?: string;
  status: "OPEN" | "DONE"; waitingFor?: string; pendingReason?: string;
  createdAt: string; completedAt?: string; completedBy?: string; remarks?: string;
}

export interface BankQuery {
  id: string; caseId: string; ref: string; bankId: string; requirement: string;
  actionPoints: string; ownerId: string; receivedAt: string; due?: string;
  response?: string; evidence?: string; qc?: string; status: "OPEN" | "RESPONDED" | "CLOSED";
}

export type RuleModule = "LTV" | "DBR" | "RETIRE" | "TENURE" | "CC" | "MIN_SAL" | "FEE" | "SETTLE" | "STRESS";

export interface Rule {
  id: string; code: string; module: RuleModule; name: string;
  scope: { bankId?: string; customerType?: CustomerType; employment?: Employment; txType?: TxType; financeCount?: 1 | 2 };
  kind: "pct" | "months" | "years" | "amount" | "number";
  value: number;
  fee?: { basis: "loan" | "property" | "flat"; min?: number; cap?: number };
  version: number; effectiveFrom: string; active: boolean; note?: string;
  history: { version: number; value: number; effectiveFrom: string }[];
}

export interface EiborRow {
  date: string; d1: number; w1: number; m1: number; m3: number; m6: number; y1: number;
  source: string; updatedBy: string;
}

export interface CalcRecord {
  id: string; type: string; label: string;
  linkKind?: "case" | "lead" | "person"; linkId?: string; linkRef?: string;
  inputs: Record<string, unknown>; outputs: Record<string, unknown>;
  rulesUsed: { code: string; version: number }[];
  by: string; at: string;
}

export interface AuditEntry {
  id: string; at: string; by: string; module: string; action: string;
  target: string; detail?: string; caseId?: string;
}

export interface AppState {
  version: number; session: string | null;
  users: User[]; persons: Person[]; leads: Lead[];
  banks: Bank[]; products: Product[]; stages: StageDef[]; docTypes: DocType[];
  taskTypes: string[]; waitingTypes: string[]; pendingReasons: string[]; leadSources: string[];
  cases: Case[]; tasks: Task[]; queries: BankQuery[];
  rules: Rule[]; eibor: EiborRow[]; calcs: CalcRecord[]; audit: AuditEntry[];
  trackerDates: string[];
}

export type View =
  | "dashboard" | "tracker" | "people" | "leads" | "cases" | "tasks" | "documents"
  | "queries" | "calculators" | "rules" | "users" | "audit";

export interface NavState {
  view: View; caseId: string | null; params: Record<string, unknown>;
  go: (view: View, opts?: { caseId?: string | null; params?: Record<string, unknown> }) => void;
}
