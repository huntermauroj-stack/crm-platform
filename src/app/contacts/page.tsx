import { and, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, CONTACT_STATUSES, listMembers, lists, type ContactStatus } from "@/db/schema";
import { Card, LinkButton, PageHeader, Select, Input, Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ContactsTable } from "@/components/contacts-table";
import { STATUS_LABELS } from "@/lib/labels";

export const metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? (sp.status as ContactStatus) : "";
  const listId = Number(sp.list) || null;
  const sort = typeof sp.sort === "string" ? sp.sort : "recent";

  const conds: SQL[] = [];
  if (q) {
    const pat = `%${q}%`;
    conds.push(
      or(
        like(contacts.firstName, pat),
        like(contacts.lastName, pat),
        like(sql`${contacts.firstName} || ' ' || coalesce(${contacts.lastName}, '')`, pat),
        like(contacts.email, pat),
        like(contacts.phone, pat),
        like(contacts.title, pat),
        like(contacts.tags, pat),
        like(companies.name, pat),
      )!,
    );
  }
  if (status && CONTACT_STATUSES.includes(status)) conds.push(eq(contacts.status, status));
  if (listId) {
    const members = db.select({ id: listMembers.contactId }).from(listMembers).where(eq(listMembers.listId, listId));
    conds.push(inArray(contacts.id, members));
  }

  const order =
    sort === "name"
      ? [contacts.firstName, contacts.lastName]
      : sort === "last_contacted"
        ? [desc(sql`coalesce(${contacts.lastContactedAt}, 0)`)]
        : sort === "follow_up"
          ? [sql`${contacts.nextFollowUpAt} is null`, contacts.nextFollowUpAt]
          : [desc(contacts.createdAt)];

  const [rows, allLists, counts] = await Promise.all([
    db
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
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(...order)
      .limit(500),
    db.select({ id: lists.id, name: lists.name }).from(lists).orderBy(lists.name),
    db.select({ status: contacts.status, n: sql<number>`count(*)` }).from(contacts).groupBy(contacts.status),
  ]);
  const total = counts.reduce((s, c) => s + c.n, 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Contacts"
        subtitle={`${total} total · ${counts.find((c) => c.status === "client")?.n ?? 0} clients · ${counts.find((c) => c.status === "prospect")?.n ?? 0} prospects`}
        actions={
          <>
            <LinkButton href="/import">
              <Icon name="upload" /> Import CSV
            </LinkButton>
            <LinkButton href="/contacts/new" variant="primary">
              <Icon name="plus" /> New contact
            </LinkButton>
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={q} placeholder="Search name, company, email, phone, tag…" className="max-w-sm" />
        <Select name="status" defaultValue={status} className="w-40">
          <option value="">All statuses</option>
          {CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select name="list" defaultValue={listId ?? ""} className="w-44">
          <option value="">Any list</option>
          {allLists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={sort} className="w-44">
          <option value="recent">Newest first</option>
          <option value="name">Name A–Z</option>
          <option value="last_contacted">Last contacted</option>
          <option value="follow_up">Next follow-up</option>
        </Select>
        <Button type="submit">Filter</Button>
      </form>

      <Card>
        <ContactsTable rows={rows} lists={allLists} />
      </Card>
    </div>
  );
}
