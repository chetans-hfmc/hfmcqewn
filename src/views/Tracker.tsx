import { useMemo, useState } from "react";
import { useMe, useNav, useStore } from "../store";
import { Avatar, Btn, DueChip, Ic, Modal, Pill, Select, TextInput, cx, fmtDate, todayISO } from "../ui";
import type { Case } from "../types";

const STAGE_TONE: Record<string, string> = {
  PREAPP: "bg-steel-100 text-steel-700", VALUATION: "bg-amber-100 text-amber-700",
  FOL: "bg-pine-100 text-pine-700", BOOKING: "bg-pine-200 text-pine-800",
  RELEASE: "bg-amber-100 text-amber-700", TRANSFER: "bg-steel-100 text-steel-700",
  CLOSURE: "bg-gr-100 text-gr-700", HANDOVER: "bg-gr-100 text-gr-700",
  INTAKE: "bg-gr-100 text-gr-700", FILEQC: "bg-gr-100 text-gr-700", SUBMIT: "bg-gr-100 text-gr-700",
  QUERY: "bg-rust-100 text-rust-700", DDA: "bg-pine-100 text-pine-700", TITLEQC: "bg-steel-100 text-steel-700",
};

function nextWorkingDay(iso: string): string {
  const dt = new Date(iso + "T12:00:00");
  do { dt.setDate(dt.getDate() + 1); } while (dt.getDay() === 5 || dt.getDay() === 6); // UAE weekend Fri–Sat (tracker shows Sun–Thu working days)
  return dt.toISOString().slice(0, 10);
}

export default function TrackerView() {
  const { state, dispatch } = useStore();
  const nav = useNav();
  const me = useMe()!;
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("ALL");
  const [bank, setBank] = useState("ALL");
  const [owner, setOwner] = useState("ALL");
  const [openOnly, setOpenOnly] = useState(true);
  const [edit, setEdit] = useState<{ caze: Case; date: string } | null>(null);
  const [note, setNote] = useState("");
  const [confirmDay, setConfirmDay] = useState<string | null>(null);
  const [span, setSpan] = useState(3);

  const dates = state.trackerDates;
  const shown = span <= 0 ? dates : dates.slice(-span);
  const today = todayISO();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.cases
      .filter((c) => (openOnly ? c.status === "OPEN" : true))
      .filter((c) => (stage === "ALL" ? true : c.stage === stage))
      .filter((c) => (bank === "ALL" ? true : c.bankId === bank))
      .filter((c) => (owner === "ALL" ? true : c.ownerId === owner))
      .filter((c) => {
        if (!needle) return true;
        const p = state.persons.find((x) => x.id === c.personId);
        const b = state.banks.find((x) => x.id === c.bankId);
        return [p?.name, c.ref, c.deal, c.bankRm, b?.short].join(" ").toLowerCase().includes(needle);
      })
      .sort((a, b) => a.ref.localeCompare(b.ref));
  }, [state.cases, state.persons, state.banks, q, stage, bank, owner, openOnly]);

  const cellOf = (c: Case, date: string) => c.tracker?.find((e) => e.date === date)?.note ?? "";
  const latestNote = (c: Case) => (c.tracker?.length ? c.tracker[c.tracker.length - 1].note : "");

  const openEdit = (caze: Case, date: string) => { setEdit({ caze, date }); setNote(cellOf(caze, date)); };
  const saveEdit = () => {
    if (!edit) return;
    dispatch({ t: "SET_TRACKER", caseId: edit.caze.id, date: edit.date, note });
    setEdit(null);
  };

  const updatedToday = state.cases.filter((c) => c.tracker?.some((e) => e.date === today)).length;
  const updMap = new Map<string, string>();
  rows.forEach((c) => c.tracker?.forEach((e) => updMap.set(e.date, e.date)));

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 anim-up">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft"><Ic n="search" size={14} /></span>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, ref, RM…" className="pl-8 w-[240px]" />
        </div>
        <Select value={stage} onChange={setStage} className="w-[150px]" options={[{ v: "ALL", l: "All stages" }, ...state.stages.map((s) => ({ v: s.id, l: s.name }))]} />
        <Select value={bank} onChange={setBank} className="w-[130px]" options={[{ v: "ALL", l: "All banks" }, ...state.banks.map((b) => ({ v: b.id, l: b.short }))]} />
        <Select value={owner} onChange={setOwner} className="w-[150px]" options={[{ v: "ALL", l: "All owners" }, ...state.users.filter((u) => u.active).map((u) => ({ v: u.id, l: u.name }))]} />
        <button
          onClick={() => setOpenOnly(!openOnly)}
          className={cx("focusable h-[34px] px-3 rounded-md border text-[12px] font-semibold font-display tracking-wide transition-all",
            openOnly ? "bg-pine-700 border-pine-700 text-paper shadow-sm" : "bg-card border-mist text-ink-soft hover:border-pine-400")}
        >
          Open files only
        </button>
        <Select value={String(span)} onChange={(v) => setSpan(Number(v))} className="w-[140px]"
          options={[{ v: "3", l: "Last 3 days" }, { v: "6", l: "Last 6 days" }, { v: "0", l: "All days" }]} />
        <div className="ml-auto flex items-center gap-2">
          <Btn variant="outline" onClick={() => {
            const head = ["Ref", "Client", "Deal", "Stage", "Bank", "Bank RM", "Channel", "Owner", "Status", "Latest position", ...dates.map((dt) => fmtDate(dt))];
            const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
            const lines = [head.map(esc).join(",")];
            rows.forEach((c) => {
              const person = state.persons.find((p) => p.id === c.personId);
              const bankObj = state.banks.find((b) => b.id === c.bankId);
              const stDef = state.stages.find((s) => s.id === c.stage);
              const ownerObj = state.users.find((u) => u.id === c.ownerId);
              lines.push([c.ref, person?.name ?? "", c.deal ?? "", stDef?.name ?? "", bankObj?.short ?? "", c.bankRm ?? "", c.channel ?? "", ownerObj?.name ?? "",
                c.status === "CLOSED" ? (c.outcome === "WON" ? "Won & Closed" : "Closed") : "Open", latestNote(c), ...dates.map((dt) => cellOf(c, dt))].map(esc).join(","));
            });
            const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `HFMC-daily-tracker-${today}.csv`;
            a.click(); URL.revokeObjectURL(url);
          }}>
            <Ic n="download" size={13} /> Export CSV
          </Btn>
          <Btn variant="outline" onClick={() => setConfirmDay(nextWorkingDay(dates[dates.length - 1]))}>
            <Ic n="plus" size={13} /> Add day
          </Btn>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-ink-soft anim-up">
        <span><strong className="num text-ink">{rows.length}</strong> files in view</span>
        <span><strong className="num text-ink">{rows.filter((r) => r.tracker?.length).length}</strong> with daily log</span>
        <span><strong className="num text-ink">{updatedToday}</strong> updated today</span>
        <span className="hidden md:inline text-ink-soft/80">Click any cell to log the day's position · click a file to open Case 360</span>
      </div>

      {/* grid */}
      <div className="bg-card border border-mist rounded-lg overflow-hidden anim-up">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]" style={{ minWidth: 440 + shown.length * 250 }}>
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.09em] font-display text-ink-soft border-b border-mist bg-paper/70">
                <th className="px-3.5 py-2.5 font-semibold w-[300px] sticky left-0 bg-[#f2f4ec] z-10 border-r border-mist">File</th>
                <th className="px-3 py-2.5 font-semibold w-[140px]">Latest position</th>
                {shown.map((dt) => (
                  <th key={dt} className={cx("px-3 py-2.5 font-semibold whitespace-nowrap", dt === today && "text-pine-700")}>
                    {fmtDate(dt)}
                    {dt === today && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-pine-600 align-middle" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const person = state.persons.find((p) => p.id === c.personId);
                const bankObj = state.banks.find((b) => b.id === c.bankId);
                const stDef = state.stages.find((s) => s.id === c.stage);
                const ownerObj = state.users.find((u) => u.id === c.ownerId);
                const latest = latestNote(c);
                return (
                  <tr key={c.id} className="border-b border-mist/70 hover:bg-pine-50/40 transition-colors group">
                    <td className="px-3.5 py-2.5 sticky left-0 bg-card group-hover:bg-[#f4f7f0] transition-colors z-10 border-r border-mist align-top">
                      <button className="focusable text-left w-full" onClick={() => nav.go("cases", { caseId: c.id })}>
                        <div className="flex items-center gap-2">
                          <span className="num text-[10.5px] font-bold text-pine-700 bg-pine-100 rounded px-1.5 py-0.5 shrink-0">{c.ref}</span>
                          {c.status === "CLOSED" && <Pill tone={c.outcome === "WON" ? "green" : "gray"}>{c.outcome === "WON" ? "Won" : "Closed"}</Pill>}
                        </div>
                        <p className="font-display font-bold text-[13px] tracking-tight mt-1 leading-tight">{person?.name}{c.deal ? <span className="text-ink-soft font-medium"> · {c.deal}</span> : null}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className={cx("text-[10px] font-display font-bold uppercase tracking-wide px-1.5 py-[2px] rounded", STAGE_TONE[c.stage] ?? "bg-gr-100 text-gr-700")}>{stDef?.short}</span>
                          <span className="text-[10.5px] font-semibold text-steel-600 bg-steel-100 rounded px-1.5 py-[2px]">{bankObj?.short}</span>
                          <span className="text-[10.5px] text-ink-soft">RM {c.bankRm}</span>
                          <span className={cx("text-[10px] font-semibold rounded px-1.5 py-[2px]", c.channel === "Direct" ? "bg-gr-100 text-gr-700" : c.channel === "Huspy" ? "bg-amber-100 text-amber-700" : "bg-steel-100 text-steel-700")}>{c.channel}</span>
                        </div>
                        {ownerObj && <div className="flex items-center gap-1.5 mt-1.5"><Avatar name={ownerObj.name} size={18} /><span className="text-[10.5px] text-ink-soft">{ownerObj.name}</span></div>}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {latest
                        ? <p className="text-[11.5px] leading-snug text-ink line-clamp-3" title={latest}>{latest}</p>
                        : <span className="text-[11px] text-ink-soft/60 italic">No log yet</span>}
                    </td>
                    {shown.map((dt) => {
                      const val = cellOf(c, dt);
                      return (
                        <td key={dt} className={cx("px-1.5 py-1.5 align-top", dt === today && "bg-pine-50/50")}>
                          <button
                            onClick={() => openEdit(c, dt)}
                            className={cx("focusable w-full min-h-[54px] rounded-md border px-2 py-1.5 text-left transition-all",
                              val ? "border-mist bg-paper/70 hover:border-pine-400 hover:shadow-sm" : "border-dashed border-mist/90 hover:border-pine-400 hover:bg-pine-50/60")}
                            title={val || `Log position for ${fmtDate(dt)}`}
                          >
                            {val
                              ? <span className="text-[11px] leading-snug text-ink line-clamp-4">{val}</span>
                              : <span className="text-[10.5px] text-ink-soft/50 italic">— log update</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={shown.length + 2} className="px-4 py-12 text-center text-ink-soft text-[13px]">
                  No files match the current filters.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* edit cell modal */}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title="Daily tracker — log position">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display font-bold text-[14px] tracking-tight">
                  {edit.caze.ref} · {state.persons.find((p) => p.id === edit.caze.personId)?.name}
                </p>
                <p className="text-[11.5px] text-ink-soft">{state.banks.find((b) => b.id === edit.caze.bankId)?.name} · {fmtDate(edit.date)}</p>
              </div>
              {edit.date === today && <Pill tone="green">Today</Pill>}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
              rows={5}
              placeholder="e.g. Pre-approval received — waiting for client confirmation to move to next stage."
              className="focusable w-full rounded-md border border-mist bg-paper/60 px-3 py-2.5 text-[13px] leading-relaxed resize-y"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10.5px] text-ink-soft">Logged by {me.name} · saved to audit trail</p>
              <div className="flex gap-2">
                <Btn variant="outline" onClick={() => setEdit(null)}>Cancel</Btn>
                <Btn variant="dark" onClick={saveEdit}><Ic n="check" size={13} /> Save entry</Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* add day confirm */}
      {confirmDay && (
        <Modal open onClose={() => setConfirmDay(null)} title="Add tracker day">
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed">
              Open a new working-day column for <strong className="num">{fmtDate(confirmDay)}</strong>?
              Every file in the tracker will gain an empty cell for that day.
            </p>
            <div className="flex justify-end gap-2">
              <Btn variant="outline" onClick={() => setConfirmDay(null)}>Cancel</Btn>
              <Btn variant="dark" onClick={() => { dispatch({ t: "ADD_TRACKER_DAY", date: confirmDay }); setConfirmDay(null); }}>
                <Ic n="plus" size={13} /> Add {fmtDate(confirmDay)}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ageing strip for files with no update in the latest logged day */}
      <div className="anim-up">
        <p className="text-[10.5px] uppercase tracking-[0.12em] font-display font-bold text-ink-soft mb-2">Files not updated on the latest tracker day</p>
        <div className="flex flex-wrap gap-2">
          {rows.filter((c) => c.status === "OPEN" && !cellOf(c, dates[dates.length - 1])).slice(0, 14).map((c) => (
            <button key={c.id} onClick={() => openEdit(c, dates[dates.length - 1])}
              className="focusable flex items-center gap-2 bg-card border border-mist rounded-md pl-1.5 pr-2.5 py-1.5 hover:border-amber-500 hover:shadow-sm transition-all">
              <DueChip iso={dates[dates.length - 1]} />
              <span className="num text-[10.5px] font-bold text-pine-700">{c.ref}</span>
              <span className="text-[11.5px] font-semibold">{state.persons.find((p) => p.id === c.personId)?.name}</span>
            </button>
          ))}
          {rows.filter((c) => c.status === "OPEN" && !cellOf(c, dates[dates.length - 1])).length === 0 && (
            <span className="text-[12px] text-ink-soft italic">All open files logged on {fmtDate(dates[dates.length - 1])}.</span>
          )}
        </div>
      </div>
    </div>
  );
}
