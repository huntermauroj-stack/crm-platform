import { z } from "zod";
import { CALL_OUTCOMES, CONTACT_STATUSES, DEAL_STAGES, SOLVABILITY } from "@/db/schema";

export const ProblemSchema = z.object({
  theme: z
    .string()
    .describe("Short, reusable 2-6 word label for this kind of problem, e.g. 'Missed after-hours calls'. Reuse an existing theme when one fits."),
  title: z.string().describe("One-line statement of the problem as it applies to this prospect"),
  detail: z.string().nullable().describe("Specifics or a short paraphrase of what they said, with numbers if given"),
  solvable: z.enum(SOLVABILITY).describe("Can the salesperson solve this with the offers they sell today?"),
  solvableNote: z.string().describe("One sentence: which offer covers it, or what would be needed to solve it"),
});
export type ExtractedProblem = z.infer<typeof ProblemSchema>;

export const CallAnalysisSchema = z.object({
  summary: z.string().describe("3-5 sentence summary of the call written for a busy salesperson"),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  interestLevel: z.number().int().describe("1 (no interest) to 5 (ready to buy)"),
  keyPoints: z.array(z.string()),
  painPoints: z.array(z.string()).describe("Business problems the prospect mentioned"),
  objections: z.array(z.string()),
  problems: z
    .array(ProblemSchema)
    .describe("Every distinct business problem the prospect raised, including ones the salesperson cannot solve today"),
  budget: z.string().nullable().describe("Anything said about budget or pricing, else null"),
  timeline: z.string().nullable().describe("Anything said about timing or urgency, else null"),
  decisionMakers: z.array(z.string()).describe("People involved in the decision, with roles if known"),
  currentTools: z.array(z.string()).describe("Software, vendors, or AI tools they use today"),
  personalNotes: z.array(z.string()).describe("Rapport details worth remembering (hobbies, family, events)"),
  nextSteps: z.array(z.string()),
  suggestedOutcome: z.enum(CALL_OUTCOMES),
  suggestedStatus: z.enum(CONTACT_STATUSES),
  suggestedDealStage: z.enum(DEAL_STAGES).nullable().describe("null if no deal is warranted"),
  suggestedDealValue: z.number().nullable().describe("Estimated deal value in USD if discussed, else null"),
  followUpInDays: z.number().int().nullable(),
  followUpEmail: z
    .object({ subject: z.string(), body: z.string() })
    .nullable()
    .describe("A short, specific follow-up email from the salesperson, or null if not appropriate"),
  contactUpdates: z
    .object({
      title: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      location: z.string().nullable(),
      companyName: z.string().nullable(),
      companyIndustry: z.string().nullable(),
      companySize: z.string().nullable(),
    })
    .describe("Only facts explicitly stated on the call; null for anything not mentioned"),
});

export type CallAnalysis = z.infer<typeof CallAnalysisSchema>;
