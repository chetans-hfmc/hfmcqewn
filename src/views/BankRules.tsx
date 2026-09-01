import { useMemo, useState } from "react";
import type {
  AxisDef, EligGate, HighRiskBand, ProductDef, ProductVersion, Promo, RateCell, RateIndex, RateStructure, TxType,
} from "../types";
import { useMe, useStore } from "../store";
import { cellRate, cellRecipe, currentEiborFix } from "../decision";
import {
  Btn, DangerModal, DateInput, Field, Ic, Modal, NumInput, Pill, Select, TextArea, TextInput,
  cx, fmtDate, nowISO, todayISO, uid,
} from "../ui";

/* ============================================================
   BANK RULE ENGINE — full CRUD for admin.
   Everything that matters is editable, explained in plain English,
   and nothing goes live until a version is activated.
   ============================================================ */

const STATUS_TONE: Record<string, string> = { DRAFT: "gr", SCHEDULED: "steel", ACTIVE: "pine", RETIRED: "amber" };

const STRUCTURES: { v: RateStructure; l: string; d: string }[] = [
  { v: "FIXED", l: "Fixed rate", d: "One flat rate for the whole fixed period" },
  { v: "MARGIN_INDEX", l: "Variable (margin + EIBOR)", d: "Rate = margin + EIBOR, with an optional floor" },
  { v: "FIXED_THEN_VAR", l: "Fixed, then variable", d: "Fixed rate first, then margin + EIBOR afterwards" },
  { v: "VAR_DAY1", l: "Variable from day 1", d: "margin + EIBOR starting immediately" },
];
const INDICES: { v: RateIndex; l: string }[] = [
  { v: "EIBOR_1M", l: "1-month EIBOR" }, { v: "EIBOR_3M", l: "3-month EIBOR" },
  { v: "EIBOR_6M", l: "6-month EIBOR" }, { v: "EIBOR_1Y", l: "1-year EIBOR" },
];
const LOAN_TYPES = [{ v: "ISLAMIC", l: "Islamic" }, { v: "CONVENTIONAL", l: "Conventional" }, { v: "BOTH", l: "Both" }];
const CLASSES = [{ v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self Employed" }];
const TX_TYPES: { v: TxType; l: string }[] = [
  { v: "PURCHASE", l: "Purchase" }, { v: "BUYOUT", l: "Buyout" }, { v: "BUYOUT_EQUITY", l: "Buyout + Equity" }, { v: "EQUITY", l: "Equity Release" },
];
const GATE_KINDS = [
  { v: "FLAG", l: "Policy note / condition" },
  { v: "NATIONALITY_ALLOW", l: "Only these nationalities allowed" },
  { v: "NATIONALITY_BLOCK", l: "These nationalities blocked" },
  { v: "EMPLOYMENT_BLOCK", l: "Employment type blocked" },
];
const WHEN_OPTS = [
  { v: "", l: "Everyone" }, { v: "SALARIED", l: "Salaried only" }, { v: "SELF_EMPLOYED", l: "Self-employed only" },
  { v: "RESIDENT", l: "Residents only" }, { v: "NON_RESIDENT", l: "Non-residents only" },
];

function axisLabel(defs: AxisDef[], axisId: string, val: string): string {
  const ax = defs.find((a) => a.id === axisId);
  return ax?.values.find((v) => v.v === val)?.l ?? val;
}

const blankPv = (): ProductVersion => ({
  version: 1, status: "DRAFT", createdAt: nowISO(),
  eligibility: { gates: [], ltvMatrix: {} }, tenure: { maxMonths: 300 }, grid: { cells: [] },
  fees: {}, affordability: { maxDBR: 50, ccPct: 5 }, documents: [], tat: {},
});

/* ---------- tiny atoms ---------- */
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] italic text-ink-soft leading-snug mt-1">{children}</p>;
}
/* little badge marking a field the decision engine actually computes with */
function Exec({ label = "engine uses this" }: { label?: string }) {
  return <span className="tip tip-b inline-flex items-center gap-1 text-[9px] font-display font-bold uppercase tracking-[0.08em] text-pine-700 bg-pine-100 rounded px-1.5 py-[2px] cursor-help" data-tip="This value is read by the Decision Engine when it works out eligibility, rate and amounts">{label}</span>;
}
function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={() => onChange(!value)}
      className={cx("focusable relative w-10 h-[22px] rounded-full transition-colors", value ? "bg-pine-600" : "bg-mist", disabled && "opacity-50 cursor-not-allowed")}>
      <span className={cx("absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all", value ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}
function SectionCard({ title, icon, hint, right, children, defaultOpen = true, badge }: {
  title: string; icon: string; hint?: string; right?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-mist rounded-lg overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-mist/70 bg-paper/50">
        <button onClick={() => setOpen(!open)} className="focusable flex items-center gap-2.5 flex-1 text-left">
          <span className="w-7 h-7 rounded-md bg-pine-700 text-paper flex items-center justify-center shrink-0"><Ic n={icon} size={14} /></span>
          <span className="font-display font-bold text-[14px] tracking-tight">{title}</span>
          {badge}
          <Ic n="chevD" size={14} className={cx("ml-auto text-ink-soft transition-transform", !open && "-rotate-90")} />
        </button>
        {right}
      </div>
      {open && (
        <div className="px-4 py-4 anim-tick">
          {hint && <Hint>{hint}</Hint>}
          <div className="mt-2">{children}</div>
        </div>
      )}
    </div>
  );
}
function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Btn variant="outline" size="sm" onClick={onClick}><Ic n="plus" size={13} /> {label}</Btn>
  );
}
function RowActions({ onEdit, onDel }: { onEdit?: () => void; onDel?: () => void }) {
  return (
    <span className="flex items-center gap-1 shrink-0">
      {onEdit && <button onClick={onEdit} className="focusable p-1.5 rounded-md text-ink-soft hover:text-pine-700 hover:bg-pine-50 transition-colors" title="Edit"><Ic n="edit" size={14} /></button>}
      {onDel && <button onClick={onDel} className="focusable p-1.5 rounded-md text-ink-soft hover:text-rust-600 hover:bg-rust-100 transition-colors" title="Delete"><Ic n="trash" size={14} /></button>}
    </span>
  );
}

/* key → number matrix editor (LTV, min salary, max loan, valuation by emirate…) */
function MatrixEditor({ data, onChange, suffix, keyPlaceholder, disabled, addLabel = "Add row" }: {
  data: Record<string, number>; onChange: (d: Record<string, number>) => void; suffix: string;
  keyPlaceholder: string; disabled?: boolean; addLabel?: string;
}) {
  const [k, setK] = useState(""); const [v, setV] = useState(0);
  const entries = Object.entries(data);
  return (
    <div>
      <div className="space-y-1.5">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="num text-[11px] font-semibold bg-steel-100 text-steel-700 rounded px-2 py-1 min-w-[120px]">{key}</span>
            {disabled
              ? <span className="num font-bold text-pine-700">{val}{suffix}</span>
              : <span className="w-[110px]"><NumInput value={val} onChange={(n) => onChange({ ...data, [key]: n })} suffix={suffix} /></span>}
            {!disabled && (
              <button onClick={() => { const d = { ...data }; delete d[key]; onChange(d); }} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={13} /></button>
            )}
          </div>
        ))}
        {entries.length === 0 && <p className="text-[11.5px] text-ink-soft italic">No rows yet.</p>}
      </div>
      {!disabled && (
        <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-mist/60">
          <TextInput className="w-[150px] h-[30px] text-[12px]" value={k} onChange={(e) => setK(e.target.value)} placeholder={keyPlaceholder} />
          <span className="w-[110px]"><NumInput value={v} onChange={setV} suffix={suffix} /></span>
          <Btn size="sm" variant="outline" disabled={!k.trim()} onClick={() => { onChange({ ...data, [k.trim().toUpperCase()]: v }); setK(""); setV(0); }}>
            <Ic n="plus" size={12} /> {addLabel}
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ---------- modal editors ---------- */
function RateCellEditor({ open, onClose, axes, cell, onSave, supportedTx }: {
  open: boolean; onClose: () => void; axes: AxisDef[]; cell: RateCell; onSave: (c: RateCell) => void; supportedTx?: TxType[];
}) {
  const [c, setC] = useState(cell);
  const setKey = (axisId: string, val: string) => {
    const key = { ...c.key };
    if (val) key[axisId] = val; else delete key[axisId];
    setC({ ...c, key });
  };
  const set = (patch: Partial<RateCell>) => setC({ ...c, ...patch });
  const isFixed = c.structure === "FIXED" || c.structure === "FIXED_THEN_VAR";
  const isVar = c.structure === "MARGIN_INDEX" || c.structure === "VAR_DAY1";
  return (
    <Modal open={open} onClose={onClose} title="Rate cell — who gets what rate" width={620}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(c)}><Ic n="check" size={14} /> Save cell</Btn></>}>
      <Hint>A “rate cell” is one line of the bank's pricing grid. First say <strong>who</strong> it applies to, then the <strong>rate recipe</strong>. Leave a “who” box empty to mean “everyone”.</Hint>
      <div className="mt-3 space-y-4">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-1.5">Who does this rate apply to?</p>
          <div className="grid grid-cols-2 gap-2.5">
            {axes.map((ax) => {
              /* For the transaction axis, only offer the types the product actually supports. */
              const vals = ax.id === "transaction" && supportedTx
                ? ax.values.filter((v) => supportedTx.includes(v.v as TxType))
                : ax.values;
              return (
                <Field key={ax.id} label={ax.id === "transaction" ? `${ax.name} (from Supported transactions)` : ax.name}>
                  <Select value={c.key[ax.id] ?? ""} onChange={(v) => setKey(ax.id, v)}
                    options={[{ v: "", l: "Anyone" }, ...vals.map((v) => ({ v: v.v, l: v.l }))]} />
                </Field>
              );
            })}
            {axes.length === 0 && <p className="text-[11.5px] text-ink-soft italic col-span-2">This product has no pricing axes — the cell applies to everyone.</p>}
          </div>
        </div>
        <Field label="Rate type" hint={STRUCTURES.find((s) => s.v === c.structure)?.d}>
          <Select value={c.structure} onChange={(v) => set({ structure: v as RateStructure })} options={STRUCTURES.map((s) => ({ v: s.v, l: s.l }))} />
        </Field>
        {isFixed && (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Fixed rate (%)"><NumInput value={c.fixedRate ?? 0} onChange={(n) => set({ fixedRate: n })} suffix="%" /></Field>
            <Field label="Fixed for (months)"><NumInput value={c.fixedMonths ?? 0} onChange={(n) => set({ fixedMonths: n })} suffix="mo" /></Field>
          </div>
        )}
        {isVar && (
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Margin (%)"><NumInput value={c.margin ?? 0} onChange={(n) => set({ margin: n })} suffix="%" /></Field>
            <Field label="Plus which EIBOR?"><Select value={c.index ?? "EIBOR_3M"} onChange={(v) => set({ index: v as RateIndex })} options={INDICES} /></Field>
            <Field label="Floor rate (%)"><NumInput value={c.floor ?? 0} onChange={(n) => set({ floor: n || undefined })} suffix="%" /></Field>
          </div>
        )}
        {c.structure === "FIXED_THEN_VAR" && (
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-1.5">After the fixed period…</p>
            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Margin (%)"><NumInput value={c.followOn?.margin ?? 0} onChange={(n) => set({ followOn: { margin: n, index: c.followOn?.index ?? "EIBOR_3M", floor: c.followOn?.floor } })} suffix="%" /></Field>
              <Field label="Plus which EIBOR?"><Select value={c.followOn?.index ?? "EIBOR_3M"} onChange={(v) => set({ followOn: { margin: c.followOn?.margin ?? 0, index: v as RateIndex, floor: c.followOn?.floor } })} options={INDICES} /></Field>
              <Field label="Floor (%)"><NumInput value={c.followOn?.floor ?? 0} onChange={(n) => set({ followOn: { margin: c.followOn?.margin ?? 0, index: c.followOn?.index ?? "EIBOR_3M", floor: n || undefined } })} suffix="%" /></Field>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Stress rate for DSR (%)" hint="Optional — the rate the bank uses to test affordability"><NumInput value={c.stressRate ?? 0} onChange={(n) => set({ stressRate: n || undefined })} suffix="%" /></Field>
          <Field label="Note"><TextInput value={c.note ?? ""} onChange={(e) => set({ note: e.target.value || undefined })} placeholder="e.g. campaign rate" /></Field>
        </div>
      </div>
    </Modal>
  );
}

function GateEditor({ open, onClose, gate, onSave }: { open: boolean; onClose: () => void; gate: EligGate; onSave: (g: EligGate) => void }) {
  const [g, setG] = useState(gate);
  const set = (p: Partial<EligGate>) => setG({ ...g, ...p });
  const needsValues = g.kind === "NATIONALITY_ALLOW" || g.kind === "NATIONALITY_BLOCK";
  return (
    <Modal open={open} onClose={onClose} title="Eligibility rule" width={560}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!g.label.trim()} onClick={() => onSave(g)}><Ic n="check" size={14} /> Save rule</Btn></>}>
      <Hint>Rules the bank applies before it will lend. “Hard stop” blocks the client outright; otherwise it's flagged for review.</Hint>
      <div className="mt-3 space-y-3.5">
        <Field label="Rule type"><Select value={g.kind} onChange={(v) => set({ kind: v as EligGate["kind"] })} options={GATE_KINDS} /></Field>
        <Field label="Describe the rule" req><TextInput value={g.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Min business age 2 years for self-employed" /></Field>
        {needsValues && (
          <Field label="Nationalities (comma separated)"><TextInput value={(g.values ?? []).join(", ")} onChange={(e) => set({ values: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Iran, Syria" /></Field>
        )}
        <Field label="Applies to"><Select value={g.when ?? ""} onChange={(v) => set({ when: v || undefined })} options={WHEN_OPTS} /></Field>
        <div className="flex items-center gap-3">
          <Toggle value={g.hardStop} onChange={(v) => set({ hardStop: v })} />
          <span className="text-[12.5px] font-medium">{g.hardStop ? "Hard stop — block the client" : "Soft flag — refer for review"}</span>
        </div>
      </div>
    </Modal>
  );
}

function BandEditor({ open, onClose, band, onSave }: { open: boolean; onClose: () => void; band: HighRiskBand; onSave: (b: HighRiskBand) => void }) {
  const [b, setB] = useState(band);
  const set = (p: Partial<HighRiskBand>) => setB({ ...b, ...p });
  return (
    <Modal open={open} onClose={onClose} title="High-risk band" width={560}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(b)}><Ic n="check" size={14} /> Save band</Btn></>}>
      <Hint>Clients in this band get their LTV capped. If several bands match, the strictest (lowest LTV) wins.</Hint>
      <div className="mt-3 space-y-3.5">
        <Field label="LTV cap for this band (%)"><NumInput value={b.ltv} onChange={(n) => set({ ltv: n })} suffix="%" /></Field>
        <Field label="Nationalities in band (comma separated)"><TextInput value={(b.nationalities ?? []).join(", ")} onChange={(e) => set({ nationalities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Iranian, Israeli" /></Field>
        <Field label="Sectors in band (comma separated)"><TextInput value={b.sectors.join(", ")} onChange={(e) => set({ sectors: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Jewelry, Real Estate" /></Field>
        <Field label="Matching keywords (optional)"><TextInput value={(b.sectorKeywords ?? []).join(", ")} onChange={(e) => set({ sectorKeywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. jewelry, developer" /></Field>
        <div className="flex items-center gap-3">
          <Toggle value={b.topDeveloperExempt ?? false} onChange={(v) => set({ topDeveloperExempt: v })} />
          <span className="text-[12.5px] font-medium">Exempt approved top developers from this band</span>
        </div>
      </div>
    </Modal>
  );
}

function DiscountEditor({ open, onClose, item, onSave }: { open: boolean; onClose: () => void; item: { maxLtv: number; bps: number; label?: string }; onSave: (d: { maxLtv: number; bps: number; label?: string }) => void }) {
  const [d, setD] = useState(item);
  return (
    <Modal open={open} onClose={onClose} title="Low-LTV rate discount" width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(d)}><Ic n="check" size={14} /> Save discount</Btn></>}>
      <Hint>If the client's LTV is at or below the threshold, knock this many basis points off the rate.</Hint>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Field label="When LTV is at or below (%)"><NumInput value={d.maxLtv} onChange={(n) => setD({ ...d, maxLtv: n })} suffix="%" /></Field>
        <Field label="Discount (basis points)"><NumInput value={d.bps} onChange={(n) => setD({ ...d, bps: n })} suffix="bps" /></Field>
        <div className="col-span-2"><Field label="Label"><TextInput value={d.label ?? ""} onChange={(e) => setD({ ...d, label: e.target.value || undefined })} placeholder="e.g. LTV ≤ 60% discount" /></Field></div>
      </div>
    </Modal>
  );
}

function EmpDiscEditor({ open, onClose, item, onSave }: { open: boolean; onClose: () => void; item: { label: string; employers: string[]; bps: number }; onSave: (d: { label: string; employers: string[]; bps: number }) => void }) {
  const [d, setD] = useState(item);
  return (
    <Modal open={open} onClose={onClose} title="Employer rate discount" width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!d.label.trim()} onClick={() => onSave(d)}><Ic n="check" size={14} /> Save discount</Btn></>}>
      <Hint>Clients who work for one of these employers get this many basis points off the rate.</Hint>
      <div className="mt-3 space-y-3.5">
        <Field label="Label" req><TextInput value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} placeholder="e.g. Approved companies −0.25%" /></Field>
        <Field label="Employers (comma separated)"><TextInput value={d.employers.join(", ")} onChange={(e) => setD({ ...d, employers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. ADNOC, Emirates, RTA" /></Field>
        <Field label="Discount (basis points)"><NumInput value={d.bps} onChange={(n) => setD({ ...d, bps: n })} suffix="bps" /></Field>
      </div>
    </Modal>
  );
}

function TierEditor({ open, onClose, item, onSave }: { open: boolean; onClose: () => void; item: { label: string; pct: number }; onSave: (d: { label: string; pct: number }) => void }) {
  const [d, setD] = useState(item);
  return (
    <Modal open={open} onClose={onClose} title="Processing fee tier" width={460}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!d.label.trim()} onClick={() => onSave(d)}><Ic n="check" size={14} /> Save tier</Btn></>}>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Field label="Tier label" req><TextInput value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} placeholder="e.g. Golden Visa" /></Field>
        <Field label="Fee (%)"><NumInput value={d.pct} onChange={(n) => setD({ ...d, pct: n })} suffix="%" /></Field>
      </div>
    </Modal>
  );
}

function TxOverrideEditor({ open, onClose, item, onSave }: { open: boolean; onClose: () => void; item: { txType: TxType; processingPct?: number; valuationWaived?: boolean; note?: string }; onSave: (d: { txType: TxType; processingPct?: number; valuationWaived?: boolean; note?: string }) => void }) {
  const [d, setD] = useState(item);
  return (
    <Modal open={open} onClose={onClose} title="Transaction fee override" width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(d)}><Ic n="check" size={14} /> Save override</Btn></>}>
      <Hint>Override the standard processing fee for one transaction type (e.g. buyout is free).</Hint>
      <div className="mt-3 space-y-3.5">
        <Field label="Transaction type"><Select value={d.txType} onChange={(v) => setD({ ...d, txType: v as TxType })} options={TX_TYPES} /></Field>
        <Field label="Processing fee (%)"><NumInput value={d.processingPct ?? 0} onChange={(n) => setD({ ...d, processingPct: n })} suffix="%" /></Field>
        <div className="flex items-center gap-3">
          <Toggle value={d.valuationWaived ?? false} onChange={(v) => setD({ ...d, valuationWaived: v })} />
          <span className="text-[12.5px] font-medium">Waive the valuation fee</span>
        </div>
        <Field label="Note"><TextInput value={d.note ?? ""} onChange={(e) => setD({ ...d, note: e.target.value || undefined })} /></Field>
      </div>
    </Modal>
  );
}

function DocEditor({ open, onClose, item, onSave }: { open: boolean; onClose: () => void; item: { name: string; required: boolean; note?: string }; onSave: (d: { name: string; required: boolean; note?: string }) => void }) {
  const [d, setD] = useState(item);
  return (
    <Modal open={open} onClose={onClose} title="Required document" width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!d.name.trim()} onClick={() => onSave(d)}><Ic n="check" size={14} /> Save document</Btn></>}>
      <div className="mt-3 space-y-3.5">
        <Field label="Document name" req><TextInput value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Salary Certificate (within 30 days)" /></Field>
        <Field label="Note"><TextInput value={d.note ?? ""} onChange={(e) => setD({ ...d, note: e.target.value || undefined })} /></Field>
        <div className="flex items-center gap-3">
          <Toggle value={d.required} onChange={(v) => setD({ ...d, required: v })} />
          <span className="text-[12.5px] font-medium">{d.required ? "Required" : "Optional"}</span>
        </div>
      </div>
    </Modal>
  );
}

function PromoEditor({ open, onClose, promo, banks, onSave }: { open: boolean; onClose: () => void; promo: Promo; banks: { v: string; l: string }[]; onSave: (p: Promo) => void }) {
  const [p, setP] = useState(promo);
  return (
    <Modal open={open} onClose={onClose} title="Promotion / campaign" width={540}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!p.name.trim()} onClick={() => onSave(p)}><Ic n="check" size={14} /> Save promo</Btn></>}>
      <Hint>A time-boxed offer. It shows on matching proposals while it's between its start and end dates.</Hint>
      <div className="mt-3 space-y-3.5">
        <Field label="Promo name" req><TextInput value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. Buyout campaign — 3.99%" /></Field>
        <Field label="Bank"><Select value={p.bankId ?? ""} onChange={(v) => setP({ ...p, bankId: v || undefined })} options={[{ v: "", l: "All banks" }, ...banks]} /></Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="From"><DateInput value={p.from} onChange={(e) => setP({ ...p, from: e.target.value })} /></Field>
          <Field label="To (optional)"><DateInput value={p.to ?? ""} onChange={(e) => setP({ ...p, to: e.target.value || undefined })} /></Field>
        </div>
        <Field label="Summary"><TextArea rows={3} value={p.summary} onChange={(e) => setP({ ...p, summary: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function AxisEditor({ open, onClose, axis, onSave }: { open: boolean; onClose: () => void; axis: AxisDef; onSave: (a: AxisDef) => void }) {
  const [a, setA] = useState(axis);
  const [nv, setNv] = useState(""); const [nl, setNl] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Pricing axis" width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!a.name.trim()} onClick={() => onSave(a)}><Ic n="check" size={14} /> Save axis</Btn></>}>
      <Hint>An axis is a way the bank splits its pricing — like “salaried vs self-employed” or “1-yr vs 3-yr fixed”. Add the possible values below.</Hint>
      <div className="mt-3 space-y-3.5">
        <Field label="Axis name" req><TextInput value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="e.g. Employment" /></Field>
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-1.5">Values</p>
          <div className="space-y-1.5">
            {a.values.map((v) => (
              <div key={v.v} className="flex items-center gap-2">
                <TextInput className="w-[120px] h-[30px] text-[12px]" value={v.v} onChange={(e) => setA({ ...a, values: a.values.map((x) => x.v === v.v ? { ...x, v: e.target.value } : x) })} />
                <TextInput className="flex-1 h-[30px] text-[12px]" value={v.l} onChange={(e) => setA({ ...a, values: a.values.map((x) => x.v === v.v ? { ...x, l: e.target.value } : x) })} />
                <button onClick={() => setA({ ...a, values: a.values.filter((x) => x.v !== v.v) })} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={13} /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-mist/60">
            <TextInput className="w-[120px] h-[30px] text-[12px]" value={nv} onChange={(e) => setNv(e.target.value)} placeholder="code e.g. SE" />
            <TextInput className="flex-1 h-[30px] text-[12px]" value={nl} onChange={(e) => setNl(e.target.value)} placeholder="label e.g. Self Employed" />
            <Btn size="sm" variant="outline" disabled={!nv.trim() || !nl.trim()} onClick={() => { setA({ ...a, values: [...a.values, { v: nv.trim(), l: nl.trim() }] }); setNv(""); setNl(""); }}><Ic n="plus" size={12} /> Add</Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================ MAIN VIEW */
export default function BankRulesView() {
  const { state, dispatch } = useStore();
  const me = useMe();
  const [bankF, setBankF] = useState("ALL");
  const [selDef, setSelDef] = useState<string | null>(state.productDefs[0]?.id ?? null);
  const [selVer, setSelVer] = useState<number | null>(null);
  const [tab, setTab] = useState("grid");
  const [showHelp, setShowHelp] = useState(true);
  const [draftPv, setDraftPv] = useState<ProductVersion | null>(null);
  /* Read-only by default: an admin must click "Edit" before any field unlocks, so an
     accidental click on a dropdown while browsing can never silently start a change. */
  const [editMode, setEditMode] = useState(false);
  const [delDef, setDelDef] = useState<ProductDef | null>(null);
  const [delAxis, setDelAxis] = useState<AxisDef | null>(null);
  const [newProd, setNewProd] = useState(false);
  const [showPromos, setShowPromos] = useState(false);
  const [showAxes, setShowAxes] = useState(false);
  // modal editors
  const [cellModal, setCellModal] = useState<{ cell: RateCell; idx: number } | null>(null);
  const [gateModal, setGateModal] = useState<{ gate: EligGate; idx: number } | null>(null);
  const [bandModal, setBandModal] = useState<{ band: HighRiskBand; idx: number } | null>(null);
  const [discModal, setDiscModal] = useState<{ item: { maxLtv: number; bps: number; label?: string }; idx: number } | null>(null);
  const [empModal, setEmpModal] = useState<{ item: { label: string; employers: string[]; bps: number }; idx: number } | null>(null);
  const [tierModal, setTierModal] = useState<{ item: { label: string; pct: number }; idx: number } | null>(null);
  const [txModal, setTxModal] = useState<{ item: { txType: TxType; processingPct?: number; valuationWaived?: boolean; note?: string }; idx: number } | null>(null);
  const [docModal, setDocModal] = useState<{ item: { name: string; required: boolean; note?: string }; idx: number } | null>(null);
  const [promoModal, setPromoModal] = useState<{ promo: Promo; isNew: boolean } | null>(null);
  const [axisModal, setAxisModal] = useState<{ axis: AxisDef; isNew: boolean } | null>(null);

  const eibor = currentEiborFix(state.eibor);
  const isAdmin = me?.role === "ADMIN" || me?.role === "HEAD";

  const defs = useMemo(() => state.productDefs.filter((p) => (bankF === "ALL" ? true : p.bankId === bankF)), [state.productDefs, bankF]);
  const prod = state.productDefs.find((p) => p.id === selDef) ?? defs[0] ?? null;
  const activeVer = prod ? prod.versions.find((v) => v.status === "ACTIVE") ?? [...prod.versions].sort((a, b) => b.version - a.version)[0] : null;
  const ver = draftPv ?? (prod ? (selVer != null ? prod.versions.find((v) => v.version === selVer) ?? activeVer : activeVer) : null);
  const editable = isAdmin && ver != null && editMode;

  /* Dirty detection: the Save button should only ever appear once a *real* change has
     been made. Compare the draft against the version it was forked from, ignoring the
     bookkeeping fields (version number, status, effective date, created time) that
     ensureDraft() legitimately bumps when forking an ACTIVE/RETIRED version. */
  const stripMeta = (p: ProductVersion) => {
    const { version: _v, status: _s, effectiveFrom: _e, createdAt: _c, ...rest } = p;
    return rest;
  };
  const baselineVer = prod
    ? (draftPv
        ? (prod.versions.find((v) => v.version === draftPv.version) ??
           prod.versions.find((v) => v.version === draftPv.version - 1) ?? activeVer)
        : (selVer != null ? prod.versions.find((v) => v.version === selVer) ?? activeVer : activeVer))
    : null;
  const isDirty = useMemo(() => {
    if (!draftPv || !baselineVer) return false;
    return JSON.stringify(stripMeta(draftPv)) !== JSON.stringify(stripMeta(baselineVer));
  }, [draftPv, baselineVer]); // eslint-disable-line react-hooks/exhaustive-deps

  /* start / continue editing the current version as a draft */
  const ensureDraft = (): ProductVersion | null => {
    if (draftPv) return draftPv;
    if (!ver) return null;
    const d: ProductVersion = JSON.parse(JSON.stringify(ver));
    if (d.status === "ACTIVE" || d.status === "RETIRED") { d.status = "DRAFT"; d.version = (activeVer?.version ?? 0) + 1; d.effectiveFrom = undefined; }
    setDraftPv(d);
    return d;
  };
  const setPv = (patch: Partial<ProductVersion>) => {
    if (!editable) return;
    const base = ensureDraft();
    if (!base) return;
    setDraftPv({ ...base, ...patch });
  };
  const setElig = (p: Partial<ProductVersion["eligibility"]>) => { const b = ensureDraft(); if (b) setDraftPv({ ...b, eligibility: { ...b.eligibility, ...p } }); };
  const setFees = (p: Partial<ProductVersion["fees"]>) => { const b = ensureDraft(); if (b) setDraftPv({ ...b, fees: { ...b.fees, ...p } }); };
  const setTenure = (p: Partial<ProductVersion["tenure"]>) => { const b = ensureDraft(); if (b) setDraftPv({ ...b, tenure: { ...b.tenure, ...p } }); };
  const setAfford = (p: Partial<ProductVersion["affordability"]>) => { const b = ensureDraft(); if (b) setDraftPv({ ...b, affordability: { ...b.affordability, ...p } }); };
  const setTat = (p: Partial<ProductVersion["tat"]>) => { const b = ensureDraft(); if (b) setDraftPv({ ...b, tat: { ...b.tat, ...p } }); };
  const setGrid = (cells: RateCell[]) => { const b = ensureDraft(); if (b) setDraftPv({ ...b, grid: { cells } }); };
  const setDocs = (docs: ProductVersion["documents"]) => { const b = ensureDraft(); if (b) setDraftPv({ ...b, documents: docs }); };

  /* Consistency check: every axis/value a rate-grid row uses must be attached to the
     product (axes) and, for transactions, be one of the product's supported types. */
  const gridWarnings = useMemo(() => {
    if (!prod || !ver) return [] as string[];
    const out: string[] = [];
    const axisName = (id: string) => state.axes.find((a) => a.id === id)?.name ?? id;
    ver.grid.cells.forEach((cell, i) => {
      Object.entries(cell.key).forEach(([axisId, val]) => {
        if (!prod.axes.includes(axisId))
          out.push(`Row ${i + 1} uses the “${axisName(axisId)}” axis, but it isn't attached to this product's pricing axes — add it above or remove it from the row.`);
        else if (axisId === "transaction" && !prod.txTypes.includes(val as TxType))
          out.push(`Row ${i + 1} prices “${axisName("transaction")}: ${val}”, but that type isn't in the product's Supported transactions — tick it above.`);
      });
    });
    return [...new Set(out)];
  }, [prod, ver, state.axes]);

  const saveDraft = () => {
    if (!prod || !draftPv) return;
    const isNew = !prod.versions.some((v) => v.version === draftPv.version);
    dispatch({ t: "SAVE_PV", productId: prod.id, pv: draftPv, isNew });
    setDraftPv(null); setSelVer(draftPv.version);
  };
  const discardDraft = () => { setDraftPv(null); };

  const saveProdMeta = (patch: Partial<ProductDef>) => {
    if (!prod || !isAdmin) return;
    dispatch({ t: "SAVE_PRODUCT_DEF", def: { ...prod, ...patch } });
  };

  const prodAxes = prod ? prod.axes.map((id) => state.axes.find((a) => a.id === id)).filter(Boolean) as AxisDef[] : [];
  const bankOpts = state.banks.map((b) => ({ v: b.id, l: b.short }));

  const GROUPS = [
    { id: "grid", l: "Rate Grid", i: "calc" },
    { id: "elig", l: "Eligibility", i: "shield" },
    { id: "risk", l: "High-Risk Bands", i: "alert" },
    { id: "income", l: "Income Rules", i: "pulse" },
    { id: "fees", l: "Fees & Discounts", i: "scale" },
    { id: "afford", l: "Affordability", i: "target" },
    { id: "docs", l: "Documents", i: "file" },
    { id: "tat", l: "Turnaround (TAT)", i: "timer" },
    { id: "tenure", l: "Tenure & Notes", i: "clock" },
  ];

  const e = ver?.eligibility;
  const f = ver?.fees;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="anim-up flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[24px] tracking-tight">Bank Rule Engine</h1>
          <p className="text-[12.5px] text-ink-soft mt-0.5">
            Add and change every bank rule here — no coding needed. EIBOR {eibor ? `3M = ${eibor.m3}%` : "not published (pricing will show Unknown)"}.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="outline" size="sm" onClick={() => setShowAxes(true)}><Ic n="sliders" size={13} /> Pricing axes ({state.axes.length})</Btn>
          <Btn variant="outline" size="sm" onClick={() => setShowPromos(true)}><Ic n="timer" size={13} /> Promos ({state.promos.length})</Btn>
          {isAdmin && <Btn variant="outline" size="sm" onClick={() => setNewProd(true)}><Ic n="plus" size={13} /> New product</Btn>}
          <Btn variant="ghost" size="sm" onClick={() => setShowHelp(!showHelp)}><Ic n="help" size={13} /> {showHelp ? "Hide guide" : "How it works"}</Btn>
        </div>
      </div>

      {/* layman guide */}
      {showHelp && (
        <div className="anim-up rounded-lg border border-pine-200 bg-pine-50/60 px-4 py-3.5">
          <p className="font-display font-bold text-[13px] text-pine-800 mb-2 flex items-center gap-2"><Ic n="book" size={15} /> How to change a bank rule (3 steps)</p>
          <ol className="grid md:grid-cols-3 gap-3">
            {[
              ["1 · Pick the product", "Choose the bank on the left, then the product (e.g. “Home Finance — Salaried”)."],
              ["2 · Edit any field", "Open a section, change a number, or press an “Add” button. You're editing a private draft — nothing is live yet."],
              ["3 · Save, then Activate", "Press “Save draft”, then “Activate” to make it live. The old version is kept for history."],
            ].map(([t, d]) => (
              <li key={t}><p className="text-[12px] font-bold text-pine-800">{t}</p><p className="text-[11.5px] text-pine-800/80 leading-snug mt-0.5">{d}</p></li>
            ))}
          </ol>
          <p className="text-[11px] text-pine-800/70 mt-2.5 flex items-center gap-1.5"><Ic n="spark" size={12} /> Green “engine uses this” badges mark the fields the Decision Engine actually calculates with.</p>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-4 items-start">
        {/* bank → product tree */}
        <div className="lg:col-span-3 anim-up bg-card border border-mist rounded-lg p-3 lg:sticky lg:top-4">
          <p className="text-[10.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mb-2 px-1">Bank → Product</p>
          <button onClick={() => setBankF("ALL")} className={cx("focusable w-full text-left px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-colors", bankF === "ALL" ? "bg-ink text-paper" : "hover:bg-paper/70")}>All banks</button>
          {state.banks.map((b) => {
            const prods = state.productDefs.filter((p) => p.bankId === b.id);
            return (
              <div key={b.id}>
                <button onClick={() => setBankF(bankF === b.id ? "ALL" : b.id)}
                  className={cx("focusable w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-colors mt-0.5", bankF === b.id ? "bg-pine-700 text-paper" : "hover:bg-paper/70")}>
                  <span>{b.short}</span><span className={cx("num text-[10px]", bankF === b.id ? "text-pine-200" : "text-ink-soft")}>{prods.length}</span>
                </button>
                {(bankF === b.id || bankF === "ALL") && prods.map((p) => (
                  <button key={p.id} onClick={() => { setSelDef(p.id); setSelVer(null); setDraftPv(null); }}
                    className={cx("focusable w-full text-left pl-6 pr-2 py-1.5 rounded-md text-[11.5px] transition-colors", prod?.id === p.id ? "bg-pine-50 text-pine-800 font-semibold" : "text-ink-soft hover:bg-paper/70")}>
                    {p.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* product editor */}
        <div className="lg:col-span-9 space-y-3">
          {prod && ver ? (
            <>
              {/* product header + meta */}
              <div className="anim-up bg-card border border-mist rounded-lg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <p className="num text-[11px] font-bold text-pine-700">{state.banks.find((b) => b.id === prod.bankId)?.name} · {prod.loanType}</p>
                    <TextInput className="font-display font-bold text-[19px] tracking-tight mt-0.5 h-[34px]" value={prod.name} onChange={(ev) => saveProdMeta({ name: ev.target.value })} disabled={!isAdmin} />
                    {/* loan type + customer class */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="text-[9.5px] uppercase tracking-[0.1em] font-display font-bold text-ink-soft mr-1">Class</span>
                      <Select className="w-[130px] h-[28px] text-[11.5px]" value={prod.loanType} onChange={(v) => saveProdMeta({ loanType: v as ProductDef["loanType"] })} options={LOAN_TYPES} disabled={!isAdmin} />
                      {CLASSES.map((cl) => (
                        <button key={cl.v} onClick={() => isAdmin && saveProdMeta({ classes: prod.classes.includes(cl.v) ? prod.classes.filter((x) => x !== cl.v) : [...prod.classes, cl.v] })}
                          className={cx("focusable px-2 py-1 rounded-full border text-[10.5px] font-semibold transition-all", prod.classes.includes(cl.v) ? "bg-pine-700 text-paper border-pine-700" : "bg-card border-mist text-ink-soft", !isAdmin && "opacity-60 cursor-not-allowed")}>{cl.l}</button>
                      ))}
                    </div>
                    {/* supported transactions — the FULL list this product can handle */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="tip tip-b text-[9.5px] uppercase tracking-[0.1em] font-display font-bold text-steel-600 mr-1 cursor-help"
                        data-tip="Everything this product can finance. The rate grid (below) prices ONE of these per row.">Supported transactions</span>
                      {TX_TYPES.map((t) => (
                        <button key={t.v} onClick={() => isAdmin && saveProdMeta({ txTypes: prod.txTypes.includes(t.v) ? prod.txTypes.filter((x) => x !== t.v) : [...prod.txTypes, t.v] })}
                          className={cx("focusable px-2 py-1 rounded-full border text-[10.5px] font-semibold transition-all", prod.txTypes.includes(t.v) ? "bg-steel-600 text-paper border-steel-600" : "bg-card border-mist text-ink-soft", !isAdmin && "opacity-60 cursor-not-allowed")}>{t.l}</button>
                      ))}
                    </div>
                    {/* pricing axes attached to this product */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="tip tip-b text-[9.5px] uppercase tracking-[0.1em] font-display font-bold text-amber-700 mr-1 cursor-help"
                        data-tip="The ways this bank splits its pricing. Each becomes a dropdown on every rate-grid row.">Pricing axes</span>
                      {prod.axes.length
                        ? prod.axes.map((aid) => {
                            const ax = state.axes.find((a) => a.id === aid);
                            const attached = aid === "transaction";
                            return (
                              <span key={aid} className={cx("tip tip-b inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10.5px] font-semibold cursor-help",
                                attached ? "border-steel-500/60 bg-steel-100 text-steel-700" : "border-amber-500/50 bg-amber-100 text-amber-700")}
                                data-tip={attached ? "Same list as 'Supported transactions' above — a row picks ONE type from it." : `Splits pricing by ${ax?.name ?? aid}`}>
                                <Ic n={attached ? "link" : "sliders"} size={10} />{ax?.name ?? aid}
                              </span>
                            );
                          })
                        : <span className="text-[10.5px] text-ink-soft italic">none — one flat rate for everyone</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[...prod.versions].sort((a, b) => b.version - a.version).map((v) => (
                      <button key={v.version} onClick={() => { setSelVer(v.version); setDraftPv(null); }}
                        className={cx("focusable px-2.5 py-1 rounded-md border text-[11px] font-display font-bold transition-all", ver.version === v.version && !draftPv ? "bg-ink text-paper border-ink" : "border-mist hover:border-pine-600")}>
                        v{v.version}
                      </button>
                    ))}
                    {draftPv && <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 border border-amber-500/50 text-[11px] font-display font-bold anim-tick">v{draftPv.version} · editing draft</span>}
                    <Pill tone={STATUS_TONE[ver.status] ?? "gr"}>{ver.status}</Pill>
                    {isAdmin && !draftPv && ver.status !== "ACTIVE" && (
                      <Btn size="sm" onClick={() => dispatch({ t: "ACTIVATE_PV", productId: prod.id, version: ver.version, effectiveFrom: todayISO() })}><Ic n="check" size={12} /> Activate v{ver.version}</Btn>
                    )}
                    {isAdmin && (
                      <button onClick={() => setDelDef(prod)} title="Delete product" className="focusable p-1.5 rounded-md text-ink-soft hover:text-rust-600 hover:bg-rust-100 transition-colors"><Ic n="trash" size={14} /></button>
                    )}
                  </div>
                </div>
                {ver.source && <p className="text-[10.5px] text-ink-soft mt-2 num">source: {ver.source}{ver.effectiveFrom ? ` · effective ${fmtDate(ver.effectiveFrom)}` : ""}</p>}

                {/* Edit gate + change-aware save bar.
                    Read-only until "Edit" is pressed, so browsing can't accidentally change
                    anything; the Save button only appears once a real change exists. */}
                {isAdmin && !editMode && (
                  <div className="flex items-center justify-between mt-3 bg-paper/60 border border-mist rounded-md px-3.5 py-2.5 anim-tick">
                    <p className="text-[11.5px] text-ink-soft flex items-center gap-2"><Ic n="lock" size={13} /> Read-only — press Edit to unlock. Nothing you click here will change the rule.</p>
                    <Btn size="sm" variant="dark" onClick={() => setEditMode(true)}><Ic n="edit" size={12} /> Edit</Btn>
                  </div>
                )}
                {isAdmin && editMode && !isDirty && (
                  <div className="flex items-center justify-between mt-3 bg-steel-100/50 border border-steel-500/40 rounded-md px-3.5 py-2.5 anim-tick">
                    <p className="text-[11.5px] text-steel-700 font-medium flex items-center gap-2"><Ic n="edit" size={13} /> Editing — no changes yet. The Save button appears once you change something.</p>
                    <Btn size="sm" variant="ghost" onClick={() => { discardDraft(); setEditMode(false); }}>Done</Btn>
                  </div>
                )}
                {isAdmin && editMode && isDirty && (
                  <div className="flex items-center justify-between mt-3 bg-amber-100/60 border border-amber-500/50 rounded-md px-3.5 py-2.5 anim-tick">
                    <p className="text-[11.5px] text-amber-700 font-semibold flex items-center gap-2"><Ic n="alert" size={13} /> Unsaved changes — nothing is live until you Save draft, then Activate.</p>
                    <div className="flex gap-2">
                      <Btn size="sm" variant="ghost" onClick={() => { discardDraft(); }}>Discard</Btn>
                      <Btn size="sm" variant="dark" onClick={() => { saveDraft(); setEditMode(false); }}><Ic n="check" size={12} /> Save draft</Btn>
                    </div>
                  </div>
                )}
              </div>

              {/* group tabs */}
              <div className="flex gap-1 border-b border-mist overflow-x-auto anim-up">
                {GROUPS.map((g) => (
                  <button key={g.id} onClick={() => setTab(g.id)}
                    className={cx("focusable relative flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-display font-bold whitespace-nowrap transition-colors", tab === g.id ? "text-pine-800" : "text-ink-soft hover:text-ink")}>
                    <Ic n={g.i} size={13} />{g.l}
                    {tab === g.id && <span className="absolute left-2 right-2 -bottom-px h-[2.5px] rounded-full bg-pine-700" />}
                  </button>
                ))}
              </div>

              <div className="anim-tick space-y-3" key={tab}>
                {/* ===== RATE GRID ===== */}
                {tab === "grid" && (
                  <SectionCard title="Rate Grid" icon="calc" defaultOpen
                    hint="Each row prices ONE client segment. If a row names a transaction type, that rate applies only to that type — it must be one of the product's Supported transactions above. The engine picks the best-matching row, then works out the actual rate from the EIBOR recipe."
                    right={editable ? <AddBtn label="Add rate" onClick={() => setCellModal({ cell: { id: "rc" + uid(), key: {}, structure: "FIXED_THEN_VAR", fixedRate: 4, fixedMonths: 36, followOn: { margin: 2, index: "EIBOR_3M" } }, idx: -1 })} /> : undefined}>
                    {gridWarnings.length > 0 && (
                      <div className="mb-3 rounded-md border border-amber-500/50 bg-amber-100/50 px-3.5 py-2.5 anim-tick">
                        <p className="text-[11.5px] font-bold text-amber-700 flex items-center gap-1.5"><Ic n="alert" size={13} /> {gridWarnings.length} row{gridWarnings.length > 1 ? "s" : ""} won't price correctly</p>
                        <ul className="mt-1.5 space-y-1">{gridWarnings.map((w, i) => <li key={i} className="text-[11px] text-amber-700/90 leading-snug">• {w}</li>)}</ul>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px] min-w-[720px]">
                        <thead><tr className="text-left text-[10px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
                          <th className="px-3 py-2 font-semibold">Who</th><th className="px-3 py-2 font-semibold">Type</th>
                          <th className="px-3 py-2 font-semibold">Recipe</th><th className="px-3 py-2 font-semibold">Rate today</th>
                          <th className="px-3 py-2 font-semibold">Stress</th><th className="px-3 py-2" />
                        </tr></thead>
                        <tbody>
                          {ver.grid.cells.map((cell, ci) => {
                            const rate = cellRate(cell, eibor);
                            return (
                              <tr key={cell.id} className="border-b border-mist/60 last:border-0 hover:bg-pine-50/40 transition-colors">
                                <td className="px-3 py-2.5">
                                  {Object.keys(cell.key).length
                                    ? Object.entries(cell.key).map(([k, v]) => {
                                        const isTx = k === "transaction";
                                        const supported = !isTx || prod.txTypes.includes(v as TxType);
                                        const attached = prod.axes.includes(k);
                                        const bad = !attached || !supported;
                                        return (
                                          <span key={k} data-tip={isTx ? "One of the product's Supported transactions" : `Split by ${axisLabel(state.axes, k, k)}`}
                                            className={cx("tip tip-b inline-flex items-center gap-1 mr-1 mb-0.5 rounded px-1.5 py-[2px] text-[10.5px] font-semibold cursor-help",
                                              bad ? "bg-rust-100 text-rust-700" : isTx ? "bg-steel-600 text-paper" : "bg-steel-100 text-steel-700")}>
                                            {isTx && <Ic n="link" size={9} />}{axisLabel(state.axes, k, v)}{bad && <Ic n="alert" size={9} />}
                                          </span>
                                        );
                                      })
                                    : <span className="text-ink-soft italic">Everyone</span>}
                                </td>
                                <td className="px-3 py-2.5"><Pill tone={cell.structure === "FIXED" ? "pine" : cell.structure === "MARGIN_INDEX" ? "steel" : "amber"}>{STRUCTURES.find((s) => s.v === cell.structure)?.l ?? cell.structure}</Pill></td>
                                <td className="px-3 py-2.5 num text-[11px]">{cellRecipe(cell)}</td>
                                <td className="px-3 py-2.5 num font-bold text-pine-700">{rate != null ? `${rate.toFixed(2)}%` : "—"}</td>
                                <td className="px-3 py-2.5 num text-[11px]">{cell.stressRate != null ? `${cell.stressRate.toFixed(2)}%` : "—"}</td>
                                <td className="px-3 py-2.5 text-right">
                                  {editable && <RowActions onEdit={() => setCellModal({ cell, idx: ci })} onDel={() => setGrid(ver.grid.cells.filter((_, j) => j !== ci))} />}
                                </td>
                              </tr>
                            );
                          })}
                          {ver.grid.cells.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-ink-soft text-[12px]">No rates yet — press “Add rate”.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10.5px] text-ink-soft mt-2">Rates are stored as recipes (e.g. “1.99% + 3M EIBOR”), so they never go stale when EIBOR moves.</p>
                  </SectionCard>
                )}

                {/* ===== ELIGIBILITY ===== */}
                {tab === "elig" && e && (
                  <>
                    <SectionCard title="Loan limits & LTV" icon="target"
                      hint="How much the bank will lend, and what share of the property value (LTV) it will cover for each client type.">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Min loan <Exec /></p><NumInput disabled={!editable} value={e.minLoan ?? 0} onChange={(n) => setElig({ minLoan: n || undefined })} suffix="AED" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Max loan <Exec /></p><NumInput disabled={!editable} value={e.maxLoan ?? 0} onChange={(n) => setElig({ maxLoan: n || undefined })} suffix="AED" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Min salary <Exec /></p><NumInput disabled={!editable} value={e.minSalary ?? 0} onChange={(n) => setElig({ minSalary: n || undefined })} suffix="AED" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Max units</p><NumInput disabled={!editable} value={e.maxUnits ?? 0} onChange={(n) => setElig({ maxUnits: n || undefined })} /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Construction LTV <Exec /></p><NumInput disabled={!editable} value={e.constructionLtv ?? 0} onChange={(n) => setElig({ constructionLtv: n || undefined })} suffix="%" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Land LTV <Exec /></p><NumInput disabled={!editable} value={e.landLtv ?? 0} onChange={(n) => setElig({ landLtv: n || undefined })} suffix="%" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Commercial LTV <Exec /></p><NumInput disabled={!editable} value={e.commercialLtv ?? 0} onChange={(n) => setElig({ commercialLtv: n || undefined })} suffix="%" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Investment LTV <Exec /></p><NumInput disabled={!editable} value={e.investmentLtv ?? 0} onChange={(n) => setElig({ investmentLtv: n || undefined })} suffix="%" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">2nd-property LTV <Exec /></p><NumInput disabled={!editable} value={e.secondPropertyLtv ?? 0} onChange={(n) => setElig({ secondPropertyLtv: n || undefined })} suffix="%" /></div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1.5 flex items-center gap-1.5">Max LTV by client type <Exec /></p>
                          <MatrixEditor disabled={!editable} data={e.ltvMatrix ?? {}} onChange={(d) => setElig({ ltvMatrix: d })} suffix="%" keyPlaceholder="e.g. NATIONAL / EXPAT" />
                        </div>
                        <div>
                          <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1.5 flex items-center gap-1.5">Min salary by client type <Exec /></p>
                          <MatrixEditor disabled={!editable} data={e.minSalaryMatrix ?? {}} onChange={(d) => setElig({ minSalaryMatrix: d })} suffix=" AED" keyPlaceholder="e.g. STL / NSTL:EXPAT" />
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1.5">High loan amount rule</p>
                        <div className="grid grid-cols-2 gap-3 max-w-md">
                          <div><p className="text-[10.5px] text-ink-soft mb-1">Above this loan…</p><NumInput disabled={!editable} value={e.highAmountThreshold ?? 0} onChange={(n) => setElig({ highAmountThreshold: n || undefined })} suffix="AED" /></div>
                          <div><p className="text-[10.5px] text-ink-soft mb-1">…use this LTV</p><NumInput disabled={!editable} value={e.ltvAboveThreshold ?? 0} onChange={(n) => setElig({ ltvAboveThreshold: n || undefined })} suffix="%" /></div>
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Eligibility rules & conditions" icon="shield"
                      hint="Hard stops block a client; soft flags refer them for review. The engine checks these before pricing."
                      right={editable ? <AddBtn label="Add rule" onClick={() => setGateModal({ gate: { id: "g" + uid(), kind: "FLAG", label: "", hardStop: false }, idx: -1 })} /> : undefined}>
                      <div className="space-y-2">
                        {e.gates.map((g, gi) => (
                          <div key={g.id} className="flex items-start gap-2.5 border border-mist rounded-md px-3 py-2.5 bg-paper/40 hover:border-pine-300 transition-colors">
                            <Pill tone={g.hardStop ? "rust" : "amber"} dot>{g.hardStop ? "Block" : "Review"}</Pill>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-medium leading-snug">{g.label}</p>
                              <p className="text-[10.5px] text-ink-soft mt-0.5">{GATE_KINDS.find((k) => k.v === g.kind)?.l}{g.values?.length ? `: ${g.values.join(", ")}` : ""}{g.when ? ` · ${WHEN_OPTS.find((w) => w.v === g.when)?.l}` : ""}</p>
                            </div>
                            {editable && <RowActions onEdit={() => setGateModal({ gate: g, idx: gi })} onDel={() => setElig({ gates: e.gates.filter((_, j) => j !== gi) })} />}
                          </div>
                        ))}
                        {e.gates.length === 0 && <p className="text-[11.5px] text-ink-soft italic">No rules yet — press “Add rule”.</p>}
                      </div>
                    </SectionCard>

                    <SectionCard title="Credit, service & statements" icon="pulse" defaultOpen={false}
                      hint="Bureau score floors, how long a client must have worked or run a business, and how many months of bank statements the bank wants.">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Min AECB score <Exec /></p><NumInput disabled={!editable} value={e.minAecb ?? 0} onChange={(n) => setElig({ minAecb: n || undefined })} /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Min business age <Exec /></p><NumInput disabled={!editable} value={e.minLobYears ?? 0} onChange={(n) => setElig({ minLobYears: n || undefined })} suffix="yrs" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Min service <Exec /></p><NumInput disabled={!editable} value={e.minLosMonths ?? 0} onChange={(n) => setElig({ minLosMonths: n || undefined })} suffix="mo" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Statements needed</p><NumInput disabled={!editable} value={e.statementMonths ?? 0} onChange={(n) => setElig({ statementMonths: n || undefined })} suffix="mo" /></div>
                      </div>
                      <div className="flex items-center gap-3 mt-3.5">
                        <Toggle value={e.negativeBureauBlock ?? false} onChange={(v) => setElig({ negativeBureauBlock: v })} disabled={!editable} />
                        <span className="text-[12.5px] font-medium">Block clients with a negative bureau record</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2.5">
                        <Toggle value={e.salaryTransferRequired ?? false} onChange={(v) => setElig({ salaryTransferRequired: v })} disabled={!editable} />
                        <span className="text-[12.5px] font-medium">Client must transfer salary to this bank</span>
                      </div>
                      <div className="mt-3.5 max-w-md">
                        <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1.5">Multi-property rule</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div><p className="text-[10.5px] text-ink-soft mb-1">More than this many properties…</p><NumInput disabled={!editable} value={e.multiPropertyRule?.minCount ?? 0} onChange={(n) => setElig({ multiPropertyRule: { minCount: n, ltv: e.multiPropertyRule?.ltv ?? 50 } })} /></div>
                          <div><p className="text-[10.5px] text-ink-soft mb-1">…cap LTV at</p><NumInput disabled={!editable} value={e.multiPropertyRule?.ltv ?? 0} onChange={(n) => setElig({ multiPropertyRule: { minCount: e.multiPropertyRule?.minCount ?? 2, ltv: n } })} suffix="%" /></div>
                        </div>
                      </div>
                      <div className="mt-3.5">
                        <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1.5 flex items-center gap-1.5">LTV by property value (bands) <Exec /></p>
                        <p className="text-[11px] text-ink-soft mb-2">Lower of market value or purchase price is matched to the first band it fits. Leave employment as "All" for a universal band.</p>
                        <div className="space-y-1.5 max-w-xl">
                          {(e.ltvBands ?? []).map((b, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span style={{ display: "inline-block", width: 150 }}><Select disabled={!editable} value={b.employment ?? ""} onChange={(v) => setElig({ ltvBands: (e.ltvBands ?? []).map((x, j) => j === i ? { ...x, employment: v || undefined } : x) })} options={[{ v: "", l: "All employment" }, { v: "SALARIED", l: "Salaried" }, { v: "SELF_EMPLOYED", l: "Self employed" }]} /></span>
                              <span className="text-[11px] text-ink-soft">value ≤</span>
                              <span style={{ display: "inline-block", width: 130 }}><NumInput disabled={!editable} value={b.upTo} onChange={(n) => setElig({ ltvBands: (e.ltvBands ?? []).map((x, j) => j === i ? { ...x, upTo: n } : x) })} suffix="AED" /></span>
                              <span className="text-[11px] text-ink-soft">→</span>
                              <span style={{ display: "inline-block", width: 80 }}><NumInput disabled={!editable} value={b.ltv} onChange={(n) => setElig({ ltvBands: (e.ltvBands ?? []).map((x, j) => j === i ? { ...x, ltv: n } : x) })} suffix="%" /></span>
                              {editable && <button onClick={() => setElig({ ltvBands: (e.ltvBands ?? []).filter((_, j) => j !== i) })} className="focusable p-1 rounded text-ink-soft hover:text-rust-600"><Ic n="x" size={12} /></button>}
                            </div>
                          ))}
                        </div>
                        {editable && <Btn size="sm" variant="outline" className="mt-2" onClick={() => setElig({ ltvBands: [...(e.ltvBands ?? []), { upTo: 5000000, ltv: 75 }] })}><Ic n="plus" size={12} /> Add value band</Btn>}
                      </div>
                      <div className="mt-3.5 max-w-md">
                        <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1.5">Employer requirements</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div><p className="text-[10.5px] text-ink-soft mb-1">Company established ≥</p><NumInput disabled={!editable} value={e.employerRequirements?.minYearsEstablished ?? 0} onChange={(n) => setElig({ employerRequirements: { ...e.employerRequirements, minYearsEstablished: n || undefined } })} suffix="yrs" /></div>
                          <div><p className="text-[10.5px] text-ink-soft mb-1">Min employees</p><NumInput disabled={!editable} value={e.employerRequirements?.minEmployees ?? 0} onChange={(n) => setElig({ employerRequirements: { ...e.employerRequirements, minEmployees: n || undefined } })} /></div>
                        </div>
                      </div>
                    </SectionCard>
                  </>
                )}

                {/* ===== HIGH-RISK BANDS ===== */}
                {tab === "risk" && e && (
                  <SectionCard title="High-risk bands" icon="alert"
                    hint="Clients matching a band (by nationality or job sector) get their LTV capped. The strictest matching band wins. You can exempt approved top developers."
                    right={editable ? <AddBtn label="Add band" onClick={() => setBandModal({ band: { ltv: 60, sectors: [], nationalities: [] }, idx: -1 })} /> : undefined}>
                    <div className="space-y-2">
                      {(e.highRiskBands ?? []).map((b, bi) => (
                        <div key={bi} className="flex items-start gap-2.5 border border-mist rounded-md px-3 py-2.5 bg-paper/40 hover:border-rust-300 transition-colors">
                          <span className="num text-[12px] font-bold bg-rust-100 text-rust-700 rounded px-2 py-1 shrink-0">{b.ltv}% LTV</span>
                          <div className="flex-1 min-w-0">
                            {b.nationalities?.length ? <p className="text-[11.5px]"><span className="font-semibold">Nationalities:</span> {b.nationalities.join(", ")}</p> : null}
                            {b.sectors.length ? <p className="text-[11.5px] mt-0.5"><span className="font-semibold">Sectors:</span> {b.sectors.join(", ")}</p> : null}
                            {b.topDeveloperExempt && <p className="text-[10.5px] text-pine-700 font-semibold mt-0.5 flex items-center gap-1"><Ic n="check" size={11} /> Top developers exempt</p>}
                          </div>
                          {editable && <RowActions onEdit={() => setBandModal({ band: b, idx: bi })} onDel={() => setElig({ highRiskBands: (e.highRiskBands ?? []).filter((_, j) => j !== bi) })} />}
                        </div>
                      ))}
                      {(e.highRiskBands ?? []).length === 0 && <p className="text-[11.5px] text-ink-soft italic">No high-risk bands for this product.</p>}
                    </div>
                    <div className="mt-3"><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1.5">Restricted sectors (legacy list)</p>
                      <TextInput disabled={!editable} value={(e.restrictedSectors ?? []).join(", ")} onChange={(ev) => setElig({ restrictedSectors: ev.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="comma separated" />
                    </div>
                  </SectionCard>
                )}

                {/* ===== INCOME RULES ===== */}
                {tab === "income" && e && (
                  <SectionCard title="Income recognition" icon="pulse"
                    hint="What percentage of each income type the bank counts. 100% = fully counted. The engine uses these to work out qualifying income.">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {([
                        ["Basic salary", "basicPct"], ["Allowances", "allowancePct"], ["Commission", "commissionPct"],
                        ["Bonus", "bonusPct"], ["Rental income", "rentalPct"], ["Business income", "businessPct"],
                      ] as [string, keyof NonNullable<ProductVersion["eligibility"]["incomeRecognition"]>][]).map(([label, key]) => (
                        <div key={key}>
                          <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">{label} <Exec /></p>
                          <NumInput disabled={!editable} value={e.incomeRecognition?.[key] ?? 100} onChange={(n) => setElig({ incomeRecognition: { ...e.incomeRecognition, [key]: n } })} suffix="%" />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4 max-w-md">
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Variable income cap <Exec /></p><NumInput disabled={!editable} value={e.variableIncomeCapPct ?? 0} onChange={(n) => setElig({ variableIncomeCapPct: n || undefined })} suffix="%" /></div>
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Max age — salaried</p><NumInput disabled={!editable} value={e.maxAgeSalaried ?? 0} onChange={(n) => setElig({ maxAgeSalaried: n || undefined })} suffix="yrs" /></div>
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Max age — self employed</p><NumInput disabled={!editable} value={e.maxAgeSelfEmp ?? 0} onChange={(n) => setElig({ maxAgeSelfEmp: n || undefined })} suffix="yrs" /></div>
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Payment holiday</p><TextInput disabled={!editable} value={e.paymentHoliday ?? ""} onChange={(ev) => setElig({ paymentHoliday: ev.target.value || undefined })} placeholder="e.g. STL up to 6 months" /></div>
                    </div>
                  </SectionCard>
                )}

                {/* ===== FEES ===== */}
                {tab === "fees" && f && (
                  <>
                    <SectionCard title="Standard fees" icon="scale" hint="The default charges for this product. The engine adds these to the customer's upfront cost.">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Processing fee <Exec /></p><NumInput disabled={!editable} value={f.processingPct ?? 0} onChange={(n) => setFees({ processingPct: n || undefined })} suffix="%" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Min processing</p><NumInput disabled={!editable} value={f.processingMin ?? 0} onChange={(n) => setFees({ processingMin: n || undefined })} suffix="AED" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Max processing</p><NumInput disabled={!editable} value={f.processingMax ?? 0} onChange={(n) => setFees({ processingMax: n || undefined })} suffix="AED" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Valuation fee <Exec /></p><NumInput disabled={!editable} value={f.valuation ?? 0} onChange={(n) => setFees({ valuation: n || undefined })} suffix="AED" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Pre-approval fee</p><NumInput disabled={!editable} value={f.preApproval ?? 0} onChange={(n) => setFees({ preApproval: n || undefined })} suffix="AED" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">VAT</p><NumInput disabled={!editable} value={f.vatPct ?? 0} onChange={(n) => setFees({ vatPct: n || undefined })} suffix="%" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Life assignment fee</p><NumInput disabled={!editable} value={f.lifeAssignmentFee ?? 0} onChange={(n) => setFees({ lifeAssignmentFee: n || undefined })} suffix="AED" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Life insurance <Exec /></p><NumInput disabled={!editable} value={f.lifeInsurancePct ?? 0} onChange={(n) => setFees({ lifeInsurancePct: n || undefined })} suffix="%" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Property insurance <Exec /></p><NumInput disabled={!editable} value={f.propertyInsurancePct ?? 0} onChange={(n) => setFees({ propertyInsurancePct: n || undefined })} suffix="%" /></div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3 mt-3.5">
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Early settlement</p><TextInput disabled={!editable} value={f.earlySettlement ?? ""} onChange={(ev) => setFees({ earlySettlement: ev.target.value || undefined })} placeholder="e.g. 1.05% or AED 10,500, whichever lower" /></div>
                        <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Partial settlement</p><TextInput disabled={!editable} value={f.partialSettlement ?? ""} onChange={(ev) => setFees({ partialSettlement: ev.target.value || undefined })} placeholder="e.g. Free up to 25% yearly" /></div>
                      </div>
                      <div className="mt-3.5 max-w-md">
                        <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1.5">Valuation fee by emirate</p>
                        <MatrixEditor disabled={!editable} data={f.valuationByEmirate ?? {}} onChange={(d) => setFees({ valuationByEmirate: d })} suffix=" AED" keyPlaceholder="e.g. AJMAN" />
                      </div>
                    </SectionCard>

                    <SectionCard title="Processing fee tiers" icon="list" defaultOpen={false}
                      hint="Different processing fees for different client segments (e.g. Golden Visa holders pay less)."
                      right={editable ? <AddBtn label="Add tier" onClick={() => setTierModal({ item: { label: "", pct: 0 }, idx: -1 })} /> : undefined}>
                      <div className="space-y-2">
                        {(f.processingFeeTiers ?? []).map((t, ti) => (
                          <div key={ti} className="flex items-center gap-2.5 border border-mist rounded-md px-3 py-2 bg-paper/40">
                            <span className="text-[12.5px] font-medium flex-1">{t.label}</span>
                            <span className="num text-[12px] font-bold text-pine-700">{t.pct}%</span>
                            {editable && <RowActions onEdit={() => setTierModal({ item: t, idx: ti })} onDel={() => setFees({ processingFeeTiers: (f.processingFeeTiers ?? []).filter((_, j) => j !== ti) })} />}
                          </div>
                        ))}
                        {(f.processingFeeTiers ?? []).length === 0 && <p className="text-[11.5px] text-ink-soft italic">No tiers.</p>}
                      </div>
                    </SectionCard>

                    <SectionCard title="Transaction fee overrides" icon="scale" defaultOpen={false}
                      hint="Override the standard processing fee for one transaction type — e.g. buyout is free."
                      right={editable ? <AddBtn label="Add override" onClick={() => setTxModal({ item: { txType: "BUYOUT", processingPct: 0 }, idx: -1 })} /> : undefined}>
                      <div className="space-y-2">
                        {(f.txOverrides ?? []).map((t, ti) => (
                          <div key={ti} className="flex items-center gap-2.5 border border-mist rounded-md px-3 py-2 bg-paper/40">
                            <Pill tone="steel">{TX_TYPES.find((x) => x.v === t.txType)?.l ?? t.txType}</Pill>
                            <span className="text-[12px] flex-1">processing {t.processingPct ?? 0}%{t.valuationWaived ? " · valuation waived" : ""}{t.note ? ` · ${t.note}` : ""}</span>
                            {editable && <RowActions onEdit={() => setTxModal({ item: t, idx: ti })} onDel={() => setFees({ txOverrides: (f.txOverrides ?? []).filter((_, j) => j !== ti) })} />}
                          </div>
                        ))}
                        {(f.txOverrides ?? []).length === 0 && <p className="text-[11.5px] text-ink-soft italic">No overrides.</p>}
                      </div>
                    </SectionCard>

                    <SectionCard title="Rate discounts" icon="spark" defaultOpen={false}
                      hint="Automatic reductions the engine applies — low-LTV discounts and employer discounts.">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-2"><p className="text-[10.5px] font-display font-bold text-ink-soft">Low-LTV discounts</p>{editable && <AddBtn label="Add" onClick={() => setDiscModal({ item: { maxLtv: 60, bps: 25 }, idx: -1 })} />}</div>
                          <div className="space-y-2">
                            {(f.ltvDiscounts ?? []).map((d, di) => (
                              <div key={di} className="flex items-center gap-2.5 border border-mist rounded-md px-3 py-2 bg-paper/40">
                                <span className="text-[12px] flex-1">LTV ≤ <strong className="num">{d.maxLtv}%</strong> → <strong className="num text-pine-700">−{d.bps} bps</strong>{d.label ? ` · ${d.label}` : ""}</span>
                                {editable && <RowActions onEdit={() => setDiscModal({ item: d, idx: di })} onDel={() => setFees({ ltvDiscounts: (f.ltvDiscounts ?? []).filter((_, j) => j !== di) })} />}
                              </div>
                            ))}
                            {(f.ltvDiscounts ?? []).length === 0 && <p className="text-[11.5px] text-ink-soft italic">None.</p>}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2"><p className="text-[10.5px] font-display font-bold text-ink-soft">Employer discounts</p>{editable && <AddBtn label="Add" onClick={() => setEmpModal({ item: { label: "", employers: [], bps: 25 }, idx: -1 })} />}</div>
                          <div className="space-y-2">
                            {(f.employerDiscounts ?? []).map((d, di) => (
                              <div key={di} className="flex items-start gap-2.5 border border-mist rounded-md px-3 py-2 bg-paper/40">
                                <div className="flex-1 min-w-0"><p className="text-[12px] font-medium">{d.label}</p><p className="text-[10.5px] text-ink-soft truncate">{d.employers.join(", ")}</p></div>
                                <span className="num text-[12px] font-bold text-pine-700 shrink-0">−{d.bps} bps</span>
                                {editable && <RowActions onEdit={() => setEmpModal({ item: d, idx: di })} onDel={() => setFees({ employerDiscounts: (f.employerDiscounts ?? []).filter((_, j) => j !== di) })} />}
                              </div>
                            ))}
                            {(f.employerDiscounts ?? []).length === 0 && <p className="text-[11.5px] text-ink-soft italic">None.</p>}
                          </div>
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Conditional rate adjustments" icon="pulse" defaultOpen={false}
                      hint="Surcharges or discounts applied when conditions match — e.g. refinance +10 bps, loan above 10M +75 bps. Positive bps = surcharge, negative = discount. All conditions must match.">
                      <div className="space-y-2.5">
                        {(f.rateAdjustments ?? []).map((a, ai) => {
                          const upd = (p: Partial<NonNullable<ProductVersion["fees"]["rateAdjustments"]>[number]>) =>
                            setFees({ rateAdjustments: (f.rateAdjustments ?? []).map((x, j) => (j === ai ? { ...x, ...p } : x)) });
                          return (
                            <div key={a.id} className="border border-mist rounded-md px-3 py-2.5 bg-paper/40 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="flex-1"><TextInput disabled={!editable} value={a.label} onChange={(e) => upd({ label: e.target.value })} placeholder="Label, e.g. Refinance" /></span>
                                <span style={{ display: "inline-block", width: 100 }}><NumInput disabled={!editable} value={a.bps} onChange={(n) => upd({ bps: n })} suffix="bps" /></span>
                                {editable && <RowActions onDel={() => setFees({ rateAdjustments: (f.rateAdjustments ?? []).filter((_, j) => j !== ai) })} />}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div><p className="text-[10px] text-ink-soft mb-1">Transactions (comma-sep)</p><TextInput disabled={!editable} value={(a.txTypes ?? []).join(", ")} onChange={(e) => upd({ txTypes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) as TxType[] })} placeholder="REFINANCE, TOPUP" /></div>
                                <div><p className="text-[10px] text-ink-soft mb-1">Loan amount &gt;</p><NumInput disabled={!editable} value={a.loanGt ?? 0} onChange={(n) => upd({ loanGt: n || undefined })} suffix="AED" /></div>
                                <div><p className="text-[10px] text-ink-soft mb-1">Loan amount &lt;</p><NumInput disabled={!editable} value={a.loanLt ?? 0} onChange={(n) => upd({ loanLt: n || undefined })} suffix="AED" /></div>
                                <div><p className="text-[10px] text-ink-soft mb-1">LTV &gt;</p><NumInput disabled={!editable} value={a.ltvGt ?? 0} onChange={(n) => upd({ ltvGt: n || undefined })} suffix="%" /></div>
                              </div>
                            </div>
                          );
                        })}
                        {(f.rateAdjustments ?? []).length === 0 && <p className="text-[11.5px] text-ink-soft italic">None.</p>}
                        {editable && <Btn size="sm" variant="outline" onClick={() => setFees({ rateAdjustments: [...(f.rateAdjustments ?? []), { id: "ra" + uid(), label: "", bps: 10 }] })}><Ic n="plus" size={12} /> Add adjustment</Btn>}
                      </div>
                    </SectionCard>
                  </>
                )}

                {/* ===== AFFORDABILITY ===== */}
                {tab === "afford" && ver && (
                  <SectionCard title="Affordability (DBR)" icon="target"
                    hint="The maximum share of income that can go to debt (Debt Burden Ratio), and how credit cards are counted.">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Max DBR <Exec /></p><NumInput disabled={!editable} value={ver.affordability.maxDBR ?? 0} onChange={(n) => setAfford({ maxDBR: n || undefined })} suffix="%" /></div>
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Credit card % <Exec /></p><NumInput disabled={!editable} value={ver.affordability.ccPct ?? 0} onChange={(n) => setAfford({ ccPct: n || undefined })} suffix="%" /></div>
                      <div className="col-span-2 flex items-center gap-3 pt-4">
                        <Toggle value={ver.affordability.dbrIncludesInsurance ?? false} onChange={(v) => setAfford({ dbrIncludesInsurance: v || undefined })} disabled={!editable} />
                        <div>
                          <p className="text-[11.5px] font-display font-bold text-ink flex items-center gap-1.5">Insurance counted inside DBR <Exec /></p>
                          <p className="text-[10.5px] text-ink-soft">e.g. DIB adds the life-insurance premium to the EMI when testing affordability.</p>
                        </div>
                      </div>
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Rental counted</p><NumInput disabled={!editable} value={ver.affordability.rentalPct ?? 0} onChange={(n) => setAfford({ rentalPct: n || undefined })} suffix="%" /></div>
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Bonus counted</p><NumInput disabled={!editable} value={ver.affordability.bonusPct ?? 0} onChange={(n) => setAfford({ bonusPct: n || undefined })} suffix="%" /></div>
                    </div>
                  </SectionCard>
                )}

                {/* ===== DOCUMENTS ===== */}
                {tab === "docs" && ver && (
                  <SectionCard title="Required documents" icon="file"
                    hint="The checklist the bank expects. These feed the Documents & QC screen for each case."
                    right={editable ? <AddBtn label="Add document" onClick={() => setDocModal({ item: { name: "", required: true }, idx: -1 })} /> : undefined}>
                    <div className="grid md:grid-cols-2 gap-2">
                      {ver.documents.map((d, di) => (
                        <div key={di} className="flex items-center gap-2.5 border border-mist rounded-md px-3 py-2 bg-paper/40 hover:border-pine-300 transition-colors">
                          <Pill tone={d.required ? "pine" : "gr"} dot>{d.required ? "Required" : "Optional"}</Pill>
                          <div className="flex-1 min-w-0"><p className="text-[12.5px] font-medium truncate">{d.name}</p>{d.note && <p className="text-[10.5px] text-ink-soft truncate">{d.note}</p>}</div>
                          {editable && <RowActions onEdit={() => setDocModal({ item: d, idx: di })} onDel={() => setDocs(ver.documents.filter((_, j) => j !== di))} />}
                        </div>
                      ))}
                      {ver.documents.length === 0 && <p className="text-[11.5px] text-ink-soft italic md:col-span-2">No documents yet — press “Add document”.</p>}
                    </div>
                  </SectionCard>
                )}

                {/* ===== TAT ===== */}
                {tab === "tat" && ver && (
                  <SectionCard title="Turnaround times (working days)" icon="timer"
                    hint="How long each step takes at this bank. Shown on proposals and used for SLA tracking.">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {([
                        ["Pre-approval", "paDays"], ["Valuation", "valuationDays"], ["FOL", "folDays"],
                        ["Account opening", "accountOpeningDays"], ["Disbursal", "disbursalDays"],
                        ["Transfer", "transferDays"], ["Total", "totalDays"],
                        ["PA validity", "paValidityDays"], ["FOL validity", "folValidityDays"], ["Valuation validity", "valuationValidityDays"],
                      ] as [string, keyof ProductVersion["tat"]][]).map(([label, key]) => (
                        <div key={key}>
                          <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">{label}</p>
                          <NumInput disabled={!editable} value={ver.tat[key] ?? 0} onChange={(n) => setTat({ [key]: n || undefined })} suffix="d" />
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* ===== TENURE & NOTES ===== */}
                {tab === "tenure" && ver && (
                  <SectionCard title="Tenure, max loan by nationality & notes" icon="clock">
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Max tenure <Exec /></p><NumInput disabled={!editable} value={ver.tenure.maxMonths ?? 0} onChange={(n) => setTenure({ maxMonths: n || undefined })} suffix="mo" /></div>
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1 flex items-center gap-1.5">Min tenure <Exec /></p><NumInput disabled={!editable} value={ver.tenure.minMonths ?? 0} onChange={(n) => setTenure({ minMonths: n || undefined })} suffix="mo" /></div>
                    </div>
                    <div className="mt-4 max-w-md">
                      <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1.5">Max loan by nationality</p>
                      <MatrixEditor disabled={!editable} data={e?.maxLoanByNationality ?? {}} onChange={(d) => setElig({ maxLoanByNationality: d })} suffix=" AED" keyPlaceholder="e.g. NATIONAL" />
                    </div>
                    <div className="mt-4">
                      <p className="text-[10.5px] font-display font-bold text-ink-soft mb-1.5">Policy notes (shown to the team, not computed)</p>
                      <TextArea disabled={!editable} rows={5} value={(e?.notes ?? []).join("\n")} onChange={(ev) => setElig({ notes: ev.target.value.split("\n").filter(Boolean) })} placeholder="One note per line…" />
                    </div>
                    <div className="mt-4 grid md:grid-cols-2 gap-3">
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Co-applicant rule</p><TextInput disabled={!editable} value={e?.coApplicantRule ?? ""} onChange={(ev) => setElig({ coApplicantRule: ev.target.value || undefined })} placeholder="e.g. 1 blood relation (no siblings)" /></div>
                      <div><p className="text-[10.5px] font-display font-bold text-ink-soft mb-1">Version source / circular ref</p><TextInput disabled={!editable} value={ver.source ?? ""} onChange={(ev) => setPv({ source: ev.target.value || undefined })} placeholder="e.g. ADCB salaried card Aug 2026" /></div>
                    </div>
                  </SectionCard>
                )}
              </div>
            </>
          ) : (
            <div className="bg-card border border-mist rounded-lg p-10 text-center">
              <p className="font-display font-bold text-[16px]">Select a product on the left</p>
              <p className="text-[12.5px] text-ink-soft mt-1">or create a new one to start adding rules.</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== modals ===== */}
      {cellModal && prod && <RateCellEditor open onClose={() => setCellModal(null)} axes={prodAxes} cell={cellModal.cell} supportedTx={prod.txTypes}
        onSave={(c) => { const cells = [...ver!.grid.cells]; if (cellModal.idx >= 0) cells[cellModal.idx] = c; else cells.push(c); setGrid(cells); setCellModal(null); }} />}
      {gateModal && e && <GateEditor open onClose={() => setGateModal(null)} gate={gateModal.gate}
        onSave={(g) => { const gates = [...e.gates]; if (gateModal.idx >= 0) gates[gateModal.idx] = g; else gates.push(g); setElig({ gates }); setGateModal(null); }} />}
      {bandModal && e && <BandEditor open onClose={() => setBandModal(null)} band={bandModal.band}
        onSave={(b) => { const bands = [...(e.highRiskBands ?? [])]; if (bandModal.idx >= 0) bands[bandModal.idx] = b; else bands.push(b); setElig({ highRiskBands: bands }); setBandModal(null); }} />}
      {discModal && f && <DiscountEditor open onClose={() => setDiscModal(null)} item={discModal.item}
        onSave={(d) => { const arr = [...(f.ltvDiscounts ?? [])]; if (discModal.idx >= 0) arr[discModal.idx] = d; else arr.push(d); setFees({ ltvDiscounts: arr }); setDiscModal(null); }} />}
      {empModal && f && <EmpDiscEditor open onClose={() => setEmpModal(null)} item={empModal.item}
        onSave={(d) => { const arr = [...(f.employerDiscounts ?? [])]; if (empModal.idx >= 0) arr[empModal.idx] = d; else arr.push(d); setFees({ employerDiscounts: arr }); setEmpModal(null); }} />}
      {tierModal && f && <TierEditor open onClose={() => setTierModal(null)} item={tierModal.item}
        onSave={(d) => { const arr = [...(f.processingFeeTiers ?? [])]; if (tierModal.idx >= 0) arr[tierModal.idx] = d; else arr.push(d); setFees({ processingFeeTiers: arr }); setTierModal(null); }} />}
      {txModal && f && <TxOverrideEditor open onClose={() => setTxModal(null)} item={txModal.item}
        onSave={(d) => { const arr = [...(f.txOverrides ?? [])]; if (txModal.idx >= 0) arr[txModal.idx] = d; else arr.push(d); setFees({ txOverrides: arr }); setTxModal(null); }} />}
      {docModal && ver && <DocEditor open onClose={() => setDocModal(null)} item={docModal.item}
        onSave={(d) => { const arr = [...ver.documents]; if (docModal.idx >= 0) arr[docModal.idx] = d; else arr.push(d); setDocs(arr); setDocModal(null); }} />}

      {/* promos */}
      {showPromos && (
        <Modal open onClose={() => setShowPromos(false)} title="Promotions & campaigns" width={620}
          footer={<Btn variant="ghost" onClick={() => setShowPromos(false)}>Close</Btn>}>
          <div className="flex justify-end mb-3"><AddBtn label="Add promo" onClick={() => setPromoModal({ promo: { id: "pr" + uid(), name: "", from: todayISO(), summary: "", createdBy: me?.id ?? "", createdAt: nowISO() }, isNew: true })} /></div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {state.promos.map((p) => (
              <div key={p.id} className="flex items-start gap-2.5 border border-mist rounded-md px-3 py-2.5 bg-paper/40">
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold">{p.name}</p>
                  <p className="text-[10.5px] text-ink-soft num">{state.banks.find((b) => b.id === p.bankId)?.short ?? "All banks"} · {fmtDate(p.from)}{p.to ? ` → ${fmtDate(p.to)}` : " → ongoing"}</p>
                  <p className="text-[11px] text-ink-soft mt-0.5">{p.summary}</p>
                </div>
                <RowActions onEdit={() => setPromoModal({ promo: p, isNew: false })} onDel={() => dispatch({ t: "DELETE_PROMO", id: p.id })} />
              </div>
            ))}
            {state.promos.length === 0 && <p className="text-[11.5px] text-ink-soft italic text-center py-6">No promos yet.</p>}
          </div>
        </Modal>
      )}
      {promoModal && <PromoEditor open onClose={() => setPromoModal(null)} promo={promoModal.promo} banks={bankOpts}
        onSave={(p) => { dispatch({ t: "SAVE_PROMO", promo: p, isNew: promoModal.isNew }); setPromoModal(null); }} />}

      {/* axes */}
      {showAxes && (
        <Modal open onClose={() => setShowAxes(false)} title="Pricing axes" width={620}
          footer={<Btn variant="ghost" onClick={() => setShowAxes(false)}>Close</Btn>}>
          <Hint>Axes are the ways banks split pricing (employment, fixed term, segment…). Add a new axis here, then attach it to a product and use it in rate cells.</Hint>
          <div className="flex justify-end my-3"><AddBtn label="Add axis" onClick={() => setAxisModal({ axis: { id: "ax" + uid(), name: "", values: [] }, isNew: true })} /></div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {state.axes.map((ax) => {
              const usedBy = state.productDefs.filter((p) => p.axes.includes(ax.id)).length;
              return (
                <div key={ax.id} className="flex items-start gap-2.5 border border-mist rounded-md px-3 py-2.5 bg-paper/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold flex items-center gap-2">{ax.name}
                      <span className={cx("num text-[9.5px] rounded px-1.5 py-[1px]", usedBy ? "bg-pine-100 text-pine-800" : "bg-mist/70 text-ink-soft")}>{usedBy ? `used by ${usedBy} product${usedBy > 1 ? "s" : ""}` : "not used yet"}</span>
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">{ax.values.map((v) => <span key={v.v} className="text-[10.5px] bg-steel-100 text-steel-700 rounded px-1.5 py-[2px] font-medium">{v.l}</span>)}</div>
                  </div>
                  <RowActions onEdit={() => setAxisModal({ axis: ax, isNew: false })} onDel={usedBy ? undefined : () => setDelAxis(ax)} />
                </div>
              );
            })}
          </div>
        </Modal>
      )}
      {axisModal && <AxisEditor open onClose={() => setAxisModal(null)} axis={axisModal.axis}
        onSave={(a) => { dispatch({ t: "SAVE_AXIS", axis: a }); setAxisModal(null); }} />}

      {/* new product */}
      {newProd && <NewProductModal banks={bankOpts} axes={state.axes} onClose={() => setNewProd(false)}
        onCreate={(def) => { dispatch({ t: "SAVE_PRODUCT_DEF", def, isNew: true }); setNewProd(false); setSelDef(def.id); setSelVer(null); setDraftPv(null); }} />}

      {/* delete confirmations */}
      {delDef && <DangerModal open onClose={() => setDelDef(null)} title="Delete product" target={delDef.name}
        warn="All of its versions and rules will be removed. This is written to the audit trail."
        onConfirm={(reason) => { dispatch({ t: "DELETE_PRODUCT_DEF", id: delDef.id, reason }); setDelDef(null); setSelDef(null); }} />}
      {delAxis && <DangerModal open onClose={() => setDelAxis(null)} title="Delete axis" target={delAxis.name}
        warn="This axis isn't used by any product, so it's safe to remove."
        onConfirm={() => { dispatch({ t: "DELETE_AXIS", id: delAxis.id }); setDelAxis(null); }} />}
    </div>
  );
}

/* ---------- new product modal ---------- */
function NewProductModal({ banks, axes, onClose, onCreate }: {
  banks: { v: string; l: string }[]; axes: AxisDef[]; onClose: () => void; onCreate: (d: ProductDef) => void;
}) {
  const me = useMe();
  const [name, setName] = useState("");
  const [bankId, setBankId] = useState(banks[0]?.v ?? "");
  const [loanType, setLoanType] = useState<ProductDef["loanType"]>("CONVENTIONAL");
  const [classes, setClasses] = useState<string[]>(["SALARIED"]);
  const [txTypes, setTxTypes] = useState<TxType[]>(["PURCHASE"]);
  const [prodAxes, setProdAxes] = useState<string[]>([]);
  return (
    <Modal open onClose={onClose} title="New product" width={560}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!name.trim()} onClick={() => onCreate({
          id: "pd" + uid(), bankId, name: name.trim(), loanType, classes, txTypes, axes: prodAxes,
          versions: [blankPv()], createdAt: nowISO(), createdBy: me?.id ?? "",
        })}><Ic n="check" size={14} /> Create product</Btn></>}>
      <Hint>Create the product shell, then fill in its rules using the sections. You can attach pricing axes now or later.</Hint>
      <div className="mt-3 space-y-3.5">
        <Field label="Product name" req><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home Finance — Salaried" /></Field>
        <Field label="Bank"><Select value={bankId} onChange={setBankId} options={banks} /></Field>
        <Field label="Loan type"><Select value={loanType} onChange={(v) => setLoanType(v as ProductDef["loanType"])} options={LOAN_TYPES} /></Field>
        <Field label="Customer classes">
          <div className="flex gap-1.5">{CLASSES.map((c) => (
            <button key={c.v} onClick={() => setClasses(classes.includes(c.v) ? classes.filter((x) => x !== c.v) : [...classes, c.v])}
              className={cx("focusable px-2.5 py-1 rounded-full border text-[11px] font-semibold", classes.includes(c.v) ? "bg-pine-700 text-paper border-pine-700" : "bg-card border-mist text-ink-soft")}>{c.l}</button>
          ))}</div>
        </Field>
        <Field label="Transaction types">
          <div className="flex gap-1.5 flex-wrap">{TX_TYPES.map((t) => (
            <button key={t.v} onClick={() => setTxTypes(txTypes.includes(t.v) ? txTypes.filter((x) => x !== t.v) : [...txTypes, t.v])}
              className={cx("focusable px-2.5 py-1 rounded-full border text-[11px] font-semibold", txTypes.includes(t.v) ? "bg-steel-600 text-paper border-steel-600" : "bg-card border-mist text-ink-soft")}>{t.l}</button>
          ))}</div>
        </Field>
        <Field label="Pricing axes" hint="Pick the ways this product splits its pricing.">
          <div className="flex gap-1.5 flex-wrap">{axes.map((a) => (
            <button key={a.id} onClick={() => setProdAxes(prodAxes.includes(a.id) ? prodAxes.filter((x) => x !== a.id) : [...prodAxes, a.id])}
              className={cx("focusable px-2.5 py-1 rounded-full border text-[11px] font-semibold", prodAxes.includes(a.id) ? "bg-ink text-paper border-ink" : "bg-card border-mist text-ink-soft")}>{a.name}</button>
          ))}</div>
        </Field>
      </div>
    </Modal>
  );
}
