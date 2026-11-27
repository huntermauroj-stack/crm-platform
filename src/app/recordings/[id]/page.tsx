import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, contacts, recordings } from "@/db/schema";
import type { CallAnalysis } from "@/lib/analysis-schema";
import { applyAnalysis, deleteRecording } from "@/lib/recording-actions";
import { aiConfigured } from "@/lib/analyze";
import { dateTime, duration, fullName } from "@/lib/format";
import { OUTCOME_LABELS, STAGE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { Badge, Button, Card, Empty, Select } from "@/components/ui";
import { Icon } from "@/components/icons";
import { RecordingProgress } from "@/components/recording-uploader";
import { ReanalyzeButton } from "@/components/reanalyze-button";
import { CopyButton } from "@/components/copy-button";

function Check({ name, label, detail, defaultChecked = true }: { name: string; label: string; detail?: React.ReactNode; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 hover:bg-ink-850">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 accent-accent-500" />
      <span className="min-w-0 text-sm">
        <span className="text-zinc-200">{label}</span>
        {detail && <span className="mt-0.5 block whitespace-pre-wrap text-xs text-zinc-400">{detail}</span>}
      </span>
    </label>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</div>
      <ul className="space-y-1 text-sm text-zinc-300">
        {items.map((i, k) => (
          <li key={k} className="flex gap-2">
            <span className="text-accent-400">•</span>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function RecordingPage({ params }: PageProps<"/recordings/[id]">) {
  const id = Number((await params).id);
  const rec = await db.query.recordings.findFirst({ where: eq(recordings.id, id) });
  if (!rec) notFound();
  const contact = rec.contactId ? await db.query.contacts.findFirst({ where: eq(contacts.id, rec.contactId) }) : null;
  const company = contact?.companyId ? await db.query.companies.findFirst({ where: eq(companies.id, contact.companyId) }) : null;
  const allContacts = contact
    ? []
    : await db.select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName }).from(contacts).orderBy(contacts.firstName);
  const a: CallAnalysis | null = rec.analysis ? JSON.parse(rec.analysis) : null;
  const inProgress = ["uploaded", "transcribing", "analyzing"].includes(rec.status);
  const u = a?.contactUpdates;
  const changed = (newV: string | null | undefined, oldV: string | null | undefined) => newV && newV.trim() && newV.trim() !== (oldV ?? "").trim();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/recordings" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Recordings
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{rec.fileName}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {contact ? (
              <Link href={`/contacts/${contact.id}`} className="text-zinc-200 hover:text-accent-300">
                {fullName(contact)}
                {company ? ` · ${company.name}` : ""}
              </Link>
            ) : (
              "Not linked to a contact"
            )}{" "}
            · {dateTime(rec.createdAt)}
            {rec.durationSec ? ` · ${duration(rec.durationSec)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rec.transcript && aiConfigured() && <ReanalyzeButton id={id} />}
          <form action={deleteRecording.bind(null, id)}>
            <Button variant="danger" size="sm">
              Delete
            </Button>
          </form>
        </div>
      </div>

      {rec.filePath && !rec.filePath.endsWith("pasted-transcript.txt") && (
        <audio controls src={`/api/recordings/${id}/audio`} className="mb-6 w-full" />
      )}

      {(inProgress || rec.status === "error") && (
        <Card className="mb-6 p-4">
          <RecordingProgress id={id} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {a ? (
            <Card
              title={
                <span className="inline-flex items-center gap-2">
                  <Icon name="sparkles" className="size-4 text-accent-400" /> AI call summary
                </span>
              }
              action={
                <div className="flex items-center gap-2">
                  <Badge>{a.sentiment}</Badge>
                  <Badge>Interest {a.interestLevel}/5</Badge>
                </div>
              }
            >
              <div className="space-y-5 p-4">
                <p className="text-sm leading-relaxed text-zinc-200">{a.summary}</p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <List title="Pain points" items={a.painPoints} />
                  <List title="Key points" items={a.keyPoints} />
                  <List title="Objections" items={a.objections} />
                  <List title="Next steps" items={a.nextSteps} />
                  <List title="Decision makers" items={a.decisionMakers} />
                  <List title="Current tools" items={a.currentTools} />
                  <List title="Personal / rapport" items={a.personalNotes} />
                  {(a.budget || a.timeline) && (
                    <div className="space-y-2 text-sm">
                      {a.budget && (
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Budget</div>
                          <p className="text-zinc-300">{a.budget}</p>
                        </div>
                      )}
                      {a.timeline && (
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Timeline</div>
                          <p className="text-zinc-300">{a.timeline}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            !inProgress &&
            rec.transcript &&
            !aiConfigured() && (
              <Card className="p-4 text-sm text-zinc-300">
                Add an Anthropic API key in <code>.env.local</code> to get an AI summary and CRM suggestions for this call (see{" "}
                <Link href="/settings" className="text-accent-300">Settings</Link>).
              </Card>
            )
          )}

          {a?.followUpEmail && (
            <Card title="Suggested follow-up email" action={<CopyButton text={`Subject: ${a.followUpEmail.subject}\n\n${a.followUpEmail.body}`} />}>
              <div className="p-4 text-sm">
                <div className="mb-2 font-medium text-zinc-200">Subject: {a.followUpEmail.subject}</div>
                <p className="whitespace-pre-wrap leading-relaxed text-zinc-300">{a.followUpEmail.body}</p>
                {contact?.email && (
                  <a
                    href={`mailto:${contact.email}?subject=${encodeURIComponent(a.followUpEmail.subject)}&body=${encodeURIComponent(a.followUpEmail.body)}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent-300 hover:text-accent-400"
                  >
                    <Icon name="mail" className="size-3.5" /> Open in email
                  </a>
                )}
              </div>
            </Card>
          )}

          <Card title="Transcript" action={rec.transcript ? <CopyButton text={rec.transcript} /> : undefined}>
            {rec.transcript ? (
              <pre className="max-h-[600px] overflow-y-auto whitespace-pre-wrap p-4 font-sans text-sm leading-relaxed text-zinc-300">{rec.transcript}</pre>
            ) : (
              <Empty title={inProgress ? "Transcribing…" : "No transcript"} />
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          {a && (
            <Card title={rec.analysisAppliedAt ? `Applied ${dateTime(rec.analysisAppliedAt)}` : "Update the CRM"} className="sticky top-6">
              <form action={applyAnalysis.bind(null, id)} className="space-y-1 p-2">
                {!contact && (
                  <div className="px-3 pb-2">
                    <Select name="contactId" required defaultValue="">
                      <option value="">Choose the contact on this call…</option>
                      {allContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {fullName(c)}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <Check name="summary" label="Add the call summary to the timeline" detail={`Suggested outcome: ${OUTCOME_LABELS[a.suggestedOutcome]}`} />
                {a.painPoints.length > 0 && <Check name="painPoints" label="Save pain points" detail={a.painPoints.join("\n")} />}
                {a.personalNotes.length > 0 && <Check name="personalNotes" label="Save rapport notes" detail={a.personalNotes.join("\n")} />}
                {a.currentTools.length > 0 && <Check name="currentTools" label="Add to company tech stack" detail={a.currentTools.join(", ")} />}
                {changed(u?.title, contact?.title) && <Check name="u_title" label="Update title" detail={`${contact?.title ?? "—"} → ${u!.title}`} />}
                {changed(u?.email, contact?.email) && <Check name="u_email" label="Update email" detail={`${contact?.email ?? "—"} → ${u!.email}`} />}
                {changed(u?.phone, contact?.phone) && <Check name="u_phone" label="Update phone" detail={`${contact?.phone ?? "—"} → ${u!.phone}`} />}
                {changed(u?.location, contact?.location) && <Check name="u_location" label="Update location" detail={`${contact?.location ?? "—"} → ${u!.location}`} />}
                {changed(u?.companyName, company?.name) && <Check name="u_companyName" label="Set company" detail={`${company?.name ?? "—"} → ${u!.companyName}`} />}
                {changed(u?.companyIndustry, company?.industry) && <Check name="u_companyIndustry" label="Set industry" detail={u!.companyIndustry} />}
                {changed(u?.companySize, company?.size) && <Check name="u_companySize" label="Set company size" detail={u!.companySize} />}
                {(!contact || a.suggestedStatus !== contact.status) && (
                  <Check name="status" label={`Set status to ${STATUS_LABELS[a.suggestedStatus]}`} defaultChecked={a.suggestedStatus !== "do_not_contact"} />
                )}
                {a.suggestedDealStage && (
                  <Check
                    name="deal"
                    label={`Move deal to ${STAGE_LABELS[a.suggestedDealStage]}`}
                    detail={a.suggestedDealValue ? `Estimated value $${a.suggestedDealValue.toLocaleString()}` : "Creates a deal if none is open"}
                  />
                )}
                {a.followUpInDays != null && (
                  <Check name="followUp" label={`Schedule follow-up in ${a.followUpInDays} day${a.followUpInDays === 1 ? "" : "s"}`} detail={a.nextSteps[0]} />
                )}
                <div className="px-3 pb-2 pt-3">
                  <Button type="submit" variant="primary" className="w-full">
                    {rec.analysisAppliedAt ? "Apply again" : "Apply selected updates"}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
