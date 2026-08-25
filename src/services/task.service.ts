import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";

/**
 * task-service — every action is a task: create, complete, reopen.
 * Completion is manual-only and stamps who did it; the system never ticks itself.
 * APIs: POST /tasks · PATCH /tasks/:id · GET /tasks · GET /cases/:id/tasks
 */
export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "ADD_TASK":
      return auditLog({ ...state, tasks: [a.task, ...state.tasks] }, {
        module: "TASK", action: "Task created", target: a.task.title, caseId: a.task.caseId,
      });
    case "UPDATE_TASK": {
      const before = state.tasks.find((t) => t.id === a.id);
      const stamp = a.patch.status === "DONE"
        ? { completedBy: state.session ?? "system" }
        : a.patch.status === "OPEN" ? { completedBy: undefined } : {};
      const s = { ...state, tasks: state.tasks.map((t) => (t.id === a.id ? { ...t, ...a.patch, ...stamp } : t)) };
      if (a.patch.status === "DONE" && before) return auditLog(s, { module: "TASK", action: "Task completed", target: before.title, caseId: before.caseId });
      if (a.patch.status === "OPEN" && before) return auditLog(s, { module: "TASK", action: "Task reopened", target: before.title, caseId: before.caseId });
      return s;
    }
    default:
      return null;
  }
};
