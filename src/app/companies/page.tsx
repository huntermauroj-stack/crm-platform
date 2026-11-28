import Link from "next/link";
import { desc, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, deals } from "@/db/schema";
import { Card, Empty, Input, LinkButton, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { money, relative } from "@/lib/format";

export const metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companies.domain,
      industry: companies.industry,
      size: companies.size,
      location: companies.location,
      contactCount: sql<number>`(select count(*) from ${contacts} where ${contacts.companyId} = ${companies.id})`,
      clientCount: sql<number>`(select count(*) from ${contacts} where ${contacts.companyId} = ${companies.id} and ${contacts.status} = 'client')`,
      openValue: sql<number>`(select coalesce(sum(${deals.value}),0) from ${deals} where ${deals.companyId} = ${companies.id} and ${deals.stage} not in ('won','lost'))`,
      lastContact: sql<number | null>`(select max(${contacts.lastContactedAt}) from ${contacts} where ${contacts.companyId} = ${companies.id})`,
    })
    .from(companies)
    .where(q ? or(like(companies.name, `%${q}%`), like(companies.industry, `%${q}%`), like(companies.domain, `%${q}%`)) : undefined)
    .orderBy(desc(companies.createdAt))
    .limit(500);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Companies"
        subtitle={`${rows.length} companies`}
        actions={
          <LinkButton href="/companies/new" variant="primary">
            <Icon name="plus" /> New company
          </LinkButton>
        }
      />
      <form className="mb-4">
        <Input name="q" defaultValue={q} placeholder="Search companies…" className="max-w-sm" />
      </form>
      <Card>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-2.5">Company</th>
                <th className="px-2 py-2.5">Industry</th>
                <th className="px-2 py-2.5">Size</th>
                <th className="px-2 py-2.5">Contacts</th>
                <th className="px-2 py-2.5">Open pipeline</th>
                <th className="px-2 py-2.5">Last contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/60">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink-850/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/companies/${r.id}`} className="font-medium text-zinc-100 hover:text-accent-300">
                      {r.name}
                    </Link>
                    {r.clientCount > 0 && <span className="ml-2 text-[11px] text-emerald-400">client</span>}
                    {r.domain && <div className="text-xs text-zinc-500">{r.domain}</div>}
                  </td>
                  <td className="px-2 py-2.5 text-zinc-400">{r.industry ?? "—"}</td>
                  <td className="px-2 py-2.5 text-zinc-400">{r.size ?? "—"}</td>
                  <td className="px-2 py-2.5 tabular-nums text-zinc-300">{r.contactCount}</td>
                  <td className="px-2 py-2.5 tabular-nums text-zinc-300">{r.openValue ? money(r.openValue) : "—"}</td>
                  <td className="px-2 py-2.5 text-xs text-zinc-400">{relative(r.lastContact ? new Date(r.lastContact * 1000) : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No companies yet">Companies are created automatically when you add or import contacts.</Empty>
        )}
      </Card>
    </div>
  );
}
