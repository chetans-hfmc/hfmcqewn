import type { AppState, Case, DocItem, DocStatus, Handoff, Task } from "../types";
import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";
import { addDays, nowISO, todayISO, uid } from "../ui";

/**
 * case-service — the golden record: lifecycle, evidence gates, handoff/custody,
 * TAT triggers, stage conditions, notes, QC checklists and pre-submission decision.
 * APIs: PATCH /cases/:id · POST /cases/:id/handoff · POST /cases/:id/advance
 *       POST /cases/:id/close · PUT /cases/:id/stages/:stage/trigger
 *       PATCH /cases/:id/conditions/:key · POST /cases/:id/notes
 *       PATCH /cases/:id/qc/:list/:item · PUT /cases/:id/decision
 *       GET /cases · GET /cases/:id · GET /cases/:id/gates · GET /pipeline/aggregate
 */

/* Generates the next stage's tasks + document checklist when a case moves forward. */
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

export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "PATCH_CASE": {
      const before = state.cases.find((c) => c.id === a.id)!;
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.id ? { ...c, ...a.patch } : c)) };
      if (a.patch.ownerId && a.patch.ownerId !== before.ownerId)
        return auditLog(s, { module: "CASE", action: "Owner changed", target: before.ref, detail: `→ ${state.users.find((u) => u.id === a.patch.ownerId)?.name}`, caseId: a.id });
      return auditLog(s, { module: "CASE", action: "Control panel updated", target: before.ref, detail: a.patch.waitingFor ? `waiting for ${a.patch.waitingFor}` : a.patch.nextAction, caseId: a.id });
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
      s = auditLog(s, { module: "STAGE", action: "Stage advanced", target: `${c.ref} · ${state.stages[idx].name} → ${next.name}`, caseId: a.id });
      return s;
    }
    case "CLOSE_CASE": {
      const c = state.cases.find((x) => x.id === a.id)!;
      let s: AppState = {
        ...state,
        cases: state.cases.map((x) => (x.id === a.id
          ? { ...x, status: "CLOSED" as const, closedAt: todayISO(), closureAudit: a.audit, nextAction: undefined, waitingFor: undefined, pendingReason: undefined, blocker: undefined }
          : x)),
      };
      if (a.audit?.length) s = auditLog(s, { module: "CASE", action: "Closure audit passed", target: c.ref, detail: `${a.audit.length}/13 items confirmed`, caseId: a.id });
      s = auditLog(s, { module: "CASE", action: "Case closed", target: c.ref, detail: "Golden record archived", caseId: a.id });
      return s;
    }
    case "HANDOFF_CASE": {
      const c = state.cases.find((x) => x.id === a.caseId);
      if (!c || c.ownerId === a.toId) return state;
      const from = state.users.find((u) => u.id === c.ownerId)?.name ?? c.ownerId;
      const to = state.users.find((u) => u.id === a.toId)?.name ?? a.toId;
      const h: Handoff = { at: nowISO(), fromId: c.ownerId, toId: a.toId, reason: a.reason, kind: a.kind };
      const s = { ...state, cases: state.cases.map((x) => (x.id === a.caseId ? { ...x, ownerId: a.toId, handoffs: [...(x.handoffs ?? []), h] } : x)) };
      return auditLog(s, { module: "CASE", action: "Handoff", target: c.ref, detail: `${from} → ${to} · ${a.kind} · ${a.reason}`, caseId: a.caseId });
    }
    case "SET_TRIGGER": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze) return state;
      const stageName = state.stages.find((s) => s.id === a.stageId)?.name ?? a.stageId;
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, triggerDates: { ...(c.triggerDates ?? {}), [a.stageId]: a.date } } : c)) };
      return auditLog(s, { module: "TAT", action: "Trigger date set", target: caze.ref, detail: `${stageName} → ${a.date}`, caseId: a.caseId });
    }
    case "TOGGLE_CONDITION": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze) return state;
      const done = { ...(caze.conditionsDone ?? {}) };
      const next = !done[a.key];
      if (next) done[a.key] = true; else delete done[a.key];
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, conditionsDone: done } : c)) };
      return next ? auditLog(s, { module: "TAT", action: "Stage condition cleared", target: caze.ref, detail: a.label, caseId: a.caseId }) : s;
    }
    case "ADD_CASE_NOTE": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze || !a.text.trim()) return state;
      const note = { id: "cn" + uid(), at: nowISO(), by: state.session ?? "system", text: a.text.trim() };
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, caseNotes: [...(c.caseNotes ?? []), note] } : c)) };
      return auditLog(s, { module: "TAT", action: "Case note saved", target: caze.ref, detail: a.text.trim().slice(0, 90), caseId: a.caseId });
    }
    case "TOGGLE_QC": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze) return state;
      const items = caze[a.list] ?? [];
      const item = items.find((it) => it.id === a.id);
      const next = items.map((it) => (it.id === a.id ? { ...it, done: !it.done } : it));
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, [a.list]: next } : c)) };
      return item && !item.done ? auditLog(s, { module: "QC", action: "QC check cleared", target: caze.ref, detail: item.label, caseId: a.caseId }) : s;
    }
    case "SET_DECISION": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze) return state;
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, preappDecision: a.decision } : c)) };
      return auditLog(s, { module: "QC", action: "Pre-submission decision", target: caze.ref, detail: a.decision.replace(/_/g, " "), caseId: a.caseId });
    }
    default:
      return null;
  }
};
