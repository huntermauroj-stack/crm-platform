import "server-only";
import crypto from "node:crypto";
import { readConfig, writeConfig, type GoogleTokens } from "./config";

// Google sign-in for a desktop app: OAuth 2.0 with PKCE and a loopback redirect
// (http://127.0.0.1:<port>/api/google/callback). Tokens are stored only in the local data folder.

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function googleClient() {
  const c = readConfig();
  const id = c.googleClientId || process.env.GOOGLE_CLIENT_ID;
  const secret = c.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

export function googleAccount() {
  return readConfig().google ?? null;
}

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function buildAuthUrl(origin: string) {
  const client = googleClient();
  if (!client) throw new Error("Add your Google client ID and secret first.");
  const redirectUri = `${origin.replace(/\/$/, "")}/api/google/callback`;
  const verifier = b64url(crypto.randomBytes(48));
  const state = b64url(crypto.randomBytes(24));
  writeConfig({ googlePending: { state, verifier, redirectUri, createdAt: Date.now() } });
  const p = new URLSearchParams({
    client_id: client.id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: b64url(crypto.createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${p.toString()}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(json.error_description ?? json.error ?? `Google sign-in failed (${res.status})`));
  return json as { access_token: string; refresh_token?: string; expires_in: number; scope?: string; id_token?: string };
}

function emailFromIdToken(idToken?: string) {
  if (!idToken) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email;
  } catch {
    return undefined;
  }
}

export async function finishSignIn(code: string, state: string) {
  const client = googleClient();
  const pending = readConfig().googlePending;
  if (!client) throw new Error("Google client ID and secret are missing.");
  if (!pending || pending.state !== state) throw new Error("This sign-in link is out of date. Start again from Settings.");
  if (Date.now() - pending.createdAt > 15 * 60_000) throw new Error("The sign-in took too long. Start again from Settings.");
  const t = await tokenRequest({
    code,
    client_id: client.id,
    client_secret: client.secret,
    redirect_uri: pending.redirectUri,
    grant_type: "authorization_code",
    code_verifier: pending.verifier,
  });
  if (!t.refresh_token) throw new Error("Google didn't return a refresh token. Remove Rapport's access in your Google account and try again.");
  const tokens: GoogleTokens = {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + (t.expires_in - 60) * 1000,
    email: emailFromIdToken(t.id_token),
    scope: t.scope,
  };
  writeConfig({ google: tokens, googlePending: undefined });
  return tokens;
}

export async function accessToken(): Promise<string> {
  const client = googleClient();
  const tokens = googleAccount();
  if (!client || !tokens) throw new Error("Google isn't connected. Connect it in Settings.");
  if (tokens.expiresAt > Date.now()) return tokens.accessToken;
  try {
    const t = await tokenRequest({
      client_id: client.id,
      client_secret: client.secret,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    });
    const next = { ...tokens, accessToken: t.access_token, expiresAt: Date.now() + (t.expires_in - 60) * 1000 };
    writeConfig({ google: next });
    return next.accessToken;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/invalid_grant|expired|revoked/i.test(msg)) {
      throw new Error("Google sign-in expired. Click Reconnect in Settings.");
    }
    throw e;
  }
}

export async function disconnectGoogle() {
  const tokens = googleAccount();
  writeConfig({ google: undefined, googlePending: undefined });
  if (tokens) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refreshToken)}`, { method: "POST" }).catch(() => {});
  }
}

/** Authenticated call to a Google REST API. */
export async function gfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text;
    try {
      msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
    } catch {}
    throw new Error(`Google ${res.status}: ${msg.slice(0, 300)}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// ---------- Gmail sending ----------

function encodeHeader(v: string) {
  return /[^\x20-\x7e]/.test(v) ? `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=` : v;
}

export async function sendGmail({ to, subject, body }: { to: string; subject: string; body: string }) {
  const from = googleAccount()?.email;
  const mime = [
    from ? `From: ${from}` : null,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64"),
  ]
    .filter((l) => l !== null)
    .join("\r\n");
  return gfetch<{ id: string; threadId: string }>("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: Buffer.from(mime, "utf8").toString("base64url") }),
  });
}

// ---------- Calendar ----------

export async function createCalendarEvent(input: {
  title: string;
  start: Date;
  durationMin: number;
  details?: string;
  location?: string;
  guests?: string[];
  timeZone?: string;
}) {
  const end = new Date(input.start.getTime() + input.durationMin * 60_000);
  const guests = (input.guests ?? []).map((g) => g.trim()).filter(Boolean);
  return gfetch<{ id: string; htmlLink: string }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${guests.length ? "all" : "none"}`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: input.title,
        description: input.details,
        location: input.location,
        start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
        end: { dateTime: end.toISOString(), timeZone: input.timeZone },
        attendees: guests.map((email) => ({ email })),
      }),
    },
  );
}
