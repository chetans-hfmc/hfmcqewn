import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { AppState, AuditEntry, BankQuery, CalcRecord, Case, DocItem, DocStatus, Lead, Person, Rule, Task, User, View } from "./types";
import { buildSeed, SEED_VERSION, SUPER_ADMIN } from "./seed";
import { nowISO, todayISO, uid, addDays } from "./ui";

const KEY = "hfmc-mos-state";

/* ---------- role → module access (TO VERIFY with compliance) ---------- */
export const ROLE_MODULES: Record<string, View[]> = {
  ADMIN: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "queries", "calculators", "templates", "rules", "users", "guide", "audit"],
  HEAD: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "queries", "calculators", "templates", "rules", "users", "guide", "audit"],
  TL: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "queries", "calculators", "templates", "guide", "audit"],
  SPO: ["dashboard", "tracker", "tat", "cases", "tasks", "documents", "queries", "calculators", "templates", "guide"],
  VRM: ["dashboard", "tracker", "tat", "people", "leads", "cases", "calculators", "templates", "guide"],
  PA: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "templates", "guide"],
  TBD: ["dashboard"],
};
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Super Admin", HEAD: "Head of Mortgage", TL: "Team Leader", SPO: "Sales Process Owner", VRM: "Virtual Relationship Mgr", PA: "Personal Assistant", TBD: "Role TBD",
};

/* Single-active-owner scoping: oversight roles see across; members see their own. */
export const OVERSIGHT: string[] = ["ADMIN", "HEAD"];
export function isOversight(role: string) { return OVERSIGHT.includes(role); }
export function teamOf(state: AppState, me: User): Set<string> {
  const ids = new Set<string>([me.id]);
  state.users.forEach((u) => { if (u.leaderId === me.id || u.team === me.team) ids.add(u.id); });
  return ids;
}

export type Action =
  | { t: "LOGIN"; userId: string } | { t: "LOGOUT" }
  | { t: "RESET" }
  | { t: "ADD_PERSON"; person: Person }
  | { t: "UPDATE_PERSON"; id: string; patch: Partial<Person> }
  | { t: "ADD_LEAD"; lead: Lead } | { t: "UPDATE_LEAD"; id: string; patch: Partial<Lead> }
  | { t: "CONVERT_LEAD"; leadId: string; caze: Case; tasks: Task[] }
  | { t: "PATCH_CASE"; id: string; patch: Partial<Case> }
  | { t: "HANDOFF_CASE"; caseId: string; toId: string; reason: string; kind: import("./types").HandoffKind }
  | { t: "HANDOFF_LEAD"; leadId: string; toId: string; reason: string }
  | { t: "ADVANCE_STAGE"; id: string; note?: string }
  | { t: "CLOSE_CASE"; id: string; audit?: string[] }
  | { t: "ADD_TASK"; task: Task } | { t: "UPDATE_TASK"; id: string; patch: Partial<Task> }
  | { t: "SET_DOC"; caseId: string; docId: string; status: DocStatus; note?: string; expiry?: string }
  | { t: "ADD_QUERY"; q: BankQuery } | { t: "UPDATE_QUERY"; id: string; patch: Partial<BankQuery> }
  | { t: "SAVE_CALC"; calc: CalcRecord }
  | { t: "SET_TRACKER"; caseId: string; date: string; note: string }
  | { t: "ADD_TRACKER_DAY"; date: string }
  | { t: "SET_TRIGGER"; caseId: string; stageId: string; date: string }
  | { t: "TOGGLE_CONDITION"; caseId: string; key: string; label: string }
  | { t: "ADD_CASE_NOTE"; caseId: string; text: string }
  | { t: "TOGGLE_QC"; caseId: string; list: "preappQc" | "submitQc" | "huspyQc"; id: string }
  | { t: "SET_DECISION"; caseId: string; decision: import("./types").PreappDecision }
  | { t: "SAVE_TEMPLATE"; template: import("./types").EmailTemplate; isNew?: boolean }
  | { t: "UPSERT_RULE"; rule: Rule; isNew?: boolean }
  | { t: "ADD_EIBOR"; row: AppState["eibor"][number] }
  | { t: "ADD_USER"; user: User } | { t: "UPDATE_USER"; id: string; patch: Partial<User> };

const log = (s: AppState, e: Omit<AuditEntry, "id" | "at" | "by">): AppState => ({
  ...s,
  audit: [{ id: "a" + uid(), at: nowISO(), by: s.session ?? "system", ...e }, ...s.audit],
});

function stageBootstrap(s: AppState, caze: Case): { tasks: Task[]; docs: DocItem[] } {
  const def = s.stages.find((st) => st.id === caze.stage)!;
  const tasks: Task[] = def.tasks.map((t) => ({
    id: "t" + uid(), caseId: caze.id, stageId: def.id, type: t.split(" ").slice(0, 3).join(" "),
    title: t, ownerId: caze.ownerId, priority: "MEDIUM" as const, status: "OPEN" as const,
    createdAt: nowISO(), due: addDays(todayISO(), def.sla),
  }));
  const docs: DocItem[] = def.docs.map((dt) => ({
    id: "d" + uid(), typeId: dt, stageId: def.id, status: "MISSING" as DocStatus,
    updatedAt: nowISO(), updatedBy: s.session ?? "system",
  }));
  return { tasks, docs };
}

function reducer(state: AppState, a: Action): AppState {
  switch (a.t) {
    case "LOGIN": return log({ ...state, session: a.userId }, { module: "AUTH", action: "Signed in", target: state.users.find((u) => u.id === a.userId)?.name ?? a.userId });
    case "LOGOUT": return { ...state, session: null };
    case "RESET": { const fresh = buildSeed(); return { ...fresh, session: state.session }; }
    case "ADD_PERSON": return log({ ...state, persons: [a.person, ...state.persons] }, { module: "PERSON", action: "Person created", target: a.person.name });
    case "UPDATE_PERSON": return log({ ...state, persons: state.persons.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) }, { module: "PERSON", action: "Person updated", target: state.persons.find((p) => p.id === a.id)?.name ?? a.id });
    case "ADD_LEAD": return log({ ...state, leads: [a.lead, ...state.leads] }, { module: "LEAD", action: "Lead created", target: `${a.lead.ref} · ${state.persons.find((p) => p.id === a.lead.personId)?.name ?? ""}` });
    case "UPDATE_LEAD": {
      const before = state.leads.find((l) => l.id === a.id);
      const s = { ...state, leads: state.leads.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) };
      if (a.patch.status && before) return log(s, { module: "LEAD", action: "Lead status", target: `${before.ref} → ${a.patch.status}` });
      return s;
    }
    case "CONVERT_LEAD": {
      const lead = state.leads.find((l) => l.id === a.leadId);
      let s: AppState = {
        ...state,
        cases: [a.caze, ...state.cases],
        tasks: [...a.tasks, ...state.tasks],
        leads: state.leads.map((l) => (l.id === a.leadId ? { ...l, status: "CONVERTED" as const, notes: `Converted to ${a.caze.ref}`, nextAction: undefined, due: undefined } : l)),
      };
      s = log(s, { module: "LEAD", action: "Lead converted", target: `${lead?.ref ?? a.leadId} → ${a.caze.ref}`, caseId: a.caze.id });
      s = log(s, { module: "CASE", action: "Case opened", target: `${a.caze.ref} at ${state.stages.find((st) => st.id === a.caze.stage)?.name}`, caseId: a.caze.id });
      return s;
    }
    case "PATCH_CASE": {
      const before = state.cases.find((c) => c.id === a.id)!;
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.id ? { ...c, ...a.patch } : c)) };
      if (a.patch.ownerId && a.patch.ownerId !== before.ownerId)
        return log(s, { module: "CASE", action: "Owner changed", target: before.ref, detail: `→ ${state.users.find((u) => u.id === a.patch.ownerId)?.name}`, caseId: a.id });
      return log(s, { module: "CASE", action: "Control panel updated", target: before.ref, detail: a.patch.waitingFor ? `waiting for ${a.patch.waitingFor}` : a.patch.nextAction, caseId: a.id });
    }
    case "ADVANCE_STAGE": {
      const c = state.cases.find((x) => x.id === a.id)!;
      const idx = state.stages.findIndex((st) => st.id === c.stage);
      const next = state.stages[idx + 1];
      if (!next) return state;
      const updated: Case = {
        ...c, stage: next.id,
        stageHistory: [...c.stageHistory, { stageId: next.id, at: nowISO(), by: state.session ?? "", note: a.note }],
        triggerDates: { ...(c.triggerDates ?? {}), [next.id]: todayISO() },
        nextAction: next.tasks[0] ?? undefined,
        nextActionDue: addDays(todayISO(), next.sla),
        waitingFor: undefined, pendingReason: undefined, blocker: undefined,
      };
      const boot = stageBootstrap(state, updated);
      updated.docs = [...c.docs, ...boot.docs];
      let s: AppState = { ...state, cases: state.cases.map((x) => (x.id === a.id ? updated : x)), tasks: [...boot.tasks, ...state.tasks] };
      s = log(s, { module: "STAGE", action: "Stage advanced", target: `${c.ref} · ${state.stages[idx].name} → ${next.name}`, caseId: a.id });
      return s;
    }
    case "CLOSE_CASE": {
      const c = state.cases.find((x) => x.id === a.id)!;
      let s: AppState = { ...state, cases: state.cases.map((x) => (x.id === a.id ? { ...x, status: "CLOSED" as const, closedAt: todayISO(), closureAudit: a.audit, nextAction: undefined, waitingFor: undefined, pendingReason: undefined, blocker: undefined } : x)) };
      if (a.audit?.length) s = log(s, { module: "CASE", action: "Closure audit passed", target: c.ref, detail: `${a.audit.length}/13 items confirmed`, caseId: a.id });
      s = log(s, { module: "CASE", action: "Case closed", target: c.ref, detail: "Golden record archived", caseId: a.id });
      return s;
    }
    case "HANDOFF_CASE": {
      const c = state.cases.find((x) => x.id === a.caseId);
      if (!c || c.ownerId === a.toId) return state;
      const from = state.users.find((u) => u.id === c.ownerId)?.name ?? c.ownerId;
      const to = state.users.find((u) => u.id === a.toId)?.name ?? a.toId;
      const h: import("./types").Handoff = { at: nowISO(), fromId: c.ownerId, toId: a.toId, reason: a.reason, kind: a.kind };
      const s = { ...state, cases: state.cases.map((x) => (x.id === a.caseId ? { ...x, ownerId: a.toId, handoffs: [...(x.handoffs ?? []), h] } : x)) };
      return log(s, { module: "CASE", action: "Handoff", target: c.ref, detail: `${from} → ${to} · ${a.kind} · ${a.reason}`, caseId: a.caseId });
    }
    case "HANDOFF_LEAD": {
      const l = state.leads.find((x) => x.id === a.leadId);
      if (!l || l.owner === a.toId) return state;
      const to = state.users.find((u) => u.id === a.toId)?.name ?? a.toId;
      const s = { ...state, leads: state.leads.map((x) => (x.id === a.leadId ? { ...x, owner: a.toId } : x)) };
      return log(s, { module: "LEAD", action: "Lead handed off", target: `${l.ref} → ${to}`, detail: a.reason });
    }
    case "ADD_TASK": return log({ ...state, tasks: [a.task, ...state.tasks] }, { module: "TASK", action: "Task created", target: a.task.title, caseId: a.task.caseId });
    case "UPDATE_TASK": {
      const before = state.tasks.find((t) => t.id === a.id);
      const stamp = a.patch.status === "DONE" ? { completedBy: state.session ?? "system" } : a.patch.status === "OPEN" ? { completedBy: undefined } : {};
      const s = { ...state, tasks: state.tasks.map((t) => (t.id === a.id ? { ...t, ...a.patch, ...stamp } : t)) };
      if (a.patch.status === "DONE" && before) return log(s, { module: "TASK", action: "Task completed", target: before.title, caseId: before.caseId });
      if (a.patch.status === "OPEN" && before) return log(s, { module: "TASK", action: "Task reopened", target: before.title, caseId: before.caseId });
      return s;
    }
    case "SET_DOC": {
      const c = state.cases.find((x) => x.id === a.caseId);
      const item = c?.docs.find((d) => d.id === a.docId);
      const dt = state.docTypes.find((t) => t.id === item?.typeId)?.name ?? item?.typeId ?? "";
      const s = {
        ...state,
        cases: state.cases.map((x) => x.id !== a.caseId ? x : {
          ...x, docs: x.docs.map((d) => (d.id === a.docId ? { ...d, status: a.status, note: a.note ?? d.note, expiry: a.expiry ?? d.expiry, updatedAt: nowISO(), updatedBy: state.session ?? "" } : d)),
        }),
      };
      return log(s, { module: "DOC", action: a.status === "VERIFIED" ? "Document verified" : a.status === "RECEIVED" ? "Document received" : a.status === "REJECTED" ? "Document rejected" : "Document marked", target: `${c?.ref} · ${dt}`, detail: a.status, caseId: a.caseId });
    }
    case "ADD_QUERY": return log({ ...state, queries: [a.q, ...state.queries] }, { module: "QUERY", action: "Query received", target: `${a.q.ref} · ${state.cases.find((c) => c.id === a.q.caseId)?.ref ?? ""}`, caseId: a.q.caseId });
    case "UPDATE_QUERY": {
      const before = state.queries.find((q) => q.id === a.id);
      const s = { ...state, queries: state.queries.map((q) => (q.id === a.id ? { ...q, ...a.patch } : q)) };
      if (a.patch.status === "CLOSED" && before) return log(s, { module: "QUERY", action: "Query closed", target: before.ref, caseId: before.caseId });
      return s;
    }
    case "SAVE_CALC": return log({ ...state, calcs: [a.calc, ...state.calcs] }, { module: "CALC", action: "Calculation saved", target: a.calc.label, caseId: a.calc.linkKind === "case" ? a.calc.linkId : undefined });
    case "SET_TRACKER": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze) return state;
      const tracker = (caze.tracker ?? []).filter((e) => e.date !== a.date);
      if (a.note.trim()) tracker.push({ date: a.date, note: a.note.trim() });
      tracker.sort((x, y) => x.date.localeCompare(y.date));
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, tracker } : c)) };
      return log(s, { module: "TRACKER", action: "Daily tracker updated", target: caze.ref, detail: `${a.date} — ${a.note.trim().slice(0, 90)}${a.note.trim().length > 90 ? "…" : ""}`, caseId: a.caseId });
    }
    case "ADD_TRACKER_DAY": {
      if (state.trackerDates.includes(a.date)) return state;
      return log({ ...state, trackerDates: [...state.trackerDates, a.date].sort() }, { module: "TRACKER", action: "Tracker day added", target: a.date });
    }
    case "SET_TRIGGER": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze) return state;
      const stageName = state.stages.find((s) => s.id === a.stageId)?.name ?? a.stageId;
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, triggerDates: { ...(c.triggerDates ?? {}), [a.stageId]: a.date } } : c)) };
      return log(s, { module: "TAT", action: "Trigger date set", target: caze.ref, detail: `${stageName} → ${a.date}`, caseId: a.caseId });
    }
    case "TOGGLE_CONDITION": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze) return state;
      const done = { ...(caze.conditionsDone ?? {}) };
      const next = !done[a.key];
      if (next) done[a.key] = true; else delete done[a.key];
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, conditionsDone: done } : c)) };
      return next ? log(s, { module: "TAT", action: "Stage condition cleared", target: caze.ref, detail: a.label, caseId: a.caseId }) : s;
    }
    case "ADD_CASE_NOTE": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze || !a.text.trim()) return state;
      const note = { id: "cn" + uid(), at: nowISO(), by: state.session ?? "system", text: a.text.trim() };
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, caseNotes: [...(c.caseNotes ?? []), note] } : c)) };
      return log(s, { module: "TAT", action: "Case note saved", target: caze.ref, detail: a.text.trim().slice(0, 90), caseId: a.caseId });
    }
    case "TOGGLE_QC": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze) return state;
      const items = caze[a.list] ?? [];
      const item = items.find((it) => it.id === a.id);
      const next = items.map((it) => (it.id === a.id ? { ...it, done: !it.done } : it));
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, [a.list]: next } : c)) };
      return item && !item.done ? log(s, { module: "QC", action: "QC check cleared", target: caze.ref, detail: item.label, caseId: a.caseId }) : s;
    }
    case "SAVE_TEMPLATE": {
      if (a.isNew) return log({ ...state, templates: [...state.templates, a.template] }, { module: "TEMPLATE", action: "Template created", target: a.template.name });
      return log({ ...state, templates: state.templates.map((t) => (t.id === a.template.id ? a.template : t)) }, { module: "TEMPLATE", action: "Template updated", target: a.template.name });
    }
    case "SET_DECISION": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze) return state;
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, preappDecision: a.decision } : c)) };
      return log(s, { module: "QC", action: "Pre-submission decision", target: caze.ref, detail: a.decision.replace(/_/g, " "), caseId: a.caseId });
    }
    case "UPSERT_RULE": {
      if (a.isNew) return log({ ...state, rules: [...state.rules, a.rule] }, { module: "RULE", action: "Rule created", target: `${a.rule.code} = ${a.rule.value}` });
      const before = state.rules.find((r) => r.id === a.rule.id);
      const s = { ...state, rules: state.rules.map((r) => (r.id === a.rule.id ? a.rule : r)) };
      if (before && before.value !== a.rule.value)
        return log(s, { module: "RULE", action: "Rule updated", target: `${a.rule.code} v${before.version} → v${a.rule.version}`, detail: `${before.value} → ${a.rule.value}` });
      return log(s, { module: "RULE", action: a.rule.active ? "Rule activated" : "Rule deactivated", target: a.rule.code });
    }
    case "ADD_EIBOR": return log({ ...state, eibor: [...state.eibor, a.row].sort((x, y) => x.date.localeCompare(y.date)) }, { module: "EIBOR", action: "EIBOR published", target: a.row.date, detail: `3M ${a.row.m3}` });
    case "ADD_USER": return log({ ...state, users: [...state.users, a.user] }, { module: "USER", action: "User created", target: a.user.name });
    case "UPDATE_USER": {
      const s = { ...state, users: state.users.map((u) => (u.id === a.id ? { ...u, ...a.patch } : u)) };
      if (a.patch.active !== undefined) {
        const u = state.users.find((x) => x.id === a.id);
        return log(s, { module: "USER", action: a.patch.active ? "User activated" : "User deactivated", target: u?.name ?? a.id });
      }
      return s;
    }
    default: return state;
  }
}

function init(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // Version must match AND the data must fingerprint as the current dataset
      // (guards against stale caches written under a colliding version number).
      const fresh =
        parsed.version === SEED_VERSION &&
        Array.isArray(parsed.trackerDates) &&
        Array.isArray(parsed.users) &&
        Array.isArray(parsed.cases) &&
        Array.isArray(parsed.leads) &&
        Array.isArray(parsed.stages) &&
        Array.isArray(parsed.rules) &&
        Array.isArray(parsed.templates) &&
        parsed.users.some((u) => u.empId === "hfmm-15");
      if (fresh) {
        // Self-heal: the management-assigned Super Admin slot must always exist.
        if (!parsed.users.some((u) => u.empId === "hfmm-00" || u.id === "hfmm-00")) {
          parsed.users = [{ ...SUPER_ADMIN }, ...parsed.users];
        }
        return parsed;
      }
    }
  } catch { /* fall through */ }
  return buildSeed();
}

const StoreCtx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}

export function useMe() {
  const { state } = useStore();
  return state.users.find((u) => u.id === state.session) ?? null;
}

/* ---------- navigation with a back stack (one layer up, always) ---------- */
const NAV_LABELS: Record<string, string> = {
  dashboard: "Home", tracker: "Daily Tracker", tat: "TAT Monitor", people: "People", leads: "Leads",
  cases: "Cases", tasks: "Tasks", documents: "Documents", queries: "Queries", calculators: "Calculators",
  templates: "Desk Tools", rules: "Rule Centre", users: "Users & Roles", guide: "Guide Book", audit: "Audit Trail",
};

interface Loc { view: View; caseId: string | null; params: Record<string, unknown>; label: string }

const NavCtx = createContext<{ view: View; caseId: string | null; params: Record<string, unknown>; crumbs: Loc[]; go: (v: View, o?: { caseId?: string | null; params?: Record<string, unknown> }) => void; back: () => void } | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const [view, setView] = useState<View>("dashboard");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [stack, setStack] = useState<Loc[]>([]);

  const labelFor = (v: View, cid: string | null) => {
    if (v === "cases" && cid) return state.cases.find((x) => x.id === cid)?.ref ?? "Case";
    return NAV_LABELS[v] ?? v;
  };

  const go = (v: View, o?: { caseId?: string | null; params?: Record<string, unknown> }) => {
    setStack((s) => [...s.slice(-19), { view, caseId, params, label: labelFor(view, caseId) }]);
    setView(v); setCaseId(o?.caseId ?? null); setParams(o?.params ?? {});
    window.scrollTo({ top: 0 });
  };

  const back = () => {
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    setStack(stack.slice(0, -1));
    setView(prev.view); setCaseId(prev.caseId); setParams(prev.params);
    window.scrollTo({ top: 0 });
  };

  const crumbs = stack.slice(-2);
  const value = useMemo(() => ({ view, caseId, params, crumbs, go, back }), [view, caseId, params, stack]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}

export function useNav() {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error("useNav outside provider");
  return ctx;
}
