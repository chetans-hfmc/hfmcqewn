import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";

/**
 * admin-service — users, roles, org hierarchy.
 * APIs: POST /users · PATCH /users/:id · GET /users · GET /org/tree
 */
export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "ADD_USER":
      return auditLog({ ...state, users: [...state.users, a.user] }, {
        module: "USER", action: "User created", target: a.user.name,
      });
    case "UPDATE_USER": {
      const s = { ...state, users: state.users.map((u) => (u.id === a.id ? { ...u, ...a.patch } : u)) };
      if (a.patch.active !== undefined) {
        const u = state.users.find((x) => x.id === a.id);
        return auditLog(s, {
          module: "USER", action: a.patch.active ? "User activated" : "User deactivated",
          target: u?.name ?? a.id,
        });
      }
      return s;
    }
    default:
      return null;
  }
};
