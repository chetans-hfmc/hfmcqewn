import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";

/**
 * template-service — the editable email template library (Desk Tools).
 * APIs: POST /templates · PUT /templates/:id · GET /templates
 */
export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "SAVE_TEMPLATE": {
      if (a.isNew)
        return auditLog({ ...state, templates: [...state.templates, a.template] }, {
          module: "TEMPLATE", action: "Template created", target: a.template.name,
        });
      return auditLog(
        { ...state, templates: state.templates.map((t) => (t.id === a.template.id ? a.template : t)) },
        { module: "TEMPLATE", action: "Template updated", target: a.template.name },
      );
    }
    default:
      return null;
  }
};
