import { finishSignIn } from "@/lib/google";
import { syncGoogle } from "@/lib/google-sync";

function page(title: string, message: string, ok: boolean) {
  const color = ok ? "#6ee7b7" : "#fda4af";
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Rapport</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#08090c;color:#e4e4e7;font:15px system-ui,sans-serif;text-align:center;padding:24px">
<div><div style="width:40px;height:40px;margin:0 auto 16px;border-radius:12px;background:linear-gradient(135deg,#8f95ff,#d946ef)"></div>
<h1 style="font-size:20px;font-weight:600;color:${color};margin:0 0 8px">${esc(title)}</h1>
<p style="color:#a1a1aa;margin:0;max-width:420px">${esc(message)}</p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  if (err) return page("Google wasn't connected", err === "access_denied" ? "You cancelled the sign-in. Start again from Rapport's Settings." : err, false);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return page("Google wasn't connected", "The sign-in response was incomplete. Start again from Settings.", false);
  try {
    const t = await finishSignIn(code, state);
    syncGoogle().catch(() => {});
    return page("Google is connected", `Signed in as ${t.email ?? "your Google account"}. You can close this tab and go back to Rapport.`, true);
  } catch (e) {
    return page("Google wasn't connected", e instanceof Error ? e.message : String(e), false);
  }
}
