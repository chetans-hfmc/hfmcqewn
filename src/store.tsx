import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type {
  AppState, BankQuery, Case, CalcRecord, ChecklistItem, DocStatus, EmailTemplate, Handoff, Lead,
  Person, ProductDef, ProductVersion, Promo, Rule, Task, User, AxisDef, View, AuditEntry,
} from "./types";
import { buildSeed, SEED_VERSION, SUPER_ADMIN } from "./seed";
import { addDays, nowISO, todayISO, uid } from "./ui";

/* ============================================================
   Action union — the full command surface (future REST endpoints)
   ============================================================ */
export type Action =
  | { t: "LOGIN"; userId: string } | { t: "LOGOUT" } | { t: "RESET" }
  | { t: "ADD_PERSON"; person: Person } | { t: "UPDATE_PERSON"; id: string; patch: Partial<Person> }
  | { t: "DELETE_PERSON"; id: string; reason: string }
  | { t: "ADD_LEAD"; lead: Lead } | { t: "UPDATE_LEAD"; id: string; patch: Partial<Lead> }
  | { t: "DELETE_LEAD"; id: string; reason: string }
  | { t: "CONVERT_LEAD"; leadId: string; caze: Case; tasks: Task[] }
  | { t: "HANDOFF_LEAD"; leadId: string; toId: string; reason: string }
  | { t: "PATCH_CASE"; id: string; patch: Partial<Case> }
  | { t: "ADVANCE_STAGE"; id: string; note?: string }
  | { t: "CLOSE_CASE"; id: string; audit?: string[] }
  | { t: "DELETE_CASE"; id: string; reason: string }
  | { t: "HANDOFF_CASE"; id: string; toId: string; reason: string; kind: Handoff["kind"] }
  | { t: "SET_TRIGGER"; caseId: string; stageId: string; date: string }
  | { t: "TOGGLE_CONDITION"; caseId: string; key: string; label: string }
  | { t: "ADD_CASE_NOTE"; caseId: string; text: string }
  | { t: "ADD_TASK"; task: Task } | { t: "UPDATE_TASK"; id: string; patch: Partial<Task> }
  | { t: "SET_DOC"; caseId: string; docId: string; status: DocStatus }
  | { t: "ADD_QUERY"; q: BankQuery } | { t: "UPDATE_QUERY"; id: string; patch: Partial<BankQuery> }
  | { t: "SAVE_CALC"; calc: CalcRecord }
  | { t: "SET_TRACKER"; caseId: string; date: string; note: string }
  | { t: "UPSERT_RULE"; rule: Rule; isNew?: boolean }
  | { t: "ADD_EIBOR"; row: AppState["eibor"][number] }
  | { t: "SAVE_TEMPLATE"; template: EmailTemplate; isNew?: boolean }
  | { t: "ADD_USER"; user: User } | { t: "UPDATE_USER"; id: string; patch: Partial<User> }
  | { t: "DISMISS_ALERTS"; ids: string[] }
  | { t: "SAVE_PRODUCT_DEF"; def: ProductDef; isNew?: boolean }
  | { t: "SAVE_PV"; productId: string; pv: ProductVersion; isNew?: boolean }
  | { t: "ACTIVATE_PV"; productId: string; version: number; effectiveFrom: string }
  | { t: "DUPLICATE_PRODUCT"; id: string; newId: string; name: string }
  | { t: "DELETE_PRODUCT_DEF"; id: string; reason: string }
  | { t: "SAVE_PROMO"; promo: Promo; isNew?: boolean }
  | { t: "DELETE_PROMO"; id: string }
  | { t: "SAVE_AXIS"; axis: AxisDef };

/* ---------- permissions (TO VERIFY) ---------- */
export const ROLE_MODULES: Record<string, View[]> = {
  ADMIN: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "queries", "calculators", "templates", "rules", "bankrules", "users", "audit", "guide"],
  HEAD: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "queries", "calculators", "templates", "rules", "bankrules", "users", "audit", "guide"],
  TL: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "queries", "calculators", "templates", "guide", "audit"],
  SPO: ["dashboard", "tracker", "tat", "cases", "tasks", "documents", "queries", "calculators", "templates", "guide"],
  VRM: ["dashboard", "tracker", "tat", "people", "leads", "cases", "calculators", "templates", "guide"],
  PA: ["dashboard", "tracker", "tat", "people", "leads", "cases", "tasks", "documents", "templates", "guide"],
  TBD: ["dashboard"],
};
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Super Admin", HEAD: "Head of Mortgage", TL: "Team Leader", SPO: "Sales Process Owner", VRM: "Virtual Relationship Mgr", PA: "Personal Assistant", TBD: "Role TBD",
};
export const isOversight = (role: string) => role === "ADMIN" || role === "HEAD";
export const teamOf = (state: AppState, me: User): Set<string> => {
  const ids = new Set<string>([me.id]);
  state.users.forEach((u) => { if (u.leaderId === me.id || u.team === me.team) ids.add(u.id); });
  return ids;
};

/* ---------- helpers ---------- */
const log = (state: AppState, entry: Omit<AuditEntry, "id" | "at" | "by">): AppState =>
  ({ ...state, audit: [{ id: "a" + uid(), at: nowISO(), by: state.session ?? "system", ...entry }, ...state.audit] });

const canDelete = (s: AppState) => {
  const role = s.users.find((u) => u.id === s.session)?.role;
  return role === "HEAD" || role === "ADMIN";
};

/* bootstraps the next stage's docs + tasks on advancement */
function stageBootstrap(state: AppState, caze: Case, stageId: string): { docs: Case["docs"]; tasks: Task[] } {
  const def = state.stages.find((s) => s.id === stageId);
  if (!def) return { docs: [], tasks: [] };
  let n = 0;
  const docs = def.docs.map((typeId) => ({ id: "d" + uid() + n++, typeId, stageId, status: "MISSING" as DocStatus, updatedAt: nowISO(), updatedBy: state.session ?? "" }));
  const tasks = def.tasks.map((title, i) => ({
    id: "t" + uid(), caseId: caze.id, stageId, type: state.taskTypes[0], title, ownerId: caze.ownerId,
    priority: (i === 0 ? "HIGH" : "MEDIUM") as Task["priority"], due: addDays(todayISO(), def.sla),
    status: "OPEN" as const, createdAt: nowISO(),
  }));
  return { docs, tasks };
}

/* ============================================================
   Reducer — every command handled here (mirrors REST endpoints)
   ============================================================ */
function reducer(state: AppState, a: Action): AppState {
  switch (a.t) {
    /* ----- auth ----- */
    case "LOGIN":
      return log({ ...state, session: a.userId }, { module: "AUTH", action: "Signed in", target: state.users.find((u) => u.id === a.userId)?.name ?? a.userId });
    case "LOGOUT": return { ...state, session: null };
    case "RESET": return { ...buildSeed(), session: state.session };

    /* ----- people ----- */
    case "ADD_PERSON":
      return log({ ...state, persons: [a.person, ...state.persons] }, { module: "PERSON", action: "Person created", target: a.person.name });
    case "UPDATE_PERSON":
      return log({ ...state, persons: state.persons.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) },
        { module: "PERSON", action: "Person updated", target: state.persons.find((p) => p.id === a.id)?.name ?? a.id });
    case "DELETE_PERSON": {
      if (!canDelete(state)) return state;
      const p = state.persons.find((x) => x.id === a.id);
      if (!p || state.leads.some((l) => l.personId === a.id) || state.cases.some((c) => c.personId === a.id)) return state;
      return log({ ...state, persons: state.persons.filter((x) => x.id !== a.id) }, { module: "PERSON", action: "Person deleted", target: p.name, detail: a.reason });
    }

    /* ----- leads ----- */
    case "ADD_LEAD":
      return log({ ...state, leads: [a.lead, ...state.leads] }, { module: "LEAD", action: "Lead created", target: `${a.lead.ref} · ${state.persons.find((p) => p.id === a.lead.personId)?.name ?? ""}` });
    case "UPDATE_LEAD": {
      const before = state.leads.find((l) => l.id === a.id);
      const s = { ...state, leads: state.leads.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) };
      if (a.patch.status && before) return log(s, { module: "LEAD", action: "Lead status", target: `${before.ref} → ${a.patch.status}` });
      return s;
    }
    case "DELETE_LEAD": {
      if (!canDelete(state)) return state;
      const l = state.leads.find((x) => x.id === a.id);
      if (!l || l.status === "CONVERTED") return state;
      return log({ ...state, leads: state.leads.filter((x) => x.id !== a.id) }, { module: "LEAD", action: "Lead deleted", target: l.ref, detail: a.reason });
    }
    case "HANDOFF_LEAD": {
      const l = state.leads.find((x) => x.id === a.leadId);
      if (!l || l.owner === a.toId) return state;
      const to = state.users.find((u) => u.id === a.toId)?.name ?? a.toId;
      return log({ ...state, leads: state.leads.map((x) => (x.id === a.leadId ? { ...x, owner: a.toId } : x)) },
        { module: "LEAD", action: "Lead handed off", target: `${l.ref} → ${to}`, detail: a.reason });
    }
    case "CONVERT_LEAD": {
      const lead = state.leads.find((l) => l.id === a.leadId);
      let s: AppState = {
        ...state, cases: [a.caze, ...state.cases], tasks: [...a.tasks, ...state.tasks],
        leads: state.leads.map((l) => (l.id === a.leadId ? { ...l, status: "CONVERTED" as const, notes: `Converted to ${a.caze.ref}` } : l)),
      };
      s = log(s, { module: "LEAD", action: "Lead converted", target: `${lead?.ref ?? ""} → ${a.caze.ref}`, caseId: a.caze.id });
      s = log(s, { module: "CASE", action: "Case opened", target: a.caze.ref, caseId: a.caze.id });
      return s;
    }

    /* ----- cases ----- */
    case "PATCH_CASE": {
      const before = state.cases.find((c) => c.id === a.id);
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.id ? { ...c, ...a.patch } : c)) };
      if (before && a.patch.ownerId && a.patch.ownerId !== before.ownerId)
        return log(s, { module: "CASE", action: "Owner changed", target: before.ref, detail: `→ ${state.users.find((u) => u.id === a.patch.ownerId)?.name}`, caseId: a.id });
      if (before) return log(s, { module: "CASE", action: "Control panel updated", target: before.ref, caseId: a.id });
      return s;
    }
    case "ADVANCE_STAGE": {
      const c = state.cases.find((x) => x.id === a.id);
      if (!c) return state;
      const idx = state.stages.findIndex((s) => s.id === c.stage);
      const next = state.stages[idx + 1];
      if (!next) return state;
      const boot = stageBootstrap(state, c, next.id);
      const updated: Case = {
        ...c, stage: next.id,
        stageHistory: [...c.stageHistory, { stageId: next.id, at: nowISO(), by: state.session ?? "", note: a.note }],
        triggerDates: { ...(c.triggerDates ?? {}), [next.id]: todayISO() },
        nextAction: next.tasks[0] ?? undefined, nextActionDue: addDays(todayISO(), next.sla),
        waitingFor: undefined, pendingReason: undefined, blocker: undefined,
        docs: [...c.docs, ...boot.docs],
      };
      let s: AppState = { ...state, cases: state.cases.map((x) => (x.id === a.id ? updated : x)), tasks: [...boot.tasks, ...state.tasks] };
      s = log(s, { module: "CASE", action: "Stage advanced", target: `${c.ref} → ${next.name}`, caseId: a.id });
      return s;
    }
    case "CLOSE_CASE": {
      const c = state.cases.find((x) => x.id === a.id)!;
      let s: AppState = { ...state, cases: state.cases.map((x) => (x.id === a.id ? { ...x, status: "CLOSED" as const, closedAt: todayISO(), closureAudit: a.audit, nextAction: undefined } : x)) };
      s = log(s, { module: "CASE", action: "Case closed", target: c.ref, caseId: a.id });
      return s;
    }
    case "DELETE_CASE": {
      if (!canDelete(state)) return state;
      const c = state.cases.find((x) => x.id === a.id);
      if (!c) return state;
      let s: AppState = {
        ...state,
        cases: state.cases.filter((x) => x.id !== a.id),
        tasks: state.tasks.filter((t) => t.caseId !== a.id),
        queries: state.queries.filter((q) => q.caseId !== a.id),
      };
      s = log(s, { module: "CASE", action: "Case deleted", target: c.ref, detail: a.reason, caseId: a.id });
      return s;
    }
    case "HANDOFF_CASE": {
      const c = state.cases.find((x) => x.id === a.id);
      if (!c || c.ownerId === a.toId) return state;
      const to = state.users.find((u) => u.id === a.toId)?.name ?? a.toId;
      const ho: Handoff = { at: nowISO(), fromId: c.ownerId, toId: a.toId, reason: a.reason, kind: a.kind };
      let s: AppState = { ...state, cases: state.cases.map((x) => (x.id === a.id ? { ...x, ownerId: a.toId, handoffs: [...(x.handoffs ?? []), ho] } : x)) };
      s = log(s, { module: "CASE", action: "Case handed off", target: `${c.ref} → ${to}`, detail: a.reason, caseId: a.id });
      return s;
    }
    case "SET_TRIGGER": {
      const c = state.cases.find((x) => x.id === a.caseId);
      if (!c) return state;
      const s = { ...state, cases: state.cases.map((x) => (x.id === a.caseId ? { ...x, triggerDates: { ...(x.triggerDates ?? {}), [a.stageId]: a.date } } : x)) };
      return log(s, { module: "TAT", action: "Trigger date set", target: c.ref, detail: `${a.stageId} → ${a.date}`, caseId: a.caseId });
    }
    case "TOGGLE_CONDITION": {
      const c = state.cases.find((x) => x.id === a.caseId);
      if (!c) return state;
      const done = { ...(c.conditionsDone ?? {}) };
      const next = !done[a.key];
      if (next) done[a.key] = true; else delete done[a.key];
      const s = { ...state, cases: state.cases.map((x) => (x.id === a.caseId ? { ...x, conditionsDone: done } : x)) };
      return next ? log(s, { module: "TAT", action: "Stage condition cleared", target: c.ref, detail: a.label, caseId: a.caseId }) : s;
    }
    case "ADD_CASE_NOTE": {
      const c = state.cases.find((x) => x.id === a.caseId);
      if (!c || !a.text.trim()) return state;
      const note = { id: "cn" + uid(), at: nowISO(), by: state.session ?? "system", text: a.text.trim() };
      return log({ ...state, cases: state.cases.map((x) => (x.id === a.caseId ? { ...x, caseNotes: [...(x.caseNotes ?? []), note] } : x)) },
        { module: "TAT", action: "Case note saved", target: c.ref, caseId: a.caseId });
    }

    /* ----- tasks ----- */
    case "ADD_TASK":
      return log({ ...state, tasks: [a.task, ...state.tasks] }, { module: "TASK", action: "Task created", target: a.task.title, caseId: a.task.caseId });
    case "UPDATE_TASK": {
      const before = state.tasks.find((t) => t.id === a.id);
      const stamp = a.patch.status === "DONE" ? { completedBy: state.session ?? "system", completedAt: nowISO() } : {};
      const s = { ...state, tasks: state.tasks.map((t) => (t.id === a.id ? { ...t, ...a.patch, ...stamp } : t)) };
      if (a.patch.status === "DONE" && before) return log(s, { module: "TASK", action: "Task completed", target: before.title, caseId: before.caseId });
      return s;
    }

    /* ----- documents ----- */
    case "SET_DOC": {
      const c = state.cases.find((x) => x.id === a.caseId);
      const item = c?.docs.find((d) => d.id === a.docId);
      const name = state.docTypes.find((t) => t.id === item?.typeId)?.name ?? "";
      const s = { ...state, cases: state.cases.map((x) => x.id !== a.caseId ? x : { ...x, docs: x.docs.map((d) => (d.id === a.docId ? { ...d, status: a.status, updatedAt: nowISO(), updatedBy: state.session ?? "" } : d)) }) };
      return log(s, { module: "DOC", action: a.status === "VERIFIED" ? "Document verified" : a.status === "RECEIVED" ? "Document received" : "Document marked", target: `${c?.ref} · ${name}`, caseId: a.caseId });
    }

    /* ----- queries ----- */
    case "ADD_QUERY":
      return log({ ...state, queries: [a.q, ...state.queries] }, { module: "QUERY", action: "Query received", target: `${a.q.ref} · ${state.cases.find((c) => c.id === a.q.caseId)?.ref ?? ""}`, caseId: a.q.caseId });
    case "UPDATE_QUERY": {
      const before = state.queries.find((q) => q.id === a.id);
      const s = { ...state, queries: state.queries.map((q) => (q.id === a.id ? { ...q, ...a.patch } : q)) };
      if (a.patch.status === "CLOSED" && before) return log(s, { module: "QUERY", action: "Query closed", target: before.ref, caseId: before.caseId });
      return s;
    }

    /* ----- calculators ----- */
    case "SAVE_CALC":
      return log({ ...state, calcs: [a.calc, ...state.calcs] }, { module: "CALC", action: "Calculation saved", target: a.calc.label, caseId: a.calc.linkKind === "case" ? a.calc.linkId : undefined });

    /* ----- tracker ----- */
    case "SET_TRACKER": {
      const c = state.cases.find((x) => x.id === a.caseId);
      if (!c) return state;
      const tracker = (c.tracker ?? []).filter((e) => e.date !== a.date);
      if (a.note.trim()) tracker.push({ date: a.date, note: a.note.trim() });
      tracker.sort((x, y) => x.date.localeCompare(y.date));
      return log({ ...state, cases: state.cases.map((x) => (x.id === a.caseId ? { ...x, tracker } : x)) },
        { module: "TRACKER", action: "Daily tracker updated", target: c.ref, detail: `${a.date} — ${a.note.trim().slice(0, 80)}`, caseId: a.caseId });
    }

    /* ----- rules ----- */
    case "UPSERT_RULE": {
      if (a.isNew) return log({ ...state, rules: [...state.rules, a.rule] }, { module: "RULE", action: "Rule created", target: `${a.rule.code} = ${a.rule.value}` });
      const before = state.rules.find((r) => r.id === a.rule.id);
      const s = { ...state, rules: state.rules.map((r) => (r.id === a.rule.id ? a.rule : r)) };
      if (before && before.value !== a.rule.value) return log(s, { module: "RULE", action: "Rule updated", target: `${a.rule.code} v${before.version} → v${a.rule.version}`, detail: `${before.value} → ${a.rule.value}` });
      return s;
    }
    case "ADD_EIBOR":
      return log({ ...state, eibor: [...state.eibor, a.row].sort((x, y) => x.date.localeCompare(y.date)) }, { module: "EIBOR", action: "EIBOR published", target: a.row.date });

    /* ----- templates ----- */
    case "SAVE_TEMPLATE": {
      if (a.isNew) return log({ ...state, templates: [...state.templates, a.template] }, { module: "TEMPLATE", action: "Template created", target: a.template.name });
      return log({ ...state, templates: state.templates.map((t) => (t.id === a.template.id ? a.template : t)) }, { module: "TEMPLATE", action: "Template updated", target: a.template.name });
    }

    /* ----- users ----- */
    case "ADD_USER":
      return log({ ...state, users: [...state.users, a.user] }, { module: "USER", action: "User created", target: a.user.name });
    case "UPDATE_USER": {
      const s = { ...state, users: state.users.map((u) => (u.id === a.id ? { ...u, ...a.patch } : u)) };
      if (a.patch.active !== undefined) return log(s, { module: "USER", action: a.patch.active ? "User activated" : "User deactivated", target: state.users.find((u) => u.id === a.id)?.name ?? a.id });
      return s;
    }

    /* ----- alerts ----- */
    case "DISMISS_ALERTS": {
      const prev = new Set(state.dismissedAlerts ?? []);
      a.ids.forEach((id) => prev.add(id));
      return { ...state, dismissedAlerts: [...prev] };
    }

    /* ----- bank rule engine ----- */
    case "SAVE_PRODUCT_DEF": {
      if (a.isNew) return log({ ...state, productDefs: [...state.productDefs, a.def] }, { module: "PRODUCT", action: "Product created", target: `${a.def.name}` });
      return log({ ...state, productDefs: state.productDefs.map((p) => (p.id === a.def.id ? a.def : p)) }, { module: "PRODUCT", action: "Product updated", target: a.def.name });
    }
    case "SAVE_PV": {
      const prod = state.productDefs.find((p) => p.id === a.productId);
      if (!prod) return state;
      const versions = a.isNew ? [...prod.versions, a.pv] : prod.versions.map((v) => (v.version === a.pv.version ? a.pv : v));
      return log({ ...state, productDefs: state.productDefs.map((p) => (p.id === a.productId ? { ...p, versions } : p)) },
        { module: "PRODUCT", action: a.isNew ? "Version drafted" : "Version edited", target: `${prod.name} · v${a.pv.version} (${a.pv.status})` });
    }
    case "ACTIVATE_PV": {
      const prod = state.productDefs.find((p) => p.id === a.productId);
      if (!prod) return state;
      const versions = prod.versions.map((v): ProductVersion => {
        if (v.version === a.version) return { ...v, status: "ACTIVE", effectiveFrom: a.effectiveFrom, effectiveTo: undefined };
        if (v.status === "ACTIVE" || v.status === "SCHEDULED") return { ...v, status: "RETIRED", effectiveTo: a.effectiveFrom };
        return v;
      });
      return log({ ...state, productDefs: state.productDefs.map((p) => (p.id === a.productId ? { ...p, versions } : p)) },
        { module: "PRODUCT", action: "Version activated", target: `${prod.name} · v${a.version}`, detail: `effective ${a.effectiveFrom}` });
    }
    case "DUPLICATE_PRODUCT": {
      const src = state.productDefs.find((p) => p.id === a.id);
      if (!src) return state;
      const copy: ProductDef = { ...src, id: a.newId, name: a.name, createdAt: nowISO(), createdBy: state.session ?? "" };
      return log({ ...state, productDefs: [...state.productDefs, copy] }, { module: "PRODUCT", action: "Product duplicated", target: `${src.name} → ${a.name}` });
    }
    case "DELETE_PRODUCT_DEF": {
      if (!canDelete(state)) return state;
      const p = state.productDefs.find((x) => x.id === a.id);
      if (!p) return state;
      return log({ ...state, productDefs: state.productDefs.filter((x) => x.id !== a.id) }, { module: "PRODUCT", action: "Product deleted", target: p.name, detail: a.reason });
    }
    case "SAVE_PROMO": {
      if (a.isNew) return log({ ...state, promos: [...state.promos, a.promo] }, { module: "PROMO", action: "Promotion created", target: a.promo.name });
      return log({ ...state, promos: state.promos.map((p) => (p.id === a.promo.id ? a.promo : p)) }, { module: "PROMO", action: "Promotion updated", target: a.promo.name });
    }
    case "DELETE_PROMO": {
      const p = state.promos.find((x) => x.id === a.id);
      return log({ ...state, promos: state.promos.filter((x) => x.id !== a.id) }, { module: "PROMO", action: "Promotion deleted", target: p?.name ?? a.id });
    }
    case "SAVE_AXIS": {
      const exists = state.axes.some((x) => x.id === a.axis.id);
      return log({ ...state, axes: exists ? state.axes.map((x) => (x.id === a.axis.id ? a.axis : x)) : [...state.axes, a.axis] },
        { module: "AXIS", action: exists ? "Axis updated" : "Axis created", target: a.axis.name });
    }

    default: return state;
  }
}

/* ---------- persistence (versioned + fingerprinted) ---------- */
const KEY = "hfmc-mos-state";
function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as AppState;
      if (p.version === SEED_VERSION && Array.isArray(p.cases) && Array.isArray(p.users) && p.users.some((u) => u.empId === "hfmm-15")) {
        if (!p.users.some((u) => u.empId === "hfmm-00")) p.users = [{ ...SUPER_ADMIN }, ...p.users];
        return p;
      }
    }
  } catch { /* fall through to seed */ }
  return buildSeed();
}

/* ---------- store context ---------- */
const Ctx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}
export function useMe(): User | null {
  const { state } = useStore();
  return state.users.find((u) => u.id === state.session) ?? null;
}

/* ---------- navigation with back stack ---------- */
const NAV_LABELS: Record<string, string> = {
  dashboard: "Home", tracker: "Daily Tracker", tat: "TAT Monitor", people: "People", leads: "Leads",
  cases: "Cases", tasks: "Tasks", documents: "Documents", queries: "Queries", calculators: "Calculators",
  templates: "Desk Tools", rules: "Rule Centre", bankrules: "Bank Rule Engine", users: "Users & Roles", guide: "Guide Book", audit: "Audit Trail",
};
interface Loc { view: View; caseId: string | null; params: Record<string, unknown>; label: string; }
const NavCtx = createContext<{ view: View; caseId: string | null; params: Record<string, unknown>; crumbs: Loc[]; go: (v: View, o?: { caseId?: string | null; params?: Record<string, unknown> }) => void; back: () => void } | null>(null);
export function NavProvider({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const [view, setView] = useState<View>("dashboard");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [stack, setStack] = useState<Loc[]>([]);
  const labelFor = (v: View, cid: string | null) => (v === "cases" && cid ? state.cases.find((x) => x.id === cid)?.ref ?? "Case" : NAV_LABELS[v] ?? v);
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
  };
  const value = useMemo(() => ({ view, caseId, params, crumbs: stack.slice(-2), go, back }), [view, caseId, params, stack]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}
export function useNav() {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error("useNav outside provider");
  return ctx;
}
