import Link from "next/link";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, contacts, deals, DEAL_STAGES, lists, listMembers, recordings } from "@/db/schema";
import { Badge, Card, Empty, LinkButton, PageHeader, Stat } from "@/components/ui";
import { TaskRow } from "@/components/task-row";
import { Icon } from "@/components/icons";
import { dueTasks } from "@/lib/task-queries";
import { addDays, dateTime, fullName, money, startOfToday } from "@/lib/format";
import { OUTCOME_COLORS, OUTCOME_LABELS, STAGE_LABELS, ACTIVITY_LABELS } from "@/lib/labels";

export default async function Dashboard() {
  const today = startOfToday();
  const weekAgo = addDays(today, -6);

  const [due, callsToday, weekCalls, pipeline, clientCount, recent, toReview, callLists] = await Promise.all([
    dueTasks(),
    db
      .select({ outcome: activities.outcome, n: sql<number>`count(*)` })
      .from(activities)
      .where(and(eq(activities.type, "call"), gte(activities.occurredAt, today)))
      .groupBy(activities.outcome),
    db
      .select({ day: sql<string>`date(${activities.occurredAt}, 'unixepoch', 'localtime')`, n: sql<number>`count(*)` })
      .from(activities)
      .where(and(eq(activities.type, "call"), gte(activities.occurredAt, weekAgo)))
      .groupBy(sql`1`),
    db
      .select({ stage: deals.stage, n: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${deals.value}),0)` })
      .from(deals)
      .groupBy(deals.stage),
    db.select({ n: sql<number>`count(*)` }).from(contacts).where(eq(contacts.status, "client")),
    db
      .select({ a: activities, first: contacts.firstName, last: contacts.lastName })
      .from(activities)
      .leftJoin(contacts, eq(activities.contactId, contacts.id))
      .orderBy(desc(activities.occurredAt))
      .limit(8),
    db
      .select({ id: recordings.id, fileName: recordings.fileName, status: recordings.status, contactId: recordings.contactId })
      .from(recordings)
      .where(and(inArray(recordings.status, ["done", "transcribed"]), isNull(recordings.analysisAppliedAt)))
      .limit(5),
    db
      .select({
        id: lists.id,
        name: lists.name,
        total: sql<number>`count(${listMembers.contactId})`,
        remaining: sql<number>`sum(case when ${listMembers.done} = 0 then 1 else 0 end)`,
      })
      .from(lists)
      .leftJoin(listMembers, eq(listMembers.listId, lists.id))
      .groupBy(lists.id)
      .orderBy(desc(lists.createdAt))
      .limit(4),
  ]);

  const dialsToday = callsToday.reduce((s, r) => s + r.n, 0);
  const connectsToday = callsToday
    .filter((r) => r.outcome && ["connected", "meeting_booked", "not_interested", "call_back"].includes(r.outcome))
    .reduce((s, r) => s + r.n, 0);
  const meetingsToday = callsToday.find((r) => r.outcome === "meeting_booked")?.n ?? 0;
  const openStages = pipeline.filter((p) => !["won", "lost"].includes(p.stage));
  const openValue = openStages.reduce((s, p) => s + p.total, 0);
  const openCount = openStages.reduce((s, p) => s + p.n, 0);
  const wonValue = pipeline.find((p) => p.stage === "won")?.total ?? 0;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekAgo, i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { label: d.toLocaleDateString("en-US", { weekday: "short" }), n: weekCalls.find((w) => w.day === key)?.n ?? 0 };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.n));
  const maxStage = Math.max(1, ...openStages.map((p) => p.total));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={greeting}
        subtitle={
          due.length
            ? `You have ${due.length} follow-up${due.length === 1 ? "" : "s"} due today.`
            : "Nothing due today. Good time to work a call list."
        }
        actions={
          <>
            <LinkButton href="/contacts/new">
              <Icon name="plus" /> Contact
            </LinkButton>
            <LinkButton href="/lists" variant="primary">
              <Icon name="phone" /> Start calling
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Dials today" value={dialsToday} hint={`${connectsToday} conversations`} />
        <Stat label="Meetings booked today" value={meetingsToday} />
        <Stat label="Open pipeline" value={money(openValue)} hint={`${openCount} open deals`} href="/pipeline" />
        <Stat label="Won (all time)" value={money(wonValue)} href="/pipeline" />
        <Stat label="Active clients" value={clientCount[0]?.n ?? 0} href="/clients" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Due today"
          action={
            <Link href="/tasks" className="text-xs text-zinc-400 hover:text-white">
              All tasks →
            </Link>
          }
        >
          {due.length ? (
            <ul className="divide-y divide-ink-700/60">
              {due.slice(0, 12).map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </ul>
          ) : (
            <Empty title="You're all caught up">Follow-ups you schedule after calls show up here.</Empty>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Calls this week">
            <div className="flex h-32 items-end gap-2 px-4 pb-3 pt-4">
              {days.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-zinc-400">{d.n || ""}</span>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-accent-600 to-accent-400"
                    style={{ height: `${(d.n / maxDay) * 80 + (d.n ? 4 : 1)}px`, opacity: d.n ? 1 : 0.25 }}
                  />
                  <span className="text-[10px] text-zinc-500">{d.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Call lists" action={<Link href="/lists" className="text-xs text-zinc-400 hover:text-white">All →</Link>}>
            {callLists.length ? (
              <ul className="divide-y divide-ink-700/60">
                {callLists.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <Link href={`/lists/${l.id}`} className="truncate text-sm text-zinc-200 hover:text-white">
                      {l.name}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{l.remaining ?? 0} left</span>
                      {(l.remaining ?? 0) > 0 && (
                        <LinkButton href={`/lists/${l.id}/call`} size="sm" variant="primary">
                          Call
                        </LinkButton>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No call lists yet">
                <Link href="/lists" className="text-accent-300">Create one</Link> to start a calling session.
              </Empty>
            )}
          </Card>
        </div>

        <Card title="Pipeline" className="lg:col-span-1">
          <div className="space-y-2.5 p-4">
            {DEAL_STAGES.filter((s) => !["won", "lost"].includes(s)).map((s) => {
              const p = pipeline.find((x) => x.stage === s);
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300">{STAGE_LABELS[s]}</span>
                    <span className="tabular-nums text-zinc-500">
                      {p?.n ?? 0} · {money(p?.total ?? 0)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-ink-800">
                    <div className="h-1.5 rounded-full bg-accent-500" style={{ width: `${((p?.total ?? 0) / maxStage) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Recent activity" className="lg:col-span-1">
          {recent.length ? (
            <ul className="divide-y divide-ink-700/60">
              {recent.map(({ a, first, last }) => (
                <li key={a.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-400">{ACTIVITY_LABELS[a.type]}</span>
                    {a.contactId && (
                      <Link href={`/contacts/${a.contactId}`} className="truncate text-zinc-100 hover:text-accent-300">
                        {fullName({ firstName: first ?? "", lastName: last })}
                      </Link>
                    )}
                    {a.outcome && <Badge className={OUTCOME_COLORS[a.outcome]}>{OUTCOME_LABELS[a.outcome]}</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">{dateTime(a.occurredAt)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No activity yet" />
          )}
        </Card>

        <Card title="Recordings to review" className="lg:col-span-1">
          {toReview.length ? (
            <ul className="divide-y divide-ink-700/60">
              {toReview.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <Link href={`/recordings/${r.id}`} className="truncate text-sm text-zinc-200 hover:text-white">
                    {r.fileName}
                  </Link>
                  <Badge className="bg-accent-500/15 text-accent-300 ring-accent-500/30">
                    <Icon name="sparkles" className="mr-1 size-3" />
                    Review
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nothing to review">
              Upload a call recording from a contact page and the AI summary lands here.
            </Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
