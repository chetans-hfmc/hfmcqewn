import type {
  AppState, BankQuery, CalcRecord, Case, DocStatus, EmailTemplate, HandoffKind,
  Lead, Person, PreappDecision, Rule, Task, User,
} from "../types";

/**
 * The command surface of the whole system.
 * Every mutation the UI can request is one of these 31 actions.
 * This union is also the future REST API contract (1 write endpoint per action).
 */
export type Action =
  | { t: "LOGIN"; userId: string } | { t: "LOGOUT" }
  | { t: "RESET" }
  | { t: "ADD_PERSON"; person: Person }
  | { t: "UPDATE_PERSON"; id: string; patch: Partial<Person> }
  | { t: "ADD_LEAD"; lead: Lead } | { t: "UPDATE_LEAD"; id: string; patch: Partial<Lead> }
  | { t: "CONVERT_LEAD"; leadId: string; caze: Case; tasks: Task[] }
  | { t: "PATCH_CASE"; id: string; patch: Partial<Case> }
  | { t: "HANDOFF_CASE"; caseId: string; toId: string; reason: string; kind: HandoffKind }
  | { t: "HANDOFF_LEAD"; leadId: string; toId: string; reason: string }
  | { t: "ADVANCE_STAGE"; id: string; note?: string }
  | { t: "CLOSE_CASE"; id: string; audit?: string[] }
  | { t: "ADD_TASK"; task: Task } | { t: "UPDATE_TASK"; id: string; patch: Partial<Task> }
  | { t: "SET_DOC"; caseId: string; docId: string; status: DocStatus; note?: string; expiry?: string }
  | { t: "ADD_QUERY"; q: BankQuery } | { t: "UPDATE_QUERY"; id: string; patch: Partial<BankQuery> }
  | { t: "SAVE_CALC"; calc: CalcRecord }
  | { t: "SET_TRACKER"; caseId: string; date: string; note: string }
  | { t: "ADD_TRACKER_DAY"; date: string }
  | { t: "SET_TRIGGER"; caseId: string; stageId: string; date: string }
  | { t: "TOGGLE_CONDITION"; caseId: string; key: string; label: string }
  | { t: "ADD_CASE_NOTE"; caseId: string; text: string }
  | { t: "TOGGLE_QC"; caseId: string; list: "preappQc" | "submitQc" | "huspyQc"; id: string }
  | { t: "SET_DECISION"; caseId: string; decision: PreappDecision }
  | { t: "SAVE_TEMPLATE"; template: EmailTemplate; isNew?: boolean }
  | { t: "UPSERT_RULE"; rule: Rule; isNew?: boolean }
  | { t: "ADD_EIBOR"; row: AppState["eibor"][number] }
  | { t: "ADD_USER"; user: User } | { t: "UPDATE_USER"; id: string; patch: Partial<User> };

/**
 * A service handler. Returns the next state if it owns the action,
 * or `null` to pass. Exactly one service claims each action type.
 */
export type Handler = (state: AppState, action: Action) => AppState | null;
