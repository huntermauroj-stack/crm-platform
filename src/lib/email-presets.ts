// Built-in email templates. Rapport saves these to your template library the first time it opens; edit them under Emails > Templates.

const SIGNATURE = "Hunter Mauro\nMauro Web & AI\n(704) 999-2668 · hunter@maurowebai.com · mauro-web-ai.replit.app";
const FOOTER = "\n\n--\nIf you'd rather not hear from me, just reply and let me know.";
const OFFER =
  "- Own it: $1,800 one-time. I finish it with your photos and details, connect your domain, and hand it over so you can edit it yourself.\n" +
  "- Hands-off: from $150/month. I host it, run your domain, and make changes whenever you need. No setup fee, cancel anytime.";

export const DEFAULT_TEMPLATES: { name: string; subject: string; body: string }[] = [
  {
    name: "Free preview site (no website)",
    subject: "I built a website for {company} (free to look)",
    body:
      "Hi {first},\n\nI'm Hunter with Mauro Web & AI, a small web studio here in the Charlotte area. Your Google reviews are the kind of reputation most local businesses would love to have, but I couldn't find a website for {company}. So I built you one to show what it could look like:\n\n{preview}\n\nIt uses your real services and a few of your customers' actual reviews. If you like it, there are two simple ways to make it yours:\n\n" +
      OFFER +
      "\n\nNo pressure either way. Would you have 10 minutes this week to take a look together?\n\n" +
      SIGNATURE +
      FOOTER,
  },
  {
    name: "Broken or outdated website",
    subject: "Quick heads-up about your website",
    body:
      "Hi {first},\n\nI'm Hunter with Mauro Web & AI here in the Charlotte area. People clearly love {company}'s work, but when I checked the website on your Google listing ({website}) this week, I noticed a problem: {issue}. Most people who hit that just call the next company on Google.\n\nI build fast, modern websites for local trades, and I can switch you over with little effort on your end. Two simple options:\n\n" +
      "- Own it: $1,800 one-time. I build the new site, connect your domain, and hand it over so you can edit it yourself.\n" +
      "- Hands-off: from $150/month. I host it, manage your domain, and keep it secure and up to date, with changes whenever you need. No setup fee, cancel anytime.\n\n" +
      "If it helps, I'm happy to put together a free preview first so you can see it before deciding. Would you have 10 minutes this week to chat?\n\n" +
      SIGNATURE +
      FOOTER,
  },
  {
    name: "Follow-up (no reply yet)",
    subject: "Re: {company}",
    body:
      "Hi {first},\n\nJust following up on my note from last week. I know things get busy. If a new website for {company} is something you'd consider this year, I'd love to grab 10 minutes and show you what I had in mind.\n\nIf now's not the right time, no worries at all.\n\n" +
      SIGNATURE +
      FOOTER,
  },
  {
    name: "No website intro",
    subject: "Quick question about {company}'s website",
    body:
      "Hi {first},\n\nI help local trades businesses around Charlotte turn their great Google reviews into more booked jobs with a simple, professional website. I noticed {company} doesn't have one yet.\n\nWould you be open to a 10-minute call this week? I can show you a few examples.\n\n" +
      SIGNATURE +
      FOOTER,
  },
];
