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
| **Gmail and Calendar** | Email and Book meeting buttons on every contact. Connect Google to sync emails and meetings onto timelines, send directly, and send personalized email blasts to a call list. |
| **Import / export** | CSV import with automatic column matching, duplicate detection (email or LinkedIn URL), and the option to drop everyone straight into a call list. Export all contacts as a CSV from Settings. |

## Install on Windows (no setup needed)

1. Download **Rapport-Setup-x.y.z.exe** from the repository's [Releases](../../releases) page (or from the latest *Windows installer* run under Actions).
2. Double-click it. Windows may show "Windows protected your PC" because the installer isn't code-signed. Click **More info → Run anyway**.
3. Open **Rapport** from the desktop or Start menu.
4. Go to **Settings** and paste your Anthropic API key to turn on AI call summaries.

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

## Gmail and Google Calendar

Every contact page and the calling screen have **Email** and **Book meeting** buttons. With nothing set up, they open Gmail or Google Calendar in your browser already filled in, and Rapport logs what you did.

Connect your Google account in **Settings** and you also get:

- **Sync**: emails to and from your contacts, and calendar events they're invited to, appear on their timelines (the first sync looks back 90 days, then every 15 minutes while Rapport is open). Upcoming meetings land in Tasks.
- **Send now** and **Add to Calendar**: send from your Gmail and create events (with an invite) without leaving Rapport.
- **Email blasts**: on any call list, **Email this list** sends one personal email per contact from your Gmail, with `{first}`, `{name}`, `{company}` and `{preview}` merge fields. It includes a preview, a test send to yourself, and progress as it goes. Do-not-contact contacts are skipped.

### One-time Google setup (about 10 minutes)

Rapport talks to Google with your own private "OAuth client", so nothing passes through anyone else's servers.

1. Go to [console.cloud.google.com](https://console.cloud.google.com), sign in with the Google account you email from, and create a project (any name, e.g. "Rapport").
2. **APIs & Services → Library**: enable **Gmail API** and **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** (or **Google Auth Platform → Branding**): choose **External**, app name "Rapport", your email as support and developer contact. Save.
4. **Audience**: add your own Gmail address as a **test user**. Then click **Publish app** so your sign-in doesn't expire every 7 days (it stays unverified, which is fine for personal use).
5. **Clients → Create client** (or **Credentials → Create credentials → OAuth client ID**): application type **Desktop app**, name "Rapport". Copy the **Client ID** and **Client secret**.
6. In Rapport, go to **Settings → Gmail and Google Calendar**, paste both, click **Save**, then **Connect Google**. Your browser opens Google's sign-in. Because the app is unverified, Google shows a warning: click **Advanced → Go to Rapport (unsafe)**, tick all the boxes, and continue. When the browser says "Google is connected", go back to Rapport and click **Refresh**.

Tokens are stored in `config.json` in your data folder. **Disconnect** in Settings removes them and revokes access. You can also remove access any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

> Email blasts are for people you'd reasonably expect to want to hear from you. Keep each message personal, include a way to opt out (the templates do), and stay under Gmail's daily limit (about 500 on a personal account).

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
