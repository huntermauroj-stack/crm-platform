import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CallAnalysisSchema, type CallAnalysis } from "./analysis-schema";
import { ANALYSIS_MODEL, aiConfigured, anthropic } from "./ai";
import { problemContext } from "./problems";

export { ANALYSIS_MODEL, aiConfigured };

const SYSTEM = `You analyze recorded sales calls for the owner of an AI services business (AI automation, AI agents, and consulting for other businesses).
The salesperson recorded the call on their cell phone. The transcript comes from automatic speech recognition: it has no speaker labels and may contain recognition errors. Infer who is speaking from context.
Extract only what was actually said. Never invent contact details, budgets, or names; use null or an empty list when something was not discussed.
List every distinct business problem the prospect raised in "problems", including ones the salesperson cannot solve with <current_offers>; those are tracked as future opportunities. Reuse a theme from <existing_themes> whenever one fits.
Write the follow-up email in a warm, direct, plain style from the salesperson, referencing specifics from the call. Keep it under 150 words.`;

export async function analyzeTranscript(opts: { transcript: string; contactContext: string }): Promise<CallAnalysis> {
  const response = await anthropic().beta.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(CallAnalysisSchema) },
    messages: [
      {
        role: "user",
        content: `${await problemContext()}\n\n<crm_record>\n${opts.contactContext}\n</crm_record>\n\n<transcript>\n${opts.transcript}\n</transcript>\n\nAnalyze this call.`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to analyze this transcript.");
  if (response.stop_reason === "max_tokens") throw new Error("Analysis was cut off (max_tokens).");
  if (!response.parsed_output) throw new Error("Could not parse the analysis output.");
  return response.parsed_output;
}
