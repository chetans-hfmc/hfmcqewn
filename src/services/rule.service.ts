import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";

/**
 * rule-service — versioned business rules, bank/product matrix, EIBOR master.
 * Every edit creates a new rule version with history; calculators read by version.
 * APIs: POST /rules · PUT /rules/:id · POST /eibor
 *       GET /rules · GET /rules/:id/history · GET /eibor · GET /bank-matrix
 */
export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "UPSERT_RULE": {
      if (a.isNew)
        return auditLog({ ...state, rules: [...state.rules, a.rule] }, {
          module: "RULE", action: "Rule created", target: `${a.rule.code} = ${a.rule.value}`,
        });
      const before = state.rules.find((r) => r.id === a.rule.id);
      const s = { ...state, rules: state.rules.map((r) => (r.id === a.rule.id ? a.rule : r)) };
      if (before && before.value !== a.rule.value)
        return auditLog(s, {
          module: "RULE", action: "Rule updated",
          target: `${a.rule.code} v${before.version} → v${a.rule.version}`,
          detail: `${before.value} → ${a.rule.value}`,
        });
      return auditLog(s, { module: "RULE", action: a.rule.active ? "Rule activated" : "Rule deactivated", target: a.rule.code });
    }
    case "ADD_EIBOR":
      return auditLog(
        { ...state, eibor: [...state.eibor, a.row].sort((x, y) => x.date.localeCompare(y.date)) },
        { module: "EIBOR", action: "EIBOR published", target: a.row.date, detail: `3M ${a.row.m3}` },
      );
    default:
      return null;
  }
};
