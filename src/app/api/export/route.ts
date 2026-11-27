import Papa from "papaparse";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts } from "@/db/schema";

export async function GET() {
  const rows = await db
    .select({
      first_name: contacts.firstName,
      last_name: contacts.lastName,
      title: contacts.title,
      company: companies.name,
      email: contacts.email,
      phone: contacts.phone,
      mobile: contacts.mobile,
      linkedin: contacts.linkedinUrl,
      location: contacts.location,
      status: contacts.status,
      source: contacts.source,
      tags: contacts.tags,
      pain_points: contacts.painPoints,
      notes: contacts.notes,
      last_contacted: contacts.lastContactedAt,
      next_follow_up: contacts.nextFollowUpAt,
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id));
  const csv = Papa.unparse(rows.map((r) => ({ ...r, last_contacted: r.last_contacted?.toISOString() ?? "", next_follow_up: r.next_follow_up?.toISOString() ?? "" })));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
