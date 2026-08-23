import { useState } from "react";
import type { Case, HandoffKind, Lead, User } from "../types";
import { useStore } from "../store";
import { Avatar, Btn, Field, Ic, Modal, Select, TextArea, cx } from "../ui";

const KINDS: { v: HandoffKind; l: string; d: string }[] = [
  { v: "progression", l: "Stage progression", d: "File moved into a stage owned by another function" },
  { v: "absence", l: "Leave / absence", d: "Owner unavailable — temporary cover or transfer" },
  { v: "rebalance", l: "Rebalance", d: "Team leader redistributing workload" },
  { v: "return", l: "Return for correction", d: "File bounced back with exact corrections required" },
];

export default function HandoffModal({ caze, lead, onClose }: { caze?: Case; lead?: Lead; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [toId, setToId] = useState("");
  const [kind, setKind] = useState<HandoffKind>(caze ? "progression" : "absence");
  const [reason, setReason] = useState("");
  const currentId = caze ? caze.ownerId : lead?.owner ?? "";
  const current = state.users.find((u) => u.id === currentId);
  const target = state.users.find((u) => u.id === toId);

  /* eligible targets: active, not the current owner; prefer relevant function */
  const fn = caze ? ["SPO", "TL", "HEAD"] : ["VRM", "TL", "HEAD"];
  const eligible = state.users.filter((u) => u.active && u.id !== currentId);
  const ranked = [
    ...eligible.filter((u) => fn.includes(u.role)),
    ...eligible.filter((u) => !fn.includes(u.role)),
  ];

  const kDef = KINDS.find((k) => k.v === kind)!;
  const ref = caze?.ref ?? lead?.ref ?? "";
  const clientName = caze
    ? state.persons.find((p) => p.id === caze.personId)?.name ?? ""
    : state.persons.find((p) => p.id === lead?.personId)?.name ?? "";

  const submit = () => {
    if (!toId) return;
    if (caze) dispatch({ t: "HANDOFF_CASE", caseId: caze.id, toId, reason: reason.trim() || kDef.l, kind });
    else if (lead) dispatch({ t: "HANDOFF_LEAD", leadId: lead.id, toId, reason: reason.trim() || "Reassigned" });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Handoff ${ref}`} width={540}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="dark" disabled={!toId} onClick={submit}><Ic n="arrowR" size={14} /> Confirm handoff</Btn>
      </>}>
      <p className="text-[12px] text-ink-soft mb-4">
        Single active owner — this file moves to <strong className="text-ink">{target?.name ?? "…"}</strong> and is recorded in the audit trail. {clientName && <>Client: <strong className="text-ink">{clientName}</strong>.</>}
      </p>

      {caze && (
        <div className="mb-4">
          <p className="text-[11px] font-display font-semibold uppercase tracking-[0.09em] text-ink-soft mb-1.5">Reason</p>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button key={k.v} onClick={() => setKind(k.v)}
                className={cx("focusable text-left border rounded-md px-3 py-2 transition-all",
                  kind === k.v ? "border-pine-600 bg-pine-50 shadow-sm" : "border-mist bg-card hover:border-pine-400")}>
                <p className={cx("font-display font-bold text-[12px] tracking-tight", kind === k.v ? "text-pine-800" : "text-ink")}>{k.l}</p>
                <p className="text-[10.5px] text-ink-soft leading-snug mt-0.5">{k.d}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2.5 mb-4">
        <div className="border border-mist rounded-md px-3 py-2.5 bg-paper/50">
          <p className="text-[10px] font-display font-semibold uppercase tracking-[0.09em] text-ink-soft">From</p>
          <div className="flex items-center gap-2 mt-1"><Avatar name={current?.name ?? "?"} size={22} /><span className="text-[12.5px] font-semibold">{current?.name ?? "—"}</span></div>
        </div>
        <Ic n="arrowR" size={18} className="text-pine-600 mb-3" />
        <Field label="To" req>
          <Select value={toId} onChange={setToId}
            options={[{ v: "", l: "Select owner…" }, ...ranked.map((u) => ({ v: u.id, l: `${u.name} · ${u.role === "TL" ? "Team Leader" : u.role}` }))]} />
        </Field>
      </div>

      <Field label="Note (optional)">
        <TextArea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
          placeholder={caze ? "e.g. Advancing to FOL — SPO takes over client confirmation" : "e.g. On leave till Friday — please cover my files"} />
      </Field>
    </Modal>
  );
}
