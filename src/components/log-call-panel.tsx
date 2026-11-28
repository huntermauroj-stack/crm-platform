"use client";

import { useState, useTransition } from "react";
import { logCall } from "@/lib/actions";
import { CALL_OUTCOMES, type CallOutcome } from "@/db/schema";
import { OUTCOME_FOLLOW_UP_DAYS, OUTCOME_LABELS } from "@/lib/labels";
import { addDays, toDateInput } from "@/lib/format";
import { uploadRecording } from "@/lib/audio-client";
import { RecordingProgress } from "./recording-uploader";
import { Button, Field, Input, Textarea, cx } from "./ui";
import { Icon } from "./icons";

const OUTCOME_STYLE: Record<CallOutcome, string> = {
  connected: "data-[on=true]:bg-sky-500/20 data-[on=true]:ring-sky-400 data-[on=true]:text-sky-200",
  meeting_booked: "data-[on=true]:bg-emerald-500/20 data-[on=true]:ring-emerald-400 data-[on=true]:text-emerald-200",
  not_interested: "data-[on=true]:bg-rose-500/20 data-[on=true]:ring-rose-400 data-[on=true]:text-rose-200",
  call_back: "data-[on=true]:bg-amber-500/20 data-[on=true]:ring-amber-400 data-[on=true]:text-amber-200",
  voicemail: "data-[on=true]:bg-slate-500/25 data-[on=true]:ring-slate-400 data-[on=true]:text-slate-100",
  no_answer: "data-[on=true]:bg-slate-500/25 data-[on=true]:ring-slate-400 data-[on=true]:text-slate-100",
  gatekeeper: "data-[on=true]:bg-orange-500/20 data-[on=true]:ring-orange-400 data-[on=true]:text-orange-200",
  wrong_number: "data-[on=true]:bg-rose-500/20 data-[on=true]:ring-rose-400 data-[on=true]:text-rose-200",
};

const KEYS = "12345678";

function defaultFollowUp(o: CallOutcome) {
  const d = OUTCOME_FOLLOW_UP_DAYS[o];
  return d == null ? "" : toDateInput(addDays(new Date(), d));
}

export function LogCallPanel({
  contactId,
  listId,
  onLogged,
  submitLabel = "Log call",
  autoFocusNotes,
}: {
  contactId: number;
  listId?: number | null;
  onLogged?: () => void;
  submitLabel?: string;
  autoFocusNotes?: boolean;
}) {
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState("");
  const [minutes, setMinutes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const [stage, setStage] = useState<string | null>(null);
  const [recId, setRecId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = (o: CallOutcome) => {
    setOutcome(o);
    setFollowUp(defaultFollowUp(o));
  };

  const submit = () => {
    if (!outcome) return;
    setError(null);
    start(async () => {
      const { activityId } = await logCall({
        contactId,
        outcome,
        notes,
        durationMin: minutes ? Number(minutes) : null,
        followUpAt: followUp,
        listId,
      });
      if (file) {
        const r = await uploadRecording({ file, contactId, activityId, onStage: setStage });
        setStage(null);
        if ("error" in r) setError(r.error);
        else setRecId(r.id);
      }
      setOutcome(null);
      setNotes("");
      setMinutes("");
      setFollowUp("");
      setFile(null);
      onLogged?.();
    });
  };

  return (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        const el = e.target as HTMLElement;
        const digit = e.code.startsWith("Digit") ? e.code.slice(5) : "";
        if (e.altKey && digit && KEYS.includes(digit)) {
          e.preventDefault();
          pick(CALL_OUTCOMES[KEYS.indexOf(digit)]);
          return;
        }
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
          return;
        }
        const i = KEYS.indexOf(e.key);
        if (i >= 0) pick(CALL_OUTCOMES[i]);
      }}
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {CALL_OUTCOMES.map((o, i) => (
          <button
            key={o}
            type="button"
            data-on={outcome === o}
            onClick={() => pick(o)}
            className={cx(
              "flex items-center justify-between rounded-lg bg-ink-850 px-2.5 py-2 text-left text-xs font-medium text-zinc-300 ring-1 ring-inset ring-ink-600 transition-colors hover:bg-ink-800",
              OUTCOME_STYLE[o],
            )}
          >
            {OUTCOME_LABELS[o]}
            <kbd className="ml-1 font-mono text-[10px] text-zinc-500">{i + 1}</kbd>
          </button>
        ))}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Call notes: what they said, pain points, who decides, next step…"
        className="min-h-28"
        autoFocus={autoFocusNotes}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="Duration (min)">
          <Input type="number" min="0" step="0.5" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        <Field label="Follow up on">
          <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </Field>
        <Field label="Recording (optional)" className="col-span-2 sm:col-span-1">
          <label className="flex h-[38px] cursor-pointer items-center gap-2 truncate rounded-lg bg-ink-900 px-3 text-sm text-zinc-400 ring-1 ring-inset ring-ink-600 hover:ring-ink-500">
            <Icon name="mic" className="size-4 shrink-0 text-accent-400" />
            <span className="truncate">{file ? file.name : "Choose audio…"}</span>
            <input
              type="file"
              accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.opus,.webm,.mp4"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">
          {stage ?? (outcome ? "Ctrl+Enter to save" : "Pick an outcome (Alt+1–8 while typing)")}
        </span>
        <Button variant="primary" onClick={submit} disabled={!outcome || pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {recId && <RecordingProgress id={recId} />}
    </div>
  );
}
