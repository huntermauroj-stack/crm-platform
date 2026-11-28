import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, listMembers, lists } from "@/db/schema";
import { googleAccount } from "@/lib/google";
import { googleReady } from "@/lib/google-sync";
import { blastRecipients, blastSubtitle } from "@/lib/blast-recipients";
import { bestTemplate, dailyLimit, listTemplates, sentToday } from "@/lib/email-templates";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { BlastComposer } from "@/components/blast-composer";

export const metadata = { title: "Email blast" };

export default async function ListEmailPage({ params }: PageProps<"/lists/[id]/email">) {
  const id = Number((await params).id);
  const list = await db.query.lists.findFirst({ where: eq(lists.id, id) });
  if (!list) notFound();
  const rows = await db
    .select({ c: contacts, company: companies.name })
    .from(listMembers)
    .innerJoin(contacts, eq(listMembers.contactId, contacts.id))
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(eq(listMembers.listId, id))
    .orderBy(listMembers.position);

  const { recipients, noEmail, dnc } = blastRecipients(rows);
  const templates = await listTemplates();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Email blast: ${list.name}`}
        subtitle={blastSubtitle(rows.length, recipients.length, noEmail, dnc)}
        actions={<LinkButton href={`/lists/${id}`}>← Back to list</LinkButton>}
      />
      {!googleReady() ? (
        <Card className="p-5 text-sm text-zinc-300">
          Email blasts send from your Gmail, so connect Google first in{" "}
          <Link href="/settings" className="text-accent-300 hover:text-accent-400">
            Settings
          </Link>
          .
        </Card>
      ) : recipients.length === 0 ? (
        <Card className="p-5 text-sm text-zinc-300">
          Nobody on this list has an email address yet. Add emails on the contact pages (or import a CSV with an Email column), then come back.
        </Card>
      ) : (
        <BlastComposer listName={list.name} recipients={recipients} senderEmail={googleAccount()?.email ?? null} templates={templates}
          initialTemplateId={bestTemplate(recipients, templates)}
          dailyLimit={dailyLimit()}
          sentToday={await sentToday()} />
      )}
    </div>
  );
}
