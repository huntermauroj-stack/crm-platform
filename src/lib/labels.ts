import type { CallOutcome, ContactStatus, DealStage, ActivityType } from "@/db/schema";

export const STATUS_LABELS: Record<ContactStatus, string> = {
  prospect: "Prospect",
  lead: "Lead",
  opportunity: "Opportunity",
  client: "Client",
  past_client: "Past client",
  do_not_contact: "Do not contact",
};

export const STATUS_COLORS: Record<ContactStatus, string> = {
  prospect: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  lead: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  opportunity: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  client: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  past_client: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  do_not_contact: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

export const STAGE_LABELS: Record<DealStage, string> = {
  new_lead: "New lead",
  contacted: "Contacted",
  discovery: "Discovery call",
  proposal: "Proposal sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const STAGE_ACCENTS: Record<DealStage, string> = {
  new_lead: "border-t-slate-400",
  contacted: "border-t-sky-400",
  discovery: "border-t-indigo-400",
  proposal: "border-t-violet-400",
  negotiation: "border-t-amber-400",
  won: "border-t-emerald-400",
  lost: "border-t-rose-400",
};

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  connected: "Connected",
  meeting_booked: "Meeting booked",
  not_interested: "Not interested",
  call_back: "Call back later",
  voicemail: "Left voicemail",
  no_answer: "No answer",
  gatekeeper: "Gatekeeper",
  wrong_number: "Wrong number",
};

export const OUTCOME_COLORS: Record<CallOutcome, string> = {
  connected: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  meeting_booked: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  not_interested: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  call_back: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  voicemail: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  no_answer: "bg-slate-500/15 text-slate-400 ring-slate-500/30",
  gatekeeper: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  wrong_number: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

/** Default follow-up delay in days after each call outcome (null = no follow-up). */
export const OUTCOME_FOLLOW_UP_DAYS: Record<CallOutcome, number | null> = {
  connected: 3,
  meeting_booked: null,
  not_interested: null,
  call_back: 2,
  voicemail: 2,
  no_answer: 1,
  gatekeeper: 2,
  wrong_number: null,
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: "Call",
  note: "Note",
  email: "Email",
  meeting: "Meeting",
  sms: "Text",
  linkedin: "LinkedIn",
};
