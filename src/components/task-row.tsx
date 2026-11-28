import Link from "next/link";
import { snoozeTask, toggleTask, deleteTask } from "@/lib/actions";
import { relative, telHref } from "@/lib/format";
import { Icon } from "./icons";
import { cx } from "./ui";

export type TaskWithContact = {
  id: number;
  title: string;
  type: string;
  dueAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  contactId: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
};

export function TaskRow({ t, showContact = true }: { t: TaskWithContact; showContact?: boolean }) {
  const overdue = !t.completedAt && t.dueAt && t.dueAt.getTime() < new Date().setHours(0, 0, 0, 0);
  return (
    <li className="group flex items-start gap-3 px-4 py-2.5 hover:bg-ink-850/60">
      <form action={toggleTask.bind(null, t.id)}>
        <button
          className={cx(
            "mt-0.5 flex size-4.5 items-center justify-center rounded-md ring-1 ring-inset transition-colors",
            t.completedAt ? "bg-emerald-500 ring-emerald-500 text-white" : "ring-ink-600 hover:ring-accent-400",
          )}
          aria-label={t.completedAt ? "Mark incomplete" : "Mark complete"}
        >
          {t.completedAt && <Icon name="check" className="size-3" />}
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <div className={cx("text-sm", t.completedAt ? "text-zinc-500 line-through" : "text-zinc-100")}>
          {t.type === "call" && <Icon name="phone" className="mr-1.5 inline size-3.5 text-accent-400" />}
          {t.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
          {t.dueAt && <span className={cx(overdue && "font-medium text-rose-400")}>{overdue ? "Overdue · " : ""}due {relative(t.dueAt)}</span>}
          {showContact && t.contactId && t.contactName && (
            <Link href={`/contacts/${t.contactId}`} className="hover:text-accent-300">
              {t.contactName}
            </Link>
          )}
          {t.notes && <span className="truncate">{t.notes.split("\n")[0]}</span>}
        </div>
      </div>
      {!t.completedAt && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {t.contactPhone && (
            <a href={telHref(t.contactPhone)} className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-ink-700 hover:text-white">
              Call
            </a>
          )}
          <form action={snoozeTask.bind(null, t.id, 1)}>
            <button className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-ink-700 hover:text-white">+1d</button>
          </form>
          <form action={snoozeTask.bind(null, t.id, 7)}>
            <button className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-ink-700 hover:text-white">+1w</button>
          </form>
          <form action={deleteTask.bind(null, t.id)}>
            <button className="rounded-md p-1 text-zinc-500 hover:bg-ink-700 hover:text-rose-300" aria-label="Delete">
              <Icon name="trash" className="size-3.5" />
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
