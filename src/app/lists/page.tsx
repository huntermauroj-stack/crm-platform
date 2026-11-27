import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { listMembers, lists } from "@/db/schema";
import { createList } from "@/lib/actions";
import { Button, Card, Empty, Field, Input, LinkButton, PageHeader, Textarea } from "@/components/ui";
import { Icon } from "@/components/icons";
import { date } from "@/lib/format";

export const metadata = { title: "Call lists" };

export default async function ListsPage() {
  const rows = await db
    .select({
      id: lists.id,
      name: lists.name,
      description: lists.description,
      createdAt: lists.createdAt,
      total: sql<number>`count(${listMembers.contactId})`,
      remaining: sql<number>`coalesce(sum(case when ${listMembers.done} = 0 then 1 else 0 end),0)`,
      attempted: sql<number>`coalesce(sum(case when ${listMembers.attempts} > 0 then 1 else 0 end),0)`,
      meetings: sql<number>`coalesce(sum(case when ${listMembers.lastOutcome} = 'meeting_booked' then 1 else 0 end),0)`,
    })
    .from(lists)
    .leftJoin(listMembers, eq(listMembers.listId, lists.id))
    .groupBy(lists.id)
    .orderBy(desc(lists.createdAt));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Call lists" subtitle="Group prospects into lists, then work through them one call at a time." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {rows.length ? (
            rows.map((l) => {
              const pct = l.total ? Math.round(((l.total - l.remaining) / l.total) * 100) : 0;
              return (
                <Card key={l.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/lists/${l.id}`} className="text-base font-medium text-white hover:text-accent-300">
                        {l.name}
                      </Link>
                      {l.description && <p className="mt-0.5 text-sm text-zinc-400">{l.description}</p>}
                      <p className="mt-1 text-xs text-zinc-500">
                        {l.total} contacts · {l.attempted} called · {l.meetings} meetings · created {date(l.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <LinkButton href={`/lists/${l.id}`} size="sm">
                        Manage
                      </LinkButton>
                      {l.remaining > 0 && (
                        <LinkButton href={`/lists/${l.id}/call`} size="sm" variant="primary">
                          <Icon name="phone" className="size-3.5" /> Call ({l.remaining})
                        </LinkButton>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-ink-800">
                    <div className="h-1.5 rounded-full bg-gradient-to-r from-accent-500 to-fuchsia-500" style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              );
            })
          ) : (
            <Card>
              <Empty title="No call lists yet">Create your first list on the right, then add contacts from the Contacts page or a CSV import.</Empty>
            </Card>
          )}
        </div>
        <Card title="New list" className="h-fit">
          <form action={createList} className="space-y-3 p-4">
            <Field label="Name">
              <Input name="name" required placeholder="e.g. Dental clinics in Tampa" />
            </Field>
            <Field label="Description">
              <Input name="description" placeholder="Who's on it and why" />
            </Field>
            <Field label="Call script / talking points">
              <Textarea name="callScript" className="min-h-32" placeholder={"Hi {name}, this is Hunter…\nDiscovery questions…\nObjection handling…"} />
              <span className="mt-1 block text-[11px] text-zinc-500">{"{name}"}, {"{company}"} and {"{title}"} are filled in during calls.</span>
            </Field>
            <Button type="submit" variant="primary" className="w-full">
              Create list
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
