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
  HighRiskBand, ProductDecision, ProductDef, ProductVersion, Promo, RateCell, Remediation, Resolution,
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
/* Like candFromRule, but returns null when the rule's scope doesn't apply to this
   client/bank — so resolution only ever considers genuinely-applicable rules. */
function candFromScopedRule(r: Rule, c: ClientProfile, bankId: string): RuleCandidate | null {
  const s = r.scope;
  if (s.customerType && s.customerType !== c.customerType) return null;
  if (s.employment && s.employment !== c.employment) return null;
  if (s.financeCount && s.financeCount !== c.financeCount) return null;
  if (s.bankId && s.bankId !== bankId) return null;
  return candFromRule(r);
}

/* ---------- client axis values for grid matching ---------- */
function clientAxisValue(axis: string, c: ClientProfile): string | null {
  switch (axis) {
    case "employment": return c.employment;
    case "residency": return c.residency;
    case "customerType": return c.customerType;
    case "segment": return c.segment ?? null;
    case "tenure": return c.preferredFixedYears != null ? String(c.preferredFixedYears) : null;
    case "stl": return c.salaryTransfer == null ? null : c.salaryTransfer ? "STL" : "NSTL";
    case "propertyStatus": return c.propertyStatus ?? null;
    case "transaction": return c.txType ?? null;
    case "relationship": return c.relationship ?? null;
    case "hio": return c.hio == null ? null : c.hio ? "HIO" : "NON_HIO";
    case "docProgram": return c.lowDoc ? "LOW_DOC" : "STANDARD";
    case "amountBand": return c.loanRequested < 2000000 ? "LT2M" : c.loanRequested <= 3490000 ? "2TO35M" : "GE35M";
    case "emirate": return c.emirate || null;
    case "ftvBand": {
      /* Bands are matched inclusively in pickCell (a “≤60%” cell also serves a 45% client),
         so we report the client's actual band here for display/scoring. */
      if (!c.propertyValue) return null;
      const ftv = (c.loanRequested / c.propertyValue) * 100;
      return ftv <= 50 ? "LE50" : ftv <= 60 ? "LE60" : "GT60";
    }
    default: return null;
  }
}
function pickCell(cells: RateCell[], c: ClientProfile): RateCell | null {
  const ftv = c.propertyValue ? (c.loanRequested / c.propertyValue) * 100 : null;
  /* FTV bands match inclusively: a “≤60%” cell also serves a 45% client, and a
     “>60%” cell serves 65%. Tighter bands out-score wider ones. */
  const bandHit = (cellVal: string): { ok: boolean; pts: number } => {
    if (ftv == null) return { ok: false, pts: 0 };
    const m = /^(LE|GT)(\d+)$/.exec(cellVal);
    if (!m) return { ok: false, pts: 0 };
    const n = Number(m[2]);
    if (m[1] === "LE") return ftv <= n ? { ok: true, pts: n <= 50 ? 3 : 2 } : { ok: false, pts: 0 };
    return ftv > n ? { ok: true, pts: 2 } : { ok: false, pts: 0 };
  };
  let best: RateCell | null = null;
  let bestScore = -1;
  for (const cell of cells) {
    let score = 0; let ok = true;
    for (const [axis, val] of Object.entries(cell.key)) {
      if (axis === "ftvBand") {
        const r = bandHit(val);
        if (!r.ok) { ok = false; break; }
        score += r.pts; continue;
      }
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
export function cellRate(cell: Pick<RateCell, "structure" | "fixedRate" | "margin" | "index" | "floor">, fix: EiborFix | null): number | null {
  if (cell.structure === "FIXED" || cell.structure === "FIXED_THEN_VAR") return cell.fixedRate ?? null;
  if (cell.margin == null) return null;
  if (cell.index === "SCBLR") return null; /* SCBLR is SCB's internal benchmark — never published, never invented */
  if (!fix) return null; /* index-based pricing is unconfirmable without a published fix */
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
  const stlKey = c.salaryTransfer == null ? null : c.salaryTransfer ? "STL" : "NSTL";
  for (const key of Object.keys(matrix)) {
    let score = 0;
    /* Most specific first: customer-type × salary-transfer (e.g. Al Hilal:
       National 85% with STL / 75% without). */
    if (stlKey != null && key === `${c.customerType}:${stlKey}`) score = 5;
    else if (key === `${c.customerType}:${c.financeCount}`) score = 4;
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
export interface EvalCtx { eibor: EiborFix | null; rules: Rule[]; promos: Promo[]; today: string; topDevelopers?: string[]; }
function livePromos(promos: Promo[], bankId: string, today: string): Promo[] {
  return promos.filter((p) => (!p.bankId || p.bankId === bankId) && p.from <= today && (!p.to || p.to >= today));
}
/* Returns null when no fix is published — the engine NEVER invents an EIBOR. */
export function currentEiborFix(rows: EiborRow[]): EiborFix | null {
  const last = rows[rows.length - 1];
  return last ? { date: last.date, m1: last.m1, m3: last.m3, m6: last.m6, y1: last.y1 } : null;
}

/* ---------- product evaluation → verdict + findings ---------- */
export function evaluateProduct(pd: ProductDef, c: ClientProfile, ctx: EvalCtx): ProductDecision {
  const findings: Finding[] = [];
  const firedRules: Resolution[] = [];
  const remediations: Remediation[] = [];
  const conditions: string[] = [];
  let blocked = false;
  let refer = false;
  let unknown = false; /* set when a required rule/fixing is missing — never fabricated */

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
  /* ---- documentation requirement: bank-statement months (verified by underwriter) ---- */
  if (pv.eligibility.statementMonths) {
    push({
      code: "STMT-MONTHS", severity: "INFO", category: "eligibility",
      message: `Requires latest ${pv.eligibility.statementMonths} months of bank statements`,
      explanation: "Document requirement — the engine flags it; an underwriter verifies the statements before submission.",
      source: pd.bankId,
    });
  }

  /* ---- employment class fit ---- */
  if (!pd.classes.includes(c.employment)) {
    blocked = true;
    push({ code: "CLASS", severity: "BLOCK", category: "eligibility", message: `Product is for ${pd.classes.map((x) => x.toLowerCase()).join(" / ")} only`, explanation: `client is ${c.employment.toLowerCase()}`, source: pd.bankId });
  }

  /* ---- income floor (per-customer-type matrix wins over the flat minimum) ---- */
  /* Matrix keys are tried in order of specificity: customer type → residency →
     salary-transfer (STL/NSTL) → employment. First hit wins. */
  const msm = pv.eligibility.minSalaryMatrix ?? {};
  const stlKey = c.salaryTransfer == null ? null : c.salaryTransfer ? "STL" : "NSTL";
  /* Compound keys (e.g. "NSTL:EXPAT") are the most specific, tried first. */
  const compoundKey = stlKey ? `${stlKey}:${c.customerType}` : null;
  const msmKey = [compoundKey, c.customerType, c.residency, stlKey, c.employment].find((k) => k != null && msm[k] != null) ?? null;
  const effMinSalary = (msmKey ? msm[msmKey] : undefined) ?? pv.eligibility.minSalary;
  if (effMinSalary != null && c.monthlyIncome < effMinSalary) {
    blocked = true;
    push({
      code: "MIN-INCOME", severity: "BLOCK", category: "eligibility",
      message: `Income below minimum${msmKey ? ` for ${msmKey.replace(/_/g, " ").toLowerCase()}` : ""}`,
      previousValue: fmtMoney(c.monthlyIncome) + "/mo",
      resultingValue: "≥ " + fmtMoney(effMinSalary) + "/mo", source: pd.bankId,
    });
    remediations.push({ field: "income", current: fmtMoney(c.monthlyIncome) + "/mo", required: fmtMoney(effMinSalary) + "/mo", delta: fmtMoney(effMinSalary - c.monthlyIncome) + "/mo", message: "Increase qualifying income to the product minimum.", effort: 3 });
  } else if (effMinSalary != null) {
    push({ code: "MIN-INCOME-OK", severity: "APPLIED", category: "eligibility", message: `Minimum income satisfied (${(msmKey ?? c.customerType).replace(/_/g, " ").toLowerCase()} ≥ ${fmtMoney(effMinSalary)}/mo)`, resultingValue: fmtMoney(effMinSalary) + "/mo", source: pd.bankId });
  }

  /* ---- credit group: bureau score floor ---- */
  if (pv.eligibility.minAecb != null && (c.aecbScore ?? 0) < pv.eligibility.minAecb) {
    blocked = true;
    push({
      code: "AECB", severity: "BLOCK", category: "eligibility",
      message: `Bureau score below minimum`, previousValue: String(c.aecbScore ?? "not provided"),
      resultingValue: "≥ " + pv.eligibility.minAecb, source: pd.bankId,
    });
  }

  /* ---- credit group: negative bureau ---- */
  if (pv.eligibility.negativeBureauBlock && c.negativeBureau) {
    blocked = true;
    push({ code: "NEG-BUREAU", severity: "BLOCK", category: "eligibility", message: `Negative bureau record — not accepted`, explanation: "product declines applicants with adverse bureau history", source: pd.bankId });
  }

  /* ---- employment group: self-employed LOB / LOS (computed) ---- */
  if (c.employment === "SELF_EMPLOYED") {
    const lob = c.lobYears ?? 0;
    const los = c.losMonths ?? 0;
    const minLob = pv.eligibility.minLobYears;
    const minLos = pv.eligibility.minLosMonths;
    if (minLob != null && lob < minLob) {
      blocked = true;
      push({ code: "LOB", severity: "BLOCK", category: "eligibility", message: `Business age below minimum`, previousValue: `${lob} yrs`, resultingValue: `≥ ${minLob} yrs`, source: pd.bankId });
    }
    if (minLos != null && los < minLos) {
      blocked = true;
      push({ code: "LOS", severity: "BLOCK", category: "eligibility", message: `Length of service below minimum`, previousValue: `${los} mo`, resultingValue: `≥ ${minLos} mo`, source: pd.bankId });
    }
    const lvl3 = pv.eligibility.level3Threshold;
    if (!blocked && lvl3 && (lob < lvl3.lobYears || los < lvl3.losMonths)) {
      refer = true;
      push({ code: "LOB-LOS-L3", severity: "WARN", category: "eligibility", message: `LOB/LOS below standard — Level 3 approval required`, explanation: `standard: LOB ≥ ${lvl3.lobYears}y & LOS ≥ ${lvl3.losMonths}m; client: ${lob}y / ${los}m`, source: pd.bankId });
    }
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
    } else {
      /* No LTV rule for this client segment — the engine does not invent one. */
      unknown = true;
      push({ code: "LTV-UNKNOWN", severity: "WARN", category: "financing", message: "No LTV rule matches this client segment — LTV is UNKNOWN", explanation: "Add an LTV rule (product matrix or scoped rule) for this nationality/residency/finance-count." });
    }
  }
  /* ---- property group: investment / second-property / high-amount LTV caps ---- */
  const eligibleValue = c.valuation && c.valuation > 0 ? Math.min(c.propertyValue, c.valuation) : c.propertyValue;
  if (c.valuation && c.valuation > 0 && c.valuation < c.propertyValue) {
    push({ code: "VALUATION", severity: "INFO", category: "financing", message: `Finance based on lower of value & valuation`, previousValue: fmtMoney(c.propertyValue), resultingValue: fmtMoney(eligibleValue), source: pd.bankId });
  }
  if (pv.eligibility.investmentLtv != null && c.propertyUse === "INVESTMENT" && ltvPct > pv.eligibility.investmentLtv) {
    push({ code: "LTV-INVEST", severity: "APPLIED", category: "financing", message: `Investment property LTV cap applied`, previousValue: `${ltvPct}%`, resultingValue: `${pv.eligibility.investmentLtv}%`, source: pd.bankId });
    ltvPct = pv.eligibility.investmentLtv;
  }
  if (pv.eligibility.secondPropertyLtv != null && c.financeCount === 2 && ltvPct > pv.eligibility.secondPropertyLtv) {
    push({ code: "LTV-SECOND", severity: "APPLIED", category: "financing", message: `Second/subsequent property LTV cap applied`, previousValue: `${ltvPct}%`, resultingValue: `${pv.eligibility.secondPropertyLtv}%`, source: pd.bankId });
    ltvPct = pv.eligibility.secondPropertyLtv;
  }
  if (pv.eligibility.highAmountThreshold != null && pv.eligibility.ltvAboveThreshold != null && c.loanRequested > pv.eligibility.highAmountThreshold && ltvPct > pv.eligibility.ltvAboveThreshold) {
    push({ code: "LTV-HIGH-AMT", severity: "APPLIED", category: "financing", message: `High loan-amount LTV cap applied (> ${fmtMoney(pv.eligibility.highAmountThreshold)})`, previousValue: `${ltvPct}%`, resultingValue: `${pv.eligibility.ltvAboveThreshold}%`, source: pd.bankId });
    ltvPct = pv.eligibility.ltvAboveThreshold;
  }

  /* ---- multi-property rule (> N properties per AECB/internal → LTV cap) ---- */
  const mp = pv.eligibility.multiPropertyRule;
  if (mp && c.propertiesOwned != null && c.propertiesOwned > mp.minCount && ltvPct > mp.ltv) {
    push({ code: "MULTI-PROP", severity: "APPLIED", category: "financing", message: `Multi-property LTV cap applied (${c.propertiesOwned} properties > ${mp.minCount})`, previousValue: `${ltvPct}%`, resultingValue: `${mp.ltv}%`, source: pd.bankId, explanation: "Identified via AECB or internal records." });
    ltvPct = mp.ltv;
  }

  /* ---- high-risk bands (nationality / sector), strictest match wins ---- */
  const bands = pv.eligibility.highRiskBands ?? [];
  if (bands.length && (c.nationality || c.sector)) {
    const nat = (c.nationality ?? "").toLowerCase();
    const sector = (c.sector ?? "").toLowerCase();
    const dev = (c.developer ?? "").toLowerCase();
    const topDevs = ctx.topDevelopers ?? [];
    const hits: { band: HighRiskBand; via: string }[] = [];
    for (const band of bands) {
      const natHit = (band.nationalities ?? []).some((n) => nat && n.toLowerCase() === nat);
      let secHit = (band.sectorKeywords ?? band.sectors).some((k) => sector && sector.includes(k.toLowerCase()));
      if (secHit && band.topDeveloperExempt && dev && topDevs.some((td) => { const t = td.toLowerCase(); return dev.includes(t) || t.includes(dev); })) {
        secHit = false;
        push({ code: "HR-DEV-EXEMPT", severity: "INFO", category: "eligibility", message: `Top-developer exemption — ${c.developer} is on the approved list; standard policy applies`, source: pd.bankId });
      }
      if (natHit) hits.push({ band, via: "nationality" });
      else if (secHit) hits.push({ band, via: "sector" });
    }
    if (hits.length) {
      const strictest = hits.reduce((a, b) => (a.band.ltv <= b.band.ltv ? a : b));
      if (ltvPct > strictest.band.ltv) {
        push({ code: "HR-LTV", severity: "APPLIED", category: "financing", message: `High-risk segment LTV cap ${strictest.band.ltv}% applied (${strictest.via})`, previousValue: `${ltvPct}%`, resultingValue: `${strictest.band.ltv}%`, source: pd.bankId });
        ltvPct = strictest.band.ltv;
      }
    }
  }

  /* ---- property-value-banded LTV (CBD revised parameters) ---- */
  const valueBands = (pv.eligibility.ltvBands ?? []).filter((b) => !b.employment || b.employment === c.employment);
  if (valueBands.length && eligibleValue > 0) {
    const sorted = [...valueBands].sort((a, b) => a.upTo - b.upTo);
    const hit = sorted.find((b) => eligibleValue <= b.upTo) ?? sorted[sorted.length - 1];
    if (hit && ltvPct > hit.ltv) {
      push({ code: "LTV-BAND", severity: "APPLIED", category: "financing", message: `Property-value LTV band applied${hit.employment ? ` (${hit.employment.replace(/_/g, " ").toLowerCase()})` : ""} — value ≤ ${fmtMoney(hit.upTo)}`, previousValue: `${ltvPct}%`, resultingValue: `${hit.ltv}%`, source: pd.bankId });
      ltvPct = hit.ltv;
    }
  }

  /* ---- emirate-conditional LTV (e.g. NR Dubai 60 / Abu Dhabi 50) ---- */
  const byEmirate = pv.eligibility.ltvByEmirate?.[c.emirate];
  if (byEmirate != null && ltvPct > byEmirate) {
    push({ code: "LTV-EMIRATE", severity: "APPLIED", category: "financing", message: `Emirate-conditional LTV applied (${c.emirate})`, previousValue: `${ltvPct}%`, resultingValue: `${byEmirate}%`, source: pd.bankId });
    ltvPct = byEmirate;
  }

  /* ---- construction / off-plan finance LTV cap ---- */
  const isConstruction = c.propertyStatus === "UNDER_CONSTRUCTION" || c.propertyStatus === "OFF_PLAN";
  if (pv.eligibility.constructionLtv != null && isConstruction && ltvPct > pv.eligibility.constructionLtv) {
    push({ code: "LTV-CONSTR", severity: "APPLIED", category: "financing", message: `Construction/off-plan finance LTV cap applied`, previousValue: `${ltvPct}%`, resultingValue: `${pv.eligibility.constructionLtv}%`, source: pd.bankId });
    ltvPct = pv.eligibility.constructionLtv;
  }

  /* ---- land purchase LTV cap ---- */
  if (pv.eligibility.landLtv != null && c.propertyStatus === "LAND" && ltvPct > pv.eligibility.landLtv) {
    push({ code: "LTV-LAND", severity: "APPLIED", category: "financing", message: `Land purchase LTV cap applied`, previousValue: `${ltvPct}%`, resultingValue: `${pv.eligibility.landLtv}%`, source: pd.bankId });
    ltvPct = pv.eligibility.landLtv;
  }

  /* ---- commercial property LTV cap (e.g. DIB shops 62%) ---- */
  if (pv.eligibility.commercialLtv != null && c.propertyType === "COMMERCIAL" && ltvPct > pv.eligibility.commercialLtv) {
    push({ code: "LTV-COMM", severity: "APPLIED", category: "financing", message: `Commercial property LTV cap applied`, previousValue: `${ltvPct}%`, resultingValue: `${pv.eligibility.commercialLtv}%`, source: pd.bankId });
    ltvPct = pv.eligibility.commercialLtv;
  }

  /* ---- leasehold restriction (e.g. Emirates Islamic cannot finance leasehold) ---- */
  if (pv.eligibility.leaseholdAllowed === false && c.propertyTenure === "LEASEHOLD") {
    blocked = true;
    push({ code: "LEASEHOLD", severity: "BLOCK", category: "eligibility", message: `Bank cannot finance leasehold property`, explanation: `${pd.bankId} policy: leasehold not eligible`, source: pd.bankId });
  }

  const maxByLtv = ltvPct > 0 && eligibleValue > 0 ? Math.floor((eligibleValue * ltvPct) / 100) : 0;

  /* ---- max loan cap ---- */
  let maxLoanCap = pv.eligibility.maxLoan ?? Infinity;
  const byNat = pv.eligibility.maxLoanByNationality?.[c.nationality];
  if (byNat != null) maxLoanCap = Math.min(maxLoanCap, byNat);
  /* RAKBANK-style income multiple: up to N × annual income, capped by the product ceiling. */
  const mult = pv.eligibility.maxLoanIncomeMultiple?.[c.customerType];
  if (mult != null) {
    const byIncome = Math.floor((c.monthlyIncome + c.otherIncome) * 12 * mult);
    if (byIncome < maxLoanCap) {
      maxLoanCap = byIncome;
      push({ code: "MAX-LOAN-MULT", severity: "INFO", category: "financing", message: `Max loan capped at ${mult}× annual income`, resultingValue: fmtMoney(byIncome), source: pd.bankId });
    }
  }
  if (maxLoanCap !== Infinity && maxByLtv > maxLoanCap) {
    push({ code: "MAX-LOAN", severity: "WARN", category: "financing", message: `Loan capped at ${fmtMoney(maxLoanCap)} (product ceiling)`, previousValue: fmtMoney(maxByLtv), resultingValue: fmtMoney(maxLoanCap), source: pd.bankId });
  }
  const ltvLimited = Math.min(maxByLtv, maxLoanCap === Infinity ? maxByLtv : maxLoanCap);

  /* ---- tenure & age (retirement age is a policy rule, never hard-coded) ---- */
  const retireCands = ctx.rules
    .filter((r) => r.module === "RETIRE" && r.active)
    .map((r) => candFromScopedRule(r, c, pd.bankId))
    .filter((x): x is RuleCandidate => x != null);
  const retireRes = resolveSlot(retireCands);
  let retireAge: number | null = null;
  if (retireRes) {
    retireAge = retireRes.winner.value;
    firedRules.push(retireRes);
    push({
      code: "RETIRE-AGE", severity: "APPLIED", category: "tenure", message: `Retirement/maturity age ${retireAge} from ${retireRes.winner.refLabel}`,
      ruleId: retireRes.winner.refId, ruleVersion: retireRes.winner.version, resultingValue: `${retireAge}`,
      explanation: retireRes.overridden.length ? `overrode ${retireRes.overridden.map((o) => o.refLabel).join(", ")}` : undefined,
    });
  } else {
    unknown = true;
    push({ code: "RETIRE-UNKNOWN", severity: "WARN", category: "tenure", message: "No retirement-age rule matches this client — age limit is UNKNOWN", explanation: "Add a RETIRE rule scoped to this customer type / employment." });
  }
  const maxByAge = retireAge == null ? Number.POSITIVE_INFINITY : Math.max(0, (retireAge - c.age) * 12);
  const capMonths = pv.tenure.maxMonths ?? 300;
  let tenure = Math.min(capMonths, maxByAge);
  if (pv.tenure.minMonths != null && tenure < pv.tenure.minMonths) {
    push({ code: "MIN-TENOR", severity: "INFO", category: "tenure", message: `Tenure raised to product minimum of ${Math.round(pv.tenure.minMonths / 12)} years`, previousValue: `${Math.round(tenure / 12)} yrs`, resultingValue: `${Math.round(pv.tenure.minMonths / 12)} yrs`, source: pd.bankId });
    tenure = Math.min(pv.tenure.minMonths, capMonths);
  }
  if (retireAge != null && maxByAge < 12) {
    blocked = true;
    push({ code: "AGE", severity: "BLOCK", category: "tenure", message: `Age at maturity exceeds limit (retires at ${retireAge})`, explanation: `client is ${c.age}; tenure would end at ${c.age + 1}+`, source: pd.bankId });
  } else if (retireAge != null && maxByAge < capMonths) {
    refer = refer || maxByAge < 60;
    push({ code: "AGE", severity: maxByAge < 60 ? "WARN" : "INFO", category: "tenure", message: `Tenure capped at ${tenure} months by age`, previousValue: `${capMonths} mo`, resultingValue: `${tenure} mo`, source: pd.bankId });
  }

  /* ---- income group: recognition percentages + variable-income cap ---- */
  let recognizedIncome = c.monthlyIncome + c.otherIncome;
  const ir = pv.eligibility.incomeRecognition;
  const ib = c.incomeBreakdown;
  if (ir && ib) {
    const pct = (v?: number) => v ?? 100;
    const fixed = (ib.basic ?? 0) * (pct(ir.basicPct) / 100) + (ib.allowances ?? 0) * (pct(ir.allowancePct) / 100);
    let variable = (ib.commission ?? 0) * (pct(ir.commissionPct) / 100) + (ib.bonus ?? 0) * (pct(ir.bonusPct) / 100)
      + (ib.rental ?? 0) * (pct(ir.rentalPct) / 100) + (ib.business ?? 0) * (pct(ir.businessPct) / 100);
    if (pv.eligibility.variableIncomeCapPct != null && variable > fixed) {
      push({ code: "VAR-INCOME-CAP", severity: "WARN", category: "affordability", message: `Variable income capped — may not exceed fixed income`, previousValue: fmtMoney(variable), resultingValue: fmtMoney(fixed), source: pd.bankId });
      variable = fixed;
    }
    recognizedIncome = fixed + variable;
    push({ code: "INCOME-RECOG", severity: "INFO", category: "affordability", message: `Recognized income after recognition rules`, resultingValue: fmtMoney(recognizedIncome) + "/mo", source: pd.bankId });
  }

  /* ---- affordability: DBR ceiling via resolver (scope-matched, never fabricated) ---- */
  const dbrCands = ctx.rules
    .filter((r) => r.module === "DBR" && r.active)
    .map((r) => candFromScopedRule(r, c, pd.bankId))
    .filter((x): x is RuleCandidate => x != null);
  const dbrRes = resolveSlot(dbrCands);
  /* 50 is only a computational placeholder when no rule exists; the verdict is
     flagged UNKNOWN so nobody relies on it. */
  const dbrCap = dbrRes ? dbrRes.winner.value : 50;
  if (dbrRes) firedRules.push(dbrRes);
  else {
    unknown = true;
    push({ code: "DBR-UNKNOWN", severity: "WARN", category: "affordability", message: "No DBR ceiling rule matches this client — affordability limit is UNKNOWN", explanation: "Add a DBR rule (global or bank-scoped)." });
  }
  const ccPct = pv.affordability.ccPct ?? 5;
  const existingOblig = c.monthlyLiabilities + c.creditCardLimits * (ccPct / 100);
  const income = recognizedIncome;
  let availForEmi = Math.max(0, income * (dbrCap / 100) - existingOblig);
  /* DIB-style: the life-insurance premium is added to the EMI inside the DBR calc,
     which reduces the EMI headroom available for the loan. */
  const lifePct = pv.fees.lifeInsurancePct;
  if (pv.affordability.dbrIncludesInsurance && lifePct != null && c.loanRequested > 0) {
    /* Basis-aware: a per-annum premium is spread over 12 months. */
    const isPA = pv.fees.lifeInsuranceBasis === "PA";
    const monthlyIns = (c.loanRequested * (lifePct / 100)) / (isPA ? 12 : 1);
    availForEmi = Math.max(0, availForEmi - monthlyIns);
    push({ code: "DBR-INS", severity: "INFO", category: "affordability", message: `Life insurance (${fmtMoney(monthlyIns)}/mo${isPA ? ", p.a. basis ÷12" : ""}) counted inside the DBR, reducing EMI headroom`, resultingValue: fmtMoney(availForEmi) + "/mo available", source: pd.bankId });
  }
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
    const needsIndex = cell.structure === "MARGIN_INDEX" || cell.structure === "VAR_DAY1";
    if (needsIndex && ratePct == null) {
      /* An index-based cell matched but no EIBOR fix is published — we must not quote. */
      unknown = true;
      recipe = cell.index === "SCBLR" ? "pricing unconfirmed — SCBLR (SCB internal benchmark) not published" : "pricing unconfirmed — EIBOR fix unavailable";
      push({ code: "EIBOR-UNKNOWN", severity: "WARN", category: "pricing", message: cell.index === "SCBLR" ? "SCB's variable rate is keyed to SCBLR — the bank's internal benchmark, which is never published, so the variable rate cannot be confirmed" : "Current EIBOR fix unavailable — index-based pricing cannot be confirmed", explanation: cell.index === "SCBLR" ? "Fixed introductory rates remain confirmable; only the post-intro variable leg is unconfirmed." : "Publish an EIBOR fix, then re-run. The engine never invents an index value." });
    } else {
      push({ code: "RATE", severity: "APPLIED", category: "pricing", message: `Indicative rate ${ratePct != null ? ratePct.toFixed(2) + "%" : "n/a"} — ${recipe}`, resultingValue: ratePct != null ? `${ratePct.toFixed(2)}%` : undefined, source: pd.bankId, explanation: cell.note });
      if (cell.stressRate != null)
        push({ code: "STRESS", severity: "INFO", category: "affordability", message: `Bank-published stress rate ${cell.stressRate.toFixed(2)}% applies for DSR`, resultingValue: `${cell.stressRate.toFixed(2)}%`, source: pd.bankId });
      else if (pv.affordability.stressAddPct != null && ratePct != null)
        /* Formula-based stress (e.g. Emirates Islamic "current rate plus 2%"). */
        push({ code: "STRESS", severity: "INFO", category: "affordability", message: `Stress rate = indicative rate + ${pv.affordability.stressAddPct}% = ${(ratePct + pv.affordability.stressAddPct).toFixed(2)}% for DSR`, resultingValue: `${(ratePct + pv.affordability.stressAddPct).toFixed(2)}%`, source: pd.bankId });
      else if (pv.affordability.stressRecipe != null) {
        /* Margin-based stress (e.g. ENBD "post-fixed margin 1.79% + 1M EIBOR"). */
        const sr = pv.affordability.stressRecipe;
        const idxVal = ctx.eibor ? (sr.index === "EIBOR_1M" ? ctx.eibor.m1 : sr.index === "EIBOR_3M" ? ctx.eibor.m3 : sr.index === "EIBOR_6M" ? ctx.eibor.m6 : ctx.eibor.y1) : null;
        if (idxVal != null)
          push({ code: "STRESS", severity: "INFO", category: "affordability", message: `Stress rate = ${sr.margin}% + ${sr.index.replace("_", " ")} (${idxVal}%) = ${(sr.margin + idxVal).toFixed(2)}% for DSR`, resultingValue: `${(sr.margin + idxVal).toFixed(2)}%`, source: pd.bankId });
        else
          push({ code: "STRESS-UNKNOWN", severity: "WARN", category: "affordability", message: `Stress recipe ${sr.margin}% + ${sr.index} cannot be confirmed — EIBOR fix unavailable`, source: pd.bankId });
      }
      for (const p of promos) {
        push({ code: "PROMO", severity: "INFO", category: "pricing", message: `Live promo: ${p.name}`, explanation: p.summary, source: "PROMO" });
      }
    }
  }

  /* ---- employer-based rate discount (e.g. ADCB −0.25% for approved companies) ---- */
  const discounts = pv.fees.employerDiscounts ?? [];
  if (ratePct != null && discounts.length && c.employer) {
    const emp = c.employer.toLowerCase();
    const hit = discounts.find((dd) => dd.employers.some((e) => emp.includes(e.toLowerCase())));
    if (hit) {
      const before = ratePct;
      ratePct = Math.max(0, ratePct - hit.bps / 100);
      push({ code: "EMPLOYER-DISC", severity: "APPLIED", category: "pricing", message: `Employer discount −${(hit.bps / 100).toFixed(2)}% (${hit.label})`, previousValue: before.toFixed(2) + "%", resultingValue: ratePct.toFixed(2) + "%", source: pd.bankId, explanation: `Employer "${c.employer}" is on the approved list.` });
    }
  }

  /* ---- LTV-conditional rate discount (e.g. ADIB −0.25% when LTV ≤ 60%) ---- */
  const ltvDiscs = pv.fees.ltvDiscounts ?? [];
  if (ratePct != null && ltvDiscs.length && ltvPct > 0) {
    const hit = ltvDiscs.find((dd) => ltvPct <= dd.maxLtv);
    if (hit) {
      const before = ratePct;
      ratePct = Math.max(0, ratePct - hit.bps / 100);
      push({ code: "LTV-DISC", severity: "APPLIED", category: "pricing", message: `Low-LTV discount −${(hit.bps / 100).toFixed(2)}% (LTV ≤ ${hit.maxLtv}%)`, previousValue: before.toFixed(2) + "%", resultingValue: ratePct.toFixed(2) + "%", source: pd.bankId });
    }
  }

  /* ---- generic conditional rate adjustments (CBD: refinance +10, >10M +75, LTV>85%&<2M +30) ---- */
  for (const adj of pv.fees.rateAdjustments ?? []) {
    if (ratePct == null) break;
    const conds: boolean[] = [];
    if (adj.txTypes) conds.push(c.txType != null && adj.txTypes.includes(c.txType));
    if (adj.employment) conds.push(c.employment === adj.employment);
    if (adj.loanGt != null) conds.push(c.loanRequested > adj.loanGt);
    if (adj.loanLt != null) conds.push(c.loanRequested < adj.loanLt);
    if (adj.ltvGt != null) conds.push(ltvPct > adj.ltvGt);
    if (adj.ageGt != null) conds.push(c.age > adj.ageGt);
    if (adj.lowDoc != null) conds.push((c.lowDoc ?? false) === adj.lowDoc);
    if (adj.financeCount != null) conds.push(c.financeCount === adj.financeCount);
    if (conds.length && conds.every(Boolean)) {
      const before = ratePct;
      const sign = adj.bps >= 0 ? "+" : "−";
      ratePct = Math.max(0, ratePct + adj.bps / 100);
      push({ code: "RATE-ADJ", severity: "APPLIED", category: "pricing", message: `${adj.label}: ${sign}${(Math.abs(adj.bps) / 100).toFixed(2)}%`, previousValue: before.toFixed(2) + "%", resultingValue: ratePct.toFixed(2) + "%", source: pd.bankId });
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
  /* Precedence: blocked → UNKNOWN (missing rule/fixing) → not eligible → refer/conditions → eligible.
     UNKNOWN is checked before "eligible <= 0" because a missing LTV rule or missing EIBOR fix
     zeroes the eligible amount — that is "we cannot determine", not "rejected". */
  let verdict: Verdict = "ELIGIBLE";
  if (blocked) verdict = "NOT_ELIGIBLE";
  else if (unknown) { verdict = "UNKNOWN"; conditions.push("One or more required rules/fixings are missing — verify before relying on this result."); }
  else if (eligible <= 0) verdict = "NOT_ELIGIBLE";
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
/* Each product is evaluated in isolation: a malformed rule set must never
   crash the whole comparison grid. A thrown error degrades to an UNKNOWN
   verdict for that one product, and the failure is surfaced as a finding. */
function errorDecision(pd: ProductDef, e: unknown): ProductDecision {
  const msg = e instanceof Error ? e.message : String(e);
  return {
    productDefId: pd.id, bankId: pd.bankId, productName: pd.name, productVersion: 0,
    verdict: "UNKNOWN", eligibleAmount: 0, ltvPct: 0, dbrPct: 0, tenureMonths: 0,
    ratePct: null, rateRecipe: "evaluation failed", fees: 0, tatDays: null,
    headlineFindings: [{ code: "EVAL-ERROR", severity: "WARN", category: "eligibility", message: `Could not evaluate this product — ${msg}`, explanation: "Fix the product's rules in the Bank Rule Engine, then re-run." }],
    findings: [], firedRules: [], conditions: [], remediations: [], score: 0,
  };
}
export function evaluateAll(productDefs: ProductDef[], c: ClientProfile, ctx: EvalCtx): ProductDecision[] {
  return productDefs.map((pd) => {
    try { return evaluateProduct(pd, c, ctx); }
    catch (e) { console.error(`evaluateProduct failed for ${pd.id}:`, e); return errorDecision(pd, e); }
  });
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
export function replayDecision(snap: DecisionSnapshot, productDefs: ProductDef[], rules: Rule[], promos: Promo[], today: string, topDevelopers?: string[]): { diffs: ReplayDiff[]; changed: boolean } {
  /* Replay uses the SAME EIBOR fix stored in the snapshot, so index movement
     doesn't masquerade as a rule change. Drift therefore means a rule changed. */
  const ctx: EvalCtx = { eibor: snap.eiborFix, rules, promos, today, topDevelopers };
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

/* ---------- person → normalized profile (full field capture) ---------- */
export function personToProfile(p: {
  name: string; nationality: string; customerType: ClientProfile["customerType"]; employment: ClientProfile["employment"];
  dob: string; monthlySalary: number; otherIncome: number; financeCount: 1 | 2;
  liabilities: { monthly: number }[]; cards: { limit: number }[]; sector?: string; yearsEmployed?: number;
  aecbScore?: number; negativeBureau?: boolean; homeCountryLiabilitiesMonthly?: number; dependants?: number; goldenVisa?: boolean;
  lobYears?: number; losMonths?: number; lowDoc?: boolean; salaryTransfer?: boolean;
  emirate?: string; uaeResident?: boolean;
  basicSalary?: number; allowances?: number; commission?: number; bonus?: number; rentalIncome?: number; businessIncome?: number;
  propertiesOwned?: number; developer?: string;
  segment?: string; employer?: string; preferredFixedYears?: number; existingLoanRate?: number; relationship?: "ETB" | "NTB";
}, propertyValue: number, loanRequested: number, age: number, txType?: ClientProfile["txType"],
  propertyUse?: ClientProfile["propertyUse"], propertyStatus?: ClientProfile["propertyStatus"], valuation?: number): ClientProfile {
  const liabilities = p.liabilities.reduce((s, l) => s + l.monthly, 0) + (p.homeCountryLiabilitiesMonthly ?? 0);
  return {
    name: p.name, nationality: p.nationality, customerType: p.customerType,
    residency: p.customerType === "NON_RESIDENT" || p.uaeResident === false ? "NON_RESIDENT" : "RESIDENT",
    employment: p.employment, age,
    monthlyIncome: p.monthlySalary, otherIncome: p.otherIncome,
    monthlyLiabilities: liabilities,
    creditCardLimits: p.cards.reduce((s, c) => s + c.limit, 0),
    propertyValue, loanRequested, financeCount: p.financeCount,
    propertyType: "RESIDENTIAL", emirate: p.emirate ?? "DUBAI", sector: p.sector ?? "",
    yearsEmployed: p.yearsEmployed ?? 2,
    propertiesOwned: p.propertiesOwned, developer: p.developer,
    segment: p.segment, employer: p.employer, preferredFixedYears: p.preferredFixedYears,
    existingLoanRate: p.existingLoanRate, relationship: p.relationship,
    /* credit group */
    aecbScore: p.aecbScore, negativeBureau: p.negativeBureau,
    homeCountryLiabilitiesMonthly: p.homeCountryLiabilitiesMonthly,
    dependants: p.dependants, goldenVisa: p.goldenVisa,
    /* employment group */
    lobYears: p.lobYears, losMonths: p.losMonths, lowDoc: p.lowDoc, salaryTransfer: p.salaryTransfer,
    /* property group */
    propertyUse, propertyStatus, valuation,
    /* transaction group */
    txType,
    /* income breakdown */
    incomeBreakdown: {
      basic: p.basicSalary ?? p.monthlySalary, allowances: p.allowances, commission: p.commission,
      bonus: p.bonus, rental: p.rentalIncome, business: p.businessIncome,
    },
  };
}
