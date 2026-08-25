/* ============================================================
   HFMC — pure calculation & TAT/escalation engine
   ============================================================ */
import type { Case, EiborRow, Person, StageDef } from "./types";
import { todayISO } from "./ui";

/* ---------- core finance math ---------- */
export function emi(loan: number, annualRate: number, months: number): number {
  if (loan <= 0 || months <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return loan / months;
  return (loan * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}
export function loanFromEmi(targetEmi: number, annualRate: number, months: number): number {
  if (targetEmi <= 0 || months <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return targetEmi * months;
  return (targetEmi * (Math.pow(1 + r, months) - 1)) / (r * Math.pow(1 + r, months));
}
export function ageYears(dob: string, on?: string): number {
  if (!dob) return 0;
  const b = new Date(dob + "T00:00:00"); const t = on ? new Date(on + "T00:00:00") : new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return Math.max(0, a);
}
export function maxTenure(dob: string, capMonths: number, retireAge: number, on?: string): number {
  const age = ageYears(dob, on);
  const byAge = Math.max(0, (retireAge - age) * 12);
  return Math.min(capMonths, byAge);
}
export function liabilitiesMonthly(p: Person): number {
  return p.liabilities.reduce((s, l) => s + l.monthly, 0) + p.cards.reduce((s, c) => s + c.limit * 0.05, 0);
}
export function dbrPct(p: Person, extraEmi = 0): number {
  const income = p.monthlySalary + p.otherIncome;
  if (income <= 0) return 0;
  return ((liabilitiesMonthly(p) + extraEmi) / income) * 100;
}

/* ---------- EIBOR ---------- */
export function latestEibor(rows: EiborRow[]): EiborRow | undefined {
  return rows.length ? rows[rows.length - 1] : undefined;
}

/* ---------- TAT & escalation ---------- */
const dayDiff = (a: string, b: string) => Math.round((new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000);
const addD = (iso: string, n: number) => { const dt = new Date(iso + "T00:00:00"); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };

export interface TatInfo { trigger?: string; target?: string; elapsed: number; daysOver: number; level: 0 | 1 | 2 | 3 }
export function tatFor(c: Case, stageId: string, stageList: StageDef[], today: string): TatInfo {
  const def = stageList.find((s) => s.id === stageId);
  const trigger = c.triggerDates?.[stageId];
  const sla = def?.sla ?? 0;
  if (!trigger) return { elapsed: 0, daysOver: 0, level: 0 };
  const elapsed = Math.max(0, dayDiff(today, trigger));
  const daysOver = Math.max(0, elapsed - sla);
  const level = daysOver < 1 ? 0 : daysOver === 1 ? 1 : daysOver === 2 ? 2 : 3;
  return { trigger, target: addD(trigger, sla), elapsed, daysOver, level };
}
export const ESC_LEVELS: { level: 0 | 1 | 2 | 3; tag: string; label: string; who: string; copied: string; dot: string; chip: string }[] = [
  { level: 0, tag: "ON TRACK", label: "Deadline not yet reached", who: "Team member", copied: "—", dot: "bg-pine-500", chip: "bg-pine-100 text-pine-800" },
  { level: 1, tag: "LEVEL 1", label: "1 day after deadline", who: "Team member", copied: "Team Leader", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-700" },
  { level: 2, tag: "LEVEL 2", label: "2 days after deadline", who: "Team Leader", copied: "Department Head", dot: "bg-rust-500", chip: "bg-rust-100 text-rust-700" },
  { level: 3, tag: "LEVEL 3", label: "3+ days after deadline", who: "Department Head", copied: "Kiran Suvarna (Owner)", dot: "bg-ink", chip: "bg-ink text-paper" },
];
export function escalationEmail(level: 1 | 2 | 3, client: string, bank: string, stage: string, ref: string, daysOver: number): { subject: string; body: string } {
  if (level === 1) return {
    subject: `[Level 1] Stage Overdue — ${client} / ${bank}`,
    body: `Dear Team,\n\nPlease note the ${stage} stage for ${client} (${ref}, ${bank}) is now ${daysOver} day(s) past its target deadline.\n\nRequesting urgent follow-up.\n\nRegards,\nHFMC Mortgage Operations`,
  };
  if (level === 2) return {
    subject: `[Level 2 Escalation] — ${client} / ${stage}`,
    body: `Dear Team,\n\nThe ${stage} stage for ${client} (${ref}, ${bank}) has not progressed despite Level 1 follow-up and is ${daysOver} days past target.\n\nPlease advise on next steps to avoid transaction risk.\n\nRegards,\nHFMC Mortgage Operations`,
  };
  return {
    subject: `[URGENT Level 3] Transaction at Risk — ${client}`,
    body: `Dear Sir,\n\nDespite Level 1 & 2 escalations, the ${stage} stage for ${client} (${ref}, ${bank}) remains unresolved — ${daysOver} days past target. Transaction risk is HIGH.\n\nRequesting your direct intervention.\n\nRegards,\nHFMC Mortgage Operations`,
  };
}

/* ---------- stage gates (evidence-based progression) ---------- */
export function stageGates(c: Case, stages: StageDef[], tasks: { caseId: string; stageId: string; status: string }[], queries: { caseId: string; status: string }[]) {
  const stageIdx = stages.findIndex((s) => s.id === c.stage);
  const def = stages[stageIdx];
  const myDocs = c.docs.filter((d) => d.stageId === c.stage);
  const docsOk = myDocs.every((d) => d.status === "VERIFIED" || d.status === "NA");
  const openTasks = tasks.filter((t) => t.caseId === c.id && t.stageId === c.stage && t.status === "OPEN").length;
  const openQueries = queries.filter((q) => q.caseId === c.id && q.status === "OPEN").length;
  const conds = def?.conditions ?? [];
  const condsDone = conds.filter((_, i) => c.conditionsDone?.[`${c.stage}:${i}`]).length;
  const checks = [
    { label: "Stage documents verified", detail: `${myDocs.filter((d) => d.status === "VERIFIED" || d.status === "NA").length}/${myDocs.length || 0} cleared`, pass: docsOk },
    { label: "Stage tasks completed", detail: openTasks ? `${openTasks} open` : "all done", pass: openTasks === 0 },
    { label: "Bank queries resolved", detail: openQueries ? `${openQueries} open` : "none open", pass: openQueries === 0 },
    { label: "Stage conditions met", detail: `${condsDone}/${conds.length}`, pass: conds.length === 0 || condsDone === conds.length },
    { label: "Next action set", detail: c.nextAction ? "set" : "missing", pass: !!c.nextAction },
  ];
  return { pass: checks.every((x) => x.pass), checks, next: stages[stageIdx + 1] };
}
