/* =====================================================================
   HFMC Mortgage Operations Guide Book — structured content.
   Data-driven so Batches 4–8 can be added by appending chapters.
   Every batch lands twice: here (reference) and in the execution layer
   (stage conditions, File QC checklists, rules, bank matrix).
   ===================================================================== */

export type GBlock =
  | { t: "p"; x: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "callout"; kind: "control" | "source" | "rule" | "security" | "important"; title: string; x: string }
  | { t: "steps"; items: string[] }
  | { t: "checklist"; items: string[] }
  | { t: "cards"; items: { t: string; d: string }[] }
  | { t: "flow"; items: string[] };

export interface GChapter { num: string; title: string; blocks: GBlock[] }
export interface GBatch { n: number; title: string; status: "current" | "planned"; chapters: GChapter[] }

const b1: GBatch = {
  n: 1, title: "Foundation, lifecycle & transaction types", status: "current",
  chapters: [
    { num: "1", title: "How to Use This Guide", blocks: [
      { t: "p", x: "A practical operating manual converting training material, checklists and working instructions into a consistent reference for the Virtual RM, Pre-Approval, Valuation, FOL, Loan Booking and Final Transfer teams." },
      { t: "checklist", items: ["Explain the complete case journey from file receipt to closure", "Define each stage's purpose and key handover points", "Separate general controls from transaction-specific requirements", "Provide common terminology for later chapters and bank SOPs", "Reduce dependency on informal or memory-based instructions"] },
      { t: "callout", kind: "rule", title: "Consistency rule", x: "All later batches use the same chapter hierarchy, terminology, callout style, table structure and control language established in Batch 1." },
    ]},
    { num: "2", title: "Operating Principles", blocks: [
      { t: "cards", items: [
        { t: "2.1 · One case, one controlled journey", d: "At every stage the owner knows what is received, verified, outstanding, who owns the next action, and what must be satisfied to move forward." },
        { t: "2.2 · Verification before submission", d: "Never forward an incomplete package. Verify client info against KYC and forms; verify transaction info against property documents; resolve discrepancies first." },
        { t: "2.3 · Transaction type drives the document set", d: "Identify Primary / Resale / Buyout / Buyout+Equity / Equity before preparing the final document checklist." },
        { t: "2.4 · Stage handover is a control point", d: "Move forward only after required handover items are available and checked. A handover is a transfer of evidence, not just an email." },
      ]},
    ]},
    { num: "3", title: "Operating Model", blocks: [
      { t: "table", head: ["Role / Stage", "Primary operational purpose"], rows: [
        ["Virtual RM 1", "Receives/organizes the client file; prepares the documentation package for Pre-Approval/bank submission."],
        ["Pre-Approval Team", "Checks the file, submits to bank or Huspy, follows up for Pre-Approval, manages bank queries with the VRM."],
        ["Virtual RM 2", "Supports downstream stages: query resolution, client communication, stage-specific coordination."],
        ["SPO – Valuation", "Coordinates bank-side valuation, inspection scheduling, valuation report receipt/check."],
        ["SPO – FOL", "Requests and checks FOL, coordinates bank follow-up, supports signing/loan-booking readiness."],
        ["SPO – Final Transfer", "Coordinates transfer readiness, charges, documents, appointment, transfer day and Title Deed QC."],
        ["Bank RM / Banker", "Bank-side instructions, booking, valuation/FOL/loan-booking actions and transfer coordination."],
        ["Huspy Contact", "Receives cases submitted through Huspy; confirms review/submission to the bank."],
      ]},
      { t: "callout", kind: "control", title: "Ownership principle", x: "The person responsible for the current stage owns the follow-up until the stage's handover condition is satisfied." },
    ]},
    { num: "4", title: "Complete Mortgage Lifecycle", blocks: [
      { t: "flow", items: ["File Received", "VRM 1 — File Preparation", "Pre-Approval Check & Submission", "Bank / Huspy Follow-up", "Pre-Approval", "Valuation & Inspection", "FOL Conversion & Check", "FOL Signing / DDA", "Loan Booking", "Liability Settlement / Clearance (if applicable)", "Final Transfer", "Title Deed + QC", "Case Closure"] },
    ]},
    { num: "5", title: "Stage Ownership & Handover Logic", blocks: [
      { t: "table", head: ["From", "To", "Minimum handover evidence"], rows: [
        ["Virtual RM 1", "Pre-Approval", "KYC, income docs, bank statement, payslip/service letter, bank forms and transaction documents ready for review."],
        ["Pre-Approval", "Valuation", "Checked Pre-Approval Letter and property documents available."],
        ["Valuation", "FOL", "Positive valuation report and valuation-stage handover shared."],
        ["FOL", "Final Transfer", "Correct FOL checked, signing completed, DDA confirmation and applicable release/loan-booking condition satisfied."],
        ["Final Transfer", "Completed", "Transfer completed, Title Deed received and Title Deed QC email sent."],
      ]},
      { t: "cards", items: [
        { t: "RECEIVED", d: "Document/confirmation is physically or electronically available." },
        { t: "VERIFIED", d: "The responsible person has checked the relevant information." },
        { t: "PENDING", d: "Required action or evidence is still outstanding." },
        { t: "ISSUE", d: "A discrepancy or blocker prevents normal progression." },
        { t: "READY", d: "All defined controls for the next stage have been satisfied." },
        { t: "HANDOVER", d: "Required evidence plus ownership/action info transferred to the next team." },
      ]},
    ]},
    { num: "6", title: "Transaction Types", blocks: [
      { t: "table", head: ["Type", "Core property / transaction documents"], rows: [
        ["Primary / Developer", "SPA (all pages); Title/Registration Deed if available; Oqood/Initial TD (Dubai); Floor Plan; Payment Proof; SOA; BCC/Handover Notice where applicable."],
        ["Resale / Secondary", "Title/Registration Deed; Oqood/Initial TD where required; Floor Plan; Seller KYC; MOU (AD) / Form F (DXB); Payment Proof; Seller Trade License if company."],
        ["Buyout", "Title/Oqood; Floor Plan; Payment Proof; Previous Bank FOL; later Liability/Release/Clearance documents."],
        ["Buyout + Equity", "Buyout documents plus existing liability, new FOL and mortgage release/equity-disbursement controls."],
        ["Pure Equity / Refinance", "Original Title Deed; FOL; equity disbursement documents, subject to bank process."],
      ]},
      { t: "callout", kind: "source", title: "Source control", x: "Exact classification and document sets follow the selected bank's current product/process. The guide preserves supplied internal terminology." },
    ]},
    { num: "7", title: "Document Framework & Definitions", blocks: [
      { t: "table", head: ["Term", "Source-derived meaning"], rows: [
        ["MOU / Form F", "MOU for Abu Dhabi; Form F is the electronic Dubai form with property, seller, buyer, commission and service-charge details."],
        ["Valuation Certificate", "Bank valuation of current market value, performed by the bank's valuators."],
        ["POA", "Lets a representative act for an absent buyer/seller at final transfer; must follow UAE requirements."],
        ["Liability Letter", "Letter from the seller's mortgage bank stating the loan outstanding amount."],
        ["SOA", "Developer account statement for a primary transaction showing amounts paid and pending."],
        ["Title Deed", "Land-department document with property details and, where applicable, mortgage information."],
        ["NOC", "Developer No Objection Certificate confirming no objection to the purchase/transfer."],
        ["Verification / Search Certificate", "Establishes whether a property is mortgaged; used by banks/financial institutions."],
      ]},
    ]},
    { num: "8", title: "Critical Control Points", blocks: [
      { t: "cards", items: [
        { t: "A · Identify the transaction first", d: "Confirm the structure and use the transaction-specific framework before submission. A new-build may not yet have a Title Deed." },
        { t: "B · Keep the case stage-ready", d: "Received ≠ stage-ready. Documents must be checked and the next-stage handover condition satisfied." },
        { t: "C · Preserve bank-specific requirements", d: "Follow bank-specific document sets and submission methods (ADIB handling, RAK routing, Huspy submission)." },
        { t: "D · Separate source-derived from current", d: "Dated items (FOL validity, MOU extension, liability validity, IDs, NOC, POA) are source-derived until confirmed against current instruction." },
      ]},
    ]},
    { num: "9", title: "Batch 1 Quick Reference", blocks: [
      { t: "table", head: ["Question", "Answer / Control"], rows: [
        ["Overall journey?", "File Intake → Pre-Approval → Valuation → FOL → Signing/DDA → Loan Booking → Liability/Clearance → Final Transfer → Title Deed/QC → Closure."],
        ["What determines the property package?", "Transaction type plus bank/government requirements."],
        ["Pre-Approval → Valuation?", "After the Pre-Approval Letter is checked and property documents are available."],
        ["Valuation → FOL?", "After a positive valuation report and valuation handover."],
        ["Toward Final Transfer?", "After FOL controls: correct FOL, signing, DDA and applicable release/booking conditions."],
        ["Final completion evidence?", "Transfer completed, Title Deed received and Title Deed QC email sent."],
      ]},
    ]},
  ],
};

export const BATCHES: GBatch[] = [
  b1,
  { n: 2, title: "Virtual RM, document collection & detailed Pre-Approval", status: "current", chapters: [
    { num: "10", title: "Virtual RM — File Intake & Handover", blocks: [
      { t: "p", x: "The Virtual RM is the first operational control point. All documents received from the client are forwarded to the Sales Progression Team, and the complete set must be available before submission." },
      { t: "steps", items: ["Receive all documents and information provided by the client", "Identify the transaction type before finalizing the document checklist", "Organize documents into logical groups (KYC, Income, Employment, Statements, Bank Forms, Transaction/Property)", "Check obvious completeness and legibility before handing to Pre-Approval", "Forward the complete received package to Sales Progression / Pre-Approval", "Record missing items or clarification points — never assume an incomplete item is acceptable"] },
      { t: "callout", kind: "control", title: "Handover is evidence, not an email", x: "The package must identify what was received, what is missing, and what Pre-Approval needs to verify." },
      { t: "table", head: ["Folder / Section", "Recommended contents"], rows: [
        ["01 – KYC", "Passport, EID, Visa, Golden Visa supporting document, self-attestation where applicable"],
        ["02 – Income", "Salary Certificate, payslips where required, Service Letter where applicable"],
        ["03 – Bank Statements", "Salary-account statement(s), required period, supporting clarifications"],
        ["04 – Bank Forms", "Application form and all bank-specific forms"],
        ["05 – Transaction", "MOU/Form F, SPA, Title/Registration Deed, Oqood, Floor Plan, Payment Proof"],
        ["06 – Buyout", "Previous FOL, liability/release documents, existing-bank documents"],
        ["07 – Internal / Submission", "Working sheet, Huspy form, submission email and operational evidence"],
      ]},
    ]},
    { num: "11", title: "Pre-Approval Document Collection", blocks: [
      { t: "table", head: ["Category", "Core document / check", "Required"], rows: [
        ["KYC", "Emirates ID / Passport / Visa", "Yes / Resident-applicable"],
        ["KYC", "Golden Visa — Labour Card / Contract", "If Golden Visa"],
        ["KYC", "Self-attestation / bank format", "Bank dependent (ADIB self-attested)"],
        ["Income", "Salary Certificate · Bank Statement · Salary Credit", "Yes"],
        ["Income", "Payslip", "If salary variance / required by bank"],
        ["Employment", "Service Letter", "New company + probation"],
        ["Bank Forms", "Bank Application Forms", "Yes"],
        ["Statement Review", "Cash transactions reviewed", "Yes"],
        ["Eligibility", "Client eligibility / liabilities", "Yes"],
        ["Transaction", "Title Deed / Previous FOL / Property documents", "Per transaction"],
      ]},
      { t: "callout", kind: "important", title: "Do not submit", x: "If a required document is missing, expired, inconsistent, unsigned, incomplete or unclear — stop the submission and record the exact issue and required action." },
    ]},
    { num: "12", title: "Detailed KYC Verification", blocks: [
      { t: "table", head: ["EID check", "What to verify", "If issue found"], rows: [
        ["Validity / expiry", "Document is valid and not expired", "Request valid/updated EID"],
        ["Customer name", "Matches passport, salary certificate, application", "Clarify mismatch before submission"],
        ["Signature", "Where applicable and required", "Obtain corrected version"],
        ["Nationality", "Consistent with KYC and application", "Clarify mismatch"],
        ["Occupation", "Consistent with employment info", "Clarify if inconsistent"],
        ["Employer", "Consistent with Salary Certificate", "Clarify if inconsistent"],
      ]},
      { t: "checklist", items: ["Passport: validity, name, nationality, signature; cross-check with EID, Visa and application", "Visa: validity, name, residency; consistent with client's residency status", "Golden Visa: apply the additional labour-card / labour-contract requirement"] },
      { t: "callout", kind: "source", title: "ADIB control", x: "ADIB KYC documents should be self-attested. The exact accepted format can change — confirm the current bank instruction before submission." },
    ]},
    { num: "13", title: "Salary Certificate Verification", blocks: [
      { t: "table", head: ["Check", "Detailed control"], rows: [
        ["Client name", "Must match KYC and bank/application details"],
        ["Salary", "Record stated monthly salary for comparison with bank salary credits"],
        ["Joining date", "Check completeness; use for employment/eligibility review"],
        ["Authorized signatory", "Signed by the appropriate authorized person where required"],
        ["Validity", "Check issue date / validity per bank/process"],
        ["Company stamp", "Confirm stamp present where required"],
        ["PO Box · Address · Company name", "Complete and consistent with company information"],
        ["Designation / occupation", "Consistent with employment information"],
      ]},
      { t: "steps", items: ["Identify the exact mismatch between Salary Certificate and bank salary credit", "Do not assume the bank will accept the variance", "Request payslip or supporting document where required", "Check the payslip amount against the bank credit", "Check company name on payslip against the Salary Certificate", "Record the clarification/action in the checklist"] },
    ]},
    { num: "14", title: "Bank Statement & Salary Credit Verification", blocks: [
      { t: "table", head: ["Statement period", "Control"], rows: [
        ["Default operational check", "Use the bank-specific required statement period"],
        ["General source instruction", "6 months is the general requirement"],
        ["ADIB source instruction", "3 months — confirm current requirement before submission"],
        ["Other banks", "Use the Bank Pre-Approval Matrix / current bank instruction"],
      ]},
      { t: "checklist", items: ["Statement belongs to the client's salary account", "Salary credits appear in the required period", "Credited salary compared with the Salary Certificate", "Salary credited regularly and per case information", "Variance → obtain required payslip/supporting explanation"] },
      { t: "table", head: ["Observation", "Required action"], rows: [
        ["Normal salary credit", "Continue verification"],
        ["Salary amount differs", "Obtain payslip / clarification"],
        ["Large cash credits/debits", "Request client clarification and supporting evidence"],
        ["Unusual transaction pattern", "Record issue and obtain clarification before submission"],
        ["Missing salary credit", "Do not treat as salary-verified; investigate first"],
      ]},
    ]},
    { num: "15", title: "Payslip & Salary Variance", blocks: [
      { t: "p", x: "Payslips are not automatically required. They are required when there is a salary variance or where the bank/process requires them." },
      { t: "table", head: ["Payslip check", "What to verify"], rows: [
        ["Salary amount", "Matches the relevant bank salary credit / explained variance"],
        ["Company name", "Matches Salary Certificate / employer"],
        ["Client name", "Matches KYC and case"],
        ["Pay period", "Correct month/period for the variance being explained"],
        ["Document completeness", "No missing pages / critical information"],
      ]},
    ]},
    { num: "16", title: "Service Letter / Employment Checks", blocks: [
      { t: "p", x: "A Service Letter is used where the customer has joined a new company and is on probation." },
      { t: "checklist", items: ["Previous company name and location correct", "Relevant salary information present", "Previous service / tenure details", "Consistency with current Salary Certificate and KYC"] },
      { t: "callout", kind: "control", title: "Not a substitute", x: "Do not use a Service Letter as a substitute for another mandatory document unless the relevant bank/process specifically allows it." },
    ]},
    { num: "17", title: "Bank Application Forms", blocks: [
      { t: "checklist", items: ["Correct bank form and product/transaction type selected", "Client name and details match KYC and supporting documents", "Loan amount and property/transaction details correct", "All mandatory fields completed; no unexplained blanks", "Required signatures/e-signatures and dates present", "Supporting declarations/consents included where applicable"] },
      { t: "callout", kind: "source", title: "Bank form sets are reference only", x: "Each bank has its own form set (CBD, DIB, NBF, ADCB, HSBC, ADIB, Arab Bank, RAK, Mashreq). Reproduced from the training deck — always use the current bank form set before live submission." },
    ]},
    { num: "18", title: "Transaction & Property Document Checks", blocks: [
      { t: "table", head: ["Transaction", "Checks"], rows: [
        ["Primary / Developer", "SPA all pages; Title Deed if issued; Oqood (Dubai); Floor Plan; Payment Proof; SOA; BCC/Handover Notice"],
        ["Resale / Secondary", "Title Deed (AD); Oqood (Dubai); Floor Plan; Seller KYC; MOU (AD) / Form F (DXB); Payment Proof; Trade License if company seller"],
        ["Buyout / Buyout + Equity", "Title/Oqood; Floor Plan; Payment Proof; Previous bank FOL; existing liability docs; later-stage release/clearance"],
      ]},
      { t: "callout", kind: "control", title: "New-build control", x: "A newly built property may not have a Title Deed yet. Do not mark the file incomplete solely for a missing Title Deed where the applicable alternative property document is available." },
    ]},
    { num: "19", title: "Eligibility & File-Level QC", blocks: [
      { t: "table", head: ["QC area", "Question before submission"], rows: [
        ["Identity", "Do KYC documents identify the same customer across all documents?"],
        ["Employment", "Does employer/designation/joining info align across KYC, Salary Certificate, Service Letter, payslip?"],
        ["Income", "Does stated salary match salary credits, or is the variance properly supported?"],
        ["Banking", "Correct statement period? Is it the salary account?"],
        ["Transactions", "Are unusual cash transactions explained where required?"],
        ["Liabilities", "Are known liabilities captured with relevant documents?"],
        ["Transaction type", "Is the correct Primary/Resale/Buyout/Equity structure selected?"],
        ["Property", "Are the applicable property documents available and consistent?"],
        ["Forms", "Are the correct bank forms completed and signed?"],
        ["Submission route", "Direct / Huspy / other channel correctly chosen?"],
        ["Bank-specific", "Are bank-specific KYC, statement, forms and submission requirements satisfied?"],
      ]},
    ]},
    { num: "20", title: "Pre-Submission Decision", blocks: [
      { t: "table", head: ["Decision", "Meaning", "Action"], rows: [
        ["READY", "All required checks completed; no unresolved issue", "Proceed to bank/Huspy submission"],
        ["READY — WITH BANK CONFIRMATION", "A source requirement is bank-specific or ambiguous", "Confirm with bank/RM before submission"],
        ["PENDING DOCUMENT", "Required document not received", "Request document; do not submit until resolved"],
        ["PENDING CLARIFICATION", "Document received but information needs explanation", "Obtain clarification/supporting document"],
        ["REJECT / RETURN TO VRM", "File is incomplete or materially inconsistent", "Return to VRM with exact corrections required"],
      ]},
      { t: "callout", kind: "control", title: "Core decision rule", x: "If everything is in order the file is submitted; if incomplete it is sent back to Virtual RM 1 for corrections." },
    ]},
    { num: "21", title: "Pre-Approval Master Checklist", blocks: [
      { t: "p", x: "The live case checklist in Case 360 → File QC tab mirrors this master checklist. Use it as the narrative control before submission." },
      { t: "table", head: ["Minimum case note field", "Example format"], rows: [
        ["Transaction", "Resale / Buyout / Primary / Buyout + Equity"],
        ["Bank", "Selected bank"],
        ["Income status", "Salary verified / variance supported"],
        ["Statement", "Required period received and reviewed"],
        ["KYC", "Complete / bank-specific attestation confirmed"],
        ["Property docs", "Applicable transaction package complete"],
        ["Forms", "Complete and signed"],
        ["Open issues", "None / list exact issue"],
        ["Submission status", "READY / RETURN TO VRM"],
      ]},
    ]},
    { num: "22", title: "Batch 2 Quick Reference", blocks: [
      { t: "table", head: ["Question", "Control"], rows: [
        ["Who receives the file first?", "Virtual RM / file intake process."],
        ["First major decision?", "Confirm transaction type and required document set."],
        ["Core Pre-Approval categories?", "KYC, Income, Employment, Bank Forms, Statement Review, Eligibility, Transaction."],
        ["When is a payslip required?", "When salary variance exists or the bank/process requires it."],
        ["Significant cash transactions?", "Obtain client clarification/supporting information as required."],
        ["File incomplete?", "Return to Virtual RM with exact missing/correction items."],
        ["Bank requirement unclear?", "Confirm with the current bank instruction/RM before submission."],
      ]},
    ]},
  ]},
  { n: 3, title: "Bank submission & Huspy salaried SOP", status: "current", chapters: [
    { num: "23", title: "Bank Submission — Operating Standard", blocks: [
      { t: "table", head: ["Gate", "Control"], rows: [
        ["1 · File readiness", "Pre-Approval checklist completed and file marked READY"],
        ["2 · Bank selected", "Correct bank and applicable product/transaction route confirmed"],
        ["3 · Forms", "Current bank forms completed and signed"],
        ["4 · Documents", "KYC, income, statement, property/transaction and supporting documents attached"],
        ["5 · Bank-specific", "Special KYC, statement period, working sheet, email format or routing checked"],
        ["6 · Submission evidence", "Email sent / portal submission completed and evidence retained"],
        ["7 · Receipt confirmation", "Bank/channel confirms receipt"],
        ["8 · Follow-up", "Status tracked until Pre-Approval is received or a formal query is raised"],
      ]},
      { t: "callout", kind: "rule", title: "Core rule", x: "An email or portal upload is not the end of the process. Submission is complete only when transmitted, receipt is confirmed where applicable, and follow-up ownership is recorded." },
    ]},
    { num: "24", title: "Bank-Specific Submission Controls", blocks: [
      { t: "table", head: ["Bank / Route", "Specific operational point"], rows: [
        ["ADIB", "KYC self-attested; working Excel sheet attached. VRM instruction: 3-month statement."],
        ["RAK", "Keep to mortgagereferrals and CC Burhan for submission routing."],
        ["Mashreq", "Some cases submitted through Huspy."],
        ["FAB", "Some cases submitted through Huspy."],
        ["ADCB", "Some cases submitted through Huspy."],
        ["Other banks", "Use the applicable current bank form set, statement requirement, email format and route."],
      ]},
      { t: "callout", kind: "source", title: "Source control", x: "Requirements change. This preserves the operational instruction but does not replace the current bank matrix or bank/RM confirmation. The live Bank Matrix lives in the Rule Centre." },
    ]},
    { num: "25", title: "Direct Bank Submission Workflow", blocks: [
      { t: "steps", items: ["Confirm the final bank and transaction type", "Confirm all required bank forms are completed and signed", "Confirm the document package is complete and logically arranged", "Prepare the bank email using the correct bank-specific format", "Attach all documents and any bank-specific working sheet", "Send to the designated bank email / RM", "Send a separate receipt-confirmation or follow the acknowledgement process", "Record the submission date and time", "Track the case until receipt is confirmed", "Follow up until Pre-Approval is received or the bank raises a query"] },
      { t: "table", head: ["Submission email QC", "Before sending"], rows: [
        ["Recipient · CC", "Correct bank/RM/referral mailbox; required internal CCs included"],
        ["Subject · Client · Transaction", "Correct bank-specific format, customer name and transaction type"],
        ["Loan amount", "Matches application/form and case summary"],
        ["Attachments", "All required documents; no wrong-client documents"],
        ["Bank forms · Working sheet", "Correct forms included; working sheet where required"],
      ]},
      { t: "callout", kind: "security", title: "Privacy control", x: "Before sending, verify that every attachment belongs to the correct client and that no document from another case is included." },
    ]},
    { num: "26", title: "RAK Submission Routing", blocks: [
      { t: "table", head: ["Item", "Control"], rows: [
        ["To", "mortgagereferrals"],
        ["CC", "Burhan"],
        ["Package", "Complete Pre-Approval package + applicable RAK forms"],
        ["Follow-up", "Confirm receipt and track until Pre-Approval / query"],
      ]},
      { t: "callout", kind: "source", title: "Source note", x: "Use the current approved email address(es) and routing from the team's contact list. This preserves the role/mailbox instruction rather than inventing an address." },
    ]},
    { num: "27", title: "Huspy — When the Channel Is Required", blocks: [
      { t: "table", head: ["Situation", "Route"], rows: [
        ["Bank requires / uses Huspy route", "Submit through Huspy portal"],
        ["Direct bank route", "Use the bank's direct submission process"],
        ["Unclear route", "Confirm with the relevant RM / current bank process before submission"],
      ]},
      { t: "callout", kind: "control", title: "Don't choose from memory", x: "Confirm the current routing for the selected bank and case — the Bank Matrix in the Rule Centre records it." },
    ]},
    { num: "28", title: "Huspy Salaried — Step 1: File Preparation", blocks: [
      { t: "table", head: ["Document", "Detailed checks before Huspy submission"], rows: [
        ["KYC – EID, Passport, Visa", "Validity; customer name; signature; nationality"],
        ["Salary Certificate", "Validity; PO Box; company address; salary; designation; company stamp"],
        ["Salary Account Statement", "Last 6 months; salary credited; compare with Salary Certificate"],
        ["Payslip – if variance", "Salary matches bank statement; company name matches Salary Certificate"],
        ["Title Deed / Previous FOL", "Required in buyout case as applicable"],
        ["Bank Forms", "Correct bank forms; complete and signed; details accurate"],
        ["Huspy Form", "Loan amount, purchase amount, tenor, ROI, transaction type, bank name, client details"],
      ]},
      { t: "checklist", items: ["Selected bank and submission route confirmed", "Client is the correct applicant", "Transaction type and purchase/property details confirmed", "Loan amount, purchase amount, tenor and ROI match the Huspy form", "Documents readable and correctly named; no unrelated client document", "Salary variance has supporting payslip", "Buyout cases contain the applicable previous-bank/property document"] },
    ]},
    { num: "29", title: "Huspy Salaried — Step 2: Portal Submission", blocks: [
      { t: "callout", kind: "security", title: "Credentials", x: "Use the approved company/team Huspy credentials. Never place passwords, OTPs or other authentication secrets in the guide, case notes or email." },
      { t: "steps", items: ["Sign in to Huspy using the authorized account", "Open Client Hub → Add New", "Enter basic client information (first name, last name, email, phone)", "Save the client record", "Open Complete Profile and populate Client Details + Mortgage Details", "Cross-check each field against the source documents and Huspy form", "Save Client"] },
      { t: "callout", kind: "control", title: "Client contact control", x: "Do not enter the client's correct email ID and contact number in the portal — the client may receive unwanted emails/calls. Follow the team's approved data-entry convention." },
      { t: "table", head: ["Complete Profile section", "Fields"], rows: [
        ["Client Details", "Residency Status; Employment Status; Fixed Monthly Salary"],
        ["Mortgage Details", "Application Type; Emirate; Property Status; Transaction Type; Mortgage Term; Property Value; Loan Amount; Down Payment %"],
      ]},
    ]},
    { num: "30", title: "Huspy Portal Field Controls", blocks: [
      { t: "table", head: ["Portal field", "Control source / check"], rows: [
        ["Client first / last name", "Match KYC"],
        ["Residency status", "Match Visa/KYC"],
        ["Employment status", "Match employment documents"],
        ["Fixed monthly salary", "Use the verified case income information"],
        ["Application type · Transaction type", "Match transaction/application structure and case type"],
        ["Emirate · Property status", "Match property/transaction and stage"],
        ["Mortgage term · Property value · Loan amount", "Match Huspy form / approved case data"],
        ["Down payment %", "Check arithmetic and case details"],
        ["Bank", "Must be the bank the case is being submitted to"],
        ["ROI", "Enter manually where instructed; verify against case information"],
      ]},
    ]},
    { num: "31", title: "Huspy Checklist & Document Upload", blocks: [
      { t: "steps", items: ["Return to main page → Start Collection", "Select the bank being submitted to", "Select the applicable checklist", "Choose required documents for the main applicant (and co-applicant if applicable)", "Ensure the checklist reflects what will actually be submitted", "Save the checklist — a case password is created"] },
      { t: "callout", kind: "security", title: "Case password", x: "Share the case password only via the team's approved secure channel. Never reuse or publish example passwords from training material." },
      { t: "steps", items: ["Confirm the client name and stage on the main page", "Log out, then sign in again immediately", "Confirm the client file status and open the file to continue"] },
      { t: "callout", kind: "source", title: "Re-login sequence", x: "This re-login sequence is part of the supplied Huspy SOP. Retain it as a process control until the portal workflow is officially updated." },
    ]},
    { num: "32", title: "Huspy Review & Submit", blocks: [
      { t: "steps", items: ["Open the client file and select the bank", "Enter the bank's Rate of Interest manually as instructed; click Next", "Upload the bank application forms and Huspy form; click Next", "Upload the applicant documents selected in the checklist", "Proceed to Review and Submit; review the case summary carefully", "Confirm the summary; add brief client details in Additional Information", "State the bank RM the file is being submitted to, where required", "Select Submit to Huspy"] },
      { t: "table", head: ["Final review point", "Question"], rows: [
        ["Client · Bank", "Is the correct client and bank shown?"],
        ["Loan · Purchase · Tenor · ROI", "Do they match the application and case summary?"],
        ["Transaction · Property", "Correct type and details?"],
        ["Applicant / co-applicant", "Correct documents attached to the correct person?"],
        ["Forms · KYC · Statement · Payslip", "All required, correct period and validity?"],
        ["Additional Info · Bank RM", "Clear, relevant, correct routing?"],
      ]},
    ]},
    { num: "33", title: "Huspy Post-Submission Confirmation", blocks: [
      { t: "steps", items: ["Take a snapshot/screenshot of the submission confirmation", "Draft an email to Areeb at the supplied Huspy address", "Attach the screenshot and state the file has been submitted on the portal", "Request review and submission to the bank", "CC the referral and internal mailboxes; send", "Record the email date/time and retain the screenshot in the case file"] },
      { t: "table", head: ["Recipient", "Role / use"], rows: [
        ["Areeb — areeb@huspy.io", "Primary Huspy contact"],
        ["referrals@huspy.io · referrals@huspy.com", "CC"],
        ["SalesProgressionDL@hfmcgroupuae.com", "CC"],
        ["VirtualRM@hfmcgroupuae.com", "CC"],
      ]},
      { t: "callout", kind: "source", title: "Source control", x: "These addresses are reproduced from the user-supplied Huspy SOP. Confirm current mailbox ownership before live use." },
    ]},
    { num: "34", title: "Bank Query Handling & Escalation", blocks: [
      { t: "steps", items: ["Read the bank query carefully and identify every requested item", "Record query date, bank, request and deadline in the tracker", "Escalate to the relevant Virtual RM / Pre-Approval coordination point", "Obtain supporting documents or explanation from client/VRM", "QC the response — check that every part of the query is answered", "Send the response and documents to the bank/RM", "Monitor until the bank confirms resolution / next status"] },
      { t: "callout", kind: "important", title: "No partial closure", x: "A query remains open until all requested points are addressed or the bank confirms that no further action is required." },
    ]},
    { num: "35", title: "Submission Follow-Up Tracker", blocks: [
      { t: "table", head: ["Tracker field", "What to record"], rows: [
        ["Client · Bank · Route", "Full name; selected bank; Direct / Huspy"],
        ["Submission date · time", "When sent/submitted"],
        ["Receipt status", "Pending / Confirmed"],
        ["Bank RM / contact", "Responsible external contact"],
        ["Last · Next follow-up", "Most recent and next planned date"],
        ["Status", "Submitted / Query / Credit / Pre-Approval / Returned"],
        ["Query · Owner · Target date", "Exact question; responsible person; expected action date"],
        ["Remarks", "Short operational note"],
      ]},
      { t: "callout", kind: "rule", title: "Follow-up rule", x: "Follow up daily after submission until pre-approval is received. For complete files the expected receipt window is 4–5 days — an operational expectation, not a guaranteed bank SLA." },
    ]},
    { num: "36", title: "Bank Submission Master Checklist", blocks: [
      { t: "p", x: "The live case checklist in Case 360 → File QC tab mirrors this 22-point master checklist. Complete it before and after every submission." },
    ]},
    { num: "37", title: "Batch 3 Quick Reference", blocks: [
      { t: "table", head: ["Question", "Answer / control"], rows: [
        ["When do we submit?", "Only after the Pre-Approval file is complete and marked READY."],
        ["Direct or Huspy?", "Use the current route for the bank/case; Mashreq, FAB and ADCB are examples using Huspy."],
        ["What is required for RAK?", "Route to mortgagereferrals and CC Burhan, using current approved addresses."],
        ["After a direct submission?", "Confirm receipt and follow up until Pre-Approval or query."],
        ["After Huspy submission?", "Screenshot, email Areeb with it, CC referral/internal mailboxes, request review/submission to bank."],
        ["Most important Huspy review?", "Client, bank, transaction, loan amount, purchase amount, tenor, ROI, documents and case summary."],
        ["If the bank raises a query?", "Record it, escalate to the VRM, obtain response/support, submit to bank and track closure."],
        ["Store credentials in the guide?", "No. Use approved secure credential management."],
      ]},
    ]},
  ]},
  { n: 4, title: "Pre-Approval follow-up, bank queries & Valuation", status: "current", chapters: [
    { num: "38", title: "Pre-Approval Status Management", blocks: [
      { t: "p", x: "After the file is checked and submitted, the Pre-Approval person owns the follow-up until the bank issues the Pre-Approval or raises a query." },
      { t: "table", head: ["Stage status", "Meaning", "Required action"], rows: [
        ["Submitted", "File sent to bank/channel", "Record submission date and confirm receipt"],
        ["Receipt Pending", "Bank has not confirmed receipt", "Follow up for confirmation"],
        ["Under Review", "Bank acknowledged and is processing", "Track status daily"],
        ["Bank Query", "Bank requires clarification/documents", "Log query and coordinate with Virtual RM 2"],
        ["Query Submitted", "Response/supporting docs sent", "Follow up for closure / credit update"],
        ["Pre-Approval Issued", "Bank has issued pre-approval", "Obtain letter and perform detailed QC"],
        ["Returned / Incomplete", "Bank requires correction / file incomplete", "Coordinate correction and re-submit"],
      ]},
      { t: "callout", kind: "source", title: "Source rule", x: "Once submitted, the Pre-Approval person must follow up daily for approval status. A complete file should normally receive pre-approval within 4–5 days — an operational expectation, not a guaranteed SLA." },
    ]},
    { num: "39", title: "Daily Bank Follow-Up", blocks: [
      { t: "steps", items: ["Check the current bank status", "Confirm whether the file is still under review or has moved to credit", "Check for any new query, missing document request or clarification", "If no update is available, send the required follow-up to the bank/RM", "Update the internal tracker with date, status and next action", "Continue until Pre-Approval is received or the case is formally returned/queried"] },
      { t: "table", head: ["Tracker field", "Example / control"], rows: [
        ["Submission date", "Date file was submitted"],
        ["Receipt confirmed", "Yes / No"],
        ["Last bank follow-up", "Date/time"],
        ["Bank status", "Under review / Credit / Query / Approved"],
        ["Bank contact", "RM / credit contact"],
        ["Query received", "Yes / No"],
        ["Next follow-up", "Next planned date"],
        ["Owner", "Assigned Pre-Approval person"],
        ["Remarks", "Short factual update"],
      ]},
      { t: "callout", kind: "important", title: "Discipline", x: "Avoid vague notes such as 'followed up.' Record what was checked, what the bank said, and what the next action is." },
    ]},
    { num: "40", title: "Bank Query Management", blocks: [
      { t: "p", x: "When the bank raises a query, the Pre-Approval person approaches Virtual RM 2 (Pre-Approval team). Both coordinate to resolve the query, prepare supporting documents and send an explanation back to the bank." },
      { t: "table", head: ["Query step", "Control"], rows: [
        ["Receive", "Capture the bank's exact query/request"],
        ["Understand", "Break the query into individual action points"],
        ["Forward", "Send the query to Virtual RM 2 / relevant owner"],
        ["Clarify", "Obtain missing information or supporting documents"],
        ["Prepare", "Prepare the response and evidence"],
        ["QC", "Confirm every bank point is answered"],
        ["Submit", "Send response to bank / credit department"],
        ["Track", "Follow up until query is closed"],
      ]},
      { t: "table", head: ["Query log field", "Required entry"], rows: [
        ["Query date · Bank · Client", "Date received; bank name; client/case"],
        ["Exact query", "Copy/accurately summarize the request"],
        ["Required document", "Document/support requested"],
        ["Responsible person", "VRM / Pre-Approval / client"],
        ["Due / target date", "When response should be sent"],
        ["Response sent", "Date"],
        ["Bank confirmation", "Closed / Further query"],
        ["Remarks", "Outcome"],
      ]},
    ]},
    { num: "41", title: "Query Resolution Workflow", blocks: [
      { t: "steps", items: ["Receive the bank query and read the full request", "Forward the query to Virtual RM 2 (Pre-Approval team)", "Identify whether the bank needs a document, explanation, correction or combination", "Coordinate with the client/Virtual RM where information is required", "Check the supporting document for completeness and consistency", "Draft the explanation so it directly addresses the bank's question", "Submit the complete response to the bank", "Record the submission date and supporting documents", "Follow up until the bank confirms resolution or issues another query"] },
      { t: "callout", kind: "important", title: "No assumptions", x: "If the query asks for a fact not available in the file, do not create an explanation from assumptions. Obtain the required information/supporting evidence." },
      { t: "table", head: ["Response QC", "Question"], rows: [
        ["Completeness", "Have all questions from the bank been answered?"],
        ["Evidence", "Is the supporting document attached?"],
        ["Consistency", "Does the explanation match KYC, income, statement and application data?"],
        ["Clarity", "Can the bank understand the reason without further interpretation?"],
        ["Names/details", "Are client/property/company details correct?"],
        ["Submission · Tracking", "Sent to the correct contact? Marked responded and still monitored?"],
      ]},
    ]},
    { num: "42", title: "Pre-Approval Letter Receipt", blocks: [
      { t: "steps", items: ["Obtain the issued Pre-Approval letter from the bank", "Save the document in the correct client file", "Check the client name", "Check the approved loan/finance amount", "Check tenure", "Check rate of interest", "Review all conditions and special remarks", "If correct, share the checked letter with Virtual RM 2 / the next-stage owner", "If incorrect, notify the bank for correction before proceeding"] },
    ]},
    { num: "43", title: "Pre-Approval Letter Quality Check", blocks: [
      { t: "table", head: ["Field", "What to check"], rows: [
        ["Client name", "Exact match with KYC/application"],
        ["Loan / finance amount", "Matches expected approved amount and case"],
        ["Tenure", "Matches approved case / requested term"],
        ["Rate of Interest", "Correct rate and structure as stated by bank"],
        ["Property / transaction", "Correct property/transaction where stated"],
        ["Conditions", "Read every condition; identify outstanding items"],
        ["Validity / expiry", "Check if the letter contains a validity period"],
        ["Special conditions", "Capture any credit / documentation conditions"],
        ["Bank details", "Correct bank/product/reference"],
        ["Document completeness", "All pages received and readable"],
      ]},
      { t: "callout", kind: "control", title: "Stop control", x: "Do not move to the next stage solely because an approval letter has arrived. The letter must first be checked for amount, tenure, rate and conditions." },
      { t: "table", head: ["Condition type", "Action"], rows: [
        ["Document condition", "Identify document required and owner"],
        ["Valuation condition", "Ensure valuation stage requirements are prepared"],
        ["Income / credit condition", "Coordinate with relevant owner before proceeding"],
        ["Property condition", "Confirm required property documents"],
        ["Legal / transaction condition", "Record and route to the relevant stage/owner"],
        ["Unclear condition", "Seek clarification from bank/RM before proceeding"],
      ]},
    ]},
    { num: "44", title: "Handover to Valuation", blocks: [
      { t: "table", head: ["Handover item", "Required"], rows: [
        ["Checked Pre-Approval letter", "Yes"],
        ["Finance amount / tenure / rate recorded", "Yes"],
        ["Property documents available", "As applicable"],
        ["Seller/developer documents available", "According to transaction type"],
        ["Valuation fee status", "Client to pay valuation fees"],
        ["Valuation payment proof", "Required once paid"],
        ["Bank submission contact", "Recorded"],
        ["Valuation owner", "Assigned"],
        ["Open conditions", "Recorded and actioned/accepted before handover where required"],
      ]},
      { t: "callout", kind: "rule", title: "Handover principle", x: "The next-stage person should understand the case without reopening the entire Pre-Approval history. The note states approval status, property documents, valuation payment status and outstanding conditions." },
    ]},
    { num: "45", title: "Valuation — Initial Requirements", blocks: [
      { t: "p", x: "When a file moves from Pre-Approval to Valuation, the client first pays the valuation fees. Property and seller/developer documents (per transaction type) are then shared with the bank along with valuation payment proof." },
      { t: "table", head: ["Requirement", "Control"], rows: [
        ["Valuation fee", "Client pays valuation fees"],
        ["Payment proof", "Obtain proof of payment"],
        ["Property documents", "Share applicable property document package"],
        ["Seller/developer documents", "Share according to transaction type"],
        ["Bank", "Send documents and payment proof to relevant bank/RM"],
        ["Valuation initiation", "Wait for bank to initiate valuation"],
      ]},
    ]},
    { num: "46", title: "Valuation Payment & Document Submission", blocks: [
      { t: "steps", items: ["Inform/confirm with client that valuation fees need to be paid", "Obtain valuation payment proof", "Prepare the property document package", "Add seller or developer documents according to the transaction type", "Send the complete valuation package to the bank", "Confirm the bank has received the documents and payment proof", "Request/monitor valuation initiation"] },
      { t: "table", head: ["Transaction", "Valuation-stage document focus"], rows: [
        ["Primary / Developer", "SPA and applicable title/registration/Oqood document, floor plan and payment proof; developer documents as applicable"],
        ["Resale / Secondary", "Title/Registration Deed or Dubai property document, floor plan, seller KYC, MOU/Form F, payment proof and seller company documents where applicable"],
        ["Buyout / Buyout + Equity", "Title/Registration Deed or Dubai property document, floor plan, payment proof and previous-bank/liability documentation as applicable"],
      ]},
      { t: "callout", kind: "source", title: "Source control", x: "Transaction document lists are based on information supplied earlier in this guide. Exact valuation documents must still be aligned with the selected bank and transaction." },
    ]},
    { num: "47", title: "Bank Valuation Initiation", blocks: [
      { t: "steps", items: ["Confirm bank has accepted the valuation package", "Monitor for valuation initiation", "The evaluator team should call Binish within 24 hours to schedule an appointment", "Record the contact/appointment status"] },
      { t: "callout", kind: "source", title: "Timing note", x: "The 24-hour evaluator contact point is the operational expectation stated in the supplied process — not a guaranteed bank SLA." },
    ]},
    { num: "48", title: "Inspection Scheduling", blocks: [
      { t: "p", x: "Binish coordinates with the valuator and buyer for Buyout Transactions to identify a suitable inspection time." },
      { t: "table", head: ["Role", "Responsibility"], rows: [
        ["Evaluator team", "Contact Binish to schedule appointment"],
        ["Binish", "Coordinate with valuator and buyer where applicable"],
        ["Buyer", "Provide suitable availability"],
        ["SPO Valuation Stage", "Confirm schedule with Binish; inform bank and Virtual RM 2 (Valuation Stage)"],
        ["Virtual RM 2 – Valuation", "Receive inspection date/time and manage next-stage communication"],
      ]},
      { t: "steps", items: ["Receive evaluator contact / appointment request", "Coordinate date and time", "For Buyout, coordinate with buyer as specified", "Confirm appointment with Binish", "SPO Valuation Stage confirms the schedule", "Inform bank", "Inform Virtual RM 2 – Valuation Stage", "Record appointment date/time in tracker"] },
    ]},
    { num: "49", title: "Inspection Day Controls", blocks: [
      { t: "table", head: ["Control", "Action"], rows: [
        ["Appointment confirmed", "Verify date/time before inspection"],
        ["Client/buyer availability", "Confirm as applicable"],
        ["Property access", "Ensure relevant party can facilitate inspection"],
        ["Bank/evaluator", "Confirm evaluator appointment"],
        ["Internal tracker", "Update scheduled/completed status"],
        ["Post-inspection", "Start valuation report follow-up immediately"],
      ]},
    ]},
    { num: "50", title: "Valuation Report Follow-Up", blocks: [
      { t: "steps", items: ["Confirm the inspection has taken place", "Request/track valuation report issuance", "Follow up with the bank as required", "Record the expected/actual report date", "Once received, save the valuation report in the client file"] },
      { t: "callout", kind: "source", title: "Source timeline", x: "The valuation report usually takes a maximum of 48 hours after inspection — a stated operational expectation, not a guaranteed SLA." },
    ]},
    { num: "51", title: "Valuation Report Quality Check", blocks: [
      { t: "table", head: ["Check", "What to verify"], rows: [
        ["Client / case", "Correct report belongs to the correct case"],
        ["Property", "Correct property/address/details"],
        ["Valuation result", "Positive / negative / any qualification"],
        ["Valuation amount", "Record the reported valuation amount"],
        ["Property condition / remarks", "Read evaluator remarks and limitations"],
        ["Bank conditions", "Identify any conditions or additional requirements"],
        ["Completeness", "All pages included and readable"],
        ["Next action", "Determine whether case can move to FOL or requires escalation"],
      ]},
      { t: "steps", items: ["Confirm the valuation is positive/acceptable", "Check the report for any conditions still needing action", "Save the report", "Share the report with Virtual RM 2 – Valuation Stage", "Prepare the case for movement to FOL Stage"] },
    ]},
    { num: "52", title: "Negative Valuation — Escalation", blocks: [
      { t: "p", x: "If the valuation report is negative, the team either challenges the bank's decision or obtains confirmation from Sir on how to proceed." },
      { t: "steps", items: ["Identify why the valuation is negative/unacceptable from the report", "Record the bank/evaluator's stated reason", "Discuss whether a challenge is appropriate", "If required, challenge/seek reconsideration through the bank", "If the decision is not clear, obtain confirmation from Sir on how to proceed", "Record the decision and next action", "Do not move the case to FOL until the valuation issue is resolved/accepted"] },
      { t: "callout", kind: "important", title: "Escalation control", x: "Do not independently promise the client that a negative valuation will be overturned. The process requires either challenging the bank's decision or obtaining confirmation on how to proceed." },
    ]},
    { num: "53", title: "Positive Valuation — Handover to FOL", blocks: [
      { t: "table", head: ["Handover item", "Required"], rows: [
        ["Valuation report", "Received and checked"],
        ["Valuation result", "Positive / acceptable"],
        ["Conditions", "Reviewed and recorded"],
        ["Pre-Approval", "Checked and available"],
        ["Property documents", "Available in file"],
        ["Inspection", "Completed"],
        ["Valuation tracker", "Updated"],
        ["Virtual RM 2 – Valuation", "Informed"],
        ["Next stage", "FOL Stage"],
      ]},
      { t: "callout", kind: "rule", title: "Next stage", x: "Once the valuation is positive and the report is shared with Virtual RM 2 (Valuation Stage), the case moves to the FOL Stage." },
    ]},
    { num: "54", title: "Pre-Approval & Valuation Master Checklists", blocks: [
      { t: "p", x: "The 18-point Pre-Approval follow-up checklist (submission date, receipt, daily follow-up, bank status, query logging/forwarding/response/closure, letter receipt and checks on name/amount/tenure/ROI/conditions, sharing with next owner) and the 21-point Valuation checklist (fee, payment proof, property & seller/developer documents, bank receipt, initiation, evaluator contact, inspection, report QC, positive/negative recording, escalation, FOL handover) run as live checklists in Case 360." },
    ]},
    { num: "55", title: "Stage Handover Note", blocks: [
      { t: "p", x: "Use a short handover note when moving the case from Pre-Approval to Valuation." },
      { t: "table", head: ["Field", "Entry"], rows: [
        ["Client · Bank · Transaction", "Name/case ref; bank; Primary / Resale / Buyout / Buyout + Equity"],
        ["Pre-Approval date · Approved amount", "Date; amount"],
        ["Tenure · ROI", "Years/months; rate"],
        ["Conditions", "Outstanding / cleared"],
        ["Valuation fee · Payment proof", "Paid / pending; Received / pending"],
        ["Property docs · Seller/developer docs", "Complete / pending each"],
        ["Inspection · Valuation report", "Scheduled / completed; Pending / received"],
        ["Result", "Positive / Negative"],
        ["Next owner · Next action", "Name/team; specific action"],
      ]},
    ]},
    { num: "56", title: "Batch 4 Quick Reference", blocks: [
      { t: "table", head: ["Question", "Control"], rows: [
        ["How often should bank follow-up happen?", "Daily after submission."],
        ["Expected Pre-Approval time?", "4–5 days for a complete file — not a guaranteed SLA."],
        ["Who handles bank queries?", "Pre-Approval person coordinates with Virtual RM 2 to resolve and respond."],
        ["What must be checked on Pre-Approval?", "Client name, loan amount, tenure, ROI and all conditions."],
        ["What happens after Pre-Approval?", "Move to Valuation once the approval is checked and case is ready."],
        ["Who pays valuation fee?", "Client."],
        ["What is shared for valuation?", "Property documents + seller/developer documents + valuation payment proof."],
        ["Who coordinates inspection?", "Binish with evaluator and buyer for Buyout; SPO Valuation confirms and informs parties."],
        ["Evaluator contact expectation?", "Within 24 hours."],
        ["Valuation report expectation?", "Maximum 48 hours after inspection."],
        ["If valuation is negative?", "Challenge bank decision or obtain confirmation from Sir on how to proceed."],
        ["If valuation is positive?", "Share checked report with Virtual RM 2 – Valuation and move toward FOL."],
      ]},
    ]},
  ]},
  { n: 5, title: "FOL, FOL QC, signing, liability & Loan Booking", status: "current", chapters: [
    { num: "57", title: "FOL Stage — Purpose & Entry Gate", blocks: [
      { t: "p", x: "The FOL stage begins after valuation is completed and the case is ready for the bank's final offer documentation. Coordination runs between the SPO FOL stage person and Virtual RM 2 (FOL stage)." },
      { t: "table", head: ["Entry requirement", "Control"], rows: [
        ["Valuation", "Positive valuation / case ready for FOL"],
        ["Pre-Approval", "Available and checked"],
        ["FOL conversation", "SPO FOL stage person shares the FOL conversation with Virtual RM 2"],
        ["Client confirmation", "Required before requesting the FOL from the bank"],
        ["Bank request", "Submitted after confirmation"],
      ]},
      { t: "callout", kind: "control", title: "Stage gate", x: "Do not treat the FOL as ready for signing until the FOL terms have been checked and the client has confirmed the required details." },
    ]},
    { num: "58", title: "FOL Conversation & Handover", blocks: [
      { t: "p", x: "The SPO FOL stage person shares the FOL conversation with Virtual RM 2 (FOL person) to confirm the final commercial and insurance-related details with the client before requesting the FOL." },
      { t: "table", head: ["Party", "Responsibility"], rows: [
        ["SPO FOL Stage Person", "Share FOL conversation/request details with Virtual RM 2"],
        ["Virtual RM 2 – FOL Stage", "Confirm final terms with client and obtain written confirmation"],
        ["Client", "Review and confirm the required FOL details"],
        ["Bank", "Issue FOL after request and required confirmation"],
      ]},
      { t: "checklist", items: ["Client name and case reference", "Bank name", "Finance amount", "Tenor", "Rate of interest", "Expected EMI", "Life insurance details", "Property insurance details", "Other key FOL conversation terms", "Known conditions or open points"] },
    ]},
    { num: "59", title: "Client Confirmation — Required Details", blocks: [
      { t: "table", head: ["Confirmation item", "What to confirm"], rows: [
        ["Finance amount", "Amount the client will receive/finance"],
        ["Tenor", "Approved repayment period"],
        ["Rate of Interest", "Applicable rate"],
        ["EMI", "Expected installment amount"],
        ["Life insurance", "Whether applicable and stated cost/coverage"],
        ["Property insurance", "Whether applicable and stated cost/coverage"],
      ]},
      { t: "callout", kind: "control", title: "Control", x: "The client should confirm the terms before the FOL request is sent to the bank." },
    ]},
    { num: "60", title: "Client Confirmation Email", blocks: [
      { t: "steps", items: ["Prepare the confirmation email with the agreed terms", "Clearly list finance amount, tenor, rate, EMI, life insurance and property insurance", "Ask the client to confirm the details", "Receive the client's confirmation", "Retain the confirmation as part of the case record", "Send the FOL request details and a snapshot of the confirmation to the SPO FOL stage person"] },
      { t: "checklist", items: ["Correct client email/contact", "Finance amount included", "Tenor included", "ROI included", "EMI included", "Life insurance included", "Property insurance included", "Client response received", "Client confirmation is clear", "Snapshot/evidence retained", "Confirmation sent to SPO FOL stage person"] },
    ]},
    { num: "61", title: "FOL Request to Bank", blocks: [
      { t: "steps", items: ["Receive FOL request details from Virtual RM 2", "Check that the client's confirmation is attached / evidenced", "Prepare the bank FOL request", "Send the request to the correct bank/RM", "Record the request date", "Track the case until FOL is received"] },
      { t: "callout", kind: "source", title: "Source timeline", x: "FOL is normally received within 4–5 days — an operational expectation, not a guaranteed bank SLA." },
    ]},
    { num: "62", title: "FOL Bank Follow-Up", blocks: [
      { t: "p", x: "The SPO FOL stage person follows up daily with the bank until the FOL is received." },
      { t: "table", head: ["Follow-up field", "Record"], rows: [
        ["FOL request date", "Date request was sent"],
        ["Bank contact", "Bank RM / responsible contact"],
        ["Last follow-up", "Date/time"],
        ["Bank status", "Requested / Processing / Query / Issued"],
        ["Expected date", "As communicated by bank"],
        ["Next follow-up", "Next planned date"],
        ["Owner", "SPO FOL stage person"],
        ["Remarks", "Short factual update"],
      ]},
      { t: "callout", kind: "rule", title: "Follow-up rule", x: "The supplied process explicitly requires daily follow-up until the FOL is received." },
    ]},
    { num: "63", title: "Bank Query During FOL", blocks: [
      { t: "p", x: "If the bank raises a query during the FOL process, the SPO FOL stage person and Virtual RM 2 (FOL stage) coordinate to resolve it and respond." },
      { t: "steps", items: ["Record the bank query", "Forward/coordinate the query with Virtual RM 2", "Identify the required document, correction or clarification", "Prepare the supporting information", "Check the response for completeness", "Send the response to the bank", "Follow up until the FOL request can proceed"] },
      { t: "table", head: ["Query control", "Question"], rows: [
        ["Completeness", "Have all points raised by the bank been answered?"],
        ["Evidence", "Are supporting documents attached?"],
        ["Consistency", "Does the response match the approved case and client documents?"],
        ["Tracking · Closure", "Is status updated? Has the bank confirmed resolution?"],
      ]},
    ]},
    { num: "64", title: "FOL Receipt & Quality Check", blocks: [
      { t: "steps", items: ["Obtain the FOL from the bank", "Confirm all pages are received and readable", "Check customer name", "Check property details", "Check loan amount", "Check tenor", "Check installment amount", "Check property insurance", "Check life insurance", "Check rate of interest", "If correct, share the checked FOL with Virtual RM 2", "If incorrect, inform the bank for correction"] },
    ]},
    { num: "65", title: "FOL QC — Detailed Checklist", blocks: [
      { t: "table", head: ["Field", "Detailed check"], rows: [
        ["Customer name", "Exact match with KYC/application"],
        ["Property details", "Correct property and relevant details"],
        ["Loan amount", "Matches approved/confirmed finance amount"],
        ["Tenor", "Matches confirmed term"],
        ["Installment / EMI", "Matches confirmed/expected amount or bank calculation"],
        ["Property insurance", "Correct inclusion/details"],
        ["Life insurance", "Correct inclusion/details"],
        ["Rate of Interest", "Matches confirmed/approved rate"],
        ["Pages", "All pages received"],
        ["Conditions", "All conditions read and recorded"],
        ["Special remarks", "Any additional bank requirement identified"],
        ["Client terms", "Consistent with client's prior confirmation"],
      ]},
      { t: "callout", kind: "control", title: "Stop control", x: "If any material FOL detail is incorrect, do not proceed to signing. Send the issue to the bank for correction." },
    ]},
    { num: "66", title: "FOL Correction Workflow", blocks: [
      { t: "steps", items: ["Identify — highlight the incorrect field", "Verify — compare against Pre-Approval, client confirmation and source documents", "Notify bank — inform the bank/RM of the discrepancy", "Request correction — ask for revised FOL", "Recheck — repeat full FOL QC on the corrected version", "Share — only after QC, share the checked FOL with Virtual RM 2"] },
    ]},
    { num: "67", title: "Sharing the Checked FOL", blocks: [
      { t: "steps", items: ["Confirm the FOL has passed QC", "Save the checked FOL in the case file", "Share the checked FOL with Virtual RM 2 (FOL stage)", "Ensure the client receives the correct version", "Prepare for signing coordination"] },
    ]},
    { num: "68", title: "FOL Signing — Client Availability", blocks: [
      { t: "steps", items: ["Client reviews the correct FOL", "Virtual RM 2 asks the client for preferred signing date/time", "Client confirms availability", "Virtual RM 2 informs the SPO FOL stage person"] },
    ]},
    { num: "69", title: "FOL Signing — Bank Coordination", blocks: [
      { t: "steps", items: ["Receive client's preferred date/time", "Check bank branch/authorized signing availability", "Confirm the appointment with bank", "Confirm client and bank meeting arrangements", "Ensure the final correct FOL is the document being signed", "Record signing date/time"] },
      { t: "callout", kind: "control", title: "Signing control", x: "The client and bank meet at a branch for FOL signing once availability is confirmed." },
    ]},
    { num: "70", title: "DDA Confirmation", blocks: [
      { t: "table", head: ["Party", "Action"], rows: [
        ["Virtual RM 2 – FOL stage", "Check with client regarding DDA confirmation"],
        ["SPO FOL stage person", "Check with the bank for DDA confirmation"],
        ["Internal tracker", "Record confirmation status"],
      ]},
      { t: "steps", items: ["Confirm the FOL has been signed", "Ask the client for DDA confirmation/status", "Check DDA status with the bank", "Record both confirmations", "Identify any outstanding DDA action"] },
    ]},
    { num: "71", title: "Seller Liability — Settlement Workflow", blocks: [
      { t: "p", x: "If the seller has a liability, the SPO FOL stage person asks the bank for a settlement date after receiving the seller's liability letter." },
      { t: "steps", items: ["Liability letter — receive seller's liability letter", "Settlement date — ask bank for settlement date", "Settlement — bank completes settlement (supplied process states 10–15 days)", "Follow-up — SPO or Virtual RM 2 asks in the WhatsApp group and checks with the realtor whether the seller/buyer received release-letter notification", "Release notification — if received, inform bank", "Collection — bank collects release letter from seller's bank", "Transfer — case moves to Final Transfer Stage"] },
      { t: "callout", kind: "source", title: "Timeline note", x: "Settlement is completed in 10–15 days per the supplied process — a process expectation, not a guaranteed bank timeline." },
      { t: "checklist", items: ["Seller liability identified", "Liability letter received", "Settlement date requested", "Settlement date received", "Settlement tracked", "WhatsApp/realtor follow-up completed", "Release notification received", "Bank informed", "Release letter collection confirmed", "Final Transfer handover ready"] },
    ]},
    { num: "72", title: "Seller Release Letter Follow-Up", blocks: [
      { t: "steps", items: ["After settlement, monitor for release-letter notification", "Check the WhatsApp group as specified by the process", "Check with the realtor", "For Buyout, verify the seller/buyer side notification as applicable", "If notification is received, inform the bank", "Confirm the bank will collect the release letter from the seller's bank", "Record release status", "Move the case to Final Transfer once the release process is complete"] },
      { t: "callout", kind: "important", title: "Important", x: "The source specifically instructs the team to check both the WhatsApp group and realtor for release-letter notification. Keep this as a defined follow-up activity." },
    ]},
    { num: "73", title: "Cash Seller Workflow", blocks: [
      { t: "table", head: ["Scenario", "Next stage"], rows: [
        ["Seller has liability", "Settlement → release letter → Final Transfer"],
        ["Seller is cash seller", "After loan booking → Final Transfer"],
      ]},
      { t: "callout", kind: "rule", title: "Decision point", x: "At FOL stage, identify whether the seller has an existing liability or is a cash seller because the downstream workflow is different." },
    ]},
    { num: "74", title: "FOL Stage Master Checklist", blocks: [
      { t: "p", x: "The 33-point FOL master checklist (valuation complete, FOL conversation shared, client confirmation of amount/tenor/ROI/EMI/insurance, written confirmation + snapshot, FOL request sent, daily follow-up, queries resolved, FOL received and QC'd on all fields, conditions reviewed, correct FOL shared, signing availability, bank availability, signing completed, DDA checked with client and bank, seller liability/cash identified, settlement and release tracked, Final Transfer handover) runs as a live checklist in Case 360." },
    ]},
    { num: "75", title: "FOL Handover Note", blocks: [
      { t: "p", x: "Use this handover when moving the case from FOL to Final Transfer." },
      { t: "table", head: ["Field", "Entry"], rows: [
        ["Client · Bank · Transaction", "Name/case ref; bank; structure"],
        ["FOL date · Finance amount", "Date received; amount"],
        ["Tenor · ROI · EMI", "Term; rate; installment"],
        ["Life · Property insurance", "Confirmed / pending each"],
        ["FOL QC", "Passed / correction requested"],
        ["Signing · DDA", "Completed / pending; Confirmed / pending"],
        ["Seller type", "Liability / Cash Seller"],
        ["Liability letter · Settlement date", "Received / pending / N/A; Date / N/A"],
        ["Release notification · Release letter", "Received / pending / N/A; Collected / pending / N/A"],
        ["Next stage · Next action", "Final Transfer; specific action"],
      ]},
    ]},
    { num: "76", title: "Batch 5 Quick Reference", blocks: [
      { t: "table", head: ["Question", "Control"], rows: [
        ["Who shares the FOL conversation?", "SPO FOL stage person to Virtual RM 2."],
        ["What does the client confirm?", "Finance amount, tenor, ROI, EMI, life insurance and property insurance."],
        ["When is FOL requested?", "After client confirmation."],
        ["Who follows up with bank?", "SPO FOL stage person, daily until FOL is received."],
        ["If bank raises a query?", "SPO FOL stage person and Virtual RM 2 coordinate to resolve and respond."],
        ["What must be checked on FOL?", "Customer name, property details, loan amount, tenor, installment, property & life insurance and ROI."],
        ["If FOL is incorrect?", "Inform bank for correction and recheck revised FOL."],
        ["Who asks client for signing availability?", "Virtual RM 2 – FOL stage."],
        ["Who checks bank availability?", "SPO FOL stage person."],
        ["Where does signing happen?", "At a bank branch."],
        ["Who checks DDA?", "Virtual RM 2 with client; SPO FOL stage person with bank."],
        ["What happens with seller liability?", "Request settlement date, track settlement, monitor release notification and bank release-letter collection."],
        ["What happens with a cash seller?", "Move directly to Final Transfer after loan booking."],
      ]},
    ]},
  ]},
  { n: 6, title: "POA, Developer NOC & Final Transfer preparation", status: "planned", chapters: [] },
  { n: 7, title: "Dubai & Abu Dhabi Transfer, ADM Valuation & Title Deed", status: "planned", chapters: [] },
  { n: 8, title: "TAT/expiry, email templates, QC, escalation & appendices", status: "planned", chapters: [] },
];
