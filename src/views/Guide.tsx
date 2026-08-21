import { useState } from "react";
import { Ic, cx } from "../ui";

const BATCHES = [
  ["Batch 1", "Foundation, lifecycle and transaction types", true],
  ["Batch 2", "Virtual RM, document collection and detailed Pre-Approval", false],
  ["Batch 3", "Bank submission, bank matrix and Huspy SOP", false],
  ["Batch 4", "Pre-Approval follow-up, bank queries and Valuation", false],
  ["Batch 5", "FOL, FOL QC, signing, liability and Loan Booking", false],
  ["Batch 6", "POA, Developer NOC and Final Transfer preparation", false],
  ["Batch 7", "Dubai Transfer, Abu Dhabi Transfer, ADM Valuation and Title Deed", false],
  ["Batch 8", "TAT/expiry, email templates, QC, escalation and appendices", false],
];

const ROLES = [
  ["Virtual RM 1", "Receives/organizes the client file and prepares the documentation package for Pre-Approval/bank submission."],
  ["Pre-Approval Person / Team", "Checks the file, submits to bank or Huspy where applicable, follows up for Pre-Approval and manages bank queries with the relevant VRM."],
  ["Virtual RM 2", "Supports the applicable downstream stage, including query resolution, client communication and stage-specific coordination."],
  ["SPO – Valuation Stage", "Coordinates bank-side valuation process, inspection scheduling/follow-up and valuation report receipt/check."],
  ["SPO – FOL Stage", "Requests and checks FOL, coordinates bank follow-up and supports signing/loan-booking readiness."],
  ["SPO – Final Transfer Stage", "Coordinates transfer readiness, charges, documents, appointment booking, transfer day and Title Deed QC."],
  ["Bank RM / Banker", "Provides bank-side instructions, requests, booking, valuation/FOL/loan-booking actions and transfer coordination."],
  ["Huspy Contact / Channel", "Receives cases submitted through Huspy for applicable banks and confirms review/submission to the bank."],
];

const LIFECYCLE = [
  ["1. File Intake / Virtual RM 1", "Collect, organize and initially check client and transaction documents.", "Complete file package ready for Pre-Approval review."],
  ["2. Pre-Approval", "Verify eligibility, KYC, income, statements, forms and transaction documents; submit to bank/Huspy.", "Pre-Approval received and checked."],
  ["3. Valuation", "Collect valuation fee proof and property/seller/developer documents; initiate and coordinate inspection.", "Positive valuation report received and checked."],
  ["4. FOL", "Convert approved terms into the Final Offer Letter and confirm client terms.", "Correct FOL received, checked and accepted for signing."],
  ["5. FOL Signing / DDA", "Complete signing, confirm funding and satisfy bank pre-booking requirements.", "FOL signed, DDA/funding confirmed and required documents handed over."],
  ["6. Loan Booking", "Bank books the loan and prepares required Manager's Cheque(s).", "Loan booking confirmation received and transfer-ready conditions met."],
  ["7. Liability / Clearance (if applicable)", "Settle existing seller mortgage and obtain release/clearance documents.", "Clearance/release documents available."],
  ["8. Final Transfer", "Complete property transfer with bank, buyer, seller/POA and relevant government office.", "Transfer completed."],
  ["9. Title Deed / Closure", "Obtain Title Deed, complete QC and close the case.", "Title Deed QC complete and case closed."],
];

const HANDOVERS = [
  ["Virtual RM 1", "Pre-Approval", "KYC, income documents, bank statement, applicable payslip/service letter, bank forms and transaction documents ready for review."],
  ["Pre-Approval", "Valuation", "Checked Pre-Approval Letter and property documents available."],
  ["Valuation", "FOL", "Positive valuation report and valuation-stage handover shared."],
  ["FOL", "Final Transfer", "Correct FOL checked, FOL signing completed, DDA confirmation and applicable release/loan-booking condition satisfied."],
  ["Final Transfer", "Completed", "Transfer completed, Title Deed received and Title Deed quality-check email sent."],
];

const LANGUAGE = [
  ["RECEIVED", "Document or confirmation is physically / electronically available."],
  ["VERIFIED", "The responsible person has checked the relevant information."],
  ["PENDING", "Required action or evidence is still outstanding."],
  ["ISSUE", "A discrepancy or blocker prevents normal progression."],
  ["READY", "All defined controls for the next stage have been satisfied."],
  ["HANDOVER", "Required evidence plus ownership/action information has been transferred to the next responsible team."],
];

const TX_TYPES: { name: string; desc: string; rows: [string, string][] }[] = [
  {
    name: "Primary Sale / Direct from Developer",
    desc: "The customer purchases the property directly from the developer. A newly built property may not yet have a Title Deed.",
    rows: [
      ["SPA – all pages", "Confirm transaction details and completeness."],
      ["Title Deed / Registration Deed", "Applicable where issued; establish property details/ownership."],
      ["Oqood / Initial Title Deed – Dubai", "Applicable Dubai property document where Title Deed is not yet available."],
      ["Floor Plan", "Confirm property/unit information."],
      ["Payment Proof", "Evidence of payments made toward the property."],
      ["SOA", "Developer account statement showing paid and pending amounts."],
      ["BCC / Handover Notice", "May be required in the applicable primary/handover scenario."],
    ],
  },
  {
    name: "Resale / Secondary Market",
    desc: "The customer purchases an existing property from a seller.",
    rows: [
      ["Title Deed / Registration Deed", "Property ownership and details."],
      ["Oqood / Initial Title Deed – Dubai", "Applicable where required for the Dubai property."],
      ["Floor Plan", "Confirm unit/property details."],
      ["Seller KYC", "Verify seller identity and transaction party."],
      ["MOU – Abu Dhabi / Form F – Dubai", "Record buyer/seller/property and commercial transaction details."],
      ["Payment Proof", "Evidence of agreed payments."],
      ["Seller Trade License", "Required where seller is a company."],
    ],
  },
  {
    name: "Buyout",
    desc: "A buyout involves replacing an existing mortgage/finance arrangement with the new bank. At later stages the existing liability must be settled and release/clearance documentation obtained.",
    rows: [
      ["Title Deed / Registration Deed", "Property and existing ownership/mortgage information."],
      ["Oqood / Initial Title Deed – Dubai", "Applicable Dubai property evidence."],
      ["Floor Plan", "Property/unit verification."],
      ["Previous Bank FOL / applicable document", "Evidence of existing facility and terms where required."],
      ["Liability Letter", "States the outstanding mortgage amount — seller mortgage bank letter."],
      ["Release / Clearance Letter", "Confirms settlement/release after existing liability is cleared."],
    ],
  },
  {
    name: "Buyout + Equity",
    desc: "Combines settlement of the existing mortgage with release of additional equity, subject to the approved finance structure and bank requirements.",
    rows: [
      ["Existing mortgage liability", "Determine amount required for settlement."],
      ["Original Title Deed", "Required for the existing mortgaged property where applicable."],
      ["New FOL", "Confirm approved finance and equity terms."],
      ["Mortgage release documents", "Enable release of the previous mortgage."],
      ["Equity disbursement", "Post-settlement release of approved equity, subject to bank process."],
    ],
  },
  {
    name: "Pure Equity / Refinance",
    desc: "Finance taken against property equity, including situations where there is no existing loan.",
    rows: [
      ["Original Title Deed", "Property ownership evidence."],
      ["FOL", "Approved finance terms."],
      ["Equity disbursement documents", "Subject to applicable bank process."],
    ],
  },
];

const DEFS = [
  ["MOU / Form F", "MOU is used for Abu Dhabi; Form F is the electronically generated Dubai form containing property, seller, buyer, commission, service-charge and related transaction information."],
  ["Valuation Certificate", "Bank valuation to understand the property's current market value; performed by the bank's respective valuators."],
  ["POA", "Allows a representative to act for an absent buyer/seller at final transfer; must follow UAE requirements."],
  ["Liability Letter", "Letter from the seller's mortgage bank stating the loan outstanding amount."],
  ["SOA", "Developer account statement for a primary transaction showing amounts paid and pending."],
  ["Title Deed", "Land-department document containing property details and, where applicable, mortgage information."],
  ["SPA", "Sale and Purchase Agreement between developer and buyer in a primary transaction."],
  ["NOC", "Developer No Objection Certificate — confirmation that the developer has no objection to the purchase/transfer."],
  ["Verification / Search Certificate", "Certificate used to establish whether a property is mortgaged; used by banks/financial institutions."],
];

const CONTROLS = [
  ["A", "Identify the transaction before building the file", ["Confirm whether the case is Primary, Resale/Secondary, Buyout, Buyout + Equity or applicable Equity/Refinance.", "Use the transaction-specific document framework before submission.", "Do not assume a Title Deed exists for a newly built property — a new-build may not yet have one."]],
  ["B", "Keep the case stage-ready", ["A case is not stage-ready merely because documents have been received.", "The relevant documents must be checked and the next-stage handover condition must be satisfied.", "Received, Verified, Status, Issue and Action are recorded as separate controls."]],
  ["C", "Preserve bank-specific requirements", ["Bank-specific document sets and submission methods must be followed.", "ADIB-specific handling, RAK recipient/CC handling and Huspy submission requirements are separate controls.", "Later chapters expand these into a bank matrix rather than repeating them inconsistently."]],
  ["D", "Separate source-derived requirements from current confirmation", ["Some supplied material is operational/dated — useful working references, but source-derived until confirmed against the current bank/government instruction.", "FOL validity 30/60/90 days → use the expiry stated on the actual FOL.", "MOU validity / extension → check the actual MOU and any extension/addendum.", "Liability Letter validity → check the expiry printed on the letter.", "IDs → ensure validity through transfer day. POA legal approval → plan early."]],
] as [string, string, string[]][];

const QUICKREF = [
  ["What is the overall journey?", "File Intake → Pre-Approval → Valuation → FOL → Signing/DDA → Loan Booking → Liability/Clearance if applicable → Final Transfer → Title Deed/QC → Closure."],
  ["What determines the property document package?", "Transaction type plus bank/government requirements."],
  ["When does a case move from Pre-Approval to Valuation?", "After the Pre-Approval Letter is checked and required property documents are available."],
  ["When does a case move from Valuation to FOL?", "After a positive valuation report and required valuation handover."],
  ["When does a case move toward Final Transfer?", "After FOL controls are satisfied, including correct FOL, signing, DDA and applicable release/booking conditions."],
  ["What is the final completion evidence?", "Transfer completed, Title Deed received and Title Deed quality-check email sent."],
];

const CHAPTERS = ["1 · How to use", "2 · Principles", "3 · Operating model", "4 · Lifecycle", "5 · Handover", "6 · Transaction types", "7 · Documents", "8 · Controls", "9 · Quick reference"];

function Callout({ kind, title, children }: { kind: "control" | "source" | "rule"; title: string; children: React.ReactNode }) {
  const map = {
    control: "border-l-ink bg-ink/4",
    source: "border-l-amber-500 bg-amber-100/40",
    rule: "border-l-pine-600 bg-pine-50/70",
  };
  return (
    <div className={cx("border border-mist border-l-[3px] rounded-r-lg px-4 py-3 my-4", map[kind])}>
      <p className="font-display font-bold text-[11px] uppercase tracking-[0.13em] text-ink-soft mb-1.5">{title}</p>
      <div className="text-[12.5px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

function Section({ id, num, title, children }: { id: number; num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`ch${id}`} className="bg-card border border-mist rounded-lg px-6 py-5 mb-5 anim-up scroll-mt-20">
      <div className="flex items-baseline gap-3.5 mb-4">
        <span className="font-display font-bold text-[30px] leading-none text-pine-700/90 num">{num}</span>
        <h2 className="font-display font-bold text-[19px] tracking-tight">{title}</h2>
      </div>
      <div className="text-[13px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

function Tbl({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto border border-mist rounded-md my-3">
      <table className="w-full text-[12.5px]">
        <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft bg-paper/70 border-b border-mist">{head.map((h) => <th key={h} className="px-3.5 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-mist/60 last:border-0 align-top hover:bg-pine-50/30 transition-colors">{r.map((c, j) => <td key={j} className={cx("px-3.5 py-2.5", j === 0 && "font-semibold whitespace-nowrap")}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function GuideView() {
  const [open, setOpen] = useState(0);
  return (
    <div className="max-w-[1080px] mx-auto">
      {/* cover */}
      <div className="bg-ink text-paper rounded-lg px-7 py-6 mb-5 anim-up relative overflow-hidden sidebar-texture">
        <div className="flex flex-wrap items-start justify-between gap-4 relative">
          <div>
            <p className="text-[10.5px] font-display font-semibold uppercase tracking-[0.16em] text-pine-300">HFMC · Document Control</p>
            <h1 className="font-display font-bold text-[28px] tracking-tight mt-1.5 leading-tight">Mortgage Operations Guide Book</h1>
            <p className="text-[13px] text-paper/70 mt-2 max-w-[560px]">Batch 1 of 8 — Foundation, operating model, mortgage lifecycle and transaction types. Working draft for operational review.</p>
            <div className="flex flex-wrap gap-1.5 mt-3.5">
              {["Batch 1 of 8", "Working draft", "Foundation & lifecycle", "Transaction types"].map((t) => <span key={t} className="text-[10px] font-display font-semibold tracking-wide uppercase border border-paper/25 rounded-full px-2.5 py-1 text-paper/80">{t}</span>)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <Ic n="book" size={54} className="text-pine-300/80" />
            <p className="num text-[11px] text-paper/60 mt-2">Design standard retained<br />across Batches 2–8</p>
          </div>
        </div>
      </div>

      <Callout kind="source" title="Source control">
        This guide consolidates the information supplied for this project. Where the source material contains bank-specific or historical operational requirements, those requirements are presented as <strong>source-derived controls</strong> and must be confirmed against the bank / current internal instruction before live use.
      </Callout>

      {/* chapter nav */}
      <div className="sticky top-[64px] z-20 bg-paper/95 backdrop-blur-sm py-2.5 mb-4 border-b border-mist/70">
        <div className="flex gap-1.5 overflow-x-auto">
          {CHAPTERS.map((c, i) => (
            <a key={c} href={`#ch${i + 1}`} onClick={() => setOpen(i)}
              className={cx("focusable whitespace-nowrap text-[11px] font-display font-semibold px-3 py-1.5 rounded-full border transition-all",
                open === i ? "bg-pine-700 border-pine-700 text-paper shadow-sm" : "bg-card border-mist text-ink-soft hover:border-pine-400")}>
              {c}
            </a>
          ))}
        </div>
      </div>

      <Section id={1} num="1." title="How to Use This Guide">
        <p>The Guide Book is a practical operating manual for the mortgage process — converting training material, operational checklists and working instructions into a consistent reference for the Virtual RM, Pre-Approval, Valuation, FOL, Loan Booking and Final Transfer teams.</p>
        <p className="mt-2.5 font-semibold">What this guide is intended to do:</p>
        <ul className="list-disc pl-5 mt-1.5 space-y-1 text-ink/85">
          <li>Explain the complete case journey from file receipt through final transfer and closure.</li>
          <li>Define the purpose of each stage and the key handover points between teams.</li>
          <li>Separate general process controls from transaction-specific requirements.</li>
          <li>Provide common terminology and structure for later chapters and bank-specific SOPs.</li>
          <li>Reduce dependency on informal or memory-based instructions.</li>
        </ul>
        <p className="mt-4 font-semibold">How the guide will be built:</p>
        <Tbl head={["Batch", "Main coverage", "Status"]} rows={BATCHES.map(([b, c, live]) => [b, c, live ? <span className="text-pine-700 font-display font-bold text-[11px] uppercase tracking-wide">● current</span> : <span className="text-ink-soft">planned</span>])} />
        <Callout kind="rule" title="Consistency rule">All later batches use the same chapter hierarchy, terminology, callout style, table structure and control language established in Batch 1.</Callout>
      </Section>

      <Section id={2} num="2." title="Operating Principles">
        <div className="grid md:grid-cols-2 gap-3">
          {[
            ["2.1", "One case, one controlled journey", "A file is one controlled case moving through defined stages. At every stage the responsible person must know what has been received, what has been verified, what remains outstanding, who owns the next action and what condition must be satisfied before the case moves forward."],
            ["2.2", "Verification before submission", "Do not forward an incomplete package merely because a document is expected later. Verify client information against KYC and the bank forms; verify transaction information against the property documents; use the bank-specific set and format; resolve discrepancies before treating the file as submission-ready."],
            ["2.3", "Transaction type drives the document set", "Required property and transaction documents change with the structure — Primary, Resale, Buyout, Buyout + Equity or otherwise. The transaction type must be identified before the final checklist is prepared."],
            ["2.4", "Stage handover is a control point", "A case moves to the next stage only after the required handover items are available and checked — a handover is not simply an email; it is a transfer of a controlled case with the required evidence."],
          ].map(([n, t, d]) => (
            <div key={n} className="border border-mist rounded-lg p-4 hover:border-pine-400 hover:shadow-sm transition-all">
              <p className="num text-[11px] font-bold text-pine-700">{n}</p>
              <p className="font-display font-bold text-[14px] tracking-tight mt-0.5">{t}</p>
              <p className="text-[12px] text-ink-soft leading-relaxed mt-1.5">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id={3} num="3." title="Mortgage Operations Operating Model">
        <p className="font-semibold mb-1">Core operating roles referenced in the supplied process:</p>
        <Tbl head={["Role / Stage", "Primary operational purpose"]} rows={ROLES} />
        <Callout kind="control" title="Ownership principle">The person responsible for the current stage owns the follow-up until the stage's defined handover condition is satisfied. A handover is not simply an email; it is a transfer of a controlled case with the required evidence.</Callout>
      </Section>

      <Section id={4} num="4." title="Complete Mortgage Lifecycle">
        <Tbl head={["Stage", "Primary objective", "Move-forward condition"]} rows={LIFECYCLE} />
        <p className="font-semibold mt-4 mb-2">Master workflow:</p>
        <div className="ml-1">
          {["FILE RECEIVED", "VIRTUAL RM 1 — FILE PREPARATION", "PRE-APPROVAL CHECK & SUBMISSION", "BANK / HUSPY FOLLOW-UP", "PRE-APPROVAL", "VALUATION & INSPECTION", "FOL CONVERSION & CHECK", "FOL SIGNING / DDA", "LOAN BOOKING", "LIABILITY SETTLEMENT / CLEARANCE (IF APPLICABLE)", "FINAL TRANSFER", "TITLE DEED + QC", "CASE CLOSURE"].map((s, i, arr) => (
            <div key={s}>
              <div className={cx("inline-flex items-center gap-2.5 border rounded-md px-3.5 py-1.5 transition-all hover:shadow-sm",
                i === arr.length - 1 ? "bg-pine-700 border-pine-700 text-paper" : "bg-card border-mist")}>
                <span className={cx("num text-[9.5px] font-bold", i === arr.length - 1 ? "text-paper/70" : "text-pine-700")}>{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display font-bold text-[11px] tracking-[0.04em]">{s}</span>
              </div>
              {i < arr.length - 1 && <div className="ml-5 w-px h-3 bg-pine-400" />}
            </div>
          ))}
        </div>
      </Section>

      <Section id={5} num="5." title="Stage Ownership & Handover Logic">
        <p>The same case may involve multiple operational owners — the handover model defines the minimum evidence at each transfer.</p>
        <Tbl head={["From", "To", "Minimum handover evidence"]} rows={HANDOVERS} />
        <p className="font-semibold mt-4 mb-2">Handover language:</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {LANGUAGE.map(([k, v]) => (
            <div key={k} className="border border-mist rounded-md px-3 py-2.5 hover:border-pine-400 transition-colors">
              <p className="font-display font-bold text-[11px] tracking-[0.1em] text-pine-700">{k}</p>
              <p className="text-[11.5px] text-ink-soft leading-snug mt-1">{v}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id={6} num="6." title="Transaction Types">
        <p className="mb-3">Transaction type determines the property-document package, the parties involved, the settlement mechanics and the final-transfer sequence.</p>
        <div className="space-y-3.5">
          {TX_TYPES.map((t, i) => (
            <details key={t.name} open={i < 2} className="group border border-mist rounded-lg overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between bg-paper/50 hover:bg-paper transition-colors">
                <span className="font-display font-bold text-[13.5px] tracking-tight"><span className="num text-pine-700 mr-2">6.{i + 1}</span>{t.name}</span>
                <Ic n="chevD" size={15} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 py-3">
                <p className="text-[12.5px] text-ink-soft mb-2">{t.desc}</p>
                <Tbl head={["Typical document / control", "Purpose / check"]} rows={t.rows} />
              </div>
            </details>
          ))}
        </div>
        <Callout kind="source" title="Source control — 6.5">The exact classification and document set should follow the selected bank's current product/process. The guide preserves the supplied internal terminology rather than redefining it.</Callout>
      </Section>

      <Section id={7} num="7." title="Transaction-Specific Document Framework">
        <p>The transaction type controls the property package. Key property document definitions from the supplied instructions:</p>
        <Tbl head={["Term", "Source-derived meaning"]} rows={DEFS} />
      </Section>

      <Section id={8} num="8." title="Critical Control Points">
        <div className="space-y-3">
          {CONTROLS.map(([k, t, pts]) => (
            <div key={k} className={cx("border rounded-lg p-4", k === "D" ? "border-amber-500/40 bg-amber-100/25" : "border-mist bg-paper/40")}>
              <p className="font-display font-bold text-[13.5px] tracking-tight"><span className="num text-pine-700 mr-2">8.{["A", "B", "C", "D"].indexOf(k) + 1}</span>Control Point {k} — {t}</p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-[12.5px] text-ink/85">
                {pts.map((p) => <li key={p}>{p}</li>)}
              </ul>
              {k === "D" && <p className="mt-2.5 text-[11px] font-display font-semibold uppercase tracking-[0.1em] text-amber-700">Important — treat as source-derived until confirmed</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section id={9} num="9." title="Batch 1 Quick Reference">
        <Tbl head={["Question", "Answer / Control"]} rows={QUICKREF} />
        <Callout kind="rule" title="Batch 1 — Source notes">
          This batch is based on the user-provided operating instructions and the supplied operational files: the current Pre-Approval workbook, Stage Handover checklist, Valuation Bank Checklist, Final Transfer workbook, FOL/Loan Booking training material and the older mortgage process notes. Where items are dated or bank-specific, they remain flagged for confirmation before live use.
        </Callout>
      </Section>
    </div>
  );
}
