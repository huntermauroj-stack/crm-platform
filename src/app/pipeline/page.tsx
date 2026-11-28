import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, deals } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { Kanban } from "@/components/kanban";
import { money } from "@/lib/format";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const rows = await db
    .select({
      id: deals.id,
      name: deals.name,
      stage: deals.stage,
      value: deals.value,
      billing: deals.billing,
      service: deals.service,
      expectedCloseAt: deals.expectedCloseAt,
      updatedAt: deals.updatedAt,
      contactId: deals.contactId,
      contactFirst: contacts.firstName,
      contactLast: contacts.lastName,
      companyName: companies.name,
    })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .orderBy(deals.position, deals.id);

  const open = rows.filter((r) => !["won", "lost"].includes(r.stage));
  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Pipeline"
        subtitle={`${open.length} open deals · ${money(open.reduce((s, r) => s + (r.value ?? 0), 0))} open value · drag cards between stages`}
      />
      <Kanban deals={rows} />
    </div>
  );
}
