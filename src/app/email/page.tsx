import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts } from "@/db/schema";
import { googleAccount } from "@/lib/google";
import { googleReady } from "@/lib/google-sync";
import { blastRecipients, blastSubtitle } from "@/lib/blast-recipients";
import { bestTemplate, dailyLimit, listTemplates, sentToday } from "@/lib/email-templates";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { BlastComposer } from "@/components/blast-composer";

export const metadata = { title: "Email selected contacts" };

/** Email the contacts checked on the Contacts page (ids come in the URL: /email?ids=1,2,3). */
export default async function EmailSelectedPage({ searchParams }: PageProps<"/email">) {
  const sp = await searchParams;
  const raw = typeof sp.ids === "string" ? sp.ids : "";
  const ids = [...new Set(raw.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000);
  const back = typeof sp.back === "string" && sp.back.startsWith("/contacts") ? sp.back : "/contacts";

  const rows = ids.length
    ? await db
        .select({ c: contacts, company: companies.name })
        .from(contacts)
        .leftJoin(companies, eq(contacts.companyId, companies.id))
        .where(inArray(contacts.id, ids))
    : [];
  // Keep the order they were picked in.
  const pos = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => pos.get(a.c.id)! - pos.get(b.c.id)!);
  const { recipients, noEmail, dnc } = blastRecipients(rows);
  const templates = await listTemplates();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Email ${rows.length} selected contact${rows.length === 1 ? "" : "s"}`}
        subtitle={rows.length ? blastSubtitle(rows.length, recipients.length, noEmail, dnc) : undefined}
        actions={<LinkButton href={back}>← Back to contacts</LinkButton>}
      />
      {!rows.length ? (
        <Card className="p-5 text-sm text-zinc-300">
          No contacts selected. On the{" "}
          <Link href="/contacts" className="text-accent-300 hover:text-accent-400">
            Contacts
          </Link>{" "}
          page, tick the boxes next to the people you want to email, then click Email selected.
        </Card>
      ) : !googleReady() ? (
        <Card className="p-5 text-sm text-zinc-300">
          Emails send from your Gmail, so connect Google first in{" "}
          <Link href="/settings" className="text-accent-300 hover:text-accent-400">
            Settings
          </Link>
          .
        </Card>
      ) : recipients.length === 0 ? (
        <Card className="p-5 text-sm text-zinc-300">
          None of the selected contacts have an email address yet. Add emails on the contact pages (or import a CSV with an Email column), then try again.
        </Card>
      ) : (
        <BlastComposer
          listName="Selected contacts"
          recipients={recipients}
          senderEmail={googleAccount()?.email ?? null}
          templates={templates}
          initialTemplateId={bestTemplate(recipients, templates)}
          dailyLimit={dailyLimit()}
          sentToday={await sentToday()}
        />
      )}
    </div>
  );
}
