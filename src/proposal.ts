/* ============================================================
   Proposal Desk — generates a bank-by-bank proposal sheet from
   a client profile + the Decision Engine output. Pure & deterministic.
   ============================================================ */
import type {
  ClientProfile, EiborFix, ProductDecision, ProductDef, ProductVersion, RateCell,
} from "./types";
import { emi } from "./calc";

export interface RateOption {
  kind: "FIXED" | "VARIABLE";
  label: string;
  ratePct: number | null;
  emiValue: number | null;
  recipe: string;
}
export interface FeeLine { label: string; amount: number | null; note?: string; }
export interface MissingItem { field: string; why: string; }

export interface BankProposal {
  def: ProductDef;
  pv: ProductVersion;
  decision: ProductDecision;
  eligible: boolean;
  verdict: string;
  tenureMonths: number;
  financeAmount: number;
  selfContribution: number;
  contributionPct: number;
  options: RateOption[];
  fees: FeeLine[];
  vat: number | null;
  totalUpfront: number | null;
  lifeInsurance: string;
  propertyInsurance: string;
  salaryTransferRequired: boolean;
  blockReason?: string;
  missing: MissingItem[];
  docs: string[];
}

const fmtAED = (n: number) => "AED " + Math.round(n).toLocaleString("en-US");
const fmt2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* match a rate cell against the client (loose: tenure keys are menu options) */
function cellScore(cell: RateCell, c: ClientProfile): number {
  let s = 0;
  for (const [k, v] of Object.entries(cell.key)) {
    if (k === "tenure") continue; /* tenure = menu option, not a filter */
    if (k === "employment" && v === c.employment) s += 2;
    else if (k === "residency" && v === c.residency) s += 2;
    else if (k === "ftvBand") {
      const ftv = c.propertyValue > 0 ? (c.loanRequested / c.propertyValue) * 100 : 0;
      const inBand =
        (v === "LE50" && ftv <= 50) || (v === "LE60" && ftv <= 60) || (v === "LE75" && ftv <= 75) ||
        (v === "GT60" && ftv > 60) || (v === "GT75" && ftv > 75);
      if (inBand) s += 1;
    }
  }
  return s;
}
function rateOf(cell: RateCell, fix: EiborFix | null): number | null {
  if (cell.structure === "FIXED" || cell.structure === "FIXED_THEN_VAR") return cell.fixedRate ?? null;
  if (cell.margin == null || !fix) return null;
  const idx = cell.index === "EIBOR_1M" ? fix.m1 : cell.index === "EIBOR_6M" ? fix.m6 : cell.index === "EIBOR_1Y" ? fix.y1 : fix.m3;
  const raw = cell.margin + idx;
  return cell.floor != null ? Math.max(raw, cell.floor) : raw;
}
function recipeOf(cell: RateCell): string {
  const idx = cell.index ?? "EIBOR_3M";
  if (cell.structure === "FIXED") return `${(cell.fixedRate ?? 0).toFixed(2)}% fixed${cell.fixedMonths ? ` for ${Math.round(cell.fixedMonths / 12)} yr` : ""}`;
  if (cell.structure === "FIXED_THEN_VAR") return `${(cell.fixedRate ?? 0).toFixed(2)}% fixed${cell.fixedMonths ? ` ${Math.round(cell.fixedMonths / 12)}yr` : ""} then ${(cell.followOn?.margin ?? 0).toFixed(2)}% + ${cell.followOn?.index ?? idx}`;
  return `${(cell.margin ?? 0).toFixed(2)}% + ${idx}${cell.floor != null ? ` · floor ${cell.floor.toFixed(2)}%` : ""}`;
}

/* pick the best fixed and best variable option for this client */
function buildOptions(pv: ProductVersion, c: ClientProfile, fix: EiborFix | null, tenure: number): RateOption[] {
  const out: RateOption[] = [];
  const fixedCells = pv.grid.cells
    .filter((x) => x.structure === "FIXED" || x.structure === "FIXED_THEN_VAR")
    .sort((a, b) => cellScore(b, c) - cellScore(a, c)).slice(0, 2);
  const varCells = pv.grid.cells
    .filter((x) => x.structure === "MARGIN_INDEX" || x.structure === "VAR_DAY1")
    .sort((a, b) => cellScore(b, c) - cellScore(a, c)).slice(0, 1);
  for (const cell of fixedCells) {
    const r = rateOf(cell, fix);
    out.push({
      kind: "FIXED", label: cell.note ?? recipeOf(cell), ratePct: r,
      emiValue: r != null && tenure > 0 ? emi(100000, r, tenure) : null, recipe: recipeOf(cell),
    });
  }
  for (const cell of varCells) {
    const r = rateOf(cell, fix);
    out.push({
      kind: "VARIABLE", label: cell.note ?? recipeOf(cell), ratePct: r,
      emiValue: r != null && tenure > 0 ? emi(100000, r, tenure) : null, recipe: recipeOf(cell),
    });
  }
  return out;
}

/* detect information the bank needs that the client profile lacks */
function detectMissing(pv: ProductVersion, c: ClientProfile): MissingItem[] {
  const m: MissingItem[] = [];
  if (c.employment === "SELF_EMPLOYED") {
    if (c.lobYears == null) m.push({ field: "Length of business", why: "Required for self-employed eligibility & LOB rules" });
    if (c.losMonths == null) m.push({ field: "Length of service (UAE)", why: "Required for self-employed LOS rules" });
    m.push({ field: "Audited financials status", why: "Determines full-doc vs low-doc route" });
  }
  if (c.aecbScore == null) m.push({ field: "AECB bureau score", why: "Bureau floor & negative-bureau checks" });
  if (!c.valuation) m.push({ field: "Valuation report", why: "Finance is currently priced on asking value only" });
  if (pv.eligibility.salaryTransferRequired && c.salaryTransfer === false)
    m.push({ field: "Salary transfer confirmation", why: "This product requires salary transfer to the bank" });
  return m;
}

export function buildProposal(def: ProductDef, decision: ProductDecision, c: ClientProfile, fix: EiborFix | null): BankProposal {
  const pv = def.versions.find((v) => v.version === decision.productVersion) ?? def.versions[def.versions.length - 1];
  const eligible = decision.verdict === "ELIGIBLE" || decision.verdict === "ELIGIBLE_WITH_CONDITIONS" || decision.verdict === "REFER";
  const finance = decision.eligibleAmount;
  const contribution = Math.max(0, c.propertyValue - finance);
  const contributionPct = c.propertyValue > 0 ? (contribution / c.propertyValue) * 100 : 0;
  const tenure = decision.tenureMonths;
  const options = buildOptions(pv, c, fix, tenure);

  const procPct = pv.fees.processingPct ?? 0;
  const procMin = pv.fees.processingMin ?? 0;
  const proc = finance > 0 ? Math.max(finance * (procPct / 100), procMin) : 0;
  const val = pv.fees.valuation ?? 0;
  const pa = pv.fees.preApproval ?? 0;
  const vatPct = pv.fees.vatPct ?? 0;
  const vat = vatPct > 0 ? (proc + val + pa) * (vatPct / 100) : null;
  const total = finance > 0 ? proc + val + pa + (vat ?? 0) : null;

  const lifePct = pv.fees.lifeInsurancePct;
  const propPct = pv.fees.propertyInsurancePct;

  const blockFinding = decision.findings.find((f) => f.severity === "BLOCK");

  return {
    def, pv, decision, eligible, verdict: decision.verdict,
    tenureMonths: tenure, financeAmount: finance, selfContribution: contribution, contributionPct,
    options,
    fees: [
      { label: "Processing fee", amount: finance > 0 ? proc : null, note: procPct > 0 ? `${procPct}% of finance${procMin ? ` (min ${fmtAED(procMin)})` : ""}${vatPct ? ` + VAT ${vatPct}%` : ""}` : pv.fees.note },
      { label: "Valuation fee", amount: val || null, note: vatPct ? `incl. VAT` : undefined },
      { label: "Pre-approval fee", amount: pa || null, note: pa ? undefined : "Not applicable" },
      { label: "Arrangement fee", amount: null, note: pv.fees.arrangementFee ?? "Not applicable" },
    ],
    vat, totalUpfront: total,
    lifeInsurance: lifePct != null && finance > 0
      ? `Monthly ${lifePct}% of outstanding (${fmtAED(finance * (lifePct / 100))})${pv.fees.lifeInsuranceNote ? " — " + pv.fees.lifeInsuranceNote : ""}`
      : (lifePct != null ? `Monthly ${lifePct}% of outstanding` : "As per bank"),
    propertyInsurance: propPct != null && c.propertyValue > 0
      ? `Yearly ${propPct}% of property value (${fmtAED(c.propertyValue * (propPct / 100))})${pv.fees.propertyInsuranceNote ? " — " + pv.fees.propertyInsuranceNote : ""}`
      : (propPct != null ? `Yearly ${propPct}% of property value` : "As per bank"),
    salaryTransferRequired: pv.eligibility.salaryTransferRequired ?? false,
    blockReason: !eligible && blockFinding ? `${blockFinding.message}${blockFinding.explanation ? " — " + blockFinding.explanation : ""}` : undefined,
    missing: detectMissing(pv, c),
    docs: pv.documents.filter((d) => d.required).map((d) => d.name),
  };
}

/* ---------- comparison insights across banks ---------- */
export interface Insight { kind: "best" | "warn" | "info"; text: string; bank?: string; }
export function buildInsights(proposals: BankProposal[]): Insight[] {
  const el = proposals.filter((p) => p.eligible && p.financeAmount > 0);
  const out: Insight[] = [];
  if (el.length >= 2) {
    const byFixed = [...el].filter((p) => p.options.some((o) => o.kind === "FIXED" && o.emiValue != null));
    if (byFixed.length) {
      const best = byFixed.reduce((a, b) => ((minEmi(a) ?? 1e18) <= (minEmi(b) ?? 1e18) ? a : b));
      out.push({ kind: "best", bank: bankName(best), text: `Lowest fixed monthly instalment — ${fmtAED(minEmi(best)!)}/mo` });
    }
    const most = el.reduce((a, b) => (a.financeAmount >= b.financeAmount ? a : b));
    out.push({ kind: "best", bank: bankName(most), text: `Highest eligible finance — ${fmtAED(most.financeAmount)}` });
    const cheap = [...el].filter((p) => p.totalUpfront != null).reduce((a, b) => ((a.totalUpfront ?? 1e18) <= (b.totalUpfront ?? 1e18) ? a : b), el[0]);
    if (cheap.totalUpfront != null) out.push({ kind: "best", bank: bankName(cheap), text: `Lowest upfront fees — ${fmtAED(cheap.totalUpfront)}` });
  }
  for (const p of proposals) {
    if (!p.eligible && p.blockReason) out.push({ kind: "warn", bank: bankName(p), text: `Not eligible — ${p.blockReason}` });
    else if (p.missing.length) out.push({ kind: "info", bank: bankName(p), text: `${p.missing.length} item(s) missing before submission` });
  }
  return out;
}
function minEmi(p: BankProposal): number | null {
  const vals = p.options.filter((o) => o.kind === "FIXED" && o.emiValue != null).map((o) => o.emiValue!) as number[];
  return vals.length ? Math.min(...vals) : null;
}
function bankName(p: BankProposal): string { return p.def.bankId.replace(/^b-/, "").toUpperCase(); }

/* ---------- shareable text ---------- */
export function proposalText(p: BankProposal, c: ClientProfile, opts: { customer?: boolean } = {}): string {
  const L: string[] = [];
  const bank = p.def.bankId.replace(/^b-/, "").toUpperCase();
  L.push(`${bank} — HOME FINANCE PROPOSAL`);
  L.push(`Client: ${c.name}`);
  L.push(`Verdict: ${p.verdict.replace(/_/g, " ")}`);
  if (!p.eligible) { L.push(`Reason: ${p.blockReason ?? "See findings"}`); return L.join("\n"); }
  L.push(`Eligible tenure: ${p.tenureMonths} months`);
  L.push(`Eligible finance: ${fmtAED(p.financeAmount)}`);
  L.push(`Self contribution: ${fmtAED(p.selfContribution)} (${p.contributionPct.toFixed(0)}% of property value)`);
  for (const o of p.options) {
    const per = o.emiValue != null && p.financeAmount > 0 ? o.emiValue * (p.financeAmount / 100000) : null;
    L.push(`${o.kind === "FIXED" ? "Fixed" : "Variable"}: ${o.ratePct != null ? o.ratePct.toFixed(2) + "%" : "TBC"} — ${per != null ? fmtAED(per) + "/mo" : "EMI unconfirmed"}`);
  }
  L.push(`Salary transfer required: ${p.salaryTransferRequired ? "Yes" : "No"}`);
  for (const f of p.fees) L.push(`${f.label}: ${f.amount != null ? fmtAED(f.amount) : (f.note ?? "—")}`);
  if (p.vat != null) L.push(`VAT: ${fmtAED(p.vat)}`);
  if (p.totalUpfront != null) L.push(`Total upfront (excl. down payment): ${fmtAED(p.totalUpfront)}`);
  L.push(`Life insurance: ${p.lifeInsurance}`);
  L.push(`Property insurance: ${p.propertyInsurance}`);
  if (p.pv.fees.earlySettlement) L.push(`Early settlement: ${p.pv.fees.earlySettlement}`);
  if (p.pv.fees.partialSettlement) L.push(`Part payment: ${p.pv.fees.partialSettlement}`);
  if (!opts.customer) {
    if (p.missing.length) { L.push(`\nMISSING INFO:`); p.missing.forEach((m) => L.push(`• ${m.field} — ${m.why}`)); }
    if (p.docs.length) { L.push(`\nDOCS REQUIRED:`); p.docs.forEach((d) => L.push(`• ${d}`)); }
  }
  return L.join("\n");
}
