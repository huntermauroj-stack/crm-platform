import { DATA_DIR } from "@/db";
import { aiConfigured, ANALYSIS_MODEL } from "@/lib/analyze";
import { WHISPER_MODEL } from "@/lib/transcribe";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
      <div className="text-zinc-400">{label}</div>
      <div className="col-span-2 text-zinc-200">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const ai = aiConfigured();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" subtitle="Configuration lives in the .env.local file in the app folder. Restart the app after changing it." />

      <Card title="Status">
        <div className="divide-y divide-ink-700/60">
          <Row label="AI call analysis">
            {ai ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 ring-emerald-500/30">Connected</Badge>
            ) : (
              <span>
                <Badge className="bg-amber-500/15 text-amber-300 ring-amber-500/30">Not set up</Badge>
                <span className="ml-2 text-zinc-400">
                  Add <code className="text-zinc-200">ANTHROPIC_API_KEY=…</code> to <code>.env.local</code>. Get a key at console.anthropic.com.
                </span>
              </span>
            )}
          </Row>
          <Row label="Analysis model">
            <code>{ANALYSIS_MODEL}</code> <span className="text-zinc-500">(override with ANALYSIS_MODEL)</span>
          </Row>
          <Row label="Speech-to-text">
            <code>{WHISPER_MODEL}</code> <span className="text-zinc-500">runs locally and free; override with WHISPER_MODEL</span>
          </Row>
          <Row label="Data folder">
            <code className="break-all">{DATA_DIR}</code>
            <div className="mt-1 text-xs text-zinc-500">Database (crm.db), recordings, and the speech model live here. Back up this folder to keep your data safe.</div>
          </Row>
          <Row label="Export">
            <a href="/api/export" className="text-accent-300 hover:text-accent-400">
              Download all contacts as CSV
            </a>
          </Row>
        </div>
      </Card>

      <Card title="Recording calls on your phone">
        <div className="space-y-3 p-4 text-sm leading-relaxed text-zinc-300">
          <p>
            <b className="text-zinc-100">iPhone (iOS 18.1 or later):</b> during a call, tap the record button at the top left. Everyone on the call hears an
            announcement. The recording and a transcript are saved in the Notes app. To bring it here, open the note, tap the recording, share or save the audio
            file, and upload it. You can also copy Apple&apos;s transcript and use &quot;Paste a transcript&quot; on the Recordings page.
          </p>
          <p>
            <b className="text-zinc-100">Android:</b> many phones (Pixel, Samsung, and others) have call recording built into the Phone app under Settings → Call
            recording. Recordings are saved as audio files you can move to your PC and upload.
          </p>
          <p>
            <b className="text-zinc-100">Getting files to your PC:</b> AirDrop (Mac), Phone Link (Windows), Google Drive or iCloud Drive, or email them to yourself.
            MP3, M4A, WAV, AAC, and OGG all work.
          </p>
          <p className="rounded-lg bg-amber-500/10 p-3 text-amber-200 ring-1 ring-amber-500/20">
            Recording laws differ by location. Several US states (including California, Florida, Illinois, Pennsylvania, and Washington) require every party to
            consent. A simple &quot;I record my calls so I can take good notes, is that alright?&quot; at the start covers you.
          </p>
        </div>
      </Card>
    </div>
  );
}
