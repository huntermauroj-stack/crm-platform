import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, companies, contacts, deals } from "@/db/schema";
import { deleteCompany, updateCompany } from "@/lib/actions";
import { fullName, initials, money, relative, telHref } from "@/lib/format";
import { STAGE_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { Avatar, Badge, Button, Card, Empty, LinkButton } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { CompanyForm } from "@/components/company-form";
import { NoteForm } from "@/components/note-form";
import { DealForm } from "@/components/deal-form";
import { Icon } from "@/components/icons";

export async function generateMetadata({ params }: PageProps<"/companies/[id]">) {
  const { id } = await params;
  const c = await db.query.companies.findFirst({ where: eq(companies.id, Number(id)) });
  return { title: c?.name ?? "Company" };
}

export default async function CompanyPage({ params }: PageProps<"/companies/[id]">) {
  const id = Number((await params).id);
  const company = await db.query.companies.findFirst({ where: eq(companies.id, id) });
  if (!company) notFound();

  const [people, companyDeals, acts] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.companyId, id)).orderBy(contacts.firstName),
    db.select().from(deals).where(eq(deals.companyId, id)).orderBy(desc(deals.createdAt)),
    db
      .select({ a: activities, first: contacts.firstName, last: contacts.lastName })
      .from(activities)
      .leftJoin(contacts, eq(activities.contactId, contacts.id))
      .where(eq(activities.companyId, id))
      .orderBy(desc(activities.occurredAt))
      .limit(100),
  ]);

  const site = company.domain ? (company.domain.startsWith("http") ? company.domain : `https://${company.domain}`) : null;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{company.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {[company.industry, company.size && `${company.size} employees`, company.location].filter(Boolean).join(" · ")}
          </p>
          {company.techStack && <p className="mt-1 text-xs text-zinc-500">Uses: {company.techStack}</p>}
        </div>
        <div className="flex gap-2">
          {company.phone && (
            <a href={telHref(company.phone)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-600">
              <Icon name="phone" /> {company.phone}
            </a>
          )}
          {site && (
            <a href={site} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 ring-1 ring-ink-600 hover:bg-ink-800">
              <Icon name="link" /> Website
            </a>
          )}
          <LinkButton href={`/contacts/new`}>
            <Icon name="plus" /> Contact
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`People (${people.length})`}>
            {people.length ? (
              <ul className="divide-y divide-ink-700/60">
                {people.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link href={`/contacts/${p.id}`} className="flex min-w-0 items-center gap-2.5">
                      <Avatar text={initials(p)} className="size-7 text-[10px]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-100 hover:text-accent-300">{fullName(p)}</span>
                        <span className="block truncate text-xs text-zinc-500">{p.title ?? ""}</span>
                      </span>
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">{relative(p.lastContactedAt)}</span>
                      <Badge className={STATUS_COLORS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No people at this company yet" />
            )}
          </Card>
          <Card title="Add a note">
            <div className="p-4">
              <NoteForm companyId={id} />
            </div>
          </Card>
          <Card title="Activity">
            <Timeline items={acts.map(({ a, first, last }) => ({ ...a, contactName: first ? fullName({ firstName: first, lastName: last }) : null }))} showContact />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Deals">
            {companyDeals.length > 0 && (
              <ul className="divide-y divide-ink-700/60 border-b border-ink-700">
                {companyDeals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="text-zinc-100">{d.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-zinc-400">{money(d.value)}</span>
                      <Badge>{STAGE_LABELS[d.stage]}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <details className="p-4">
              <summary className="cursor-pointer text-sm text-accent-300">+ New deal</summary>
              <div className="mt-3">
                <DealForm companyId={id} contactId={people[0]?.id} defaultName={company.name} />
              </div>
            </details>
          </Card>
          <Card title="Details">
            <div className="p-4">
              {company.description && <p className="mb-4 whitespace-pre-wrap text-sm text-zinc-300">{company.description}</p>}
              <details>
                <summary className="cursor-pointer text-sm text-zinc-300">Edit company</summary>
                <div className="mt-4">
                  <CompanyForm action={updateCompany.bind(null, id)} company={company} />
                </div>
                <form action={deleteCompany.bind(null, id)} className="mt-4 border-t border-ink-700 pt-4">
                  <Button variant="danger" size="sm">
                    Delete company
                  </Button>
                </form>
              </details>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
