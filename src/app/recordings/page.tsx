import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, recordings } from "@/db/schema";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { RecordingUploader } from "@/components/recording-uploader";
import { PasteTranscript } from "@/components/paste-transcript";
import { dateTime, duration, fullName } from "@/lib/format";
import { aiConfigured } from "@/lib/analyze";

export const metadata = { title: "Call recordings" };

const STATUS: Record<string, string> = {
  uploaded: "Queued",
  transcribing: "Transcribing",
  transcribed: "Transcribed",
  analyzing: "Analyzing",
  done: "Ready to review",
  error: "Error",
};

export default async function RecordingsPage() {
  const rows = await db
    .select({ r: recordings, first: contacts.firstName, last: contacts.lastName })
    .from(recordings)
    .leftJoin(contacts, eq(recordings.contactId, contacts.id))
    .orderBy(desc(recordings.createdAt));
  const contactOptions = await db
    .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
    .from(contacts)
    .orderBy(contacts.firstName);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Call recordings"
        subtitle="Upload recordings from your phone. They're transcribed on this PC, then Claude summarizes them and suggests CRM updates."
      />
      {!aiConfigured() && (
        <Card className="mb-6 border-l-4 border-amber-500 p-4 text-sm text-zinc-300">
          Transcription works now. To get AI summaries and CRM suggestions, add your Anthropic API key to <code className="text-amber-300">.env.local</code>{" "}
          (see <Link href="/settings" className="text-accent-300">Settings</Link>).
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {rows.length ? (
            <ul className="divide-y divide-ink-700/60">
              {rows.map(({ r, first, last }) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/recordings/${r.id}`} className="block truncate text-sm font-medium text-zinc-100 hover:text-accent-300">
                      {r.fileName}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      {first ? fullName({ firstName: first, lastName: last }) : "Not linked to a contact"} · {dateTime(r.createdAt)}
                      {r.durationSec ? ` · ${duration(r.durationSec)}` : ""}
                    </div>
                  </div>
                  <Badge
                    className={
                      r.status === "done" && !r.analysisAppliedAt
                        ? "bg-accent-500/15 text-accent-300 ring-accent-500/30"
                        : r.status === "error"
                          ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
                          : undefined
                    }
                  >
                    {r.analysisAppliedAt ? "Applied" : STATUS[r.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No recordings yet">Drop a recording on the right, or attach one when you log a call.</Empty>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Upload a recording">
            <div className="p-4">
              <RecordingUploader />
              <p className="mt-2 text-xs text-zinc-500">You can link it to a contact after it&apos;s analyzed. Uploading from a contact&apos;s page links it automatically.</p>
            </div>
          </Card>
          <Card title="Or paste a transcript">
            <div className="p-4">
              <PasteTranscript contacts={contactOptions.map((c) => ({ id: c.id, name: fullName(c) }))} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
