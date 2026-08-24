import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";

/**
 * crm-service — people, exhaustive profiles, leads, lead→case conversion.
 * APIs: POST /persons · PATCH /persons/:id · POST /leads · PATCH /leads/:id
 *       POST /leads/:id/convert · POST /leads/:id/handoff
 *       GET /persons · GET /persons/:id · GET /leads
 */
export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "ADD_PERSON":
      return auditLog({ ...state, persons: [a.person, ...state.persons] }, {
        module: "PERSON", action: "Person created", target: a.person.name,
      });
    case "UPDATE_PERSON":
      return auditLog(
        { ...state, persons: state.persons.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) },
        { module: "PERSON", action: "Person updated", target: state.persons.find((p) => p.id === a.id)?.name ?? a.id },
      );
    case "ADD_LEAD":
      return auditLog({ ...state, leads: [a.lead, ...state.leads] }, {
        module: "LEAD", action: "Lead created",
        target: `${a.lead.ref} · ${state.persons.find((p) => p.id === a.lead.personId)?.name ?? ""}`,
      });
    case "UPDATE_LEAD": {
      const before = state.leads.find((l) => l.id === a.id);
      const s = { ...state, leads: state.leads.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) };
      if (a.patch.status && before) return auditLog(s, { module: "LEAD", action: "Lead status", target: `${before.ref} → ${a.patch.status}` });
      return s;
    }
    case "CONVERT_LEAD": {
      const lead = state.leads.find((l) => l.id === a.leadId);
      let s = {
        ...state,
        cases: [a.caze, ...state.cases],
        tasks: [...a.tasks, ...state.tasks],
        leads: state.leads.map((l) => (l.id === a.leadId
          ? { ...l, status: "CONVERTED" as const, notes: `Converted to ${a.caze.ref}`, nextAction: undefined, due: undefined }
          : l)),
      };
      s = auditLog(s, { module: "LEAD", action: "Lead converted", target: `${lead?.ref ?? a.leadId} → ${a.caze.ref}`, caseId: a.caze.id });
      s = auditLog(s, { module: "CASE", action: "Case opened", target: `${a.caze.ref} at ${state.stages.find((st) => st.id === a.caze.stage)?.name}`, caseId: a.caze.id });
      return s;
    }
    case "HANDOFF_LEAD": {
      const l = state.leads.find((x) => x.id === a.leadId);
      if (!l || l.owner === a.toId) return state;
      const to = state.users.find((u) => u.id === a.toId)?.name ?? a.toId;
      const s = { ...state, leads: state.leads.map((x) => (x.id === a.leadId ? { ...x, owner: a.toId } : x)) };
      return auditLog(s, { module: "LEAD", action: "Lead handed off", target: `${l.ref} → ${to}`, detail: a.reason });
    }
    default:
      return null;
  }
};
