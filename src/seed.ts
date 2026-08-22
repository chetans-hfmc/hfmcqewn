import type { AppState, BankQuery, Case, ChecklistItem, DocItem, DocStatus, EmailTemplate, Handoff, Lead, LeadStatus, Person, Rule, Task, TrackerEntry, TxType } from "./types";
import { addDays, todayISO } from "./ui";

export const SEED_VERSION = 13;
const T = todayISO();
const d = (off: number) => addDays(T, off);
const ts = (off: number) => new Date(Date.now() + off * 86400000).toISOString();

/* Management-assigned Super Admin slot — must always exist; init() self-heals saved states missing it. */
export const SUPER_ADMIN = {
  id: "hfmm-00", empId: "hfmm-00", name: "Super Admin", email: "admin@hfmc.ae", mobile: "",
  role: "ADMIN" as const, team: "Management", active: true, createdAt: d(-400),
  note: "System slot — assigned by management / Sir Kiran",
};

/* =====================================================================
   Operational dataset — imported from the HFMC daily case tracker
   (working days 13, 14, 17, 18, 19, 20 Aug 2026). Financial figures are
   only recorded where the tracker states them; everything else is left
   blank rather than invented.
   ===================================================================== */

export const TRACKER_DATES = ["2026-08-13", "2026-08-14", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"];

const stages: AppState["stages"] = [
  { id: "HANDOVER", name: "Handover", short: "HO", sla: 2, docs: [], tasks: ["Sales→Ops handover briefing", "Validate lead file & calculator snapshot"], conditions: ["Lead file & calculator snapshot received", "Transaction type identified before building the file"] },
  { id: "INTAKE", name: "File Intake / KYC", short: "KYC", sla: 3, docs: ["PASSPORT", "EID", "VISA"], tasks: ["Collect KYC documents", "Run affordability calculator"], conditions: ["Transaction type identified before finalizing document checklist", "Documents organized into folders 01 KYC · 02 Income · 03 Statements · 04 Bank Forms · 05 Transaction · 06 Buyout · 07 Internal", "Obvious completeness & legibility checked", "Handover package states what is received, missing and to be verified", "Golden Visa labour card / contract collected where applicable"], tatNote: "The VRM handover is not complete merely because an email was sent." },
  { id: "FILEQC", name: "File QC", short: "QC", sla: 2, docs: ["SALCERT", "BANKSTMT", "LIABILITY", "CARDSTMT"], tasks: ["Complete file QC checklist", "QC review by Team Leader"], gate: "QC", conditions: ["KYC verified (EID, passport, visa, Golden Visa, self-attestation)", "Salary certificate verified (name, salary, signatory, stamp, PO Box)", "Bank statement period correct for bank; salary credits checked", "Salary variance supported by payslip where applicable", "Cash / unusual transactions clarified", "Pre-submission decision recorded (READY / PENDING / RETURN TO VRM)"], tatNote: "DO NOT SUBMIT if a required document is missing, expired, inconsistent, unsigned or unclear." },
  { id: "SUBMIT", name: "Bank Submission", short: "SUB", sla: 2, docs: ["APPFORM"], tasks: ["Submit file to bank", "Log submission reference"], conditions: ["Pre-Approval checklist completed and file marked READY", "Correct bank and submission route (Direct / Huspy) confirmed", "Current bank forms completed and signed", "KYC, income, statement, property/transaction documents attached", "Bank-specific requirements met (self-attested KYC, working sheet, routing)", "Submission email QC'd — correct client, attachments, CCs", "Submission evidence retained; receipt confirmation requested", "Follow-up ownership recorded in tracker"], tatNote: "Submission is complete only when transmitted, receipt confirmed and follow-up owned. Enter the trigger date when the file is registered at the bank." },
  { id: "PREAPP", name: "Pre-Approval", short: "PA", sla: 5, docs: ["PALETTER"], tasks: ["Follow up with bank", "Capture pre-approval terms"], conditions: ["Application submitted to bank", "DBR calculated & within bank limit", "Credit score confirmed", "NSTL rate offer used if salary not transferring to bank", "Daily follow-up until pre-approval or formal query", "Pre-approval letter received from bank", "Shared with client & client confirmed"], tatNote: "Pre-approval normally takes 3–5 working days (operational expectation, not a bank SLA). Check NSTL vs STL pricing." },
  { id: "QUERY", name: "Bank Query", short: "QRY", sla: 3, docs: [], tasks: ["Respond to bank query"], conditions: ["Query read carefully — every requested item identified", "Query logged with date, bank, request, deadline & owner", "Escalated to the relevant Virtual RM", "Response QC'd — every part of the query answered", "Evidence shared with bank same day", "Tracked until bank confirms resolution — no partial closure"] },
  { id: "VALUATION", name: "Valuation", short: "VAL", sla: 4, docs: ["VALPAYPROOF", "VALREP"], tasks: ["Obtain valuation payment proof", "Send valuation package to bank", "Schedule inspection", "Review valuation report"], conditions: ["Client advised to pay valuation fee (same day as pre-approval)", "Valuation payment proof received", "Property documents sent to bank for evaluation", "Seller / developer documents shared per transaction type", "Valuation initiated by bank", "Evaluator contacted Binish within 24 hours", "Inspection scheduled and confirmed", "Valuation report received (max 48h after inspection)", "Report QC completed (result, amount, remarks, conditions)", "Positive result shared with Virtual RM 2 / negative escalated"], tatNote: "Evaluator contacts Binish within 24h; report within 48h of inspection (operational expectations). Negative valuation: challenge the bank or get Sir's confirmation — never promise the client it will be overturned." },
  { id: "FOL", name: "FOL", short: "FOL", sla: 5, docs: ["CLIENTCONF", "FOL"], tasks: ["Confirm FOL terms with client", "Request FOL from bank", "Review Final Offer Letter", "Clarify FOL conditions"], conditions: ["Client confirmed finance amount, tenor, ROI, EMI, life & property insurance", "Client written confirmation + snapshot retained", "FOL request sent to bank after client confirmation", "FOL received and all pages readable", "FOL QC passed (customer name, property, loan amount, tenor, installment, insurance, ROI)", "FOL conditions & special remarks reviewed and recorded", "Correct FOL shared with Virtual RM 2 and client"], tatNote: "FOL normally received within 4–5 working days of request (operational expectation). If a query is raised by bank — respond same day." },
  { id: "DDA", name: "DDA / Signing", short: "DDA", sla: 3, docs: ["DDA"], tasks: ["Coordinate FOL signing", "Sign DDA with client", "Collect security cheques"], conditions: ["Client signing availability received", "Bank branch signing availability confirmed", "FOL signed (digital + manual) at bank branch", "DDA confirmed with client", "DDA confirmed with bank", "Seller type identified (liability / cash seller)", "Funding / security cheques confirmed"] },
  { id: "BOOKING", name: "Loan Booking", short: "BKG", sla: 2, docs: [], tasks: ["Book loan with bank"], conditions: ["FOL signed (digital + manual)", "All pre-approval & FOL conditions fulfilled", "Liability letter obtained (buyout/seller buyout) — must match property address in FOL", "Original liability letter + seller undertaking (per bank policy)", "Tracker booked in system", "Manager's cheque for final payment to developer arranged"], tatNote: "Loan booking should complete in max 5–6 working days. Manager's cheque to developer due by D+4 to D+7." },
  { id: "RELEASE", name: "Liability / Release", short: "REL", sla: 15, docs: ["NOC"], tasks: ["Settle existing liability", "Monitor release-letter notification", "Obtain mortgage release NOC"], conditions: ["Seller liability letter received", "Settlement date requested from bank and received", "Settlement completed (10–15 day expectation)", "Release-letter notification monitored (WhatsApp group + realtor)", "Bank informed of release notification", "Mortgage release letter obtained (7–10 working days — arrange early)", "Clearance / release documents available"], tatNote: "Cash seller: skip to Final Transfer after loan booking. Liability seller: settlement → release letter → Final Transfer." },
  { id: "TRANSFER", name: "Final Transfer", short: "TRF", sla: 4, docs: ["NOCDEV", "VALREP", "MANCHEQUE", "TITLE"], tasks: ["Confirm entry gate — DDA approved + release docs", "Request Developer NOC & transfer documents", "Confirm client availability", "Prepare & share final transfer charges", "Verify manager's cheque (client details + bank copies)", "Instruct bank to book transfer date", "Confirm Bank RM attendance", "Monitor transfer day & request title deed"], conditions: ["DDA approval confirmed & release docs collected (if seller liability)", "Bank transfer-booking process initiated (3–4 day expectation)", "Developer NOC requested/received where required", "Valuation report available", "Client availability obtained", "Final transfer charges prepared & shared with client", "Manager's cheque arranged — client cheque details verified", "Bank cheque copies requested & verified (double-check)", "Government-office date booked; Bank RM attendance confirmed", "Final transfer completed", "Title deed requested from client"], tatNote: "Bank books the transfer date with the government office. Title deed may take time — start chasing developer as soon as transfer is done." },
  { id: "TITLEQC", name: "Title Deed QC", short: "TD", sla: 2, docs: ["NEWTITLE", "TDQC"], tasks: ["QC new title deed", "Send Title Deed QC email to department", "Verify mortgage registration", "Send completion communication to client"], conditions: ["Title deed received from client", "Client/owner name & property details checked", "Property address matches transaction documents", "Document complete & readable", "Title Deed QC email sent to respective department", "QC email/status retained in case file", "Completion communication sent — client congratulated"] },
  { id: "CLOSURE", name: "Closure", short: "CL", sla: 2, docs: [], tasks: ["Run case closure audit", "Archive golden record"], conditions: ["Case closure audit passed (13 items)", "Final case record updated", "Pending departmental action recorded", "Golden record archived"], tatNote: "Transaction completion and administrative closure are separate controls — do not close while QC/handover remains pending." },
];

const R = (r: Omit<Rule, "active" | "history"> & { active?: boolean; history?: Rule["history"] }): Rule => ({
  active: true, history: [], ...r,
});

const rules: Rule[] = [
  R({ id: "r-ltv1", code: "LTV-NAT-1", module: "LTV", name: "LTV · UAE National · 1st finance", kind: "pct", value: 85, scope: { customerType: "NATIONAL", financeCount: 1 }, version: 2, effectiveFrom: "2026-07-01", history: [{ version: 1, value: 80, effectiveFrom: "2026-01-01" }], note: "Raised to 85% Jul-2026" }),
  R({ id: "r-ltv2", code: "LTV-NAT-2", module: "LTV", name: "LTV · UAE National · 2nd+", kind: "pct", value: 70, scope: { customerType: "NATIONAL", financeCount: 2 }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ltv3", code: "LTV-EXP-1", module: "LTV", name: "LTV · Expat · 1st finance", kind: "pct", value: 80, scope: { customerType: "EXPAT", financeCount: 1 }, version: 2, effectiveFrom: "2026-06-01", history: [{ version: 1, value: 85, effectiveFrom: "2026-01-01" }], note: "Tightened to 80% Jun-2026" }),
  R({ id: "r-ltv4", code: "LTV-EXP-2", module: "LTV", name: "LTV · Expat · 2nd+", kind: "pct", value: 65, scope: { customerType: "EXPAT", financeCount: 2 }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ltv5", code: "LTV-NR-1", module: "LTV", name: "LTV · Non-Resident · 1st", kind: "pct", value: 75, scope: { customerType: "NON_RESIDENT", financeCount: 1 }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ltv6", code: "LTV-NR-2", module: "LTV", name: "LTV · Non-Resident · 2nd+", kind: "pct", value: 60, scope: { customerType: "NON_RESIDENT", financeCount: 2 }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-dbr1", code: "DBR-MAX", module: "DBR", name: "DBR ceiling (all customers)", kind: "pct", value: 50, scope: {}, version: 2, effectiveFrom: "2026-08-01", history: [{ version: 1, value: 55, effectiveFrom: "2026-03-01" }], note: "DBR must stay strictly below 50% — TO VERIFY with compliance" }),
  R({ id: "r-ret1", code: "RET-NAT-SAL", module: "RETIRE", name: "Retirement age · National salaried", kind: "years", value: 60, scope: { customerType: "NATIONAL", employment: "SALARIED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret2", code: "RET-NAT-SE", module: "RETIRE", name: "Retirement age · National self-employed", kind: "years", value: 65, scope: { customerType: "NATIONAL", employment: "SELF_EMPLOYED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret3", code: "RET-EXP-SAL", module: "RETIRE", name: "Retirement age · Expat salaried", kind: "years", value: 60, scope: { customerType: "EXPAT", employment: "SALARIED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret4", code: "RET-EXP-SE", module: "RETIRE", name: "Retirement age · Expat self-employed", kind: "years", value: 70, scope: { customerType: "EXPAT", employment: "SELF_EMPLOYED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret5", code: "RET-NR-SAL", module: "RETIRE", name: "Retirement age · Non-Resident salaried", kind: "years", value: 65, scope: { customerType: "NON_RESIDENT", employment: "SALARIED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret6", code: "RET-NR-SE", module: "RETIRE", name: "Retirement age · Non-Resident self-employed", kind: "years", value: 70, scope: { customerType: "NON_RESIDENT", employment: "SELF_EMPLOYED" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ret7", code: "RET-DIB-EXP", module: "RETIRE", name: "DIB exception · Expat salaried", kind: "years", value: 65, scope: { customerType: "EXPAT", employment: "SALARIED", bankId: "b-dib" }, version: 1, effectiveFrom: "2026-02-01", note: "DIB accepts expat salaried to 65" }),
  R({ id: "r-ten1", code: "TENURE-MAX", module: "TENURE", name: "Global max tenure", kind: "months", value: 300, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "300 months / 25 years" }),
  R({ id: "r-cc1", code: "CC-RATE", module: "CC", name: "Credit card qualifying liability", kind: "pct", value: 5, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "5% of card limits" }),
  R({ id: "r-ms1", code: "MIN-SAL-EXP", module: "MIN_SAL", name: "Minimum salary · Expat", kind: "amount", value: 15000, scope: { customerType: "EXPAT" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ms2", code: "MIN-SAL-NAT", module: "MIN_SAL", name: "Minimum salary · National", kind: "amount", value: 10000, scope: { customerType: "NATIONAL" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-ms3", code: "MIN-SAL-NR", module: "MIN_SAL", name: "Minimum salary · Non-Resident", kind: "amount", value: 25000, scope: { customerType: "NON_RESIDENT" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f1", code: "FEE-PROC", module: "FEE", name: "Bank processing fee", kind: "pct", value: 1, scope: {}, fee: { basis: "loan", min: 2500 }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f2", code: "FEE-VAL", module: "FEE", name: "Valuation fee", kind: "amount", value: 2625, scope: {}, fee: { basis: "flat" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f3", code: "FEE-ADMIN", module: "FEE", name: "Bank admin fee", kind: "amount", value: 1050, scope: {}, fee: { basis: "flat" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f4", code: "FEE-DLD", module: "FEE", name: "DLD transfer fee", kind: "pct", value: 4, scope: { txType: "PURCHASE" }, fee: { basis: "property" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f5", code: "FEE-DLD-BE", module: "FEE", name: "DLD transfer fee (buyout+equity)", kind: "pct", value: 4, scope: { txType: "BUYOUT_EQUITY" }, fee: { basis: "property" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f6", code: "FEE-MREG", module: "FEE", name: "Mortgage registration", kind: "pct", value: 0.25, scope: {}, fee: { basis: "loan" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-f7", code: "FEE-AGENCY", module: "FEE", name: "Agency fee", kind: "pct", value: 2, scope: { txType: "PURCHASE" }, fee: { basis: "property" }, version: 1, effectiveFrom: "2026-01-01" }),
  R({ id: "r-s1", code: "SETTLE-1", module: "SETTLE", name: "Early settlement charge", kind: "pct", value: 1, scope: {}, fee: { basis: "loan", cap: 10000 }, version: 1, effectiveFrom: "2026-01-01", note: "1% of outstanding, capped AED 10,000" }),
  R({ id: "r-q1", code: "STRESS-QUAL", module: "STRESS", name: "Qualifying rate stress", kind: "pct", value: 2, scope: {}, version: 1, effectiveFrom: "2026-01-01" }),
  /* ---- Batch 3: statement & TAT controls (Admin-configurable) ---- */
  R({ id: "r-st1", code: "STMT-DEFAULT", module: "STMT", name: "Bank statement period · default", kind: "months", value: 6, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "General Pre-Approval requirement" }),
  R({ id: "r-st2", code: "STMT-ADIB", module: "STMT", name: "Bank statement period · ADIB", kind: "months", value: 3, scope: { bankId: "b-adib" }, version: 1, effectiveFrom: "2026-01-01", note: "Per VRM process — TO VERIFY against current bank instruction" }),
  R({ id: "r-t1", code: "PREAPP-WINDOW", module: "TAT", name: "Pre-approval receipt window", kind: "number", value: 5, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "4–5 working days — operational expectation, not a bank SLA" }),
  R({ id: "r-t2", code: "QUERY-RESPOND", module: "TAT", name: "Bank query response", kind: "number", value: 0, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "Same-day response when a query is raised (0 = same day)" }),
  R({ id: "r-t3", code: "EVAL-CONTACT", module: "TAT", name: "Evaluator contact after initiation", kind: "number", value: 1, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "Evaluator team calls Binish within 24 hours to schedule inspection — operational expectation" }),
  R({ id: "r-t4", code: "VALREP-WINDOW", module: "TAT", name: "Valuation report after inspection", kind: "number", value: 2, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "Maximum 48 hours after inspection — operational expectation, not a bank SLA" }),
  R({ id: "r-t5", code: "FOL-WINDOW", module: "TAT", name: "FOL receipt after request", kind: "number", value: 5, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "4–5 working days after client confirmation & request — operational expectation" }),
  R({ id: "r-t6", code: "SETTLE-WINDOW", module: "TAT", name: "Seller liability settlement", kind: "number", value: 15, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "10–15 days per supplied process — process expectation, not a guaranteed timeline" }),
  R({ id: "r-t7", code: "CHEQUE-DUE", module: "TAT", name: "Manager's cheque to developer", kind: "number", value: 7, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "Due by D+4 to D+7 after loan booking" }),
  R({ id: "r-t8", code: "TRANSFER-BOOKING", module: "TAT", name: "Bank transfer-booking period", kind: "number", value: 4, scope: {}, version: 1, effectiveFrom: "2026-01-01", note: "3–4 days once DDA approved + release docs collected (Batch 6) — operational expectation, not a bank SLA" }),
];

/* ---- Batch 3: bank submission matrix (route / statement / KYC / routing) ---- */
const bankMatrix: AppState["bankMatrix"] = [
  { bankId: "b-adib", route: "DIRECT", statementMonths: 3, selfAttestedKyc: true, workingSheet: true, routing: "Direct to ADIB RM", note: "KYC self-attested; attach working Excel sheet.", verified: false },
  { bankId: "b-dib", route: "DIRECT", statementMonths: 6, selfAttestedKyc: false, workingSheet: false, routing: "Direct to DIB RM", verified: true },
  { bankId: "b-enbd", route: "DIRECT", statementMonths: 6, routing: "Direct to ENBD RM", verified: true },
  { bankId: "b-hsbc", route: "BOTH", statementMonths: 6, routing: "Direct or via Huspy", verified: false },
  { bankId: "b-mashreq", route: "HUSPY", statementMonths: 6, routing: "Submit through Huspy portal", verified: false },
  { bankId: "b-cbd", route: "DIRECT", statementMonths: 6, routing: "Direct to CBD RM", verified: true },
  { bankId: "b-fab", route: "HUSPY", statementMonths: 6, routing: "Submit through Huspy portal", verified: false },
  { bankId: "b-rak", route: "DIRECT", statementMonths: 6, routing: "To mortgagereferrals, CC Burhan", note: "Use current approved mailbox from the team contact list.", verified: false },
  { bankId: "b-scb", route: "DIRECT", statementMonths: 6, routing: "Direct to SCB RM", verified: true },
  { bankId: "b-arab", route: "DIRECT", statementMonths: 6, routing: "Direct to Arab Bank RM", verified: true },
  { bankId: "b-nbf", route: "DIRECT", statementMonths: 6, routing: "Direct to NBF RM", verified: true },
  { bankId: "b-bob", route: "DIRECT", statementMonths: 6, routing: "Direct to BOB RM", verified: true },
  { bankId: "b-adcb", route: "HUSPY", statementMonths: 6, routing: "Submit through Huspy portal", verified: false },
];

/* ---- Batch 8 §127: Email Template Library ---- */
const templates: EmailTemplate[] = [
  { id: "tp1", name: "Direct Bank Submission", purpose: "Send the complete Pre-Approval file to the bank RM.", tags: ["Submission", "Direct bank"], source: "Batch 8 §127.1",
    subject: "Pre-Approval Submission – [Client Name] – [Bank]",
    body: "Dear [Bank RM],\n\nPlease find attached the complete documents and required bank forms for the Pre-Approval of [Client Name]. Kindly confirm receipt and proceed with the review.\n\nPlease let us know if any additional documents or clarification are required.\n\nRegards,\n[Name]\nHFMC" },
  { id: "tp2", name: "Receipt Follow-Up", purpose: "Chase the bank when no receipt confirmation or update has arrived.", tags: ["Follow-up", "Pre-Approval"], source: "Batch 8 §127.2",
    subject: "Follow-Up – Pre-Approval – [Client Name] – [Bank]",
    body: "Dear [Bank RM],\n\nKindly confirm the status of the above Pre-Approval submission and advise if any further documents or clarification are required.\n\nWe would appreciate your update on the expected approval timeline.\n\nRegards,\n[Name]" },
  { id: "tp3", name: "Huspy Submission to Areeb", purpose: "Confirm a Huspy portal submission with the screenshot attached.", tags: ["Huspy", "Submission"], source: "Batch 8 §127.3",
    subject: "Huspy Submission – [Client Name] – [Bank]",
    body: "Dear Areeb,\n\nWe have submitted the file for [Client Name] on the Huspy portal for [Bank]. Please review the submission and proceed with submission to the bank.\n\nAttached is the screenshot of the final submission step for reference.\n\nKindly confirm receipt.\n\nRegards,\n[Name]\nHFMC" },
  { id: "tp4", name: "Bank Query Response", purpose: "Answer a bank query with the supporting document attached.", tags: ["Query", "Response"], source: "Batch 8 §127.4",
    subject: "Re: Bank Query – [Client Name] – [Reference]",
    body: "Dear [Bank RM],\n\nPlease find attached the requested document/clarification regarding the above case.\n\nQuery: [Brief query]\nResponse: [Clear explanation]\nSupporting document: [Document name]\n\nKindly confirm if the query is now resolved and proceed with the review.\n\nRegards,\n[Name]" },
  { id: "tp5", name: "Client FOL Confirmation", purpose: "Ask the client to confirm FOL terms in writing before requesting the FOL.", tags: ["Client", "FOL"], source: "Batch 5 §60",
    subject: "Confirmation of Finance Terms – [Client Name]",
    body: "Dear [Client Name],\n\nPlease confirm the following finance terms so we may request your Final Offer Letter from [Bank]:\n\nFinance amount: [Amount]\nTenor: [Tenor]\nRate of interest: [ROI]\nExpected EMI: [EMI]\nLife insurance: [Details]\nProperty insurance: [Details]\n\nKindly reply to confirm these details.\n\nRegards,\n[Name]\nHFMC" },
  { id: "tp6", name: "Title Deed QC Email", purpose: "Send the received title deed to the respective department for quality check.", tags: ["Closure", "QC"], source: "Batch 6 §92",
    subject: "Title Deed Quality Check – [Client Name] – [Ref]",
    body: "Dear Team,\n\nPlease find attached the title deed for [Client Name] following completion of the final transfer on [Date].\n\nKindly carry out the quality check and confirm the record is correct.\n\nClient / owner name: [Name]\nProperty: [Property details]\nTransfer date: [Date]\n\nRegards,\n[Name]\nHFMC" },
];

/* ---- Batch 2/3: file-level QC checklist templates ---- */
type QcDef = { g: string; items: [string, boolean][] }; // [label, required]
const PREAPP_QC: QcDef[] = [
  { g: "Setup", items: [["Transaction type confirmed", true]] },
  { g: "KYC", items: [["Client KYC complete", true], ["EID validity checked", true], ["Passport validity checked", true], ["Visa validity checked", true], ["Golden Visa supporting document checked (if applicable)", false], ["Self-attestation / attestation requirement checked", true]] },
  { g: "Income", items: [["Salary Certificate received and valid", true], ["Salary Certificate name checked", true], ["Salary Certificate salary checked", true], ["Joining date checked", false], ["Authorized signatory checked", true], ["Stamp checked", true], ["PO Box / company address checked", false], ["Designation / employer checked", true]] },
  { g: "Bank Statement", items: [["Correct bank statement period received", true], ["Salary account confirmed", true], ["Salary credits checked", true], ["Salary matches Salary Certificate", true], ["Payslip obtained if variance", false], ["Cash / unusual transactions reviewed", true], ["Clarifications obtained where required", false]] },
  { g: "Employment", items: [["Service Letter obtained if new company / probation", false]] },
  { g: "Bank Forms", items: [["Bank application form correct", true], ["All form fields complete", true], ["Signatures / e-signatures complete", true], ["Client details match KYC on forms", true]] },
  { g: "Eligibility & Property", items: [["Eligibility / liabilities reviewed", true], ["Transaction property documents complete", true], ["Buyout previous FOL / applicable document checked", false]] },
  { g: "Submission", items: [["Submission route confirmed", true], ["Bank-specific requirements checked", true], ["All issues resolved", true], ["File marked READY for submission", true]] },
];
const SUBMIT_QC: QcDef[] = [
  { g: "Readiness", items: [["Pre-Approval checklist completed", true], ["Correct bank selected", true], ["Correct submission route confirmed", true]] },
  { g: "Documents", items: [["KYC complete", true], ["Income documents complete", true], ["Bank statement period correct for selected bank", true], ["Salary credits checked", true], ["Salary variance supported", false], ["Property / transaction documents complete", true], ["Buyout previous-bank documents checked (if applicable)", false]] },
  { g: "Forms & Evidence", items: [["Bank forms correct", true], ["Bank forms fully completed and signed", true], ["Bank-specific working sheet attached (if required)", false], ["Email format / portal route correct", true], ["Attachments checked for correct client", true]] },
  { g: "Transmission & Follow-up", items: [["Submission sent / completed", true], ["Submission evidence retained", true], ["Receipt confirmation requested / received", true], ["Follow-up tracker updated", true], ["Bank query owner assigned (if query received)", false], ["Query response submitted (if applicable)", false], ["Case tracked until Pre-Approval", true]] },
];
const HUSPY_QC: QcDef[] = [
  { g: "Step 1 · File Preparation", items: [["KYC (EID, Passport, Visa) checked — validity, name, signature, nationality", true], ["Salary Certificate checked — validity, PO Box, address, salary, designation, stamp", true], ["Salary-account statement (6 months) — salary credited, matches certificate", true], ["Payslip attached if variance", false], ["Title Deed / previous FOL attached for buyout", false], ["Bank forms + Huspy form complete and signed", true]] },
  { g: "Step 2 · Portal", items: [["Client created in Client Hub (no real client email/phone)", true], ["Complete Profile fields cross-checked vs source documents", true], ["Start Collection — bank & checklist selected", true], ["Case password created & shared via approved channel", true], ["Re-login sequence completed; client status confirmed", true]] },
  { g: "Review & Submit", items: [["Bank ROI entered manually and verified", true], ["Bank forms + Huspy form uploaded", true], ["Applicant documents uploaded per checklist", true], ["Case summary reviewed (client, bank, loan, purchase, tenor, ROI, property)", true], ["Additional Information + bank RM noted", true], ["Submitted to Huspy", true]] },
  { g: "Post-Submission", items: [["Screenshot of submission confirmation taken", true], ["Email to Areeb with screenshot; CC referrals + internal DLs", true], ["Email date/time recorded; screenshot retained in case file", true]] },
];
let qcN = 0;
const mkQc = (tpl: QcDef[]): ChecklistItem[] =>
  tpl.flatMap((grp) => grp.items.map(([label, required]) => ({ id: "qc" + ++qcN, label, group: grp.g, required, done: false })));

const banks: AppState["banks"] = [
  { id: "b-adib", name: "Abu Dhabi Islamic Bank", short: "ADIB" },
  { id: "b-dib", name: "Dubai Islamic Bank", short: "DIB" },
  { id: "b-enbd", name: "Emirates NBD", short: "ENBD" },
  { id: "b-hsbc", name: "HSBC Middle East", short: "HSBC" },
  { id: "b-mashreq", name: "Mashreq Bank", short: "Mashreq" },
  { id: "b-cbd", name: "Commercial Bank of Dubai", short: "CBD" },
  { id: "b-fab", name: "First Abu Dhabi Bank", short: "FAB" },
  { id: "b-rak", name: "RAKBANK", short: "RAK" },
  { id: "b-scb", name: "Standard Chartered UAE", short: "SCB" },
  { id: "b-arab", name: "Arab Bank UAE", short: "ARAB" },
  { id: "b-nbf", name: "National Bank of Fujairah", short: "NBF" },
  { id: "b-bob", name: "Bank of Baroda UAE", short: "BOB" },
  { id: "b-adcb", name: "Abu Dhabi Commercial Bank", short: "ADCB" },
];
const products: AppState["products"] = [
  { id: "pr-adib-sal", bankId: "b-adib", name: "ADIB Salaried Fixed", rateType: "ISLAMIC", rate: 3.99, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-dib-ijara", bankId: "b-dib", name: "DIB Ijarah", rateType: "ISLAMIC", rate: 3.75, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5, note: "Expat salaried retirement exception: 65" },
  { id: "pr-enbd-sal", bankId: "b-enbd", name: "ENBD Salaried Fixed 3Y", rateType: "FIXED", rate: 3.99, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-hsbc-prem", bankId: "b-hsbc", name: "HSBC Premier Mortgage", rateType: "FIXED", rate: 3.69, maxTenureMonths: 300, maxLoan: 7500000, ccRate: 5 },
  { id: "pr-mash-sal", bankId: "b-mashreq", name: "Mashreq Salaried", rateType: "FIXED", rate: 4.25, maxTenureMonths: 300, maxLoan: 4000000, ccRate: 5 },
  { id: "pr-cbd-sal", bankId: "b-cbd", name: "CBD Home Finance", rateType: "FIXED", rate: 4.15, maxTenureMonths: 300, maxLoan: 4000000, ccRate: 5 },
  { id: "pr-fab-sal", bankId: "b-fab", name: "FAB Salaried Fixed", rateType: "FIXED", rate: 3.89, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-rak-sal", bankId: "b-rak", name: "RAKBANK Salaried", rateType: "FIXED", rate: 4.35, maxTenureMonths: 300, maxLoan: 3500000, ccRate: 5 },
  { id: "pr-scb-sal", bankId: "b-scb", name: "SCB Mortgage Saver", rateType: "VARIABLE", rate: 4.45, maxTenureMonths: 300, maxLoan: 5000000, ccRate: 5 },
  { id: "pr-arab-sal", bankId: "b-arab", name: "Arab Bank Housing Loan", rateType: "FIXED", rate: 4.29, maxTenureMonths: 300, maxLoan: 3000000, ccRate: 5, note: "Credit cards at 5% of limits" },
  { id: "pr-nbf-sal", bankId: "b-nbf", name: "NBF Salaried Mortgage", rateType: "FIXED", rate: 4.4, maxTenureMonths: 300, maxLoan: 3000000, ccRate: 5 },
  { id: "pr-bob-sal", bankId: "b-bob", name: "BOB Home Loan", rateType: "FIXED", rate: 4.5, maxTenureMonths: 240, maxLoan: 2500000, ccRate: 5 },
  { id: "pr-adcb-sal", bankId: "b-adcb", name: "ADCB Salaried Fixed", rateType: "FIXED", rate: 3.89, maxTenureMonths: 300, maxLoan: 4000000, ccRate: 5 },
];

/* ---------- persons (deduplicated clients from the tracker) ---------- */
const CLIENTS = [
  "Faizul Hussain", "Reneez Ahmed Kabeer", "Ante Svagusa", "Yasir Mohhumad", "Jumana Hytham Zin Aldin",
  "Marc Robert Spitzer", "Stephen Geoff Fensham", "Jignesh Kumar Patel", "Walid Elrasoul", "Stanislav Boykov",
  "Gonzalo Tatay Diaz & Carla Viti Munoz", "Bhavesh & Prerna Magnani", "Sona Rawal & Bhavesh Rawal",
  "Ediz Karahasanoglu", "Yaghoub Hassan Pour", "Silvia Torres", "Dharpan Randhawa", "Qingie Yang",
  "Dr Rahat Ghazanfar", "Saurabh Jain", "Sumantra", "Chandan Marianathan Rajah", "Anna Larina",
  "Parvez Ahmed", "Yash Pandya", "Mr Sharafi", "Avinash Nagar", "Rona Nadeem",
  "Mohamed Hengazy I. Aboukhalil", "Spencer Domingos", "Ihab Abdulla Jawad", "Saeed Shah", "Ricardo Laborda",
  "Sangeeth Chemboth", "Karolina & Angie Abbas Issa", "Akram Shah", "Sheree Anne Serilla Sumpay",
  "Andrei Umnov", "Zinah Alkatabi & Ihab Jawad", "Hesham",
];
const persons: Person[] = CLIENTS.map((name, i) => ({
  id: "p" + (i + 1), name, customerType: "EXPAT", nationality: "", employment: "SALARIED",
  dob: "", mobile: "", email: "", employer: "", monthlySalary: 0, otherIncome: 0, financeCount: 1,
  cards: [], liabilities: [], kyc: { passport: false, eid: false, visa: false, address: false }, createdAt: d(-30),
}));
const pid = (name: string) => persons.find((p) => p.name === name)!.id;

/* ---------- daily tracker rows (as received from operations) ---------- */
const rep = (n: string): (string | null)[] => [n, n, n, n, n, n];
const N6: (string | null)[] = [null, null, null, null, null, null];

type Row = { st: string; client: string; bank: string; rm: string; ch: string; deal?: string; notes: (string | null)[] };

const ROWS: Row[] = [
  { st: "Valuation", client: "Faizul Hussain", bank: "b-adib", rm: "Zaffar", ch: "Direct", notes: rep("Waiting for the property to finalize.") },
  { st: "Pre-Approval", client: "Reneez Ahmed Kabeer", bank: "b-hsbc", rm: "Samiksha / Dinesh C", ch: "Huspy", notes: rep("Sir Kiran is following up Dinesh.") },
  { st: "Pre-Approval", client: "Reneez Ahmed Kabeer", bank: "b-hsbc", rm: "Samiksha / Dinesh", ch: "Huspy", notes: ["Sir is directly coordinating with Dinesh — waiting for approval.", "Sir is directly coordinating with Dinesh — waiting for approval.", "Sir is directly coordinating with Dinesh — waiting for approval.", "Sir Kiran is following up Dinesh.", "Sir Kiran is following up Dinesh.", "Sir Kiran is following up Dinesh."] },
  { st: "Valuation", client: "Reneez Ahmed Kabeer", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Waiting for the property to finalize.") },
  { st: "Pre-Approval", client: "Reneez Ahmed Kabeer", bank: "b-mashreq", rm: "Samiksha / Praveen", ch: "Direct", notes: rep("As per bank revert, bonuses cannot be considered for a family business — income not eligible per Mashreq policy. Waiting for Sir's response.") },
  { st: "Pre-Approval", client: "Reneez Ahmed Kabeer", bank: "b-adib", rm: "Zaffar", ch: "Direct", deal: "Land plot", notes: rep("Nothing to do now — no submission, instructed by Sir Kiran.") },
  { st: "Pre-Approval", client: "Ante Svagusa", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Pre-approval received but finance value is less. RCD didn't change the amount — will request amendment after valuation. Share valuation doc.") },
  { st: "Valuation", client: "Ante Svagusa", bank: "b-adib", rm: "Zaffar", ch: "Direct", notes: rep("Waiting for the property to finalize.") },
  { st: "Pre-Approval", client: "Yasir Mohhumad", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Pre-approval received 19-Jan-2026 for less amount and less tenure. Per Sir, submit fresh case with new working.") },
  { st: "Closed", client: "Jumana Hytham Zin Aldin", bank: "b-adib", rm: "Zaffar", ch: "Direct", notes: N6 },
  { st: "Closed", client: "Jumana Hytham Zin Aldin", bank: "b-dib", rm: "Babar", ch: "Direct", notes: N6 },
  { st: "Valuation", client: "Marc Robert Spitzer", bank: "b-cbd", rm: "Samiksha / Praveen", ch: "Huspy", notes: rep("Waiting for the property to finalize.") },
  { st: "Pre-Approval", client: "Marc Robert Spitzer", bank: "b-mashreq", rm: "Samiksha / Praveen", ch: "Huspy", notes: rep("Case on hold due to pre-approval fees — client doesn't want to pay.") },
  { st: "Valuation", client: "Stephen Geoff Fensham", bank: "b-hsbc", rm: "Samiksha", ch: "Huspy", notes: rep("Case is on hold.") },
  { st: "Valuation", client: "Stephen Geoff Fensham", bank: "b-scb", rm: "Samiksha", ch: "Huspy", notes: rep("Case is on hold.") },
  { st: "Valuation", client: "Stephen Geoff Fensham", bank: "b-enbd", rm: "Samiksha", ch: "Huspy", notes: rep("Case is on hold.") },
  { st: "Valuation", client: "Stephen Geoff Fensham", bank: "b-rak", rm: "Farukh", ch: "Prypco", notes: rep("Case is on hold.") },
  { st: "Valuation", client: "Jignesh Kumar Patel", bank: "b-mashreq", rm: "Samiksha / Praveen", ch: "Huspy", notes: rep("ENBD valuation completed; case now in FOL — waiting for client confirmation on the Mashreq transaction.") },
  { st: "Pre-Approval", client: "Walid Elrasoul", bank: "b-dib", rm: "Nawzat", ch: "Direct", notes: rep("Bank query received — waiting for VRM response.") },
  { st: "Valuation", client: "Stanislav Boykov", bank: "b-rak", rm: "Farukh", ch: "Prypco", notes: rep("Sir Kiran coordinating with client — property not yet finalized.") },
  { st: "Won&closed", client: "Gonzalo Tatay Diaz & Carla Viti Munoz", bank: "b-adib", rm: "Zaffar", ch: "Direct", notes: N6 },
  { st: "Valuation", client: "Bhavesh & Prerna Magnani", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Property not finalized — as per Sir, do not follow up.") },
  { st: "Valuation", client: "Sona Rawal & Bhavesh Rawal", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Client wants to hold for now; introduced to our internal real-estate team for assistance.") },
  { st: "Valuation", client: "Ediz Karahasanoglu", bank: "b-hsbc", rm: "Samiksha", ch: "Huspy", notes: rep("Sir Kiran is handling the case.") },
  { st: "Pre-Approval", client: "Yaghoub Hassan Pour", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: rep("Waiting for Sir's reply to the query.") },
  { st: "Pre-Approval", client: "Yaghoub Hassan Pour", bank: "b-cbd", rm: "Burhan", ch: "Direct", notes: rep("Pre-approval received 11-Jun-2026 with conditions — less FAV AED 1,174,000.") },
  { st: "Won&closed", client: "Silvia Torres", bank: "b-enbd", rm: "Tuba", ch: "Huspy", notes: N6 },
  { st: "Final Transfer", client: "Dharpan Randhawa", bank: "b-adib", rm: "Eranga", ch: "Direct", notes: rep("Waiting for TD.") },
  { st: "Won&closed", client: "Qingie Yang", bank: "b-dib", rm: "Babar", ch: "Direct", notes: N6 },
  { st: "Won&closed", client: "Dr Rahat Ghazanfar", bank: "b-dib", rm: "Raouf", ch: "Direct", notes: N6 },
  { st: "Won&closed", client: "Dr Rahat Ghazanfar", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: N6 },
  { st: "Pre-Approval", client: "Yaghoub Hassan Pour", bank: "b-cbd", rm: "Burhan", ch: "Direct", deal: "Second file", notes: rep("Pre-approval received 11-Jun-2026 with conditions — less FAV AED 1,174,000.") },
  { st: "Valuation", client: "Saurabh Jain", bank: "b-bob", rm: "Vikas", ch: "Direct", notes: rep("Waiting for BCC (Building Completion Certificate) report to do property evaluation.") },
  { st: "Won&closed", client: "Sumantra", bank: "b-enbd", rm: "Buddha", ch: "Huspy", notes: N6 },
  { st: "Pre-Approval", client: "Chandan Marianathan Rajah", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Pre-approval received 24-Jun-2026; property not finalized — VRM checking with client. Case on hold.") },
  { st: "Final Transfer", client: "Anna Larina", bank: "b-rak", rm: "Shiji", ch: "Prypco", notes: ["Blocking process done — blocking certificate shared by client. Settlement cheque deposited with HSBC on 13-Aug-2026.", "Blocking process done — blocking certificate shared by client. Settlement cheque deposited with HSBC on 13-Aug-2026.", "Waiting for update on mortgage release letter from HSBC.", "Waiting for update on mortgage release letter from HSBC.", "Waiting for update on mortgage release letter from HSBC.", "Waiting for update on mortgage release letter from HSBC."] },
  { st: "Loan Booking", client: "Parvez Ahmed", bank: "b-dib", rm: "Babar", ch: "Direct", notes: ["Liability letter expected by Friday — follow up to confirm receipt and next steps. Salary certificate shared with banker Babar.", "Liability letter takes 5 days to issue. Seller advised to drop original liability letter at Mr. Babar Zaheer's office (10th Floor, Business Avenue Tower, Salam Street, AD) if issued today; confirm designated FAB branch for settlement cheque.", "Liability letter takes 5 days to issue. Seller advised to drop original liability letter at Mr. Babar Zaheer's office (10th Floor, Business Avenue Tower, Salam Street, AD) if issued today; confirm designated FAB branch for settlement cheque.", "Liability letter received — Sir Kiran sent same to bank. NOC received on WhatsApp and saved in G-drive folder.", "Liability letter received — Sir Kiran sent same to bank. NOC received on WhatsApp and saved in G-drive folder.", "Settlement appointment booked for 24-Aug-2026, 10:03 AM. Bank asked us to confirm branch with seller. Per proposal sheet, cheque to be deposited at FAB Khalifa Street or FAB Khalifa Park branch — verification needed. Email sent to VRM, awaiting confirmation."] },
  { st: "Pre-Approval", client: "Yash Pandya", bank: "b-dib", rm: "Babar", ch: "Direct", notes: rep("Pre-approval received; refund of valuation fees credited to client's account. Case on hold.") },
  { st: "Closed", client: "Mr Sharafi", bank: "b-dib", rm: "Abdul", ch: "Direct", notes: N6 },
  { st: "Loan Booking", client: "Avinash Nagar", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: ["Settlement successfully completed today. Next step: wait for Mortgage Release Letter (approx. 7–10 working days after settlement).", "Settlement successfully completed today. Next step: wait for Mortgage Release Letter (approx. 7–10 working days after settlement).", "Settlement successfully completed on 13-Aug-2026. Waiting for Mortgage Release Letter (approx. 7–10 working days).", "Settlement successfully completed on 13-Aug-2026. Waiting for Mortgage Release Letter (approx. 7–10 working days).", "24th–28th Aug 2026: mortgage release and mortgage registration should be completed.", "24th–28th Aug 2026: mortgage release and registration expected. As per Kiran Sir — nothing to be done for now."] },
  { st: "Valuation", client: "Avinash Nagar", bank: "b-adib", rm: "Ahmed", ch: "Direct", deal: "Second property", notes: ["Valuation initiated — waiting for schedule from realtor. On hold (waiting for handover notification; till 17-Aug no follow-up).", "Valuation initiated — waiting for schedule from realtor. On hold (waiting for handover notification; till 17-Aug no follow-up).", "Valuation initiated — waiting for schedule from realtor. On hold (waiting for handover notification; till 17-Aug no follow-up).", "Valuation initiated — waiting for schedule from realtor. On hold (waiting for handover notification; till 17-Aug no follow-up).", "Wait till Thursday (20-Aug-2026) to put a message — see the response from the realtor today. Based on the realtor's decision, take the valuation ahead.", "Wait till Thursday (20-Aug-2026) to put a message — see the response from the realtor today. Based on the realtor's decision, take the valuation ahead."] },
  { st: "FOL", client: "Rona Nadeem", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: ["FOL on hold for seller title deed copy. Once received, push transaction ahead — wait till Friday for seller update.", "FOL on hold for seller title deed copy. Once received, push transaction ahead — wait till Friday for seller update.", "FOL on hold for seller title deed copy. Once received, push transaction ahead — wait till Friday for seller update.", "FOL on hold for seller title deed copy. Once received, push transaction ahead — wait till Friday for seller update.", "FOL on hold for seller title deed copy. Once received, push transaction ahead — wait till Friday for seller update.", "Waiting for seller's title deed. Per realtor: Aldar RM can't do anything as it's already under municipality. News expected next week Mon/Tue."] },
  { st: "Loan Booking", client: "Mohamed Hengazy I. Aboukhalil", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: ["Per Kiran Sir: take Hegazy to Aldar customer service, show FOL, inform loan booking / drawdown / manager's cheque under preparation — need confirmation from Khalil.", "Per Kiran Sir: take Hegazy to Aldar customer service, show FOL — as per Khalil, handover cheques to Ahmed (ADIB).", "As per bank revert: deal is booked.", "Developer cheque handed over to Aldar 18-Aug-2026.", "Manager's cheque handed over to Aldar on 18-Aug-2026.", "Client to visit Aldar at least once in 2 days for title deed of the apartment — manager's cheque handed over on 18-Aug-2026."] },
  { st: "Loan Booking", client: "Spencer Domingos", bank: "b-dib", rm: "Abdul", ch: "Direct", notes: ["As per bank update: case under process — FOL to be shared soon.", "Case under process; follow-up email sent requesting FOL update.", "FOL received — rechecking done and shared with VRM.", "FOL signing done 18-Aug-2026. Case moves to Loan Booking.", "Loan booking is in process.", "Per banker, transfer of ownership scheduled for 24-Aug-2026; client to confirm convenient date/time on Monday — banker informed by email."] },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-mashreq", rm: "Praveen", ch: "Huspy", deal: "80%", notes: rep("Query received — per Sir's instruction, do not follow up with the bank from 10-Aug-2026.") },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-cbd", rm: "Shiji", ch: "Prypco", deal: "80% Resale", notes: rep("Per Sir's instruction, do not follow up with the bank from 10-Aug-2026.") },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-cbd", rm: "Shiji", ch: "Prypco", deal: "Unit 420 — Commercial 60%", notes: rep("Pre-approval received — waiting for client confirmation to move to next stage.") },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-cbd", rm: "Shiji", ch: "Prypco", deal: "Unit 419 — Commercial 60%", notes: ["Pre-approval received — waiting for client confirmation to move to next stage.", "Pre-approval received — waiting for client confirmation to move to next stage.", "Pre-approval received — waiting for client confirmation to move to next stage.", "Pre-approval received — waiting for client confirmation to move to next stage.", "Per Sir's instruction, do not follow up with the bank from 10-Aug-2026.", "Pre-approval received — waiting for client confirmation to move to next stage."] },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-enbd", rm: "Samiksha", ch: "Huspy", deal: "50%", notes: rep("Case is on hold.") },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-enbd", rm: "Samiksha", ch: "Huspy", deal: "80% Resale", notes: ["As per bank update: case is with credit — decision expected today or by tomorrow.", "Query received from bank — same query sent to Kiran Sir for assist.", "As per Sir's confirmation — don't follow.", "As per Sir's confirmation — don't follow.", "As per Sir's confirmation — don't follow.", "As per Sir's confirmation — don't follow."] },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: rep("Pre-approval received for 65% — waiting for other banks' pre-approval updates. Bank query received.") },
  { st: "Loan Booking", client: "Parvez Ahmed", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: ["DDA activated by client. Loan-booking email shared; settlement requested for 17-Aug-2026. ADIB confirmed deal booked — settlement appointment once PO received.", "DDA activated by client. Loan-booking email shared; settlement requested for 17-Aug-2026. ADIB confirmed deal booked — settlement appointment once PO received.", "Settlement completed today 17-Aug at DIB.", "Settlement completed 17-Aug at DIB — waiting for mortgage release letter.", "Settlement completed 17-Aug at DIB — awaiting mortgage release letter.", "Mortgage Release Letter expected around 26th–31st Aug 2026."] },
  { st: "Valuation", client: "Saeed Shah", bank: "b-adib", rm: "Ahmed", ch: "Direct", deal: "Al Reef — Buyout + Equity", notes: rep("Pre-approval received — valuation payment pending from client's side.") },
  { st: "Valuation", client: "Saeed Shah", bank: "b-adib", rm: "Ahmed", ch: "Direct", deal: "Water Edge — Buyout + Equity", notes: rep("Pre-approval received — valuation payment pending from client's side.") },
  { st: "FOL", client: "Ricardo Laborda", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: rep("Valuation report received but market value came in lower. Waiting for FOL conversion from VRM — Sir Kiran showing more properties to client.") },
  { st: "Valuation", client: "Sangeeth Chemboth", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: rep("Waiting for valuation payment proof.") },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-fab", rm: "Shiji", ch: "Prypco", deal: "80% Resale", notes: ["Case is in credit as per the banker.", "Query received from the bank yesterday.", "Query received — per Sir's instruction, do not follow up with the bank from 17-Aug-2026.", "Query received — per Sir's instruction, do not follow up with the bank from 17-Aug-2026.", "Query received — per Sir's instruction, do not follow up with the bank from 17-Aug-2026.", "Query received — per Sir's instruction, do not follow up with the bank from 17-Aug-2026."] },
  { st: "Closed", client: "Ihab Abdulla Jawad", bank: "b-fab", rm: "Shiji", ch: "Prypco", deal: "Unit 420 — Commercial 70%", notes: N6 },
  { st: "Closed", client: "Ihab Abdulla Jawad", bank: "b-fab", rm: "Shiji", ch: "Prypco", deal: "Unit 419 — Commercial 70%", notes: N6 },
  { st: "FOL", client: "Karolina & Angie Abbas Issa", bank: "b-dib", rm: "Babar", ch: "Direct", notes: ["Valuation amount received AED 1,650,000. Case moved to FOL.", "FOL conversion details shared with bank — awaiting FOL update.", "Per banker Abdul: verification certificate received and FOL processed. Follow-up email sent asking expected FOL timeline.", "FOL received 17-Aug-2026. Signing on 31-Aug-2026, 10:30 AM — Madam Karolina out of UAE till 30-Aug.", "FOL signing on 31-Aug-2026, 10:30 AM — Madam Karolina out of UAE till 30-Aug-2026.", "FOL signing on 31-Aug-2026, 10:30 AM — Madam Karolina out of UAE till 30-Aug-2026."] },
  { st: "Pre-Approval", client: "Akram Shah", bank: "b-adib", rm: "Ahmed", ch: "Direct", notes: rep("Bank query received — there is an overdue.") },
  { st: "Pre-Approval", client: "Akram Shah", bank: "b-cbd", rm: "Siji", ch: "Huspy", notes: rep("Case on hold as per Sir's instruction 30-Jul-2026.") },
  { st: "FOL", client: "Jumana Hytham Zin Aldin", bank: "b-dib", rm: "Raouf", ch: "Direct", notes: ["Follow-up email sent to bank for pre-approval status.", "Follow-up email sent requesting pre-approval status; FOL conversion details shared in advance.", "Per Abdul: case at Level-4 approval with credit for pre-approval. FOL conversion + documents shared in advance on 14-Aug so FOL can process immediately on approval.", "Per Alaa: POL today and conversion to be submitted today.", "Pre-approval received — waiting for FOL.", "Pre-approval received yesterday; follow-up email sent to bank for FOL letter."] },
  { st: "Pre-Approval", client: "Sheree Anne Serilla Sumpay", bank: "b-dib", rm: "Raouf", ch: "Direct", notes: ["Follow-up with banker Abdul — file received and in credit review. Query raised for deployed-company ID card; requested from client.", "File under process. Bank query: ID card from deployed company — requested from client; will share and follow up on pre-approval.", "File under process. Bank query: ID card from deployed company — requested from client; will share and follow up on pre-approval.", "ID card received from client and submitted to bank. Follow-up email sent to Abdul for pre-approval status.", "Follow-up email sent to banker for pre-approval status.", "Follow-up email sent to banker for pre-approval status."] },
  { st: "Pre-Approval", client: "Andrei Umnov", bank: "b-cbd", rm: "Santanu", ch: "Prypco", notes: [null, null, "File submitted to the bank.", "Case was logged yesterday — per Santanu Sir, no update yet.", "Santanu Sir following up with bank — awaiting LMF number.", "Santanu Sir following up with bank — awaiting LMF number."] },
  { st: "Pre-Approval", client: "Saeed Shah", bank: "b-dib", rm: "Raouf", ch: "Direct", deal: "Al Reef — Resale", notes: [null, null, null, null, "File submitted to the bank.", "Swathi shared the documents with Abdul — file in process with bank."] },
  { st: "Pre-Approval", client: "Zinah Alkatabi & Ihab Jawad", bank: "b-arab", rm: "Pradipta", ch: "Direct", notes: [null, null, null, null, "File submitted to the bank.", "Query raised by bank for HRA AED 150,000 — credit proof in statement."] },
  { st: "Pre-Approval", client: "Zinah Alkatabi & Ihab Jawad", bank: "b-cbd", rm: "Santanu", ch: "Prypco", notes: [null, null, null, null, null, "File submitted to the bank."] },
  { st: "Pre-Approval", client: "Hesham", bank: "b-arab", rm: "Pradipta", ch: "Direct", notes: [null, null, null, null, null, "Few documents have been shared."] },
  { st: "Pre-Approval", client: "Ihab Abdulla Jawad", bank: "b-nbf", rm: "Rajeew", ch: "Direct", notes: [null, null, null, null, "Documents submitted to the bank.", "Follow-up mail sent to bank — waiting for response."] },
];

const STAGE_OF: Record<string, string> = {
  "Pre-Approval": "PREAPP", Valuation: "VALUATION", FOL: "FOL", "Loan Booking": "BOOKING", "Final Transfer": "TRANSFER",
  Closed: "CLOSURE", "Won&closed": "CLOSURE",
};

/* stage indices: HANDOVER 0 · INTAKE 1 · FILEQC 2 · SUBMIT 3 · PREAPP 4 · QUERY 5 · VALUATION 6 · FOL 7 · DDA 8 · BOOKING 9 · RELEASE 10 · TRANSFER 11 · TITLEQC 12 · CLOSURE 13 */
let dn = 0;
const mkDocs = (stageIdx: number, o: { folReceived?: boolean; dda?: DocStatus } = {}): DocItem[] => {
  const out: DocItem[] = [];
  const push = (stageId: string, typeId: string, status: DocStatus) =>
    out.push({ id: "sd" + ++dn, typeId, stageId, status, updatedAt: ts(-3), updatedBy: "hfmm-01" });
  if (stageIdx >= 1) ["PASSPORT", "EID", "VISA"].forEach((t) => push("INTAKE", t, "VERIFIED"));
  if (stageIdx >= 3) push("SUBMIT", "APPFORM", "VERIFIED");
  if (stageIdx >= 4) push("PREAPP", "PALETTER", stageIdx > 4 ? "VERIFIED" : "MISSING");
  if (stageIdx >= 6) { push("VALUATION", "VALPAYPROOF", stageIdx > 6 ? "VERIFIED" : "RECEIVED"); push("VALUATION", "VALREP", stageIdx > 6 ? "VERIFIED" : "MISSING"); }
  if (stageIdx >= 7) { push("FOL", "CLIENTCONF", "VERIFIED"); push("FOL", "FOL", stageIdx > 7 ? "VERIFIED" : o.folReceived ? "RECEIVED" : "MISSING"); }
  if (stageIdx >= 8) push("DDA", "DDA", stageIdx > 8 ? "VERIFIED" : o.dda ?? "MISSING");
  if (stageIdx >= 10) push("RELEASE", "RELEASELETTER", stageIdx > 10 ? "VERIFIED" : "MISSING");
  if (stageIdx >= 11) { ["NOCDEV", "VALREP", "MANCHEQUE"].forEach((t) => push("TRANSFER", t, stageIdx > 11 ? "VERIFIED" : "RECEIVED")); push("TRANSFER", "TITLE", stageIdx > 11 ? "VERIFIED" : "MISSING"); }
  if (stageIdx >= 12) { push("TITLEQC", "NEWTITLE", "RECEIVED"); push("TITLEQC", "TDQC", stageIdx > 12 ? "VERIFIED" : "MISSING"); }
  return out;
};

const SPOS = ["hfmm-01", "hfmm-02", "hfmm-03", "hfmm-04", "hfmm-05", "hfmm-06"];
const VRMS = ["hfmm-07", "hfmm-08", "hfmm-09", "hfmm-10", "hfmm-11", "hfmm-13"];

let cn = 0;
const cases: Case[] = ROWS.map((r, i) => {
  cn += 1;
  const closed = r.st === "Closed" || r.st === "Won&closed";
  const stage = STAGE_OF[r.st];
  const prod = products.find((p) => p.bankId === r.bank)!;
  const tracker: TrackerEntry[] = r.notes
    .map((n, k) => ({ date: TRACKER_DATES[k], note: n }))
    .filter((e): e is TrackerEntry => !!e.note)
    .map((e) => ({ ...e, note: e.note as string }));
  const lastNote = tracker.length ? tracker[tracker.length - 1].note : undefined;
  const holdish = /on hold|don'?t follow|nothing to do|do not follow/i.test(lastNote ?? "");
  const waiting =
    /property.*(finalize|finalized)|not yet finalized/i.test(lastNote ?? "") ? { w: "Client", p: "Property not finalized" } :
    /pre-approval fees/i.test(lastNote ?? "") ? { w: "Client", p: "Pre-approval fee objection" } :
    /valuation payment/i.test(lastNote ?? "") ? { w: "Client", p: "Valuation payment pending" } :
    /mortgage release/i.test(lastNote ?? "") ? { w: "Bank", p: "Awaiting mortgage release letter" } :
    /waiting for (sir|kiran)/i.test(lastNote ?? "") || /sir'?s (reply|response)/i.test(lastNote ?? "") ? { w: "Sir Kiran", p: "Awaiting management reply" } :
    /vrms? response/i.test(lastNote ?? "") ? { w: "VRM", p: "Awaiting VRM response" } :
    /query/i.test(lastNote ?? "") ? { w: "Bank", p: "Bank query in progress" } :
    /client confirmation|client'?s confirmation/i.test(lastNote ?? "") ? { w: "Client", p: "Awaiting client confirmation" } :
    /waiting for (td|title deed|seller)/i.test(lastNote ?? "") ? { w: "Seller", p: "Awaiting seller documents" } :
    /bcc/i.test(lastNote ?? "") ? { w: "Developer", p: "Awaiting BCC report" } :
    /realtor/i.test(lastNote ?? "") ? { w: "Realtor", p: "Awaiting realtor update" } :
    holdish ? { w: "Sir Kiran", p: "On instruction — no follow-up" } :
    lastNote ? { w: "Bank", p: "Awaiting bank response" } : undefined;
  const dueSeq = [2, -2, 4, 1, -1, 3, 0, 5][i % 8];
  const base: Case = {
    id: "c" + (3000 + cn), ref: "HF-" + (3000 + cn), personId: pid(r.client), ownerId: SPOS[i % 6],
    bankId: r.bank, productId: prod.id, txType: /buyout \+ equity/i.test(r.deal ?? "") ? "BUYOUT_EQUITY" : /buyout/i.test(r.deal ?? "") ? "BUYOUT" : "PURCHASE",
    deal: r.deal, bankRm: r.rm, channel: r.ch,
    propertyValue: r.client === "Karolina & Angie Abbas Issa" ? 1650000 : 0,
    loanAmount: r.client === "Yaghoub Hassan Pour" && r.deal !== "Second file" ? 1174000 : 0,
    rate: prod.rate, tenureMonths: 300,
    stage, status: closed ? "CLOSED" : "OPEN",
    outcome: r.st === "Won&closed" ? "WON" : r.st === "Closed" ? "LOST" : undefined,
    tracker,
    stageHistory: [{ stageId: stage, at: ts(closed ? -30 : -(10 + (i % 12))), by: SPOS[i % 6] }],
    createdAt: d(closed ? -60 : -(12 + (i % 20))),
    expectedRevenue: 0,
    docs: mkDocs(stages.findIndex((s) => s.id === stage), {
      folReceived: r.client === "Karolina & Angie Abbas Issa",
      dda: (r.client === "Parvez Ahmed" && r.bank === "b-adib") || r.client === "Mohamed Hengazy I. Aboukhalil" ? "VERIFIED" : undefined,
    }),
    ...(closed ? {} : {
      preappQc: mkQc(PREAPP_QC),
      submitQc: mkQc(SUBMIT_QC),
      ...(r.ch === "Huspy" ? { huspyQc: mkQc(HUSPY_QC) } : {}),
    }),
    ...(closed
      ? { closedAt: d(-1) }
      : {
          nextAction: lastNote ? (holdish ? "Await instruction — no follow-up" : "Update daily tracker & follow up") : "Profile client file",
          nextActionDue: lastNote ? d(dueSeq) : d(1),
          waitingFor: waiting?.w, pendingReason: waiting?.p,
          blocker: /don'?t follow|do not follow|nothing to do/i.test(lastNote ?? "") ? "Instruction from Sir Kiran — do not follow up" : undefined,
        }),
  };
  return base;
});

const byRef = (client: string, bank: string, deal?: string) =>
  cases.find((c) => c.personId === pid(client) && c.bankId === bank && (c.deal ?? undefined) === deal)!;

/* ---------- tasks derived from the tracker's action points ---------- */
let tn = 0;
const task = (c: Case, title: string, o: Partial<Task> = {}): Task => ({
  id: "st" + ++tn, caseId: c.id, stageId: c.stage, type: "Follow up with bank", title,
  ownerId: c.ownerId, priority: "MEDIUM", status: "OPEN", createdAt: ts(-3), ...o,
});
const tasks: Task[] = [
  task(byRef("Parvez Ahmed", "b-dib"), "Confirm FAB settlement branch with seller — appointment 24-Aug, 10:03 AM", { due: d(-1), priority: "HIGH", waitingFor: "VRM" }),
  task(byRef("Avinash Nagar", "b-adib"), "Follow up Mortgage Release Letter (expected 24–28 Aug)", { due: d(2), waitingFor: "Bank" }),
  task(byRef("Avinash Nagar", "b-adib", "Second property"), "Message realtor — decision on valuation schedule", { due: d(-2), priority: "HIGH", waitingFor: "Realtor" }),
  task(byRef("Rona Nadeem", "b-adib"), "Chase seller title deed — Aldar/municipality update Mon–Tue", { due: d(-2), waitingFor: "Seller" }),
  task(byRef("Mohamed Hengazy I. Aboukhalil", "b-adib"), "Client visit to Aldar for apartment title deed", { due: d(1), waitingFor: "Client" }),
  task(byRef("Spencer Domingos", "b-dib"), "Confirm ownership-transfer date with client (bank proposed 24-Aug)", { due: d(0), waitingFor: "Client" }),
  task(byRef("Karolina & Angie Abbas Issa", "b-dib"), "FOL signing 31-Aug, 10:30 AM — reminder before client returns 30-Aug", { due: d(6), waitingFor: "Client" }),
  task(byRef("Jumana Hytham Zin Aldin", "b-dib"), "Follow up bank for FOL letter (pre-approval in)", { due: d(1), priority: "HIGH", waitingFor: "Bank" }),
  task(byRef("Saeed Shah", "b-adib", "Al Reef — Buyout + Equity"), "Collect valuation payment from client", { due: d(-3), priority: "HIGH", waitingFor: "Client", pendingReason: "Valuation payment pending" }),
  task(byRef("Saeed Shah", "b-adib", "Water Edge — Buyout + Equity"), "Collect valuation payment from client", { due: d(-3), priority: "HIGH", waitingFor: "Client", pendingReason: "Valuation payment pending" }),
  task(byRef("Sangeeth Chemboth", "b-adib"), "Collect valuation payment proof", { due: d(-1), waitingFor: "Client" }),
  task(byRef("Anna Larina", "b-rak"), "Chase HSBC mortgage release letter (cheque deposited 13-Aug)", { due: d(0), priority: "HIGH", waitingFor: "Bank" }),
  task(byRef("Dharpan Randhawa", "b-adib"), "Obtain title deed for final transfer", { due: d(2), waitingFor: "Developer" }),
  task(byRef("Ricardo Laborda", "b-adib"), "FOL conversion — VRM to shortlist alternate properties with Sir Kiran", { due: d(3), waitingFor: "Client" }),
  task(byRef("Yasir Mohhumad", "b-dib"), "Resubmit fresh case with new working (less amount & tenure)", { due: d(-4), priority: "HIGH", waitingFor: "Sir Kiran" }),
  task(byRef("Ante Svagusa", "b-dib"), "Request FAV amendment after valuation; share valuation doc", { due: d(2), waitingFor: "Bank" }),
  task(byRef("Reneez Ahmed Kabeer", "b-mashreq"), "Bonus-income eligibility — await Sir's response to bank revert", { due: d(-1), waitingFor: "Sir Kiran", pendingReason: "Income not eligible per Mashreq policy" }),
  task(byRef("Jignesh Kumar Patel", "b-mashreq"), "Client confirmation on Mashreq transaction (ENBD FOL running)", { due: d(1), waitingFor: "Client" }),
  task(byRef("Walid Elrasoul", "b-dib"), "Answer bank query — coordinate VRM response", { due: d(-1), priority: "HIGH", waitingFor: "VRM" }),
  task(byRef("Sheree Anne Serilla Sumpay", "b-dib"), "Follow up pre-approval after ID card submission", { due: d(1), waitingFor: "Bank" }),
  task(byRef("Ihab Abdulla Jawad", "b-nbf"), "Chase bank response to submitted documents", { due: d(2), waitingFor: "Bank" }),
  task(byRef("Andrei Umnov", "b-cbd"), "Obtain LMF number — Santanu Sir following up", { due: d(0), waitingFor: "Bank" }),
  task(byRef("Zinah Alkatabi & Ihab Jawad", "b-arab"), "Provide HRA AED 150,000 credit proof in statement", { due: d(-1), priority: "HIGH", waitingFor: "Client" }),
  // files under explicit hold instruction — keep out of the "ready" bucket
  ...[
    byRef("Reneez Ahmed Kabeer", "b-adib", "Land plot"),
    byRef("Bhavesh & Prerna Magnani", "b-dib"),
    byRef("Ihab Abdulla Jawad", "b-mashreq", "80%"),
    byRef("Ihab Abdulla Jawad", "b-cbd", "80% Resale"),
    byRef("Ihab Abdulla Jawad", "b-enbd", "80% Resale"),
    byRef("Ihab Abdulla Jawad", "b-fab", "80% Resale"),
    byRef("Akram Shah", "b-cbd"),
  ].map((hz) => task(hz, "HOLD — await Sir Kiran's instruction before any bank follow-up", { due: d(5), priority: "LOW", waitingFor: "Sir Kiran", pendingReason: "On instruction — no follow-up", remarks: "Do not contact the bank until the hold is lifted." })),
];

/* ---------- bank queries recorded in the tracker ---------- */
const Q = (id: string, client: string, bank: string, deal: string | undefined, q: Omit<BankQuery, "id" | "caseId" | "ownerId" | "bankId">): BankQuery => {
  const cz = byRef(client, bank, deal);
  return { id, caseId: cz.id, ownerId: cz.ownerId, bankId: bank, ...q };
};
const queries: BankQuery[] = [
  Q("q101", "Walid Elrasoul", "b-dib", undefined, { ref: "BQ-101", requirement: "Query on file — response to be prepared by VRM", actionPoints: "Coordinate VRM response and revert to banker Nawzat", receivedAt: ts(-5), due: d(-1), status: "OPEN" }),
  Q("q102", "Akram Shah", "b-adib", undefined, { ref: "BQ-102", requirement: "Overdue facility flagged on customer profile", actionPoints: "Clarify overdue status with client; obtain clearance letter", receivedAt: ts(-6), due: d(-2), status: "OPEN" }),
  Q("q103", "Zinah Alkatabi & Ihab Jawad", "b-arab", undefined, { ref: "BQ-103", requirement: "HRA AED 150,000 — credit proof required in bank statement", actionPoints: "Collect statement evidence of HRA credit from client", receivedAt: ts(-1), due: d(-1), status: "OPEN" }),
  Q("q104", "Ihab Abdulla Jawad", "b-enbd", "80% Resale", { ref: "BQ-104", requirement: "Credit query — escalated to Sir Kiran for assist", actionPoints: "Hold per Sir's confirmation; do not follow up", receivedAt: ts(-4), due: d(3), status: "OPEN" }),
  Q("q105", "Ihab Abdulla Jawad", "b-fab", "80% Resale", { ref: "BQ-105", requirement: "Query received from bank", actionPoints: "Do not follow up from 17-Aug per Sir's instruction", receivedAt: ts(-3), due: d(4), status: "OPEN" }),
  Q("q106", "Sheree Anne Serilla Sumpay", "b-dib", undefined, { ref: "BQ-106", requirement: "ID card from deployed company", actionPoints: "Collect from client and submit to banker Abdul", receivedAt: ts(-5), due: d(-3), response: "ID card received from client and submitted to bank", evidence: "Submitted to banker Abdul", qc: "Verified by Vijya (SPO TL)", status: "RESPONDED" }),
  Q("q107", "Yaghoub Hassan Pour", "b-adib", undefined, { ref: "BQ-107", requirement: "Query on pre-approval file — Sir's reply pending", actionPoints: "Send Sir Kiran's reply to banker Ahmed", receivedAt: ts(-6), due: d(-2), status: "OPEN" }),
];

/* ---------- leads — files that converted during the tracker window ---------- */
let ln = 0;
const conv = (client: string, bank: string, deal: string | undefined, off: number): Lead => {
  ln += 1;
  const caze = byRef(client, bank, deal);
  return { id: "l" + (2000 + ln), ref: "L-" + (2000 + ln), personId: pid(client), source: deal ? "Existing Client" : "Bank Partner", type: caze.txType, status: "CONVERTED", owner: VRMS[ln % 6], bankId: bank, createdAt: d(off), notes: `Converted to ${caze.ref}` };
};
const leads: Lead[] = [
  conv("Andrei Umnov", "b-cbd", undefined, -6),
  conv("Saeed Shah", "b-dib", "Al Reef — Resale", -5),
  conv("Zinah Alkatabi & Ihab Jawad", "b-arab", undefined, -5),
  conv("Zinah Alkatabi & Ihab Jawad", "b-cbd", undefined, -4),
  conv("Hesham", "b-arab", undefined, -4),
  conv("Ihab Abdulla Jawad", "b-nbf", undefined, -5),
  conv("Karolina & Angie Abbas Issa", "b-dib", undefined, -20),
];

const eibor: AppState["eibor"] = Array.from({ length: 8 }, (_, i) => {
  const drift = (7 - i) * 0.008;
  return {
    date: d(i - 7),
    d1: +(4.15 + drift).toFixed(3), w1: +(4.28 + drift).toFixed(3), m1: +(4.37 + drift).toFixed(3),
    m3: +(4.46 + drift).toFixed(3), m6: +(4.53 + drift).toFixed(3), y1: +(4.59 + drift).toFixed(3),
    source: "Central Bank UAE", updatedBy: "hfmm-16",
  };
});

const calcs: AppState["calcs"] = [
  { id: "calc1", type: "emi", label: "EMI preview · Yaghoub Hassan Pour · CBD", linkKind: "case", linkId: byRef("Yaghoub Hassan Pour", "b-cbd").id, linkRef: byRef("Yaghoub Hassan Pour", "b-cbd").ref, inputs: { loan: 1174000, rate: 4.15, tenure: 300 }, outputs: { emi: 6291, totalPayments: 1887300 }, rulesUsed: [{ code: "TENURE-MAX", version: 1 }], by: byRef("Yaghoub Hassan Pour", "b-cbd").ownerId, at: ts(-2) },
  { id: "calc2", type: "buyout", label: "Buyout + Equity structure · Saeed Shah · Al Reef", linkKind: "case", linkId: byRef("Saeed Shah", "b-adib", "Al Reef — Buyout + Equity").id, linkRef: byRef("Saeed Shah", "b-adib", "Al Reef — Buyout + Equity").ref, inputs: { transaction: "Buyout + Equity", property: "Al Reef" }, outputs: { note: "Pre-approval received; valuation payment pending before structure finalised" }, rulesUsed: [{ code: "LTV-EXP-1", version: 2 }], by: byRef("Saeed Shah", "b-adib", "Al Reef — Buyout + Equity").ownerId, at: ts(-4) },
  { id: "calc3", type: "ltv", label: "LTV check · Karolina & Angie Abbas Issa · DIB", linkKind: "case", linkId: byRef("Karolina & Angie Abbas Issa", "b-dib").id, linkRef: byRef("Karolina & Angie Abbas Issa", "b-dib").ref, inputs: { propertyValue: 1650000, customerType: "EXPAT", financeCount: 1 }, outputs: { ltv: "80%", maxFinance: 1320000 }, rulesUsed: [{ code: "LTV-EXP-1", version: 2 }], by: byRef("Karolina & Angie Abbas Issa", "b-dib").ownerId, at: ts(-6) },
];

const audit: AppState["audit"] = [
  { id: "a1", at: ts(-0.1), by: "hfmm-00", module: "IMPORT", action: "Tracker imported", target: `${cases.length} case files from daily tracker`, detail: "Working days 13–20 Aug 2026" },
  { id: "a2", at: ts(-0.3), by: byRef("Parvez Ahmed", "b-dib").ownerId, module: "TRACKER", action: "Daily tracker updated", target: byRef("Parvez Ahmed", "b-dib").ref, detail: "Settlement appointment booked 24-Aug, 10:03 AM", caseId: byRef("Parvez Ahmed", "b-dib").id },
  { id: "a3", at: ts(-0.6), by: byRef("Karolina & Angie Abbas Issa", "b-dib").ownerId, module: "DOC", action: "Document received", target: `${byRef("Karolina & Angie Abbas Issa", "b-dib").ref} · FOL`, detail: "FOL received 17-Aug — signing 31-Aug, 10:30 AM", caseId: byRef("Karolina & Angie Abbas Issa", "b-dib").id },
  { id: "a4", at: ts(-1), by: byRef("Zinah Alkatabi & Ihab Jawad", "b-arab").ownerId, module: "QUERY", action: "Query received", target: "BQ-103 · Zinah Alkatabi & Ihab Jawad", detail: "Arab Bank: HRA AED 150,000 credit proof", caseId: byRef("Zinah Alkatabi & Ihab Jawad", "b-arab").id },
  { id: "a5", at: ts(-1.4), by: byRef("Parvez Ahmed", "b-adib").ownerId, module: "CASE", action: "Settlement completed", target: byRef("Parvez Ahmed", "b-adib").ref, detail: "Settlement completed 17-Aug at DIB", caseId: byRef("Parvez Ahmed", "b-adib").id },
  { id: "a6", at: ts(-2), by: byRef("Mohamed Hengazy I. Aboukhalil", "b-adib").ownerId, module: "CASE", action: "Deal booked", target: byRef("Mohamed Hengazy I. Aboukhalil", "b-adib").ref, detail: "Manager's cheque handed to Aldar 18-Aug", caseId: byRef("Mohamed Hengazy I. Aboukhalil", "b-adib").id },
  { id: "a7", at: ts(-3), by: "hfmm-15", module: "RULE", action: "Rule updated", target: "DBR-MAX v1 → v2 (55% → 50%)", detail: "DBR must stay strictly below 50% — TO VERIFY" },
  { id: "a8", at: ts(-4), by: "hfmm-11", module: "LEAD", action: "Lead converted", target: `L-2006 → ${byRef("Ihab Abdulla Jawad", "b-nbf").ref}` },
  { id: "a9", at: ts(-5), by: "hfmm-14", module: "CASE", action: "Case closed (won)", target: byRef("Silvia Torres", "b-enbd").ref, caseId: byRef("Silvia Torres", "b-enbd").id },
  { id: "a10", at: ts(-6), by: "hfmm-15", module: "RULE", action: "Rule updated", target: "LTV-EXP-1 v1 → v2 (85% → 80%)", detail: "Expat 1st finance tightened" },
  { id: "a11", at: ts(-7), by: "hfmm-16", module: "EIBOR", action: "EIBOR published", target: d(-1), detail: "3M fix updated from Central Bank UAE feed" },
];

/* ================================================================
   VRM PIPELINE REGISTER (dataset 2) — merged into cases & leads.
   Amounts are finance amounts; property value derived at 80% LTV.
   ================================================================ */
const TD_LAST = TRACKER_DATES[TRACKER_DATES.length - 1];
let ax = 0;

type Reg = { n: string; b: string; dl?: string; st?: string; loan?: number; opened?: number; vrm?: string; spo?: string; pa?: string; rename?: string; hold?: boolean; note?: string };
const REG: Reg[] = [
  { n: "Dharpan Randhawa", b: "b-adib", loan: 1328445, vrm: "hfmm-09", spo: "hfmm-03", rename: "Dharpan Randhawa & Mrs. Amanda", note: "Off-plan handover — waiting for the title deed." },
  { n: "Chandan Marianathan Rajah", b: "b-dib", loan: 3960000, vrm: "hfmm-07", spo: "hfmm-06", pa: "24 Jun 2026", note: "Resale — property not finalised." },
  { n: "Parvez Ahmed", b: "b-dib", loan: 1120000, vrm: "hfmm-09", spo: "hfmm-06", pa: "2 Aug 2026", note: "As per realtor, liability letter will be shared maximum by tomorrow." },
  { n: "Parvez Ahmed", b: "b-adib", loan: 920000, vrm: "hfmm-09", spo: "hfmm-03", pa: "13 Jul 2026", note: "Buyout + Equity — FOL signing done 10-Aug-2026." },
  { n: "Yash Pandya", b: "b-dib", vrm: "hfmm-07", spo: "hfmm-06", hold: true, note: "Case on hold — property not finalised." },
  { n: "Anna Larina", b: "b-rak", loan: 1128000, vrm: "hfmm-09", spo: "hfmm-05", note: "Loan settlement done — waiting for the title deed." },
  { n: "Ihab Abdulla Jawad", b: "b-cbd", dl: "80% Resale", loan: 3200000, vrm: "hfmm-09", spo: "hfmm-05", note: "Pre-approval in credit — LMF2807260657." },
  { n: "Ihab Abdulla Jawad", b: "b-cbd", dl: "419", loan: 1320000, vrm: "hfmm-09", spo: "hfmm-05" },
  { n: "Ihab Abdulla Jawad", b: "b-cbd", dl: "420", loan: 1320000, vrm: "hfmm-09", spo: "hfmm-05" },
  { n: "Ihab Abdulla Jawad", b: "b-enbd", dl: "80% Resale", loan: 3200000, vrm: "hfmm-09", spo: "hfmm-03", note: "Query received — replied by Kiran Sir." },
  { n: "Ihab Abdulla Jawad", b: "b-adib", loan: 3200000, vrm: "hfmm-09", spo: "hfmm-03", note: "Pre-approval received for 65%." },
  { n: "Ihab Abdulla Jawad", b: "b-fab", dl: "80% Resale", loan: 3200000, vrm: "hfmm-11", spo: "hfmm-03", note: "Follow-up mail sent for pre-approval." },
  { n: "Ihab Abdulla Jawad", b: "b-mashreq", dl: "80%", loan: 3200000, vrm: "hfmm-09", spo: "hfmm-05", note: "Follow-up mail sent for pre-approval." },
  { n: "Mohamed Hengazy", b: "b-adib", loan: 1200000, opened: -38, vrm: "hfmm-07", spo: "hfmm-03", pa: "13 Jul 2026", rename: "Mohammed Hegazy Ibrahim (Tariq Ref)", note: "Handover payment — account opening pending, will be done tomorrow." },
  { n: "Rona Nadeem", b: "b-adib", loan: 1072000, opened: -58, vrm: "hfmm-08", spo: "hfmm-03", note: "Resale handover — waiting for the seller's title deed." },
  { n: "Avinash Nagar", b: "b-adib", st: "BOOKING", loan: 2640000, opened: -57, vrm: "hfmm-07", spo: "hfmm-03", pa: "9 Jul 2026", note: "Buyout + Equity — settlement at CBD on 14-Aug-2026." },
  { n: "Avinash Nagar", b: "b-adib", st: "VALUATION", loan: 1200000, opened: -57, vrm: "hfmm-07", spo: "hfmm-03", pa: "7 Jul 2026", note: "New purchase — on hold: handover notice pending from developer." },
  { n: "Akram Shah", b: "b-adib", loan: 2800000, opened: -40, vrm: "hfmm-07", spo: "hfmm-06", hold: true, note: "Hold until AECB issue is resolved (31-Jul)." },
  { n: "Akram Shah", b: "b-cbd", loan: 2800000, opened: -40, vrm: "hfmm-07", spo: "hfmm-06", note: "Hold until AECB issue is resolved (31-Jul)." },
  { n: "Karolina & Angie", b: "b-dib", loan: 1320000, opened: -35, vrm: "hfmm-07", spo: "hfmm-06", pa: "10 Aug 2026" },
  { n: "Andrei Umnov", b: "b-cbd", loan: 1260000, opened: -29, vrm: "hfmm-08", spo: "hfmm-05", note: "File to be submitted to CBD via Prypco — awaiting documents & e-signatures." },
  { n: "Jumana Hytham Zin Aldin", b: "b-dib", st: "FOL", loan: 334920, opened: -22, vrm: "hfmm-07", spo: "hfmm-06", note: "Handover payment — valuation received by email; pre-approval in, FOL awaited." },
  { n: "Sheree Anne", b: "b-dib", loan: 1560000, opened: -14, vrm: "hfmm-08", spo: "hfmm-06", rename: "Sheree Anne Serilla Sumpay (Al Reef 3 Bed)", note: "Al Reef 3-bed — file submitted 12-Aug; conditional approval needed." },
  { n: "Saeed Shah", b: "b-adib", dl: "Al Reef", loan: 1200000, vrm: "hfmm-07", spo: "hfmm-03", pa: "16 Jul 2026", note: "Pre-approval received with conditions — valuation payment details shared; awaiting payment proof." },
  { n: "Saeed Shah", b: "b-adib", dl: "Water Edge", loan: 1200000, vrm: "hfmm-07", spo: "hfmm-03", note: "Submission done via SPO — waiting for Unit Verification Certificate; reminder sent 15-Jul." },
  { n: "Saeed Shah", b: "b-dib", loan: 2560000, vrm: "hfmm-07", spo: "hfmm-06", note: "Resale — file submitted on 19-Aug to bank." },
  { n: "Ricardo Laborda", b: "b-adib", loan: 2080000, opened: -40, vrm: "hfmm-09", spo: "hfmm-03", note: "Buyout + Equity — VR received; send to FOL conversion with SPO (7-Aug)." },
  { n: "Spencer Domingos", b: "b-dib", loan: 312000, opened: -42, vrm: "hfmm-08", spo: "hfmm-06", rename: "Spencer Domingos Guiao", pa: "9 Jul 2026" },
  { n: "Sangeeth Chemboth", b: "b-adib", loan: 810000, opened: -50, vrm: "hfmm-07", spo: "hfmm-03", note: "Pure buyout — counter offer received from DIB; waiting for client response." },
];

for (const r of REG) {
  const c = cases.find((cc) => {
    const p = persons.find((x) => x.id === cc.personId);
    if (!p || !p.name.toLowerCase().includes(r.n.toLowerCase())) return false;
    if (cc.bankId !== r.b) return false;
    if (r.st && cc.stage !== r.st) return false;
    if (r.dl !== undefined && !(cc.deal ?? "").toLowerCase().includes(r.dl.toLowerCase())) return false;
    return true;
  });
  if (!c) continue;
  if (r.loan) { c.loanAmount = r.loan; c.propertyValue = Math.round(r.loan / 0.8 / 1000) * 1000; }
  if (r.opened) c.createdAt = d(r.opened);
  if (r.spo) c.ownerId = r.spo;
  if (r.rename) { const p = persons.find((x) => x.id === c.personId); if (p) p.name = r.rename; }
  if (r.note && !(c.tracker ?? []).some((e) => e.date === TD_LAST)) c.tracker = [...(c.tracker ?? []), { date: TD_LAST, note: r.note }];
  if (r.pa) audit.push({ id: "ax" + ++ax, at: ts(-2), by: c.ownerId, module: "MILESTONE", action: "Pre-approval received", target: c.ref, detail: `${banks.find((b) => b.id === c.bankId)?.short} · ${r.pa}`, caseId: c.id });
  if (r.vrm && !leads.some((l) => l.personId === c.personId && l.bankId === c.bankId))
    leads.push({ id: "l" + (2000 + ++ln), ref: "L-" + (2000 + ln), personId: c.personId, source: "Existing Client", type: c.txType, status: "CONVERTED", owner: r.vrm, bankId: c.bankId, propertyValue: c.propertyValue || undefined, createdAt: c.createdAt, notes: `Converted to ${c.ref}` });
  if (r.hold && !tasks.some((t) => t.caseId === c.id && t.title.startsWith("HOLD")))
    tasks.push(task(c, "HOLD — await Sir Kiran's instruction before any follow-up", { due: d(5), priority: "LOW", waitingFor: "Sir Kiran", pendingReason: "On instruction — no follow-up" }));
}

/* ---- new people & files from the register ---- */
let xn = 0;
const NP = (name: string, o: Partial<Person> = {}): Person => {
  const p: Person = { id: "xp" + ++xn, name, customerType: "EXPAT", nationality: "—", employment: "SALARIED", dob: "1985-06-15", mobile: "", email: "", employer: "", monthlySalary: 0, otherIncome: 0, financeCount: 1, cards: [], liabilities: [], kyc: { passport: false, eid: false, visa: false, address: false }, createdAt: d(-20), ...o };
  persons.push(p); return p;
};
const getPerson = (name: string) => persons.find((x) => x.name.toLowerCase() === name.toLowerCase()) ?? persons.find((x) => x.name.toLowerCase().includes(name.toLowerCase())) ?? NP(name);

const NC = (client: string, bank: string, stage: string, o: { deal?: string; loan?: number; opened?: number; vrm?: string; spo?: string; tx?: TxType; note?: string; hold?: boolean; wf?: string; pr?: string; na?: string; naDue?: number } = {}) => {
  const p = getPerson(client);
  cn += 1;
  const loan = o.loan ?? 0;
  const idx = stages.findIndex((s) => s.id === stage);
  const c: Case = {
    id: "c" + (3000 + cn), ref: "HF-" + (3000 + cn), personId: p.id, ownerId: o.spo ?? "hfmm-01",
    bankId: bank, productId: products.find((pp) => pp.bankId === bank)!.id, txType: o.tx ?? "PURCHASE",
    propertyValue: loan ? Math.round(loan / 0.8 / 1000) * 1000 : 0, loanAmount: loan, rate: 0, tenureMonths: 300,
    stage, status: "OPEN", createdAt: d(o.opened ?? -7), expectedRevenue: 0,
    stageHistory: [{ stageId: stage, at: ts(o.opened ?? -7), by: o.spo ?? "hfmm-01" }],
    nextAction: o.na, nextActionDue: o.naDue !== undefined ? d(o.naDue) : undefined,
    waitingFor: o.wf, pendingReason: o.pr, deal: o.deal,
    docs: idx >= 3 ? mkDocs(idx) : [],
    tracker: o.note ? [{ date: TD_LAST, note: o.note }] : [],
  };
  cases.push(c);
  if (o.vrm) leads.push({ id: "l" + (2000 + ++ln), ref: "L-" + (2000 + ln), personId: p.id, source: "Existing Client", type: c.txType, status: "CONVERTED", owner: o.vrm, bankId: bank, propertyValue: c.propertyValue || undefined, createdAt: c.createdAt, notes: `Converted to ${c.ref}` });
  if (o.hold) tasks.push(task(c, "HOLD — await Sir Kiran's instruction before any follow-up", { due: d(5), priority: "LOW", waitingFor: "Sir Kiran", pendingReason: "On instruction — no follow-up" }));
  return c;
};

const NL = (client: string, o: { vrm?: string; opened?: number; note?: string; status?: LeadStatus; type?: TxType; pv?: number; na?: string; due?: number; src?: string } = {}) => {
  const p = getPerson(client);
  ln += 1;
  leads.push({ id: "l" + (2000 + ln), ref: "L-" + (2000 + ln), personId: p.id, source: o.src ?? "Referral", type: o.type ?? "PURCHASE", status: o.status ?? "CONTACTED", owner: o.vrm ?? "hfmm-12", bankId: undefined, propertyValue: o.pv, createdAt: d(o.opened ?? -7), nextAction: o.na, due: o.due !== undefined ? d(o.due) : undefined, notes: o.note });
};

/* Ihab — additional off-plan handover files */
NC("Ihab Abdulla Jawad", "b-enbd", "PREAPP", { deal: "Off-Plan Handover", loan: 4500000, opened: -14, vrm: "hfmm-09", spo: "hfmm-03", note: "Off-plan handover — query received, replied by Kiran Sir." });
NC("Ihab Abdulla Jawad", "b-adib", "PREAPP", { deal: "Off-Plan Handover", loan: 4500000, opened: -14, vrm: "hfmm-09", spo: "hfmm-03", hold: true, note: "Off-plan handover — hold the case for 50% per Sir's instruction." });
/* Avinash — DIB buyout + equity on hold */
NC("Avinash Nagar", "b-dib", "PREAPP", { deal: "Buyout + Equity", loan: 2640000, opened: -57, tx: "BUYOUT_EQUITY", vrm: "hfmm-07", spo: "hfmm-06", hold: true, note: "On hold as per Kiran Sir." });
/* Kashif Ghafoor — pure buyout at two banks; chase bank contact only */
NC("Kashif Ghafoor", "b-dib", "SUBMIT", { loan: 1400000, opened: -50, tx: "BUYOUT", vrm: "hfmm-08", spo: "hfmm-06", na: "Chase Amit — no client follow-up per Sir Kiran", naDue: 1, wf: "Bank", note: "Pure buyout — chase Amit; per Kiran Sir, no follow-up with the client." });
NC("Kashif Ghafoor", "b-adib", "SUBMIT", { loan: 1400000, opened: -50, tx: "BUYOUT", vrm: "hfmm-08", spo: "hfmm-03", na: "Chase Amit — no client follow-up per Sir Kiran", naDue: 1, wf: "Bank", note: "Pure buyout — chase Amit; per Kiran Sir, no follow-up with the client." });
/* Kiran Patil — resale, MOU pending */
NC("Kiran Patil", "b-adib", "VALUATION", { loan: 900200, opened: -50, vrm: "hfmm-09", spo: "hfmm-03", wf: "Client", pr: "Awaiting signatures", na: "Chase MOU signing — client still negotiating", naDue: 2, note: "Resale — waiting for MOU to be signed; client negotiating (31-Jul)." });
/* Hesham 20MM — six-bank buyout + equity mandate */
(["b-dib", "b-arab", "b-mashreq", "b-nbf", "b-cbd", "b-enbd"] as const).forEach((b) =>
  NC("Hesham (20MM — Omar Sherif Ref)", b, b === "b-arab" ? "PREAPP" : "SUBMIT", {
    deal: "20MM Buyout + Equity", loan: 12000000, opened: -43, tx: "BUYOUT_EQUITY", wf: "Client", pr: "Document missing",
    na: b === "b-arab" ? "Track credit review — documents sent to bank" : "Collect client details & documents", naDue: 2,
    note: b === "b-arab" ? "Buyout + Equity AED 12M — documents sent to the bank." : "Buyout + Equity AED 12M — waiting for client details & documents.",
  }));
/* Roshan Rohra — four banks, documents pending */
(["b-fab", "b-enbd", "b-cbd", "b-adib"] as const).forEach((b, i) =>
  NC("Roshan Rohra", b, "INTAKE", { opened: -16, vrm: "hfmm-09", spo: ["hfmm-01", "hfmm-02", "hfmm-03", "hfmm-04"][i], wf: "Client", pr: "Document missing", na: "Collect pending documents", naDue: 1, note: "Waiting for pending documents." }));
/* Yashwardhan Ganediwal — 60% LTV, four banks */
(["b-arab", "b-cbd", "b-rak", "b-adib"] as const).forEach((b, i) =>
  NC("Yashwardhan Ganediwal", b, "INTAKE", { opened: -2, vrm: "hfmm-07", spo: ["hfmm-01", "hfmm-02", "hfmm-03", "hfmm-04"][i], wf: "Client", pr: "Document missing", na: "Collect documents — 60% LTV applies", naDue: 3, note: "At 60% loan-to-value — low-document profile." }));

/* ---- early-stage pipeline → leads ---- */
NL("Akram Chalich", { vrm: "hfmm-09", opened: -10, note: "Omar Sherif reference. No update from the client on documents.", na: "Chase client documents", due: 2 });
NL("Dina Khalid", { vrm: "hfmm-11", opened: -10, status: "QUALIFIED", note: "Case study shared with Kiran Sir.", na: "Await Sir Kiran's review of case study", due: 3 });
NL("Zeynap Erdogan", { vrm: "hfmm-08", opened: -10, note: "ON HOLD — handover of property is late.", na: "Review hold — developer handover delayed", due: 7 });
NL("Shyam Veerabhadram", { vrm: "hfmm-09", opened: -57, status: "QUALIFIED", note: "Case study prepared & shared with Kiran Sir." });
NL("Mohammed Jarrar", { vrm: "hfmm-07", opened: -51, note: "Documents pending from the client's end.", na: "Collect pending documents", due: 2 });
NL("Deepika", { vrm: "hfmm-12", opened: -51, note: "Need to chase Kiran Sir for direction.", na: "Chase Sir Kiran for next steps", due: 1 });
NL("Eun Kyong Lee", { opened: -49, note: "ON HOLD — property finalised; handover in Sep 2027." });
NL("Aref Beyed", { src: "Existing Client", opened: -43, note: "No update from the client on documents.", na: "Follow up client for documents", due: 3 });
NL("Clara", { opened: -28, status: "PROPOSAL", pv: 3960000, note: "Proposal shared with the client for review (3-Aug).", na: "Follow up on proposal review", due: 1 });
NL("Jesus", { vrm: "hfmm-07", opened: -13, note: "Documents received on WhatsApp — waiting for working to be shared.", na: "Run affordability working & share", due: 1 });
NL("Dr. Kamran Ahmed", { vrm: "hfmm-17", opened: -3, note: "Documents received on WhatsApp — waiting for working to be shared.", na: "Run affordability working & share", due: 1 });
NL("Dr. Ali", { vrm: "hfmm-08", opened: -2, note: "New file — initial documents awaited.", na: "First contact & document list", due: 2 });
NL("Saffa", { vrm: "hfmm-09", opened: -2, note: "New file — initial documents awaited.", na: "First contact & document list", due: 2 });
NL("Ashish Mathur", { vrm: "hfmm-17", opened: -2, note: "Documents received on email — share the pending docs list.", na: "Share pending docs list", due: 1 });
NL("Ismail Shaikh", { vrm: "hfmm-07", opened: 0, type: "BUYOUT_EQUITY", status: "QUALIFIED", note: "Buyout + Equity — structuring.", na: "Prepare buyout working", due: 3 });

/* Sharafi (closed) — valuation refund instruction */
audit.push({ id: "ax" + ++ax, at: ts(-1), by: "hfmm-06", module: "MILESTONE", action: "Valuation refund instructed", target: byRef("Mr Sharafi", "b-dib").ref, detail: "Refund valuation amount per Sir Kiran's email (4-Aug)", caseId: byRef("Mr Sharafi", "b-dib").id });

/* ================================================================
   DINA KHALID SAEED ALALAMI — full TAT flagship file (Ops Guide Book)
   Salaried UAE National · Govt · AED 60,679 · liabilities 30,842 (DBR 50.8%)
   Current stage: FOL · Bank: DIB (Mr. Babar) · Ref DIB-2026-00123
   ================================================================ */
const dina = persons.find((p) => p.name.startsWith("Dina Khalid"))!;
Object.assign(dina, {
  dob: "1973-08-22", nationality: "UAE National", customerType: "NATIONAL", employment: "SALARIED",
  mobile: "+971 52 696 9845", email: "dina.alalami@gmail.com", employer: "Abu Dhabi School of Government",
  monthlySalary: 60679, otherIncome: 0, financeCount: 1,
  liabilities: [{ type: "Existing financing", monthly: 30842 }],
  kyc: { passport: true, eid: true, visa: true, address: true },
  preferredName: "Dina", gender: "Female", whatsapp: "+971 52 696 9845", countryOfBirth: "UAE",
  uaeResident: true, residencyStatus: "Citizen", visaType: "N/A",
  eidNumber: "784-1973-0613762-7", passportNo: "AA0076779", emirate: "Abu Dhabi",
  sector: "Government", yearsEmployed: 7, workLocation: "Abu Dhabi",
  creditScore: "Good", assignedTeam: "VRM2", assignedRm: "Adnan Mahmood",
  dateRegistered: d(-11), leadSource: "Referral",
} as Partial<Person>);
{
  const dibProd = products.find((p) => p.bankId === "b-dib")!;
  const stg = (id: string, at: number) => ({ stageId: id, at: ts(at), by: "hfmm-06" });
  const dinaCase: Case = {
    id: "c-dina", ref: "HF-" + (3000 + cases.length + 1), personId: dina.id, ownerId: "hfmm-06",
    bankId: "b-dib", productId: dibProd.id, txType: "BUYOUT", propertyValue: 0, loanAmount: 0,
    rate: 3.99, tenureMonths: 300, stage: "FOL", status: "OPEN",
    stageHistory: [stg("INTAKE", -11), stg("FILEQC", -10), stg("SUBMIT", -9), stg("PREAPP", -7), stg("VALUATION", -4), stg("FOL", -1)],
    triggerDates: { INTAKE: d(0), FILEQC: d(-10), SUBMIT: d(-9), PREAPP: d(-7), VALUATION: d(-4), FOL: d(-1) },
    conditionsDone: {
      "INTAKE:0": true, "INTAKE:1": true,
      "FILEQC:0": true, "FILEQC:1": true, "FILEQC:2": true,
      "SUBMIT:0": true, "SUBMIT:1": true, "SUBMIT:2": true, "SUBMIT:3": true, "SUBMIT:4": true,
      "PREAPP:0": true, "PREAPP:1": true, "PREAPP:2": true, "PREAPP:4": true, "PREAPP:5": true,
      "VALUATION:0": true, "VALUATION:1": true, "VALUATION:2": true, "VALUATION:3": true, "VALUATION:4": true, "VALUATION:5": true, "VALUATION:6": true,
      "FOL:0": true, "FOL:1": true,
    },
    nextAction: "FOL received — share with client for signing", nextActionDue: d(1), waitingFor: "Client",
    expectedCompletion: d(45), expectedRevenue: 0, createdAt: d(-11),
    bankApp: {
      officer: "Mr. Babar", officerEmail: "babar@dib.ae", appRef: "DIB-2026-00123", status: "Pre-Approval",
      statusDate: "2026-04-20", rate: 3.99, ltv: 75, valuationFee: 2500, offerExpiry: "2026-04-30", insuranceProvider: "DIB Takaful",
    },
    caseNotes: [
      { id: "cn-d1", at: ts(-4), by: "hfmm-11", text: "Case study shared with Kiran Sir. Pre-approval conditions satisfied during valuation stage; bank account opening confirmed with DIB." },
      { id: "cn-d2", at: ts(-1), by: "hfmm-06", text: "FOL submitted same day valuation report received. Security cheque book confirmed (10 leaves). Salary certificate re-issued addressed to DIB." },
    ],
    docs: [],
  };
  const DD = (typeId: string, status: DocStatus): DocItem => ({ id: "dd" + ++dn, typeId, stageId: "INTAKE", status, updatedAt: ts(-2), updatedBy: "hfmm-11" });
  /* workbook status: 11 of 16 received (69%) — R=received P=pending NA */
  dinaCase.docs = [
    DD("EID", "VERIFIED"), DD("PASSPORT", "VERIFIED"), DD("VISA", "VERIFIED"), DD("PHOTO", "RECEIVED"),
    DD("SALCERT", "MISSING"), DD("PAYSLIPS", "RECEIVED"), DD("BANKSTMT", "RECEIVED"), DD("LIABILITY", "MISSING"),
    DD("EMPCONTRACT", "RECEIVED"), DD("SPA", "RECEIVED"), DD("FORMF", "RECEIVED"), DD("NOCDEV", "MISSING"),
    DD("FLOORPLAN", "RECEIVED"), DD("TRADELIC", "NA"), DD("AUDITREP", "NA"), DD("LOANSTMT", "RECEIVED"), DD("POA", "NA"),
    { id: "dd" + ++dn, typeId: "FOL", stageId: "FOL", status: "RECEIVED", updatedAt: ts(-1), updatedBy: "hfmm-06" },
  ];
  /* Dina is past Pre-Approval (in FOL): pre-app + submission checklists nearly done, decision READY */
  const markDone = (items: ChecklistItem[], except: string[]) => items.map((it) => ({ ...it, done: !except.some((e) => it.label.includes(e)) }));
  dinaCase.preappQc = markDone(mkQc(PREAPP_QC), ["Payslip obtained", "File marked READY"]);
  dinaCase.submitQc = markDone(mkQc(SUBMIT_QC), ["Case tracked until Pre-Approval"]);
  dinaCase.preappDecision = "READY";
  cases.push(dinaCase);
  const dl = leads.find((l) => l.personId === dina.id);
  if (dl) { dl.status = "CONVERTED"; dl.bankId = "b-dib"; dl.notes = `Converted to ${dinaCase.ref}`; }
  tasks.push(
    { id: "t-dina1", caseId: dinaCase.id, stageId: "FOL", type: "FOL check", title: "Verify FOL terms against pre-approval (rate 3.99%, LTV 75)", ownerId: "hfmm-06", priority: "HIGH", due: d(0), status: "OPEN", createdAt: ts(-1), estimateMinutes: 240 },
    { id: "t-dina2", caseId: dinaCase.id, stageId: "FOL", type: "Client coordination", title: "Share FOL with Dina & obtain signed copy", ownerId: "hfmm-11", priority: "MEDIUM", due: d(2), status: "OPEN", createdAt: ts(-1), estimateMinutes: 1440, waitingFor: "Client" },
    { id: "t-dina3", caseId: dinaCase.id, stageId: "FOL", type: "Collect document", title: "Collect re-issued salary certificate (bank format)", ownerId: "hfmm-11", priority: "MEDIUM", due: d(1), status: "OPEN", createdAt: ts(-2), estimateMinutes: 2880, waitingFor: "Client" },
  );
  audit.unshift({ id: "a-dina", at: ts(-0.9), by: "hfmm-06", module: "TAT", action: "Trigger date set", target: dinaCase.ref, detail: `FOL stage started — target ${d(2)}`, caseId: dinaCase.id });
  audit.unshift({ id: "a-dina2", at: ts(-0.5), by: "hfmm-11", module: "LEAD", action: "Lead converted", target: `${dl?.ref ?? "L-DINA"} → ${dinaCase.ref}` });
}

/* task time estimates — expected time to complete (days/hours/minutes) */
([
  ["FOL signing 31-Aug", 480], ["Chase HSBC mortgage release", 2880], ["Collect valuation payment", 1440],
  ["Obtain title deed for final transfer", 4320], ["HOLD — await", 7200], ["Client visit to Aldar", 300],
] as [string, number][]).forEach(([frag, min]) => {
  const t = tasks.find((x) => x.title.includes(frag));
  if (t) t.estimateMinutes = min;
});

/* ---- handoff custody examples (single active owner) ---- */
const ho = (client: string, bank: string, deal: string | undefined, fromId: string, kind: Handoff["kind"], reason: string, daysAgo: number) => {
  const c = byRef(client, bank, deal);
  if (!c) return;
  (c.handoffs ??= []).push({ at: ts(-daysAgo), fromId, toId: c.ownerId, reason, kind });
};
/* VRM → SPO progression handoffs (custody chain) */
ho("Parvez Ahmed", "b-dib", undefined, "hfmm-09", "progression", "Advancing to FOL — SPO takes over bank follow-up", 6);
ho("Karolina & Angie Abbas Issa", "b-dib", undefined, "hfmm-07", "progression", "Valuation positive — handed to SPO for FOL conversion", 4);
ho("Spencer Domingos", "b-dib", undefined, "hfmm-08", "progression", "Pre-approval received — SPO to request FOL", 5);
/* recent handoff into Mayur's inbox (absence cover) */
{
  const c = cases.find((x) => x.status === "OPEN" && x.ownerId === "hfmm-06" && !x.handoffs?.length);
  if (c) { c.handoffs = [{ at: ts(-1), fromId: "hfmm-03", toId: "hfmm-06", reason: "Vijay on leave — please cover this file", kind: "absence" }]; }
}

export function buildSeed(): AppState {
  return {
    version: SEED_VERSION,
    session: null,
    users: [
      { ...SUPER_ADMIN },
      { id: "hfmm-15", empId: "hfmm-15", name: "Sir Kiran", email: "kiran@hfmc.ae", mobile: "+971 50 555 0015", role: "HEAD", team: "Management", active: true, createdAt: d(-400), note: "Head" },
      { id: "hfmm-14", empId: "hfmm-14", name: "Swathi Naverkar", email: "swathi@hfmc.ae", mobile: "+971 50 555 0014", role: "TL", team: "Sales & Ops", leaderId: "hfmm-15", active: true, createdAt: d(-350), note: "VRM & SPO Head" },
      { id: "hfmm-01", empId: "hfmm-01", name: "Vijya", email: "vijya@hfmc.ae", mobile: "+971 50 555 0001", role: "TL", team: "Ops Team (SPO)", leaderId: "hfmm-14", active: true, createdAt: d(-300), note: "SPO Team Leader" },
      { id: "hfmm-12", empId: "hfmm-12", name: "Sameer", email: "sameer@hfmc.ae", mobile: "+971 50 555 0012", role: "TL", team: "Sales Team (VRM)", leaderId: "hfmm-14", active: true, createdAt: d(-300), note: "VRM Team Leader" },
      { id: "hfmm-02", empId: "hfmm-02", name: "Vaibhavi", email: "vaibhavi@hfmc.ae", mobile: "+971 50 555 0002", role: "SPO", team: "Ops Team (SPO)", leaderId: "hfmm-01", active: true, createdAt: d(-260) },
      { id: "hfmm-03", empId: "hfmm-03", name: "Vijay", email: "vijay@hfmc.ae", mobile: "+971 50 555 0003", role: "SPO", team: "Ops Team (SPO)", leaderId: "hfmm-01", active: true, createdAt: d(-260) },
      { id: "hfmm-04", empId: "hfmm-04", name: "Chetan", email: "chetan@hfmc.ae", mobile: "+971 50 555 0004", role: "SPO", team: "Ops Team (SPO)", leaderId: "hfmm-01", active: true, createdAt: d(-260) },
      { id: "hfmm-05", empId: "hfmm-05", name: "Rohan", email: "rohan@hfmc.ae", mobile: "+971 50 555 0005", role: "SPO", team: "Ops Team (SPO)", leaderId: "hfmm-01", active: true, createdAt: d(-260) },
      { id: "hfmm-06", empId: "hfmm-06", name: "Mayur", email: "mayur@hfmc.ae", mobile: "+971 50 555 0006", role: "SPO", team: "Ops Team (SPO)", leaderId: "hfmm-01", active: true, createdAt: d(-260) },
      { id: "hfmm-07", empId: "hfmm-07", name: "Gaurav", email: "gaurav@hfmc.ae", mobile: "+971 50 555 0007", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-08", empId: "hfmm-08", name: "Ani", email: "ani@hfmc.ae", mobile: "+971 50 555 0008", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-09", empId: "hfmm-09", name: "Edwin", email: "edwin@hfmc.ae", mobile: "+971 50 555 0009", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-10", empId: "hfmm-10", name: "Omprakash", email: "omprakash@hfmc.ae", mobile: "+971 50 555 0010", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-11", empId: "hfmm-11", name: "Sona", email: "sona@hfmc.ae", mobile: "+971 50 555 0011", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-13", empId: "hfmm-13", name: "Sneha", email: "sneha@hfmc.ae", mobile: "+971 50 555 0013", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-240) },
      { id: "hfmm-16", empId: "hfmm-16", name: "Binish", email: "binish@hfmc.ae", mobile: "+971 50 555 0016", role: "PA", team: "Management", leaderId: "hfmm-15", active: true, createdAt: d(-200), note: "PA to Sir Kiran" },
      { id: "hfmm-17", empId: "hfmm-17", name: "Omkar", email: "", mobile: "", role: "VRM", team: "Sales Team (VRM)", leaderId: "hfmm-12", active: true, createdAt: d(-30), note: "New joiner — designation to be confirmed" },
      { id: "hfmm-18", empId: "hfmm-18", name: "Extra 2", email: "", mobile: "", role: "TBD", team: "—", active: false, createdAt: d(-1), note: "Designation to be provided — new designation may follow" },
    ],
    persons, leads, banks, products, stages, bankMatrix, templates,
    docTypes: [
      { id: "PASSPORT", name: "Passport" }, { id: "EID", name: "Emirates ID" }, { id: "VISA", name: "Residence Visa" },
      { id: "GOLDENVISA", name: "Golden Visa — Labour Card / Contract" }, { id: "SELFATT", name: "Self-Attested KYC (ADIB)" },
      { id: "SALCERT", name: "Salary Certificate" }, { id: "BANKSTMT", name: "Bank Statements (salary account)" },
      { id: "SERVICELETTER", name: "Service Letter (new company / probation)" }, { id: "WORKSHEET", name: "Working Sheet (bank-specific)" },
      { id: "LIABILITY", name: "Liability Letter" }, { id: "CARDSTMT", name: "Card Statements" },
      { id: "APPFORM", name: "Bank Application Form" }, { id: "VALREP", name: "Valuation Report" },
      { id: "FOL", name: "Final Offer Letter" }, { id: "DDA", name: "DDA & Security Cheques" },
      { id: "NOC", name: "Mortgage Release NOC" }, { id: "TITLE", name: "Transfer Receipt" },
      { id: "NEWTITLE", name: "New Title Deed" },
      { id: "PHOTO", name: "Recent Photograph" }, { id: "PAYSLIPS", name: "Salary Slips (3M)" },
      { id: "EMPCONTRACT", name: "Employment Contract" }, { id: "SPA", name: "Title Deed / SPA" },
      { id: "FORMF", name: "Form F / MOU" }, { id: "NOCDEV", name: "Developer NOC" },
      { id: "FLOORPLAN", name: "Floor Plan" }, { id: "TRADELIC", name: "Trade Licence (self-employed)" },
      { id: "AUDITREP", name: "Audit Report (self-employed)" }, { id: "LOANSTMT", name: "Existing Loan Statement" },
      { id: "POA", name: "Power of Attorney" },
      { id: "SELLERKYC", name: "Seller KYC" }, { id: "PAYMENTPROOF", name: "Payment Proof" },
      { id: "OQOOD", name: "Oqood / Initial Title Deed (Dubai)" }, { id: "SOA", name: "Developer SOA (Primary)" },
      { id: "BCC", name: "BCC / Handover Notice" }, { id: "HUSPYFORM", name: "Huspy Form" },
      { id: "PALETTER", name: "Pre-Approval Letter" }, { id: "VALPAYPROOF", name: "Valuation Payment Proof" },
      { id: "CLIENTCONF", name: "Client Confirmation (FOL terms)" }, { id: "RELEASELETTER", name: "Mortgage Release Letter" },
      { id: "MANCHEQUE", name: "Manager's Cheque (details + bank copies)" }, { id: "TDQC", name: "Title Deed QC Email" },
    ],
    taskTypes: ["Follow up with bank", "Collect documents from client", "Respond to bank query", "Schedule appointment", "Verify original documents", "Update client"],
    waitingTypes: ["Bank", "Client", "Sir Kiran", "VRM", "Seller", "Realtor", "Valuer", "Employer", "Developer", "Trustee Office", "Insurance", "Team Leader"],
    pendingReasons: ["Document missing", "Awaiting bank response", "Client not reachable", "Property not finalized", "Valuation payment pending", "Awaiting mortgage release letter", "On instruction — no follow-up", "Pre-approval fee objection", "Awaiting seller documents", "Employer verification pending", "Terms under negotiation", "Awaiting signatures"],
    leadSources: ["Referral", "Property Portal", "Walk-in", "Bank Partner", "Developer", "Social Media", "Existing Client"],
    cases, tasks, queries, rules, eibor, calcs, audit,
    trackerDates: TRACKER_DATES,
  };
}
