import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";

/**
 * calc-service — persists saved calculations with their rule-version snapshot.
 * (The pure math engine lives in calc.ts; this service only records outcomes.)
 * APIs: POST /calculations · GET /calculations · GET /cases/:id/calculations
 */
export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "SAVE_CALC":
      return auditLog({ ...state, calcs: [a.calc, ...state.calcs] }, {
        module: "CALC", action: "Calculation saved", target: a.calc.label,
        caseId: a.calc.linkKind === "case" ? a.calc.linkId : undefined,
      });
    default:
      return null;
  }
};
