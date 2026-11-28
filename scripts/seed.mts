/** Adds sample data so you can explore the app. Run: npm run seed */
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";

const dataDir = path.resolve(process.env.CRM_DATA_DIR ?? "data");
const client = createClient({ url: "file:" + path.join(dataDir, "crm.db").replace(/\\/g, "/") });
const db = drizzle(client, { schema });
const { companies, contacts, deals, lists, listMembers, activities, tasks } = schema;

const day = 86400000;
const ago = (d: number) => new Date(Date.now() - d * day);
const ahead = (d: number) => new Date(Date.now() + d * day);

const cos = await db
  .insert(companies)
  .values([
    { name: "Brightline Dental Group", domain: "brightlinedental.com", industry: "Healthcare", size: "11-50", location: "Tampa, FL", techStack: "Dentrix, Mailchimp" },
    { name: "Harbor Logistics", domain: "harborlogistics.co", industry: "Logistics", size: "51-200", location: "Savannah, GA", techStack: "Excel, QuickBooks" },
    { name: "Summit Realty Partners", domain: "summitrealty.com", industry: "Real estate", size: "11-50", location: "Denver, CO" },
    { name: "Apex Roofing", domain: "apexroofingpros.com", industry: "Construction", size: "11-50", location: "Austin, TX", techStack: "JobNimbus" },
    { name: "Northwind Accounting", domain: "northwindcpa.com", industry: "Accounting", size: "1-10", location: "Raleigh, NC" },
  ])
  .returning();

const people = await db
  .insert(contacts)
  .values([
    { firstName: "Sarah", lastName: "Chen", title: "Practice Manager", companyId: cos[0].id, phone: "(813) 555-0142", email: "sarah@brightlinedental.com", status: "opportunity", painPoints: "• Front desk overwhelmed with appointment calls\n• No-shows around 15%", lastContactedAt: ago(2), nextFollowUpAt: ahead(1), source: "Referral" },
    { firstName: "Marcus", lastName: "Reed", title: "Operations Director", companyId: cos[1].id, phone: "(912) 555-0198", email: "mreed@harborlogistics.co", status: "client", lastContactedAt: ago(40), source: "LinkedIn" },
    { firstName: "Elena", lastName: "Vasquez", title: "Broker / Owner", companyId: cos[2].id, mobile: "(720) 555-0117", status: "lead", lastContactedAt: ago(5), source: "Cold call" },
    { firstName: "Jake", lastName: "Morrison", title: "Owner", companyId: cos[3].id, phone: "(512) 555-0163", status: "prospect", source: "Cold list" },
    { firstName: "Priya", lastName: "Patel", title: "Managing Partner", companyId: cos[4].id, phone: "(919) 555-0185", email: "priya@northwindcpa.com", status: "prospect", source: "Cold list" },
    { firstName: "Tom", lastName: "Becker", title: "Office Manager", companyId: cos[3].id, phone: "(512) 555-0144", status: "prospect", source: "Cold list" },
  ])
  .returning();

await db.insert(deals).values([
  { name: "Brightline AI receptionist", contactId: people[0].id, companyId: cos[0].id, stage: "proposal", value: 1500, billing: "monthly", service: "AI voice agent" },
  { name: "Harbor dispatch automation", contactId: people[1].id, companyId: cos[1].id, stage: "won", value: 2500, billing: "monthly", service: "Workflow automation" },
  { name: "Summit lead follow-up bot", contactId: people[2].id, companyId: cos[2].id, stage: "discovery", value: 6000, billing: "one_time", service: "AI SMS agent" },
]);

const [list] = await db
  .insert(lists)
  .values({
    name: "Local service businesses",
    description: "Owners and office managers at 10-50 person service companies",
    callScript:
      "Opener: Hi {name}, this is Hunter. I help service businesses use AI to answer every call and follow up with leads automatically. Did I catch you at an OK time?\n\nDiscovery:\n• How are inbound calls handled today? What happens after hours?\n• How do you follow up with leads who don't book right away?\n• What's a new customer worth to you?\n\nClose: Worth a 20-minute call this week so I can show you what it'd look like for you?",
  })
  .returning();
await db.insert(listMembers).values([people[3], people[4], people[5]].map((p, i) => ({ listId: list.id, contactId: p.id, position: i })));

await db.insert(activities).values([
  { type: "call", contactId: people[0].id, companyId: cos[0].id, outcome: "meeting_booked", body: "Great call. Sarah says the front desk misses 20+ calls a week. Wants to see a demo with the dentist owner.", occurredAt: ago(9), durationSec: 540 },
  { type: "meeting", contactId: people[0].id, companyId: cos[0].id, body: "Demo with Sarah and Dr. Lee. Loved the after-hours booking. Sent proposal.", occurredAt: ago(2) },
  { type: "call", contactId: people[2].id, companyId: cos[2].id, outcome: "connected", body: "Interested in auto follow-up for Zillow leads. Asked for pricing.", occurredAt: ago(5), durationSec: 300 },
]);
await db.insert(tasks).values([
  { title: "Follow up on Brightline proposal", type: "call", contactId: people[0].id, dueAt: ahead(0) },
  { title: "Monthly check-in with Marcus", type: "call", contactId: people[1].id, dueAt: ago(1) },
  { title: "Send Summit pricing one-pager", type: "email", contactId: people[2].id, dueAt: ahead(2) },
]);

console.log("Sample data added.");
client.close();
