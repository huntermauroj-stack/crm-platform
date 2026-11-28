import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, index, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);

export const companies = sqliteTable("companies", {
  id: id(),
  name: text("name").notNull(),
  domain: text("domain"),
  industry: text("industry"),
  size: text("size"),
  location: text("location"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  description: text("description"),
  techStack: text("tech_stack"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const CONTACT_STATUSES = ["prospect", "lead", "opportunity", "client", "past_client", "do_not_contact"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const contacts = sqliteTable(
  "contacts",
  {
    id: id(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    title: text("title"),
    email: text("email"),
    phone: text("phone"),
    mobile: text("mobile"),
    linkedinUrl: text("linkedin_url"),
    location: text("location"),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    status: text("status").$type<ContactStatus>().notNull().default("prospect"),
    source: text("source"),
    tags: text("tags"),
    painPoints: text("pain_points"),
    notes: text("notes"),
    lastContactedAt: integer("last_contacted_at", { mode: "timestamp" }),
    nextFollowUpAt: integer("next_follow_up_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contacts_company_idx").on(t.companyId), index("contacts_status_idx").on(t.status)],
);

export const DEAL_STAGES = [
  "new_lead",
  "contacted",
  "discovery",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const deals = sqliteTable(
  "deals",
  {
    id: id(),
    name: text("name").notNull(),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    stage: text("stage").$type<DealStage>().notNull().default("new_lead"),
    value: real("value"),
    billing: text("billing").$type<"one_time" | "monthly" | "annual">().default("one_time"),
    service: text("service"),
    expectedCloseAt: integer("expected_close_at", { mode: "timestamp" }),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("deals_stage_idx").on(t.stage)],
);

export const ACTIVITY_TYPES = ["call", "note", "email", "meeting", "sms", "linkedin"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const CALL_OUTCOMES = [
  "connected",
  "meeting_booked",
  "not_interested",
  "call_back",
  "voicemail",
  "no_answer",
  "gatekeeper",
  "wrong_number",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const activities = sqliteTable(
  "activities",
  {
    id: id(),
    type: text("type").$type<ActivityType>().notNull(),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
    dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
    outcome: text("outcome").$type<CallOutcome>(),
    subject: text("subject"),
    body: text("body"),
    durationSec: integer("duration_sec"),
    recordingId: integer("recording_id"),
    /** Source id for synced items, e.g. "gmail:<id>" or "gcal:<id>". */
    externalId: text("external_id"),
    /** Set on emails sent as part of a campaign (bulk send). */
    campaignId: integer("campaign_id").references(() => emailCampaigns.id, { onDelete: "set null" }),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    createdAt: createdAt(),
  },
  (t) => [
    index("activities_contact_idx").on(t.contactId),
    index("activities_campaign_idx").on(t.campaignId),
    index("activities_occurred_idx").on(t.occurredAt),
    uniqueIndex("activities_external_idx").on(t.externalId),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    type: text("type").$type<"call" | "email" | "todo" | "meeting">().notNull().default("todo"),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
    dueAt: integer("due_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    notes: text("notes"),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_due_idx").on(t.dueAt), uniqueIndex("tasks_external_idx").on(t.externalId)],
);

export const lists = sqliteTable("lists", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  callScript: text("call_script"),
  createdAt: createdAt(),
});

export const listMembers = sqliteTable(
  "list_members",
  {
    listId: integer("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    lastOutcome: text("last_outcome").$type<CallOutcome>(),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp" }),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    addedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.contactId] })],
);

export const RECORDING_STATUSES = ["uploaded", "transcribing", "transcribed", "analyzing", "done", "error"] as const;
export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

export const recordings = sqliteTable("recordings", {
  id: id(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  activityId: integer("activity_id"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  durationSec: integer("duration_sec"),
  status: text("status").$type<RecordingStatus>().notNull().default("uploaded"),
  progress: text("progress"),
  error: text("error"),
  transcript: text("transcript"),
  /** JSON-encoded CallAnalysis */
  analysis: text("analysis"),
  analysisAppliedAt: integer("analysis_applied_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export type Company = typeof companies.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type List = typeof lists.$inferSelect;
export type ListMember = typeof listMembers.$inferSelect;
export type Recording = typeof recordings.$inferSelect;

/** Saved email templates. Merge fields: {first} {name} {company} {preview} {website} {issue}. */
export const emailTemplates = sqliteTable("email_templates", {
  id: id(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** One bulk send: what was sent and to whom (the sends are activities with this campaign id). */
export const emailCampaigns = sqliteTable("email_campaigns", {
  id: id(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
});
