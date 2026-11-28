import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "./config";

export const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL ?? "claude-opus-5-5";

export function aiConfigured() {
  return Boolean(anthropicApiKey() || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function anthropic() {
  const key = anthropicApiKey();
  return key ? new Anthropic({ apiKey: key }) : new Anthropic();
}
