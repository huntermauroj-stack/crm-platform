# Rapport: personal CRM and prospecting workspace

A CRM and cold-calling workspace built for one person. It runs on your own computer, keeps every record in a local database file, and never sends your data anywhere except, optionally, call transcripts to Claude for analysis.

## What it does

| Area | What you get |
| --- | --- |
| **Dashboard** | Follow-ups due today, dials and conversations today, calls per day this week, open pipeline value, active clients, recordings waiting for review. |
| **Contacts and companies** | Search and filter, status tracking (prospect, lead, opportunity, client, past client, do not contact), pain points, notes, tags, and a full activity timeline. Click any phone number to dial. |
| **Call lists** | Group prospects into lists with a call script. **Start calling** opens a focused session: one contact at a time, the number to dial (plus a QR code your phone can scan to dial), the script, past history, outcome buttons, and notes. **Save & next** moves straight to the next person. |
| **Call logging** | Eight outcomes (connected, meeting booked, not interested, call back, voicemail, no answer, gatekeeper, wrong number). Each one schedules a sensible follow-up task, updates the contact's status, and books a deal into Discovery when you set a meeting. Keyboard: `1`–`8` picks an outcome (`Alt+1`–`8` while typing), `Ctrl+Enter` saves. |
| **Pipeline** | Drag-and-drop board: New lead → Contacted → Discovery call → Proposal sent → Negotiation → Won / Lost. Deals track one-time, monthly, or annual value. |
| **Clients** | Active clients, monthly recurring revenue, one-time revenue, and anyone you haven't spoken to in 30+ days. |
| **Tasks** | Today and overdue, upcoming, and done. Snooze by a day or a week. |
| **Call recordings** | Upload a recording from your phone. It's **transcribed locally** with Whisper (free and private). Then **Claude** writes a summary, pulls out pain points, objections, budget, timeline, decision makers, current tools, and rapport notes, suggests the next deal stage and follow-up, and drafts a follow-up email. You pick which updates to apply to the CRM. |
| **Opportunities** | Every problem a prospect mentions is saved, grouped by theme across everyone you've called, and marked as solvable now, partly, or not yet. List what you sell today, and when you add a new service, **Re-check against my offers** finds the old problems you can now solve. **Make call list** turns a theme into a ready-to-dial list with a script. Problems come from recording analysis, from **Scan call notes** (Claude reads your typed notes), or from the Problems card on a contact's page. |
| **Import / export** | CSV import with automatic column matching, duplicate detection (email or LinkedIn URL), and the option to drop everyone straight into a call list. Export all contacts as a CSV from Settings. |

## Install on Windows (no setup needed)

1. Download **Rapport-Setup-x.y.z.exe** from the repository's [Releases](../../releases) page (or from the latest *Windows installer* run under Actions).
2. Double-click it. Windows may show "Windows protected your PC" because the installer isn't code-signed. Click **More info → Run anyway**.
3. Open **Rapport** from the desktop or Start menu.
4. Go to **Settings** and paste your Anthropic API key to turn on AI call summaries.

**Updates install themselves.** Rapport checks GitHub for a new version when it starts (and every few hours), downloads it in the background, and asks you to restart. Help → Check for updates does it on demand. You only run the installer by hand once.

Your data is stored in `%LOCALAPPDATA%\Rapport\data` (Help → Open data folder in the app). Uninstalling the app leaves your data in place. Clicking a phone number opens Phone Link or your default calling app.

## Run from source (developers)



You need **Node.js 20 or newer** ([nodejs.org](https://nodejs.org), pick the LTS version).

```bash
git clone https://github.com/huntermauroj-stack/crm-platform.git
cd crm-platform
npm run setup          # installs packages and creates the database
cp .env.example .env.local   # Windows: copy .env.example .env.local
```

To turn on AI call analysis, paste your Anthropic API key in the app's Settings page, or put it in `.env.local` as `ANTHROPIC_API_KEY=` (create one at [console.anthropic.com](https://console.anthropic.com)). Everything else works without it.

Want sample data to click around? Run `npm run seed`. Delete the `data` folder afterwards to start fresh.

### Running it

```bash
npm run app
```

Then open **http://localhost:3000**. The app only listens on your own machine (`127.0.0.1`), so nobody else on your network can reach it. Use `npm run dev` instead if you're changing the code.

## Recording calls

- **iPhone (iOS 18.1+):** tap the record button during a call (everyone hears a short announcement). The audio and Apple's transcript are saved in Notes. Share the audio file to your PC and upload it, or paste Apple's transcript on the Recordings page.
- **Android:** many phones (Pixel, Samsung, and others) have call recording under Phone → Settings → Call recording.
- Upload from the contact's page, or attach the file while logging a call, so it links to the right person automatically.

MP3, M4A, WAV, AAC, OGG, and WebM all work. Your browser decodes the audio, so very unusual formats (like AMR) may need converting first.

The first transcription downloads the speech model (about 250 MB) into `data/models`. After that it works offline. A 10-minute call takes roughly 1–3 minutes to transcribe on a typical laptop. For faster but less accurate results, set `WHISPER_MODEL=Xenova/whisper-base.en` in `.env.local`.

> Recording laws vary. Several US states (California, Florida, Illinois, Pennsylvania, Washington, and others) require everyone on the call to consent. Asking "I record my calls so I can take good notes, is that alright?" covers you.

## Your data

Everything lives in the `data/` folder: `crm.db` (the database), `recordings/` (audio files), and `models/` (the speech model). **Back up this folder**, for example by syncing it to a cloud drive. Set `CRM_DATA_DIR` in `.env.local` to keep it somewhere else.

`npm run db:studio` opens a spreadsheet-style editor for the raw database.

## Tech

Next.js 16 (App Router, server actions), SQLite through libSQL and Drizzle ORM, Tailwind CSS 4, Whisper through Transformers.js (runs in Node, on your CPU), and the Anthropic SDK with structured outputs for call analysis (`claude-opus-5-5` by default, with server-side fallback turned on).

| Command | What it does |
| --- | --- |
| `npm run app` | Build and start the app at http://localhost:3000 |
| `npm run dev` | Development mode with hot reload |
| `npm run seed` | Add sample data |
| `npm run desktop` | Build and open the desktop (Electron) version |
| `npm run dist:win` | Build the Windows installer into `dist/` (run on Windows; CI does this automatically) |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` (applied automatically on next start) |
| `npm run typecheck` / `npm run lint` | Checks |
