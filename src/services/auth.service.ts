import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";
import { buildSeed } from "../seed";

/**
 * auth-service — session lifecycle & demo reset.
 * APIs: POST /auth/login · POST /auth/logout · POST /system/reset
 */
export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "LOGIN":
      return auditLog({ ...state, session: a.userId }, {
        module: "AUTH", action: "Signed in",
        target: state.users.find((u) => u.id === a.userId)?.name ?? a.userId,
      });
    case "LOGOUT":
      return { ...state, session: null };
    case "RESET": {
      const fresh = buildSeed();
      return { ...fresh, session: state.session };
    }
    default:
      return null;
  }
};
