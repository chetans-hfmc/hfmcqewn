import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";
import { nowISO } from "../ui";

/**
 * document-service — five-state document marking (no uploads in V1).
 * APIs: PATCH /cases/:id/docs/:docId · GET /documents · GET /cases/:id/docs
 */
export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "SET_DOC": {
      const c = state.cases.find((x) => x.id === a.caseId);
      const item = c?.docs.find((d) => d.id === a.docId);
      const dt = state.docTypes.find((t) => t.id === item?.typeId)?.name ?? item?.typeId ?? "";
      const s = {
        ...state,
        cases: state.cases.map((x) => x.id !== a.caseId ? x : {
          ...x,
          docs: x.docs.map((d) => (d.id === a.docId
            ? { ...d, status: a.status, note: a.note ?? d.note, expiry: a.expiry ?? d.expiry, updatedAt: nowISO(), updatedBy: state.session ?? "" }
            : d)),
        }),
      };
      return auditLog(s, {
        module: "DOC",
        action: a.status === "VERIFIED" ? "Document verified"
          : a.status === "RECEIVED" ? "Document received"
            : a.status === "REJECTED" ? "Document rejected" : "Document marked",
        target: `${c?.ref} · ${dt}`, detail: a.status, caseId: a.caseId,
      });
    }
    default:
      return null;
  }
};
