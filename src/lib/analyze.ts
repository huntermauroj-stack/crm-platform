import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CallAnalysisSchema, type CallAnalysis } from "./analysis-schema";

export const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL ?? "claude-opus-5-5";

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const SYSTEM = `You analyze recorded sales calls for the owner of an AI services business (AI automation, AI agents, and consulting for other businesses).
The salesperson recorded the call on their cell phone. The transcript comes from automatic speech recognition: it has no speaker labels and may contain recognition errors. Infer who is speaking from context.
Extract only what was actually said. Never invent contact details, budgets, or names; use null or an empty list when something was not discussed.
Write the follow-up email in a warm, direct, plain style from the salesperson, referencing specifics from the call. Keep it under 150 words.`;

export async function analyzeTranscript(opts: {
  transcript: string;
  contactContext: string;
}): Promise<CallAnalysis> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(CallAnalysisSchema) },
    messages: [
      {
        role: "user",
        content: `<crm_record>\n${opts.contactContext}\n</crm_record>\n\n<transcript>\n${opts.transcript}\n</transcript>\n\nAnalyze this call.`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to analyze this transcript.");
  if (response.stop_reason === "max_tokens") throw new Error("Analysis was cut off (max_tokens).");
  if (!response.parsed_output) throw new Error("Could not parse the analysis output.");
  return response.parsed_output;
}
