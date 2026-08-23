import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";

/**
 * query-service — bank query lifecycle: received → responded → QC closed.
 * APIs: POST /queries · PATCH /queries/:id · GET /queries · GET /cases/:id/queries
 */
export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "ADD_QUERY":
      return auditLog({ ...state, queries: [a.q, ...state.queries] }, {
        module: "QUERY", action: "Query received",
        target: `${a.q.ref} · ${state.cases.find((c) => c.id === a.q.caseId)?.ref ?? ""}`, caseId: a.q.caseId,
      });
    case "UPDATE_QUERY": {
      const before = state.queries.find((q) => q.id === a.id);
      const s = { ...state, queries: state.queries.map((q) => (q.id === a.id ? { ...q, ...a.patch } : q)) };
      if (a.patch.status === "CLOSED" && before) return auditLog(s, { module: "QUERY", action: "Query closed", target: before.ref, caseId: before.caseId });
      return s;
    }
    default:
      return null;
  }
};
