/* ============================================================
   HFMC Bank Decision Engine (V1)
   An explainable decision engine whose source of truth is bank rules.

   Pipeline: Client → Resolver → Product Evaluation → Verdict Engine
             → Findings[] → Comparison/Ranking.

   Conflict model (winner selection):
     Exception(layer) → Tier → Specificity → explicit Priority
       → Effective date → deterministic rule-id tie-break.
   Recency NEVER silently overrides a more-specific or higher-priority rule.
   ============================================================ */
import type {
  ClientProfile, DecisionSnapshot, EiborFix, EiborRow, Finding, GoldenCase, GoldenResult,
  ProductDecision, ProductDef, ProductVersion, Promo, RateCell, Remediation, Resolution,
  Rule, RuleCandidate, Verdict, WeightingProfile,
} from "./types";
import { emi, loanFromEmi } from "./calc";

export const RESOLVER_VERSION = "1.0.0";
const tierLabel: Record<number, string> = { 4: "Exception", 3: "Product", 2: "Bank", 1: "Global" };

/* ---------- generic resolver: pick a winner, explain the losers ---------- */
export function resolveSlot(candidates: RuleCandidate[]): Resolution | null {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) =>
    b.tier - a.tier ||
    b.axesMatched - a.axesMatched ||
    b.priority - a.priority ||
    (b.effectiveFrom ?? "").localeCompare(a.effectiveFrom ?? "") ||
    a.refId.localeCompare(b.refId));
  const winner = sorted[0];
  const overridden = sorted.slice(1).map((c) => ({ ...c, reason: loseReason(c, winner) }));
  return { winner, overridden };
}
function loseReason(c: RuleCandidate, w: RuleCandidate): string {
  if (c.tier < w.tier) return `lower tier (${tierLabel[c.tier]} < ${tierLabel[w.tier]})`;
  if (c.axesMatched < w.axesMatched) return `less specific (${c.axesMatched} vs ${w.axesMatched} axis match)`;
  if (c.priority < w.priority) return "lower explicit priority";
  if ((c.effectiveFrom ?? "") < (w.effectiveFrom ?? "")) return "older effective date";
  return "rule-id tie-break";
}

/* ---------- rule lookup ---------- */
function globalRule(rules: Rule[], code: string): Rule | undefined {
  return rules.find((r) => r.code === code && r.active);
}
function candFromRule(r: Rule): RuleCandidate {
  const axes = Object.values(r.scope).filter(Boolean).length;
  return {
    source: r.scope.bankId ? "BANK" : "GLOBAL", tier: r.scope.bankId ? 2 : 1,
    refId: r.id, refLabel: `${r.code} v${r.version}`, value: r.value,
    axesMatched: axes, priority: 0, effectiveFrom: r.effectiveFrom, version: r.version,
  };
}

/* ---------- client axis values for grid matching ---------- */
function clientAxisValue(axis: string, c: ClientProfile): string | null {
  switch (axis) {
    case "employment": return c.employment;
    case "residency": return c.residency;
    case "customerType": return c.customerType;
    case "ftvBand": {
      if (!c.propertyValue) return null;
      const ftv = (c.loanRequested / c.propertyValue) * 100;
      return ftv <= 50 ? "LE50" : ftv <= 60 ? "LE60" : "GT60";
    }
    default: return null;
  }
}
function pickCell(cells: RateCell[], c: ClientProfile): RateCell | null {
  let best: RateCell | null = null;
  let bestScore = -1;
  for (const cell of cells) {
    let score = 0; let ok = true;
    for (const [axis, val] of Object.entries(cell.key)) {
      const cv = clientAxisValue(axis, c);
      if (cv == null) continue;
      if (cv === val) score += 1; else { ok = false; break; }
    }
    if (!ok) continue;
    if (score > bestScore) { bestScore = score; best = cell; }
  }
  return best;
}

/* ---------- rate resolution (recipes, never stored snapshots) ---------- */
export function cellRate(cell: Pick<RateCell, "structure" | "fixedRate" | "margin" | "index" | "floor">, fix: EiborFix): number | null {
  if (cell.structure === "FIXED" || cell.structure === "FIXED_THEN_VAR") return cell.fixedRate ?? null;
  if (cell.margin == null) return null;
  const idx = cell.index === "EIBOR_1M" ? fix.m1 : cell.index === "EIBOR_6M" ? fix.m6 : cell.index === "EIBOR_1Y" ? fix.y1 : fix.m3;
  const raw = cell.margin + idx;
  return cell.floor != null ? Math.max(raw, cell.floor) : raw;
}
export function cellRecipe(cell: Pick<RateCell, "structure" | "fixedRate" | "fixedMonths" | "margin" | "index" | "floor" | "followOn">): string {
  const idx = cell.index ?? "EIBOR_3M";
  if (cell.structure === "FIXED") return `${(cell.fixedRate ?? 0).toFixed(2)}% fixed`;
  if (cell.structure === "FIXED_THEN_VAR")
    return `${(cell.fixedRate ?? 0).toFixed(2)}% fixed${cell.fixedMonths ? ` ${Math.round(cell.fixedMonths / 12)}yr` : ""} then ${(cell.followOn?.margin ?? 0).toFixed(2)}% + ${cell.followOn?.index ?? idx}`;
  return `${(cell.margin ?? 0).toFixed(2)}% + ${idx}${cell.floor != null ? ` · floor ${cell.floor.toFixed(2)}%` : ""}`;
}

/* ---------- LTV resolution (product matrix specificity) ---------- */
export function resolveLtv(matrix: Record<string, number> | undefined, c: ClientProfile): { ltv: number; key: string } | null {
  if (!matrix || !Object.keys(matrix).length) return null;
  let bestKey = ""; let bestScore = -1;
  for (const key of Object.keys(matrix)) {
    let score = 0;
    if (key === `${c.customerType}:${c.financeCount}`) score = 4;
    else if (key === c.customerType) score = 3;
    else if (key === c.residency) score = 3;
    else if (key === String(c.financeCount)) score = 2;
    else if (key === c.employment) score = 2;
    else score = 0;
    if (score > bestScore) { bestScore = score; bestKey = key; }
  }
  if (!bestKey || bestScore < 0) return null;
  return { ltv: matrix[bestKey], key: bestKey };
}

/* ---------- evaluation context ---------- */
export interface EvalCtx { eibor: EiborFix; rules: Rule[]; promos: Promo[]; today: string; }
function livePromos(promos: Promo[], bankId: string, today: string): Promo[] {
  return promos.filter((p) => (!p.bankId || p.bankId === bankId) && p.from <= today && (!p.to || p.to >= today));
}
export function currentEiborFix(rows: EiborRow[]): EiborFix {
  const last = rows[rows.length - 1];
  return last
    ? { date: last.date, m1: last.m1, m3: last.m3, m6: last.m6, y1: last.y1 }
    : { date: new Date().toISOString().slice(0, 10), m1: 4.0, m3: 4.1, m6: 4.2, y1: 4.3 };
}

/* ---------- product evaluation → verdict + findings ---------- */
export function evaluateProduct(pd: ProductDef, c: ClientProfile, ctx: EvalCtx): ProductDecision {
  const findings: Finding[] = [];
  const firedRules: Resolution[] = [];
  const remediations: Remediation[] = [];
  const conditions: string[] = [];
  let blocked = false;
  let refer = false;

  const pv: ProductVersion | undefined =
    pd.versions.find((v) => v.status === "ACTIVE") ?? [...pd.versions].sort((a, b) => b.version - a.version)[0];

  const push = (f: Finding) => findings.push(f);
  if (!pv) {
    return finish(pd, 0, "NOT_ELIGIBLE", 0, 0, 0, 0, null, "no active version", 0, null,
      [{ code: "VERSION", severity: "BLOCK", category: "eligibility", message: "No active product version — nothing to evaluate." }],
      findings, [], [], [], 0);
  }

  const promos = livePromos(ctx.promos, pd.bankId, ctx.today);

  /* ---- eligibility gates (evaluated first, fail-fast) ---- */
  for (const g of pv.eligibility.gates) {
    let hit = false; let detail = "";
    if (g.kind === "NATIONALITY_ALLOW") {
      hit = !(g.values ?? []).some((v) => c.nationality.toLowerCase().includes(v.toLowerCase()));
      detail = `allowed: ${g.values?.join(", ")}`;
    } else if (g.kind === "NATIONALITY_BLOCK") {
      hit = (g.values ?? []).some((v) => c.nationality.toLowerCase().includes(v.toLowerCase()));
      detail = `blocked: ${g.values?.join(", ")}`;
    } else if (g.kind === "EMPLOYMENT_BLOCK") {
      hit = (g.values ?? []).includes(c.employment);
      detail = `blocked employment: ${g.values?.join(", ")}`;
    } else if (g.kind === "FLAG") {
      /* A FLAG with no `when` applies to everyone; with `when`, it scopes to a
         residency / employment / customer-type segment (e.g. "SELF_EMPLOYED"). */
      hit = !g.when ? true : (g.when === c.residency || g.when === c.employment || g.when === c.customerType);
    }
    if (hit) {
      if (g.hardStop) {
        blocked = true;
        push({ code: `GATE-${g.id}`, severity: "BLOCK", category: "eligibility", message: g.label, explanation: detail, source: pd.bankId });
      } else {
        refer = true;
        push({ code: `GATE-${g.id}`, severity: "WARN", category: "eligibility", message: g.label, explanation: detail, source: pd.bankId });
      }
    }
  }
  if (pv.eligibility.restrictedSectors?.length && c.sector && pv.eligibility.restrictedSectors.includes(c.sector)) {
    blocked = true;
    push({ code: "SECTOR", severity: "BLOCK", category: "eligibility", message: `Sector restricted: ${c.sector}`, source: pd.bankId });
  }

  /* ---- employment class fit ---- */
  if (!pd.classes.includes(c.employment)) {
    blocked = true;
    push({ code: "CLASS", severity: "BLOCK", category: "eligibility", message: `Product is for ${pd.classes.map((x) => x.toLowerCase()).join(" / ")} only`, explanation: `client is ${c.employment.toLowerCase()}`, source: pd.bankId });
  }

  /* ---- income floor ---- */
  if (pv.eligibility.minSalary != null && c.monthlyIncome < pv.eligibility.minSalary) {
    blocked = true;
    push({
      code: "MIN-INCOME", severity: "BLOCK", category: "eligibility",
      message: `Income below minimum`, previousValue: fmtMoney(c.monthlyIncome) + "/mo",
      resultingValue: "≥ " + fmtMoney(pv.eligibility.minSalary) + "/mo", source: pd.bankId,
    });
    remediations.push({ field: "income", current: fmtMoney(c.monthlyIncome) + "/mo", required: fmtMoney(pv.eligibility.minSalary) + "/mo", delta: fmtMoney(pv.eligibility.minSalary - c.monthlyIncome) + "/mo", message: "Increase qualifying income to the product minimum.", effort: 3 });
  }

  /* ---- LTV (product matrix, specificity-ranked) ---- */
  const ltvRes = resolveLtv(pv.eligibility.ltvMatrix, c);
  let ltvPct = 0;
  if (ltvRes) {
    ltvPct = ltvRes.ltv;
    push({ code: "LTV", severity: "APPLIED", category: "financing", message: `LTV ${ltvPct}% applied (matrix key: ${ltvRes.key})`, resultingValue: `${ltvPct}%`, source: pd.bankId });
  } else {
    // fall back to global LTV rules via the resolver
    const cands: RuleCandidate[] = ctx.rules
      .filter((r) => r.module === "LTV" && r.active)
      .map(candFromRule);
    const res = resolveSlot(cands);
    if (res) {
      ltvPct = res.winner.value;
      firedRules.push(res);
      push({
        code: "LTV", severity: "APPLIED", category: "financing", message: `LTV ${ltvPct}% from ${res.winner.refLabel}`,
        ruleId: res.winner.refId, ruleVersion: res.winner.version, resultingValue: `${ltvPct}%`,
        explanation: res.overridden.length ? `overrode ${res.overridden.map((o) => o.refLabel).join(", ")}` : undefined,
      });
    } else ltvPct = 80;
  }
  const maxByLtv = ltvPct > 0 && c.propertyValue > 0 ? Math.floor((c.propertyValue * ltvPct) / 100) : 0;

  /* ---- max loan cap ---- */
  let maxLoanCap = pv.eligibility.maxLoan ?? Infinity;
  const byNat = pv.eligibility.maxLoanByNationality?.[c.nationality];
  if (byNat != null) maxLoanCap = Math.min(maxLoanCap, byNat);
  if (maxLoanCap !== Infinity && maxByLtv > maxLoanCap) {
    push({ code: "MAX-LOAN", severity: "WARN", category: "financing", message: `Loan capped at ${fmtMoney(maxLoanCap)} (product ceiling)`, previousValue: fmtMoney(maxByLtv), resultingValue: fmtMoney(maxLoanCap), source: pd.bankId });
  }
  const ltvLimited = Math.min(maxByLtv, maxLoanCap === Infinity ? maxByLtv : maxLoanCap);

  /* ---- tenure & age ---- */
  const retireAge = c.customerType === "NATIONAL" ? 70 : 65;
  const maxByAge = Math.max(0, (retireAge - c.age) * 12);
  const capMonths = pv.tenure.maxMonths ?? 300;
  const tenure = Math.min(capMonths, maxByAge);
  if (maxByAge < 12) {
    blocked = true;
    push({ code: "AGE", severity: "BLOCK", category: "tenure", message: `Age at maturity exceeds limit (retires at ${retireAge})`, explanation: `client is ${c.age}; tenure would end at ${c.age + 1}+`, source: pd.bankId });
  } else if (maxByAge < capMonths) {
    refer = refer || maxByAge < 60;
    push({ code: "AGE", severity: maxByAge < 60 ? "WARN" : "INFO", category: "tenure", message: `Tenure capped at ${tenure} months by age`, previousValue: `${capMonths} mo`, resultingValue: `${tenure} mo`, source: pd.bankId });
  }

  /* ---- affordability: DBR ceiling via resolver ---- */
  const dbrCands = ctx.rules.filter((r) => r.module === "DBR" && r.active).map(candFromRule);
  const dbrRes = resolveSlot(dbrCands);
  const dbrCap = dbrRes ? dbrRes.winner.value : 50;
  if (dbrRes) firedRules.push(dbrRes);
  const ccPct = pv.affordability.ccPct ?? 5;
  const existingOblig = c.monthlyLiabilities + c.creditCardLimits * (ccPct / 100);
  const income = c.monthlyIncome + c.otherIncome;
  const availForEmi = Math.max(0, income * (dbrCap / 100) - existingOblig);
  const dbrNow = income > 0 ? (existingOblig / income) * 100 : 0;
  push({ code: "DBR", severity: "APPLIED", category: "affordability", message: `DBR ceiling ${dbrCap}%${dbrRes ? ` (${dbrRes.winner.refLabel})` : ""}`, resultingValue: `${dbrCap}%`, ruleId: dbrRes?.winner.refId, ruleVersion: dbrRes?.winner.version });
  if (dbrNow >= dbrCap) {
    blocked = true;
    push({ code: "DBR-NOW", severity: "BLOCK", category: "affordability", message: `Existing obligations already at ${dbrNow.toFixed(1)}% — no headroom`, previousValue: `${dbrNow.toFixed(1)}%`, resultingValue: `< ${dbrCap}%`, source: pd.bankId });
    remediations.push({ field: "liabilities", current: fmtMoney(existingOblig) + "/mo", required: fmtMoney(income * (dbrCap / 100)) + "/mo", delta: fmtMoney(existingOblig - income * (dbrCap / 100)) + "/mo", message: "Reduce existing monthly obligations below the DBR ceiling.", effort: 2 });
  } else if (dbrNow >= dbrCap - 5) {
    refer = true;
    push({ code: "DBR-NOW", severity: "WARN", category: "affordability", message: `Existing DBR ${dbrNow.toFixed(1)}% is close to the ${dbrCap}% ceiling`, source: pd.bankId });
  }

  /* ---- pricing: pick the most specific rate cell ---- */
  const cell = pickCell(pv.grid.cells, c);
  let ratePct: number | null = null;
  let recipe = "no rate cell matched";
  if (cell) {
    ratePct = cellRate(cell, ctx.eibor);
    recipe = cellRecipe(cell);
    push({ code: "RATE", severity: "APPLIED", category: "pricing", message: `Indicative rate ${ratePct != null ? ratePct.toFixed(2) + "%" : "n/a"} — ${recipe}`, resultingValue: ratePct != null ? `${ratePct.toFixed(2)}%` : undefined, source: pd.bankId, explanation: cell.note });
    for (const p of promos) {
      push({ code: "PROMO", severity: "INFO", category: "pricing", message: `Live promo: ${p.name}`, explanation: p.summary, source: "PROMO" });
    }
  }

  /* ---- eligible amount: min(LTV-limited, DBR-limited) ---- */
  let maxByDbr = 0;
  if (ratePct != null && tenure > 0) maxByDbr = Math.floor(loanFromEmi(availForEmi, ratePct, tenure));
  let eligible = Math.max(0, Math.min(ltvLimited, maxByDbr));
  if (pv.eligibility.minLoan != null && eligible > 0 && eligible < pv.eligibility.minLoan) {
    refer = true;
    push({ code: "MIN-LOAN", severity: "WARN", category: "financing", message: `Eligible amount below product minimum of ${fmtMoney(pv.eligibility.minLoan)}`, source: pd.bankId });
  }
  if (eligible > 0 && c.loanRequested > eligible) {
    push({ code: "REQUEST", severity: "WARN", category: "financing", message: `Requested ${fmtMoney(c.loanRequested)} exceeds eligible ${fmtMoney(eligible)}`, previousValue: fmtMoney(c.loanRequested), resultingValue: fmtMoney(eligible), source: pd.bankId });
    remediations.push({ field: "loanAmount", current: fmtMoney(c.loanRequested), required: fmtMoney(eligible), delta: fmtMoney(c.loanRequested - eligible), message: "Reduce the loan request, or increase down payment.", effort: 1 });
    remediations.push({ field: "downPayment", current: fmtMoney(c.propertyValue - c.loanRequested), required: fmtMoney(c.propertyValue - eligible), message: "Raise the down payment to bring the loan within the eligible amount.", effort: 2 });
  }
  if (tenure < capMonths && eligible > 0) {
    remediations.push({ field: "tenureMonths", current: `${tenure} mo`, required: `${capMonths} mo`, message: "A younger age or longer product tenure would raise the eligible amount.", effort: 3 });
  }
  if (eligible <= 0 && !blocked && availForEmi > 0 && ltvLimited > 0) refer = true;

  /* ---- fees ---- */
  const procPct = pv.fees.processingPct ?? 0;
  const procMin = pv.fees.processingMin ?? 0;
  let fees = eligible > 0 ? Math.max(eligible * (procPct / 100), procMin) + (pv.fees.valuation ?? 0) + (pv.fees.preApproval ?? 0) : 0;
  if (fees > 0) push({ code: "FEES", severity: "INFO", category: "fees", message: `Est. fees ${fmtMoney(fees)} (processing ${procPct}% min ${fmtMoney(procMin)} + valuation + PA)`, resultingValue: fmtMoney(fees), source: pd.bankId });

  /* ---- verdict ---- */
  let verdict: Verdict = "ELIGIBLE";
  if (blocked || eligible <= 0) verdict = "NOT_ELIGIBLE";
  else if (refer || conditions.length > 0) verdict = refer ? "REFER" : "ELIGIBLE_WITH_CONDITIONS";
  if (verdict === "REFER") conditions.push("Senior review required before submission.");

  const headline = findings.filter((f) => f.severity === "BLOCK" || f.severity === "WARN").slice(0, 3);
  const score = 0; // filled by rankDecisions

  return finish(pd, pv.version, verdict, eligible, ltvPct, dbrNow, tenure, ratePct, recipe, fees,
    pv.tat.totalDays ?? null, headline, findings, firedRules, conditions, remediations, score);
}

function fmtMoney(n: number): string { return "AED " + Math.round(n).toLocaleString("en-US"); }

function finish(
  pd: ProductDef, version: number, verdict: Verdict, eligibleAmount: number, ltvPct: number, dbrPct: number,
  tenureMonths: number, ratePct: number | null, rateRecipe: string, fees: number, tatDays: number | null,
  headlineFindings: Finding[], findings: Finding[], firedRules: Resolution[], conditions: string[],
  remediations: Remediation[], score: number,
): ProductDecision {
  return {
    productDefId: pd.id, bankId: pd.bankId, productName: pd.name, productVersion: version,
    verdict, eligibleAmount, ltvPct, dbrPct, tenureMonths, ratePct, rateRecipe, fees, tatDays,
    headlineFindings, findings, firedRules, conditions, remediations, score,
  };
}

/* ---------- comparison + ranking ---------- */
export function evaluateAll(productDefs: ProductDef[], c: ClientProfile, ctx: EvalCtx): ProductDecision[] {
  return productDefs.map((pd) => evaluateProduct(pd, c, ctx));
}
export function rankDecisions(decisions: ProductDecision[], w: WeightingProfile["weights"]): ProductDecision[] {
  const eligible = decisions.filter((d) => d.eligibleAmount > 0);
  const minMax = (vals: number[]) => {
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return (v: number) => (hi === lo ? 1 : (v - lo) / (hi - lo));
  };
  const normFin = minMax(eligible.map((d) => d.eligibleAmount));
  const normRate = minMax(eligible.map((d) => -(d.ratePct ?? 99)));
  const normLtv = minMax(eligible.map((d) => d.ltvPct));
  const normFees = minMax(eligible.map((d) => -d.fees));
  const normTat = minMax(eligible.map((d) => -(d.tatDays ?? 99)));
  const total = w.finance + w.rate + w.ltv + w.fees + w.tat || 1;
  const scored = decisions.map((d) => {
    if (d.eligibleAmount <= 0) return { ...d, score: 0 };
    const s = (normFin(d.eligibleAmount) * w.finance + normRate(d.ratePct ?? 99) * w.rate + normLtv(d.ltvPct) * w.ltv + normFees(d.fees) * w.fees + normTat(d.tatDays ?? 99) * w.tat) / total;
    return { ...d, score: Math.round(s * 100) };
  });
  return scored.sort((a, b) => b.score - a.score || b.eligibleAmount - a.eligibleAmount);
}

/* ---------- snapshot + deterministic replay ---------- */
export function collectRuleVersions(decisions: ProductDecision[]): { refId: string; version: number }[] {
  const map = new Map<string, number>();
  for (const d of decisions) for (const r of d.firedRules) map.set(r.winner.refId, r.winner.version ?? 0);
  return [...map.entries()].map(([refId, version]) => ({ refId, version }));
}
export interface ReplayDiff { productDefId: string; field: "verdict" | "eligibleAmount"; was: string; now: string }
export function replayDecision(snap: DecisionSnapshot, productDefs: ProductDef[], rules: Rule[], promos: Promo[], today: string): { diffs: ReplayDiff[]; changed: boolean } {
  /* Replay uses the SAME EIBOR fix stored in the snapshot, so index movement
     doesn't masquerade as a rule change. Drift therefore means a rule changed. */
  const ctx: EvalCtx = { eibor: snap.eiborFix, rules, promos, today };
  const fresh = evaluateAll(productDefs, snap.client, ctx);
  const diffs: ReplayDiff[] = [];
  for (const oldD of snap.decisions) {
    const newD = fresh.find((f) => f.productDefId === oldD.productDefId);
    if (!newD) { diffs.push({ productDefId: oldD.productDefId, field: "verdict", was: oldD.verdict, now: "product removed" }); continue; }
    if (newD.verdict !== oldD.verdict) diffs.push({ productDefId: oldD.productDefId, field: "verdict", was: oldD.verdict, now: newD.verdict });
    if (newD.eligibleAmount !== oldD.eligibleAmount) diffs.push({ productDefId: oldD.productDefId, field: "eligibleAmount", was: String(oldD.eligibleAmount), now: String(newD.eligibleAmount) });
  }
  return { diffs, changed: diffs.length > 0 };
}

/* ---------- golden test gate ---------- */
export function runGoldenCases(cases: GoldenCase[], productDefs: ProductDef[], ctx: EvalCtx): GoldenResult[] {
  return cases.map((gc) => {
    const decisions = evaluateAll(productDefs, gc.client, ctx);
    const diffs = gc.expected
      .map((e) => {
        const d = decisions.find((x) => x.productDefId === e.productDefId);
        const actual: Verdict = d?.verdict ?? "NOT_ELIGIBLE";
        return { productDefId: e.productDefId, expected: e.verdict, actual };
      })
      .filter((x) => x.expected !== x.actual);
    return { caseId: gc.id, caseName: gc.name, pass: diffs.length === 0, diffs };
  });
}

/* ---------- person → normalized profile ---------- */
export function personToProfile(p: {
  name: string; nationality: string; customerType: ClientProfile["customerType"]; employment: ClientProfile["employment"];
  dob: string; monthlySalary: number; otherIncome: number; financeCount: 1 | 2;
  liabilities: { monthly: number }[]; cards: { limit: number }[]; sector?: string; yearsEmployed?: number;
}, propertyValue: number, loanRequested: number, age: number): ClientProfile {
  return {
    name: p.name, nationality: p.nationality, customerType: p.customerType,
    residency: p.customerType === "NON_RESIDENT" ? "NON_RESIDENT" : "RESIDENT",
    employment: p.employment, age,
    monthlyIncome: p.monthlySalary, otherIncome: p.otherIncome,
    monthlyLiabilities: p.liabilities.reduce((s, l) => s + l.monthly, 0),
    creditCardLimits: p.cards.reduce((s, c) => s + c.limit, 0),
    propertyValue, loanRequested, financeCount: p.financeCount,
    propertyType: "RESIDENTIAL", emirate: "DUBAI", sector: p.sector ?? "",
    yearsEmployed: p.yearsEmployed ?? 2,
  };
}
