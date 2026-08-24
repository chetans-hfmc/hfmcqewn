/* ============================================================
   HFMC — pure calculation & rule engine (no UI, no state writes)
   ============================================================ */
import type { Case, EligGate, EiborRow, Person, RateCell, StageDef } from "./types";

const dISO = (dt: Date) => dt.toISOString().slice(0, 10);
const addD = (iso: string, n: number) => { const dt = new Date(iso + "T00:00:00"); dt.setDate(dt.getDate() + n); return dISO(dt); };
const dayDiff = (a: string, b: string) => Math.round((new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000);

/* ---------- core finance ---------- */
export function emi(loan: number, annualRate: number, months: number): number {
  if (!loan || !months) return 0;
  const r = annualRate / 1200;
  if (r === 0) return loan / months;
  return Math.round((loan * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
}

export function ageYears(dob: string, on?: string): number {
  if (!dob) return 0;
  const b = new Date(dob + "T00:00:00"); const n = new Date((on ?? dISO(new Date())) + "T00:00:00");
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return Math.max(0, a);
}

export function maxTenure(dob: string, maxMonths: number, retireAge: number, on?: string): number {
  const age = ageYears(dob, on);
  const byAge = Math.max(0, (retireAge - age) * 12);
  return Math.min(maxMonths, byAge);
}

export function liabilitiesMonthly(p: Person): number {
  return p.liabilities.reduce((s, l) => s + l.monthly, 0);
}
export function dbrPct(p: Person, extraEmi = 0): number {
  const income = p.monthlySalary + p.otherIncome;
  if (!income) return 0;
  return ((liabilitiesMonthly(p) + extraEmi) / income) * 100;
}

/* ---------- TAT & escalation ---------- */
export interface TatInfo { trigger?: string; target?: string; elapsed: number; daysOver: number; level: 0 | 1 | 2 | 3; }

export function tatFor(c: Case, stageId: string, stages: StageDef[], today: string): TatInfo {
  const def = stages.find((s) => s.id === stageId);
  const trigger = c.triggerDates?.[stageId];
  const sla = def?.sla ?? 0;
  if (!trigger) return { elapsed: 0, daysOver: 0, level: 0 };
  const elapsed = Math.max(0, dayDiff(today, trigger));
  const daysOver = Math.max(0, elapsed - sla);
  const level = daysOver < 1 ? 0 : daysOver === 1 ? 1 : daysOver === 2 ? 2 : 3;
  return { trigger, target: addD(trigger, sla), elapsed, daysOver, level };
}

export const ESC_LEVELS: { level: 0 | 1 | 2 | 3; tag: string; label: string; action: string; who: string; copied: string; dot: string; chip: string }[] = [
  { level: 0, tag: "ON TRACK", label: "Deadline not yet reached", action: "Normal follow-up call / email — document in audit trail", who: "Team member", copied: "—", dot: "bg-pine-500", chip: "bg-pine-100 text-pine-800" },
  { level: 1, tag: "LEVEL 1", label: "1 day after deadline", action: "Formal follow-up — flag to Team Leader", who: "Team member", copied: "Team Leader", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-700" },
  { level: 2, tag: "LEVEL 2", label: "2 days after deadline", action: "Team Leader sends escalation email", who: "Team Leader", copied: "Department Head", dot: "bg-rust-500", chip: "bg-rust-100 text-rust-700" },
  { level: 3, tag: "LEVEL 3", label: "3+ days after deadline", action: "Department Head escalates to Kiran", who: "Department Head", copied: "Kiran Suvarna (Owner)", dot: "bg-ink", chip: "bg-ink text-paper" },
];

export function escalationEmail(level: 1 | 2 | 3, client: string, bank: string, stage: string, ref: string, daysOver: number): { subject: string; body: string } {
  if (level === 1) return {
    subject: `[Level 1] Stage Overdue — ${client} / ${bank}`,
    body: `Dear Team,\n\nThe ${stage} stage for ${client} (${ref}, ${bank}) is ${daysOver} day(s) past its target deadline.\n\nRequesting urgent follow-up.\n\nRegards,\nHFMC Mortgage Operations`,
  };
  if (level === 2) return {
    subject: `[Level 2 Escalation] — ${client} / ${stage}`,
    body: `Dear Team,\n\n${stage} for ${client} (${ref}, ${bank}) has not progressed despite Level 1 follow-up — ${daysOver} days overdue.\n\nPlease advise next steps to avoid transaction risk.\n\nRegards,\nHFMC Mortgage Operations`,
  };
  return {
    subject: `[URGENT Level 3] Transaction at Risk — ${client}`,
    body: `Dear Sir,\n\nDespite Level 1 & 2 escalations, ${stage} for ${client} (${ref}, ${bank}) remains unresolved — ${daysOver} days overdue. Transaction risk is HIGH.\n\nRequesting your direct intervention.\n\nRegards,\nHFMC Mortgage Operations`,
  };
}

/* ---------- stage gates (evidence-based advancement) ---------- */
export function stageGates(c: Case, stages: StageDef[], tasks: { caseId: string; stageId: string; status: string }[], queries: { caseId: string; status: string }[]) {
  const def = stages.find((s) => s.id === c.stage);
  const docsOk = (c.docs ?? []).filter((d) => d.stageId === c.stage && d.status !== "NA").every((d) => d.status === "VERIFIED");
  const docsTotal = (c.docs ?? []).filter((d) => d.stageId === c.stage && d.status !== "NA").length;
  const docsDone = (c.docs ?? []).filter((d) => d.stageId === c.stage && d.status === "VERIFIED").length;
  const tasksOpen = tasks.filter((t) => t.caseId === c.id && t.stageId === c.stage && t.status === "OPEN").length;
  const queriesOpen = queries.filter((q) => q.caseId === c.id && q.status === "OPEN").length;
  const condsTotal = def?.conditions.length ?? 0;
  const condsDone = (def?.conditions ?? []).filter((_, i) => c.conditionsDone?.[`${c.stage}:${i}`]).length;
  const checks = [
    { label: "Stage documents verified", detail: `${docsDone}/${docsTotal} verified`, pass: docsOk },
    { label: "Stage tasks complete", detail: tasksOpen ? `${tasksOpen} open` : "all done", pass: tasksOpen === 0 },
    { label: "Bank queries closed", detail: queriesOpen ? `${queriesOpen} open` : "none open", pass: queriesOpen === 0 },
    { label: "Stage conditions cleared", detail: `${condsDone}/${condsTotal}`, pass: condsDone === condsTotal },
  ];
  return { pass: checks.every((x) => x.pass), checks };
}

/* ---------- eligibility gates (fail-fast, before pricing) ---------- */
export function evaluateGates(gates: EligGate[], ctx: { nationality?: string }): { blocked: boolean; reason?: string } {
  for (const g of gates) {
    if (g.kind === "FLAG" && g.hardStop) continue; // informational flags don't auto-block without profile context
    if (g.kind === "NATIONALITY_ALLOW" && ctx.nationality && g.values?.length) {
      if (!g.values.some((v) => v.toLowerCase() === ctx.nationality!.toLowerCase())) return { blocked: true, reason: g.label };
    }
    if (g.kind === "NATIONALITY_BLOCK" && ctx.nationality && g.values?.length) {
      if (g.values.some((v) => v.toLowerCase() === ctx.nationality!.toLowerCase())) return { blocked: true, reason: g.label };
    }
  }
  return { blocked: false };
}

/* ---------- rate cells: store the RECIPE, resolve live against EIBOR ---------- */
const eiborValue = (row: EiborRow | undefined, index?: string): number | null => {
  if (!row) return null;
  if (index === "EIBOR_1M") return row.m1;
  if (index === "EIBOR_3M") return row.m3;
  if (index === "EIBOR_6M") return row.m6;
  if (index === "EIBOR_1Y") return row.y1;
  return null;
};

export function resolveCellRate(cell: Pick<RateCell, "structure" | "fixedRate" | "margin" | "index" | "floor">, eibor: EiborRow | undefined): number | null {
  if (cell.structure === "FIXED" || cell.structure === "FIXED_THEN_VAR") return cell.fixedRate ?? null;
  if (cell.margin == null) return null;
  const idx = eiborValue(eibor, cell.index);
  if (idx == null) return null;
  const raw = cell.margin + idx;
  return cell.floor != null ? Math.max(raw, cell.floor) : raw;
}

const fN = (n: number) => (Math.round(n * 100) / 100).toString();
export function rateRecipe(cell: Pick<RateCell, "structure" | "fixedRate" | "fixedMonths" | "margin" | "index" | "floor">): string {
  if (cell.structure === "FIXED") return `${fN(cell.fixedRate ?? 0)}% fixed`;
  if (cell.structure === "FIXED_THEN_VAR") return `${fN(cell.fixedRate ?? 0)}% fixed${cell.fixedMonths ? ` ${Math.round(cell.fixedMonths / 12)}yr` : ""} then ${fN(cell.margin ?? 0)}% + ${cell.index ?? "3M EIBOR"}${cell.floor != null ? ` · floor ${fN(cell.floor)}%` : ""}`;
  return `${fN(cell.margin ?? 0)}% + ${cell.index ?? "3M EIBOR"}${cell.floor != null ? ` · floor ${fN(cell.floor)}%` : ""}`;
}

export const fmtDur = (min?: number) => {
  if (!min || min <= 0) return "—";
  const dd = Math.floor(min / 1440), hh = Math.floor((min % 1440) / 60), mm = min % 60;
  const p: string[] = [];
  if (dd) p.push(`${dd}d`); if (hh) p.push(`${hh}h`); if (mm || !p.length) p.push(`${mm}m`);
  return p.join(" ");
};
