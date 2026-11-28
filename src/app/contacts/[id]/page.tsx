import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, companies, contacts, deals, listMembers, lists, problems, recordings } from "@/db/schema";
import { createProblem } from "@/lib/problem-actions";
import { existingThemes } from "@/lib/problems";
import { deleteContact, updateContact, removeFromList } from "@/lib/actions";
import { contactTasks } from "@/lib/task-queries";
import { fullName, initials, money, relative, telHref, date } from "@/lib/format";
import { PROBLEM_STATUS_LABELS, SOLVABLE_COLORS, SOLVABLE_LABELS, STAGE_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { Avatar, Badge, Button, Card, Empty, Input, Select } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Timeline } from "@/components/timeline";
import { NoteForm } from "@/components/note-form";
import { TaskForm } from "@/components/task-form";
import { TaskRow } from "@/components/task-row";
import { DealForm } from "@/components/deal-form";
import { ContactForm } from "@/components/contact-form";
import { LogCallPanel } from "@/components/log-call-panel";
import { RecordingUploader } from "@/components/recording-uploader";
import { AddToList } from "@/components/add-to-list";
import { GoogleQuickActions } from "@/components/google-quick-actions";
import { googleReady } from "@/lib/google-sync";

export async function generateMetadata({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const c = await db.query.contacts.findFirst({ where: eq(contacts.id, Number(id)) });
  return { title: c ? fullName(c) : "Contact" };
}

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const id = Number((await params).id);
  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
  if (!contact) notFound();

  const [company, acts, contactDeals, taskRows, memberships, allLists, recs, probs, themes] = await Promise.all([
    contact.companyId ? db.query.companies.findFirst({ where: eq(companies.id, contact.companyId) }) : null,
    db.select().from(activities).where(eq(activities.contactId, id)).orderBy(desc(activities.occurredAt)),
    db.select().from(deals).where(eq(deals.contactId, id)).orderBy(desc(deals.createdAt)),
    contactTasks(id),
    db
      .select({ id: lists.id, name: lists.name, lastOutcome: listMembers.lastOutcome, done: listMembers.done })
      .from(listMembers)
      .innerJoin(lists, eq(listMembers.listId, lists.id))
      .where(eq(listMembers.contactId, id)),
    db.select({ id: lists.id, name: lists.name }).from(lists),
    db.select().from(recordings).where(eq(recordings.contactId, id)).orderBy(desc(recordings.createdAt)),
    db.select().from(problems).where(eq(problems.contactId, id)).orderBy(desc(problems.createdAt)),
    existingThemes(),
  ]);

  const openTasks = taskRows.filter((t) => !t.completedAt);
  const phone = contact.mobile ?? contact.phone;
  const calls = acts.filter((a) => a.type === "call").length;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar text={initials(contact)} className="size-14 text-lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">{fullName(contact)}</h1>
              <Badge className={STATUS_COLORS[contact.status]}>{STATUS_LABELS[contact.status]}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-zinc-400">
              {contact.title}
              {contact.title && company && " at "}
              {company && (
                <Link href={`/companies/${company.id}`} className="text-zinc-200 hover:text-accent-300">
                  {company.name}
                </Link>
              )}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {calls} call{calls === 1 ? "" : "s"} · last contact {relative(contact.lastContactedAt)}
              {contact.nextFollowUpAt && ` · follow up ${relative(contact.nextFollowUpAt)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {phone && (
            <a
              href={telHref(phone)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              <Icon name="phone" /> {phone}
            </a>
          )}
          {contact.mobile && contact.phone && contact.mobile !== contact.phone && (
            <a href={telHref(contact.phone)} className="rounded-lg px-3 py-2 text-sm text-zinc-300 ring-1 ring-ink-600 hover:bg-ink-800">
              Office: {contact.phone}
            </a>
          )}
          {contact.linkedinUrl && (
            <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 ring-1 ring-ink-600 hover:bg-ink-800">
              <Icon name="link" /> LinkedIn
            </a>
          )}
        </div>
      </div>

      <div className="-mt-3 mb-6 flex justify-end">
        <GoogleQuickActions
          contactId={id}
          firstName={contact.firstName}
          fullName={fullName(contact)}
          company={company?.name ?? null}
          email={contact.email}
          phone={phone}
          notes={contact.notes}
          googleConnected={googleReady()}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Log a call">
            <div className="p-4">
              <LogCallPanel contactId={id} />
            </div>
          </Card>
          <Card title="Add a note">
            <div className="p-4">
              <NoteForm contactId={id} />
            </div>
          </Card>
          <Card title={`Activity (${acts.length})`}>
            <Timeline items={acts} />
          </Card>
        </div>

        <div className="space-y-6">
          {(contact.painPoints || contact.notes) && (
            <Card title="What we know">
              <div className="space-y-3 p-4 text-sm">
                {contact.painPoints && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-zinc-500">Pain points</div>
                    <p className="whitespace-pre-wrap text-zinc-300">{contact.painPoints}</p>
                  </div>
                )}
                {contact.notes && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-zinc-500">Notes</div>
                    <p className="whitespace-pre-wrap text-zinc-300">{contact.notes}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card
            title={`Problems (${probs.length})`}
            action={
              <Link href="/opportunities" className="text-xs text-accent-300 hover:text-accent-400">
                Opportunities
              </Link>
            }
          >
            {probs.length > 0 && (
              <ul className="divide-y divide-ink-700/60 border-b border-ink-700">
                {probs.map((p) => (
                  <li key={p.id} className="space-y-1 px-4 py-2.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-zinc-100">{p.title}</span>
                      <Badge className={SOLVABLE_COLORS[p.solvable]}>{SOLVABLE_LABELS[p.solvable]}</Badge>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {p.theme} · {PROBLEM_STATUS_LABELS[p.status]}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <details className="p-4">
              <summary className="cursor-pointer text-sm text-accent-300 hover:text-accent-400">+ Add a problem</summary>
              <form action={createProblem} className="mt-3 space-y-2">
                <input type="hidden" name="contactId" value={id} />
                <Input name="title" placeholder="What's the problem?" required />
                <Input name="theme" placeholder="Theme, e.g. Missed calls after hours" list="problem-themes" />
                <datalist id="problem-themes">
                  {themes.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <Select name="solvable" defaultValue="no">
                  <option value="yes">I can solve this now</option>
                  <option value="partially">Partly</option>
                  <option value="no">Not yet</option>
                </Select>
                <Button type="submit" variant="primary" size="sm">Save problem</Button>
              </form>
            </details>
          </Card>

          <Card title={`Tasks (${openTasks.length})`}>
            {openTasks.length > 0 && (
              <ul className="divide-y divide-ink-700/60 border-b border-ink-700">
                {openTasks.map((t) => (
                  <TaskRow key={t.id} t={t} showContact={false} />
                ))}
              </ul>
            )}
            <div className="p-3">
              <TaskForm contactId={id} />
            </div>
          </Card>

          <Card title="Deals">
            {contactDeals.length > 0 && (
              <ul className="divide-y divide-ink-700/60 border-b border-ink-700">
                {contactDeals.map((d) => (
                  <li key={d.id} className="px-4 py-2.5">
                    <details>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                        <span className="text-sm text-zinc-100">{d.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs tabular-nums text-zinc-400">{money(d.value)}</span>
                          <Badge>{STAGE_LABELS[d.stage]}</Badge>
                        </span>
                      </summary>
                      <div className="mt-3">
                        <DealForm deal={d} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <details className="p-4">
              <summary className="cursor-pointer text-sm text-accent-300 hover:text-accent-400">+ New deal</summary>
              <div className="mt-3">
                <DealForm contactId={id} companyId={contact.companyId} defaultName={company?.name ?? fullName(contact)} />
              </div>
            </details>
          </Card>

          <Card title="Call recordings">
            {recs.length > 0 && (
              <ul className="divide-y divide-ink-700/60 border-b border-ink-700">
                {recs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <Link href={`/recordings/${r.id}`} className="truncate text-zinc-200 hover:text-accent-300">
                      {r.fileName}
                    </Link>
                    <span className="shrink-0 text-xs text-zinc-500">{date(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="p-3">
              <RecordingUploader contactId={id} compact />
            </div>
          </Card>

          <Card title="Call lists">
            {memberships.length > 0 ? (
              <ul className="divide-y divide-ink-700/60 border-b border-ink-700">
                {memberships.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <Link href={`/lists/${m.id}`} className="text-zinc-200 hover:text-accent-300">
                      {m.name}
                    </Link>
                    <form action={removeFromList.bind(null, m.id, id)}>
                      <button className="text-xs text-zinc-500 hover:text-rose-300">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Not on any list" />
            )}
            <div className="p-3">
              <AddToList contactId={id} lists={allLists.filter((l) => !memberships.some((m) => m.id === l.id))} />
            </div>
          </Card>

          <Card title="Details">
            <details className="p-4" open={!contact.phone && !contact.email && !contact.mobile}>
              <summary className="cursor-pointer text-sm text-zinc-300">
                {[contact.email, contact.location, contact.source && `Source: ${contact.source}`, contact.tags && `Tags: ${contact.tags}`]
                  .filter(Boolean)
                  .join(" · ") || "Edit details"}
              </summary>
              <div className="mt-4">
                <ContactForm action={updateContact.bind(null, id)} contact={contact} companyName={company?.name} />
              </div>
              <form action={deleteContact.bind(null, id)} className="mt-4 border-t border-ink-700 pt-4">
                <Button variant="danger" size="sm">
                  Delete contact
                </Button>
              </form>
            </details>
          </Card>
        </div>
      </div>
    </div>
  );
}
