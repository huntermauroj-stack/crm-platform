import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { campaignStats } from "@/lib/email-stats";
import { fullName, relative } from "@/lib/format";
import { Badge, Card, LinkButton, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: PageProps<"/emails/campaigns/[id]">) {
  const id = Number((await params).id);
  const [stat] = id ? await campaignStats(id) : [];
  if (!stat) notFound();
  const campaign = await db.query.emailCampaigns.findFirst({ where: (c, { eq }) => eq(c.id, id) });
  const rows = await db.all<{ contactId: number; firstName: string; lastName: string | null; company: string | null; sentAt: number; repliedAt: number | null }>(sql`
    select a.contact_id as contactId, c.first_name as firstName, c.last_name as lastName, co.name as company, min(a.occurred_at) as sentAt,
      (select min(r.occurred_at) from activities r where r.contact_id = a.contact_id and r.type = 'email'
        and r.subject like 'Received%' and r.occurred_at >= min(a.occurred_at)) as repliedAt
    from activities a join contacts c on c.id = a.contact_id left join companies co on co.id = c.company_id
    where a.campaign_id = ${id}
    group by a.contact_id order by repliedAt is null, sentAt`);
  const replyIds = rows.filter((r) => !r.repliedAt).map((r) => r.contactId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={stat.name}
        subtitle={`Started ${relative(new Date(stat.createdAt * 1000))}`}
        actions={
          <>
            <LinkButton href="/emails?tab=campaigns">← Campaigns</LinkButton>
            {replyIds.length > 0 && (
              <LinkButton href={`/email?ids=${replyIds.join(",")}&back=${encodeURIComponent(`/emails/campaigns/${id}`)}`} variant="primary">
                Follow up with {replyIds.length} who didn&apos;t reply
              </LinkButton>
            )}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sent" value={stat.sent} />
        <Stat label="Replied" value={stat.replied} />
        <Stat label="Reply rate" value={stat.sent ? `${Math.round((stat.replied / stat.sent) * 100)}%` : "–"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Recipients" className="lg:col-span-3">
          <ul className="divide-y divide-ink-700/60">
            {rows.map((r) => (
              <li key={r.contactId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link href={`/contacts/${r.contactId}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-100 hover:text-accent-300">{fullName(r)}</span>
                  <span className="block truncate text-xs text-zinc-500">{r.company ?? ""}</span>
                </Link>
                {r.repliedAt ? (
                  <Badge className="bg-emerald-500/15 text-emerald-300">Replied {relative(new Date(r.repliedAt * 1000))}</Badge>
                ) : (
                  <Badge className="bg-zinc-500/15 text-zinc-400">Sent {relative(new Date(r.sentAt * 1000))}</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="What was sent" className="lg:col-span-2">
          <div className="space-y-2 p-4 text-sm">
            <div className="font-medium text-zinc-100">{campaign?.subject}</div>
            <p className="whitespace-pre-wrap text-xs text-zinc-400">{campaign?.body}</p>
            <p className="pt-2 text-xs text-zinc-500">Replies are picked up by Gmail sync, which runs every 15 minutes while Rapport is open.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
