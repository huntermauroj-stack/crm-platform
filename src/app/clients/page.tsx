import Link from "next/link";
import { eq, sql, and } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, deals } from "@/db/schema";
import { Avatar, Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { daysSince, fullName, initials, money, relative, telHref } from "@/lib/format";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const rows = await db
    .select({
      c: contacts,
      companyName: companies.name,
      wonTotal: sql<number>`(select coalesce(sum(${deals.value}),0) from ${deals} where ${deals.contactId} = ${contacts.id} and ${deals.stage} = 'won' and coalesce(${deals.billing},'one_time') = 'one_time')`,
      mrr: sql<number>`(select coalesce(sum(case when ${deals.billing} = 'monthly' then ${deals.value} when ${deals.billing} = 'annual' then ${deals.value} / 12.0 else 0 end),0) from ${deals} where ${deals.contactId} = ${contacts.id} and ${deals.stage} = 'won')`,
      services: sql<string | null>`(select group_concat(distinct ${deals.service}) from ${deals} where ${deals.contactId} = ${contacts.id} and ${deals.stage} = 'won')`,
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(and(eq(contacts.status, "client")))
    .orderBy(contacts.firstName);

  const mrr = rows.reduce((s, r) => s + r.mrr, 0);
  const oneTime = rows.reduce((s, r) => s + r.wonTotal, 0);
  const stale = rows.filter((r) => daysSince(r.c.lastContactedAt) > 30);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Clients" subtitle="Everyone you're actively working with, plus who needs a check-in." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active clients" value={rows.length} />
        <Stat label="Monthly recurring" value={money(mrr)} hint="Won monthly + annual/12 deals" />
        <Stat label="One-time revenue won" value={money(oneTime)} />
        <Stat label="Need a check-in" value={stale.length} hint="No contact in 30+ days" />
      </div>
      <Card>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-2.5">Client</th>
                <th className="px-2 py-2.5">Services</th>
                <th className="px-2 py-2.5">MRR</th>
                <th className="px-2 py-2.5">One-time</th>
                <th className="px-2 py-2.5">Last contact</th>
                <th className="px-2 py-2.5">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/60">
              {rows.map(({ c, companyName, wonTotal, mrr, services }) => {
                const isStale = stale.some((s) => s.c.id === c.id);
                const phone = c.mobile ?? c.phone;
                return (
                  <tr key={c.id} className="hover:bg-ink-850/60">
                    <td className="px-4 py-2.5">
                      <Link href={`/contacts/${c.id}`} className="flex items-center gap-2.5">
                        <Avatar text={initials(c)} className="size-7 text-[10px]" />
                        <span>
                          <span className="block font-medium text-zinc-100 hover:text-accent-300">{fullName(c)}</span>
                          <span className="block text-xs text-zinc-500">{companyName ?? ""}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-zinc-400">{services ?? "—"}</td>
                    <td className="px-2 py-2.5 tabular-nums text-zinc-200">{mrr ? money(mrr) : "—"}</td>
                    <td className="px-2 py-2.5 tabular-nums text-zinc-300">{wonTotal ? money(wonTotal) : "—"}</td>
                    <td className="px-2 py-2.5 text-xs">
                      {isStale ? <Badge className="bg-amber-500/15 text-amber-300 ring-amber-500/30">{relative(c.lastContactedAt)}</Badge> : <span className="text-zinc-400">{relative(c.lastContactedAt)}</span>}
                    </td>
                    <td className="px-2 py-2.5">{phone ? <a href={telHref(phone)} className="text-zinc-300 hover:text-accent-300">{phone}</a> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="No clients yet">Contacts become clients when you mark a deal as Won, or set their status to Client.</Empty>
        )}
      </Card>
    </div>
  );
}
