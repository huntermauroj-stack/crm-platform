export const IMPORT_FIELDS = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["fullName", "Full name (split automatically)"],
  ["title", "Job title"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["mobile", "Mobile"],
  ["linkedinUrl", "LinkedIn URL"],
  ["location", "Location"],
  ["companyName", "Company name"],
  ["companyDomain", "Company website / domain"],
  ["companyIndustry", "Company industry"],
  ["companySize", "Company size / employees"],
  ["status", "Status"],
  ["tags", "Tags"],
  ["notes", "Notes"],
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number][0];
export type ImportRow = Partial<Record<ImportField, string>>;

