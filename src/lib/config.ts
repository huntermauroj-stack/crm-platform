import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/db";

export type GoogleTokens = { accessToken: string; refreshToken: string; expiresAt: number; email?: string; scope?: string };

type AppConfig = {
  anthropicApiKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  google?: GoogleTokens;
  /** In-flight sign-in: PKCE verifier and redirect URI, keyed by the state value. */
  googlePending?: { state: string; verifier: string; redirectUri: string; createdAt: number };
  googleLastSync?: { at: number; emails: number; meetings: number; error?: string };
  emailTemplatesSeeded?: boolean;
  /** Most emails Rapport will send through Gmail in one day (bulk sends stop there). */
  emailDailyLimit?: number;
};

const file = () => path.join(DATA_DIR, "config.json");

export function readConfig(): AppConfig {
  try {
    return JSON.parse(fs.readFileSync(file(), "utf8")) as AppConfig;
  } catch {
    return {};
  }
}

export function writeConfig(patch: Partial<AppConfig>) {
  const next = { ...readConfig(), ...patch };
  fs.writeFileSync(file(), JSON.stringify(next, null, 2), { mode: 0o600 });
}

/** API key saved in Settings wins over the ANTHROPIC_API_KEY environment variable. */
export function anthropicApiKey(): string | undefined {
  return readConfig().anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined;
}
