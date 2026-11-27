import Link from "next/link";
import type { Activity } from "@/db/schema";
import { deleteActivity } from "@/lib/actions";
import { ACTIVITY_LABELS, OUTCOME_COLORS, OUTCOME_LABELS } from "@/lib/labels";
import { dateTime, duration } from "@/lib/format";
import { Icon, type IconName } from "./icons";
import { Badge, Empty } from "./ui";

const ICONS: Record<string, IconName> = {
  call: "phone",
  note: "note",
  email: "mail",
  meeting: "calendar",
  sms: "mail",
  linkedin: "link",
};

export function Timeline({ items, showContact }: { items: (Activity & { contactName?: string | null })[]; showContact?: boolean }) {
  if (!items.length) return <Empty title="No activity yet">Log a call or add a note to start the history.</Empty>;
  return (
    <ol className="relative space-y-0 px-4 py-3">
      {items.map((a, i) => (
        <li key={a.id} className="group relative flex gap-3 pb-5">
          {i < items.length - 1 && <span className="absolute left-[13px] top-7 h-full w-px bg-ink-700" />}
          <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-800 ring-1 ring-ink-600">
            <Icon name={ICONS[a.type] ?? "note"} className="size-3.5 text-zinc-300" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-zinc-100">{a.subject && a.type !== "call" ? a.subject : ACTIVITY_LABELS[a.type]}</span>
              {a.outcome && <Badge className={OUTCOME_COLORS[a.outcome]}>{OUTCOME_LABELS[a.outcome]}</Badge>}
              {a.durationSec ? <span className="text-xs text-zinc-500">{duration(a.durationSec)}</span> : null}
              {showContact && a.contactId && a.contactName && (
                <Link href={`/contacts/${a.contactId}`} className="text-xs text-zinc-400 hover:text-accent-300">
                  {a.contactName}
                </Link>
              )}
              <span className="text-xs text-zinc-500">{dateTime(a.occurredAt)}</span>
              {a.recordingId && (
                <Link
                  href={`/recordings/${a.recordingId}`}
                  className="inline-flex items-center gap-1 text-xs text-accent-300 hover:text-accent-400"
                >
                  <Icon name="mic" className="size-3" /> Recording
                </Link>
              )}
              <form action={deleteActivity.bind(null, a.id)} className="ml-auto opacity-0 group-hover:opacity-100">
                <button className="text-zinc-600 hover:text-rose-300" aria-label="Delete activity">
                  <Icon name="trash" className="size-3.5" />
                </button>
              </form>
            </div>
            {a.body && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{a.body}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
