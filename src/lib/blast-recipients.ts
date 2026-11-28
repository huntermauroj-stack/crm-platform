import "server-only";
import type { contacts } from "@/db/schema";
import { fullName } from "./format";

type Row = { c: typeof contacts.$inferSelect; company: string | null };

/** Turns contact rows into blast recipients and counts the ones that can't be emailed. */
export function blastRecipients(rows: Row[]) {
  const recipients = rows
    .filter((r) => r.c.email && r.c.status !== "do_not_contact")
    .map((r) => ({
      id: r.c.id,
      name: fullName(r.c),
      firstName: r.c.firstName,
      lastName: r.c.lastName,
      email: r.c.email!,
      company: r.company,
      notes: r.c.notes,
    }));
  const noEmail = rows.filter((r) => !r.c.email).length;
  const dnc = rows.filter((r) => r.c.email && r.c.status === "do_not_contact").length;
  return { recipients, noEmail, dnc };
}

export function blastSubtitle(total: number, ready: number, noEmail: number, dnc: number) {
  return `${ready} of ${total} contacts have an email address${noEmail ? ` · ${noEmail} without one` : ""}${dnc ? ` · ${dnc} do-not-contact skipped` : ""}`;
}
