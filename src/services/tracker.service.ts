import type { Handler } from "../core/types";
import { auditLog } from "../core/audit";

/**
 * tracker-service — the daily log / Morning Board (time × file matrix).
 * APIs: PUT /cases/:id/tracker/:date · POST /tracker/days
 *       GET /tracker/grid · GET /tracker/unlogged
 */
export const handle: Handler = (state, a) => {
  switch (a.t) {
    case "SET_TRACKER": {
      const caze = state.cases.find((c) => c.id === a.caseId);
      if (!caze) return state;
      const tracker = (caze.tracker ?? []).filter((e) => e.date !== a.date);
      if (a.note.trim()) tracker.push({ date: a.date, note: a.note.trim() });
      tracker.sort((x, y) => x.date.localeCompare(y.date));
      const s = { ...state, cases: state.cases.map((c) => (c.id === a.caseId ? { ...c, tracker } : c)) };
      return auditLog(s, {
        module: "TRACKER", action: "Daily tracker updated", target: caze.ref,
        detail: `${a.date} — ${a.note.trim().slice(0, 90)}${a.note.trim().length > 90 ? "…" : ""}`, caseId: a.caseId,
      });
    }
    case "ADD_TRACKER_DAY": {
      if (state.trackerDates.includes(a.date)) return state;
      return auditLog(
        { ...state, trackerDates: [...state.trackerDates, a.date].sort() },
        { module: "TRACKER", action: "Tracker day added", target: a.date },
      );
    }
    default:
      return null;
  }
};
