import { DATA_DIR } from "@/db";
import { aiConfigured, ANALYSIS_MODEL } from "@/lib/analyze";
import { WHISPER_MODEL } from "@/lib/transcribe";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { readConfig } from "@/lib/config";
import { saveApiKey, saveGoogleClient } from "@/lib/settings-actions";
import { googleAccount, googleClient } from "@/lib/google";
import { GoogleConnectButtons } from "@/components/google-connect";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Settings" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
      <div className="text-zinc-400">{label}</div>
      <div className="col-span-2 text-zinc-200">{children}</div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const ai = aiConfigured();
  const cfg = readConfig();
  const saved = cfg.anthropicApiKey;
  const gClient = googleClient();
  const gAccount = googleAccount();
  const lastSync = cfg.googleLastSync;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" />

      <Card title="Anthropic API key">
        <form action={saveApiKey} className="space-y-3 p-4">
          <p className="text-sm text-zinc-400">
            Used to summarize recorded calls and suggest CRM updates. Create a key at console.anthropic.com → API keys. It&apos;s stored only on this
            computer, in your data folder.
          </p>
          <div className="flex gap-2">
            <Input
              name="anthropicApiKey"
              type="password"
              autoComplete="off"
              placeholder={saved ? `Saved: ${saved.slice(0, 10)}…${saved.slice(-4)}` : "sk-ant-…"}
              className="flex-1"
            />
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
          {saved && (
            <button name="remove" value="1" className="text-xs text-zinc-500 hover:text-rose-300">
              Remove saved key
            </button>
          )}
        </form>
      </Card>

      <Card title="Gmail and Google Calendar">
        <div className="space-y-4 p-4 text-sm">
          <p className="text-zinc-400">
            Once connected, emails with your contacts and meetings they&apos;re invited to show up on their timelines (synced every 15 minutes), and the Email
            and Book meeting buttons send and create events directly. Email blasts send from your Gmail. Everything stays on this computer.
          </p>
          <form action={saveGoogleClient} className="space-y-2">
            <div className="text-xs font-medium text-zinc-500">Step 1: your Google OAuth client (one-time setup; see the guide in the README)</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input name="googleClientId" autoComplete="off" placeholder={gClient ? `Saved: ${gClient.id.slice(0, 14)}…` : "Client ID (…apps.googleusercontent.com)"} />
              <Input name="googleClientSecret" type="password" autoComplete="off" placeholder={gClient ? "Secret saved" : "Client secret (GOCSPX-…)"} />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit">Save</Button>
              {gClient && (
                <button name="remove" value="1" className="text-xs text-zinc-500 hover:text-rose-300">
                  Remove client
                </button>
              )}
            </div>
          </form>
          {gClient && (
            <div className="space-y-2 border-t border-ink-700 pt-4">
              <div className="text-xs font-medium text-zinc-500">Step 2: sign in</div>
              <p className="text-zinc-300">
                {gAccount ? (
                  <>
                    <Badge className="bg-emerald-500/15 text-emerald-300 ring-emerald-500/30">Connected</Badge>{" "}
                    <span className="ml-1">{gAccount.email ?? "Google account"}</span>
                  </>
                ) : (
                  <Badge className="bg-amber-500/15 text-amber-300 ring-amber-500/30">Not connected</Badge>
                )}
              </p>
              {gAccount && lastSync && (
                <p className={lastSync.error ? "text-xs text-rose-300" : "text-xs text-zinc-500"}>
                  {lastSync.error
                    ? `Last sync failed: ${lastSync.error}`
                    : `Last synced ${dateTime(new Date(lastSync.at))}: ${lastSync.emails} new emails, ${lastSync.meetings} new meetings.`}
                </p>
              )}
              <GoogleConnectButtons connected={Boolean(gAccount)} />
            </div>
          )}
        </div>
      </Card>

      <Card title="Status">
        <div className="divide-y divide-ink-700/60">
          <Row label="AI call analysis">
            {ai ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 ring-emerald-500/30">Connected</Badge>
            ) : (
              <span>
                <Badge className="bg-amber-500/15 text-amber-300 ring-amber-500/30">Not set up</Badge>
                <span className="ml-2 text-zinc-400">
                  Paste your API key above.
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
