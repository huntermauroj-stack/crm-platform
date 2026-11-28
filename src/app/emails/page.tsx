import Link from "next/link";
import { and, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activities, companies, contacts, lists } from "@/db/schema";
import { googleAccount } from "@/lib/google";
import { googleReady } from "@/lib/google-sync";
import { dailyLimit, listTemplates, sentToday } from "@/lib/email-templates";
import { campaignStats, emailCounts, followUpIds, waitingOnYouIds } from "@/lib/email-stats";
import { saveDailyLimit } from "@/lib/email-actions";
import { fullName, relative } from "@/lib/format";
import { Badge, Button, Card, Empty, Input, LinkButton, PageHeader, Select, Stat, cx } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ContactsTable } from "@/components/contacts-table";
import { TemplateLibrary } from "@/components/template-library";
import { GoogleSyncButton } from "@/components/google-sync-button";

export const metadata = { title: "Emails" };

const TABS = [
  { id: "activity", label: "Activity" },
  { id: "followups", label: "Follow-ups" },
  { id: "campaigns", label: "Campaigns" },
  { id: "templates", label: "Templates" },
] as const;
type Tab = (typeof TABS)[number]["id"];

async function contactRows(ids: number[]) {
  if (!ids.length) return [];
  const rows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      title: contacts.title,
      email: contacts.email,
      phone: contacts.phone,
      mobile: contacts.mobile,
      status: contacts.status,
      tags: contacts.tags,
      lastContactedAt: contacts.lastContactedAt,
      nextFollowUpAt: contacts.nextFollowUpAt,
      companyId: contacts.companyId,
      companyName: companies.name,
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(inArray(contacts.id, ids));
  const pos = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
}

export default async function EmailsPage({ searchParams }: PageProps<"/emails">) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "activity";
  const connected = googleReady();
  const limit = dailyLimit();
  const [today, counts, followIds, waitingIds, allLists] = await Promise.all([
    sentToday(),
    emailCounts(),
    followUpIds(),
    waitingOnYouIds(),
    db.select({ id: lists.id, name: lists.name }).from(lists).orderBy(lists.name),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Emails"
        subtitle={connected ? `Sending from ${googleAccount()?.email}` : "Connect Gmail in Settings to send and sync emails"}
        actions={
          <>
            {connected && <GoogleSyncButton />}
            <LinkButton href="/contacts" variant="primary">
              <Icon name="mail" /> New email
            </LinkButton>
          </>
        }
      />

      {!connected && (
        <Card className="p-4 text-sm text-zinc-300">
          Rapport sends from your Gmail and pulls replies into each contact&apos;s timeline once Google is connected.{" "}
          <Link href="/settings" className="text-accent-300 hover:text-accent-400">
            Connect it in Settings
          </Link>
          .
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sent today" value={`${today} / ${limit}`} hint="Daily limit protects your domain" />
        <Stat label="Sent, last 7 days" value={counts.sentWeek} />
        <Stat label="Received, last 7 days" value={counts.receivedWeek} hint="From contacts, via Gmail sync" />
        <Stat label="Need a follow-up" value={followIds.length} hint={`${waitingIds.length} waiting on your reply`} href="/emails?tab=followups" />
      </div>

      <nav className="flex gap-1 border-b border-ink-700">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/emails?tab=${t.id}`}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              t.id === tab ? "border-accent-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "activity" && <ActivityTab sp={sp} />}
      {tab === "followups" && (
        <div className="space-y-6">
          <Card title={`Waiting on your reply (${waitingIds.length})`}>
            {waitingIds.length ? (
              <ContactsTable rows={await contactRows(waitingIds)} lists={allLists} />
            ) : (
              <Empty title="You're all caught up">When a contact emails you, they show up here until you reply.</Empty>
            )}
          </Card>
          <Card title={`No reply after 3+ days (${followIds.length})`}>
            {followIds.length ? (
              <>
                <p className="border-b border-ink-700 px-4 py-2 text-xs text-zinc-400">
                  Tick the people to nudge, then click Email selected and pick the &quot;Follow-up (no reply yet)&quot; template.
                </p>
                <ContactsTable rows={await contactRows(followIds)} lists={allLists} />
              </>
            ) : (
              <Empty title="No follow-ups due">Contacts you emailed 3 or more days ago who haven&apos;t written back will show up here.</Empty>
            )}
          </Card>
        </div>
      )}
      {tab === "campaigns" && <CampaignsTab />}
      {tab === "templates" && (
        <div className="space-y-6">
          <TemplateLibrary templates={await listTemplates()} />
          <Card title="Daily send limit">
            <form action={saveDailyLimit} className="flex flex-wrap items-center gap-3 p-4 text-sm text-zinc-300">
              <span>Send at most</span>
              <Input name="limit" type="number" min={1} max={2000} defaultValue={limit} className="!w-28" />
              <span>emails a day from Rapport.</span>
              <Button type="submit">Save</Button>
              <p className="w-full text-xs text-zinc-500">
                Google Workspace allows about 2,000 a day. A new domain like yours stays out of spam folders best if you start around 30 to 50 a day and raise
                it slowly over a few weeks.
              </p>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

async function ActivityTab({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const dir = sp.dir === "sent" || sp.dir === "received" ? sp.dir : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const conds: SQL[] = [eq(activities.type, "email")];
  if (dir === "sent") conds.push(like(activities.subject, "Sent%"));
  if (dir === "received") conds.push(like(activities.subject, "Received%"));
  if (q) {
    const pat = `%${q}%`;
    conds.push(or(like(activities.subject, pat), like(activities.body, pat), like(contacts.firstName, pat), like(contacts.lastName, pat), like(companies.name, pat))!);
  }
  const rows = await db
    .select({ a: activities, firstName: contacts.firstName, lastName: contacts.lastName, company: companies.name })
    .from(activities)
    .leftJoin(contacts, eq(activities.contactId, contacts.id))
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(and(...conds))
    .orderBy(desc(activities.occurredAt), desc(activities.id))
    .limit(200);

  return (
    <div className="space-y-3">
      <form className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value="activity" />
        <Input name="q" defaultValue={q} placeholder="Search subject, message, contact, company…" className="max-w-sm" />
        <Select name="dir" defaultValue={dir} className="!w-48">
          <option value="">Sent and received</option>
          <option value="sent">Sent</option>
          <option value="received">Received</option>
        </Select>
        <Button type="submit">Filter</Button>
      </form>
      <Card>
        {rows.length ? (
          <ul className="divide-y divide-ink-700/60">
            {rows.map(({ a, firstName, lastName, company }) => {
              const received = a.subject?.startsWith("Received");
              const subject = (a.subject ?? "").replace(/^(Sent|Received)( \(.*?\))?: /, "");
              const body = (a.body ?? "").replace(/^To: .*\n\n/, "");
              return (
                <li key={a.id} className="flex gap-3 px-4 py-3 text-sm">
                  <Badge className={`h-fit self-start ${received ? "bg-emerald-500/15 text-emerald-300" : "bg-accent-500/15 text-accent-300"}`}>{received ? "Received" : "Sent"}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {a.contactId ? (
                        <Link href={`/contacts/${a.contactId}`} className="font-medium text-zinc-100 hover:text-accent-300">
                          {fullName({ firstName: firstName ?? "", lastName })}
                        </Link>
                      ) : null}
                      {company && <span className="text-xs text-zinc-500">{company}</span>}
                      <span className="ml-auto text-xs text-zinc-500">{relative(a.occurredAt)}</span>
                    </div>
                    <div className="truncate text-zinc-200">{subject || "(no subject)"}</div>
                    {body && <div className="line-clamp-2 text-xs text-zinc-500">{body}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No emails yet">Emails you send from Rapport, and emails to and from your contacts in Gmail, show up here.</Empty>
        )}
      </Card>
    </div>
  );
}

async function CampaignsTab() {
  const stats = await campaignStats();
  return (
    <Card>
      {stats.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs font-medium text-zinc-500">
              <th className="px-4 py-2.5">Campaign</th>
              <th className="px-2 py-2.5">Sent</th>
              <th className="px-2 py-2.5">Replied</th>
              <th className="px-2 py-2.5">Reply rate</th>
              <th className="px-2 py-2.5">Started</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/60">
            {stats.map((s) => (
              <tr key={s.id} className="hover:bg-ink-850/60">
                <td className="px-4 py-2.5">
                  <Link href={`/emails/campaigns/${s.id}`} className="font-medium text-zinc-100 hover:text-accent-300">
                    {s.name}
                  </Link>
                  <div className="truncate text-xs text-zinc-500">{s.subject}</div>
                </td>
                <td className="px-2 py-2.5 tabular-nums">{s.sent}</td>
                <td className="px-2 py-2.5 tabular-nums">{s.replied}</td>
                <td className="px-2 py-2.5 tabular-nums">{s.sent ? `${Math.round((s.replied / s.sent) * 100)}%` : "–"}</td>
                <td className="px-2 py-2.5 text-xs text-zinc-400">{relative(new Date(s.createdAt * 1000))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty title="No campaigns yet">
          Select contacts on the Contacts page (or open a call list) and click Email selected. Each send shows up here with its reply count.
        </Empty>
      )}
    </Card>
  );
}
