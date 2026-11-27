import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, listMembers, lists } from "@/db/schema";
import { deleteList, removeFromList, requeueUnreached, resetList, updateList } from "@/lib/actions";
import { fullName, relative, telHref } from "@/lib/format";
import { OUTCOME_COLORS, OUTCOME_LABELS } from "@/lib/labels";
import { Badge, Button, Card, Empty, Field, Input, LinkButton, PageHeader, Textarea } from "@/components/ui";
import { Icon } from "@/components/icons";

export default async function ListPage({ params }: PageProps<"/lists/[id]">) {
  const id = Number((await params).id);
  const list = await db.query.lists.findFirst({ where: eq(lists.id, id) });
  if (!list) notFound();
  const members = await db
    .select({ m: listMembers, c: contacts, companyName: companies.name })
    .from(listMembers)
    .innerJoin(contacts, eq(listMembers.contactId, contacts.id))
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(eq(listMembers.listId, id))
    .orderBy(listMembers.done, listMembers.position);
  const remaining = members.filter((r) => !r.m.done).length;
  const retryable = members.filter(
    (r) => r.m.done && r.m.lastOutcome && ["no_answer", "voicemail", "gatekeeper", "call_back"].includes(r.m.lastOutcome),
  ).length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={list.name}
        subtitle={`${members.length} contacts · ${remaining} left to work`}
        actions={
          <>
            <LinkButton href={`/contacts?list=${id}`}>View as contacts</LinkButton>
            <LinkButton href={`/import?list=${id}`}>
              <Icon name="upload" /> Import into list
            </LinkButton>
            {retryable > 0 && (
              <form action={requeueUnreached.bind(null, id)}>
                <Button>Re-queue {retryable} unreached</Button>
              </form>
            )}
            {remaining === 0 && members.length > 0 && retryable === 0 && (
              <form action={resetList.bind(null, id)}>
                <Button>Restart whole list</Button>
              </form>
            )}
            {remaining > 0 && (
              <LinkButton href={`/lists/${id}/call`} variant="primary">
                <Icon name="phone" /> Start calling ({remaining})
              </LinkButton>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {members.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-2 py-2.5">Phone</th>
                  <th className="px-2 py-2.5">Last outcome</th>
                  <th className="px-2 py-2.5">Attempts</th>
                  <th className="px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/60">
                {members.map(({ m, c, companyName }) => {
                  const phone = c.mobile ?? c.phone;
                  return (
                    <tr key={c.id} className={m.done ? "opacity-50" : "hover:bg-ink-850/60"}>
                      <td className="px-4 py-2">
                        <Link href={`/contacts/${c.id}`} className="font-medium text-zinc-100 hover:text-accent-300">
                          {fullName(c)}
                        </Link>
                        <div className="text-xs text-zinc-500">{[c.title, companyName].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="px-2 py-2 tabular-nums">{phone ? <a href={telHref(phone)} className="text-zinc-300 hover:text-accent-300">{phone}</a> : <span className="text-zinc-600">no phone</span>}</td>
                      <td className="px-2 py-2">
                        {m.lastOutcome ? <Badge className={OUTCOME_COLORS[m.lastOutcome]}>{OUTCOME_LABELS[m.lastOutcome]}</Badge> : <span className="text-xs text-zinc-600">Not called</span>}
                        {m.lastAttemptAt && <div className="text-[11px] text-zinc-500">{relative(m.lastAttemptAt)}</div>}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-zinc-400">{m.attempts}</td>
                      <td className="px-2 py-2 text-right">
                        <form action={removeFromList.bind(null, id, c.id)}>
                          <button className="text-xs text-zinc-500 hover:text-rose-300">Remove</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty title="This list is empty">
              Add people from the <Link href="/contacts" className="text-accent-300">Contacts</Link> page (select, then &quot;Add to call list&quot;) or{" "}
              <Link href={`/import?list=${id}`} className="text-accent-300">import a CSV</Link> straight into it.
            </Empty>
          )}
        </Card>
        <Card title="List settings" className="h-fit">
          <form action={updateList.bind(null, id)} className="space-y-3 p-4">
            <Field label="Name">
              <Input name="name" defaultValue={list.name} required />
            </Field>
            <Field label="Description">
              <Input name="description" defaultValue={list.description ?? ""} />
            </Field>
            <Field label="Call script / talking points">
              <Textarea name="callScript" defaultValue={list.callScript ?? ""} className="min-h-48" />
            </Field>
            <Button type="submit" variant="primary" className="w-full">
              Save
            </Button>
          </form>
          <form action={deleteList.bind(null, id)} className="border-t border-ink-700 p-4">
            <Button variant="danger" size="sm">
              Delete list (contacts are kept)
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
