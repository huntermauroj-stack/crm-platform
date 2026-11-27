import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/db";

type AppConfig = { anthropicApiKey?: string };

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
  fs.writeFileSync(file(), JSON.stringify(next, null, 2));
}

/** API key saved in Settings wins over the ANTHROPIC_API_KEY environment variable. */
export function anthropicApiKey(): string | undefined {
  return readConfig().anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined;
}
