import { useState } from "react";
import type { EmailTemplate } from "../types";
import { useStore } from "../store";
import { Btn, Field, Ic, Pill, SectionHead, TextArea, TextInput, cx, uid } from "../ui";

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea"); ta.value = text;
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
}

const GOLDEN_RULES = [
  "Never submit an incomplete file when a required correction is known.",
  "Always match client details across KYC, Salary Certificate, bank statement, forms and portal.",
  "Always reconcile salary credit with the Salary Certificate; use payslip for variance.",
  "Always identify the transaction type before checking property documents.",
  "Always apply the selected bank's routing and document requirements.",
  "Always retain submission evidence and confirmation.",
  "Always log bank queries and assign an owner.",
  "Follow up according to the supplied stage timelines and do not leave a case without a next action.",
  "Do not expose passwords or confidential credentials in emails, trackers or training documents.",
  "Do not treat a stage as complete until its QC and handover are complete.",
  "At Final Transfer, verify financial/cheque details before the transfer date.",
  "After completion, obtain the title deed and send the required quality-check email.",
];

export default function TemplatesView() {
  const { state, dispatch } = useStore();
  const [edit, setEdit] = useState<EmailTemplate | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  const doCopy = async (t: EmailTemplate) => {
    await copyText(`Subject: ${t.subject}\n\n${t.body}`);
    setCopied(t.id); setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div>
      <SectionHead title="Email Template Library" sub="Batch 8 §127. Copy a template, replace the [bracketed] placeholders with the case details, and send."
        right={<Btn onClick={() => { setIsNew(true); setEdit({ id: "tp" + uid(), name: "", purpose: "", tags: [], subject: "", body: "", source: "Custom" }); }}><Ic n="plus" size={14} /> New template</Btn>} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {state.templates.map((t, i) => (
          <div key={t.id} className="anim-up bg-card border border-mist rounded-lg p-4 flex flex-col hover:shadow-md transition-all" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div>
                <p className="font-display font-bold text-[15px] tracking-tight">{t.name}</p>
                <p className="text-[12px] text-ink-soft mt-0.5">{t.purpose}</p>
              </div>
              <Pill tone="gr">{t.source}</Pill>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {t.tags.map((tag) => <span key={tag} className="text-[10px] font-display font-semibold uppercase tracking-wide bg-pine-100 text-pine-800 rounded px-1.5 py-0.5">{tag}</span>)}
            </div>
            <div className="bg-paper/60 border border-mist rounded-md px-3 py-2.5 mb-2">
              <p className="text-[10.5px] font-display font-semibold uppercase tracking-[0.09em] text-ink-soft mb-0.5">Subject</p>
              <p className="num text-[12.5px] font-semibold text-ink">{t.subject}</p>
            </div>
            <pre className="num text-[11.5px] leading-relaxed whitespace-pre-wrap bg-paper/60 border border-mist rounded-md px-3 py-2.5 flex-1 text-ink/90">{t.body}</pre>
            <div className="flex items-center gap-2 mt-3">
              <Btn size="sm" onClick={() => doCopy(t)}><Ic n={copied === t.id ? "check" : "copy"} size={13} /> {copied === t.id ? "Copied" : "Copy email"}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => { setIsNew(false); setEdit({ ...t }); }}><Ic n="pen" size={13} /> Edit</Btn>
            </div>
          </div>
        ))}
      </div>

      {/* golden rules */}
      <div className="anim-up bg-ink text-paper rounded-lg px-5 py-4 mt-5">
        <div className="flex items-center gap-2 mb-3">
          <Ic n="shield" size={16} className="text-pine-300" />
          <p className="font-display font-bold text-[14px] tracking-tight">Final Golden Rules <span className="text-paper/50 font-body font-normal text-[11.5px]">— Batch 8 §131</span></p>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {GOLDEN_RULES.map((r, i) => (
            <div key={i} className="flex gap-2.5 text-[12px] leading-snug text-paper/85">
              <span className="num shrink-0 w-5 h-5 rounded-full bg-pine-600 text-paper text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* editor modal */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={() => setEdit(null)}>
          <div className="anim-pop bg-card rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-mist flex items-center justify-between">
              <p className="font-display font-bold text-[16px] tracking-tight">{isNew ? "New email template" : `Edit — ${edit.name}`}</p>
              <button className="focusable text-ink-soft hover:text-ink" onClick={() => setEdit(null)}><Ic n="x" size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" req><TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Valuation Follow-Up" /></Field>
                <Field label="Source / reference"><TextInput value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })} placeholder="e.g. Batch 8 §127" /></Field>
              </div>
              <Field label="Purpose"><TextInput value={edit.purpose} onChange={(e) => setEdit({ ...edit, purpose: e.target.value })} placeholder="One line on when to use it" /></Field>
              <Field label="Tags (comma separated)"><TextInput value={edit.tags.join(", ")} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Follow-up, Valuation" /></Field>
              <Field label="Subject" req><TextInput value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} placeholder="Use [Client Name], [Bank] placeholders" /></Field>
              <Field label="Body" req><TextArea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={9} placeholder={"Dear [Bank RM],\n\n…"} /></Field>
            </div>
            <div className="px-5 py-3.5 border-t border-mist flex justify-end gap-2 bg-paper/50">
              <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
              <Btn disabled={!edit.name.trim() || !edit.subject.trim() || !edit.body.trim()} onClick={() => {
                dispatch({ t: "SAVE_TEMPLATE", template: edit, isNew });
                setEdit(null);
              }}><Ic n="check" size={13} /> {isNew ? "Create template" : "Save changes"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
