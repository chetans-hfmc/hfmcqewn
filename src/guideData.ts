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
  { n: 4, title: "Pre-Approval follow-up, bank queries & Valuation", status: "planned", chapters: [] },
  { n: 5, title: "FOL, FOL QC, signing, liability & Loan Booking", status: "planned", chapters: [] },
  { n: 6, title: "POA, Developer NOC & Final Transfer preparation", status: "planned", chapters: [] },
  { n: 7, title: "Dubai & Abu Dhabi Transfer, ADM Valuation & Title Deed", status: "planned", chapters: [] },
  { n: 8, title: "TAT/expiry, email templates, QC, escalation & appendices", status: "planned", chapters: [] },
];
