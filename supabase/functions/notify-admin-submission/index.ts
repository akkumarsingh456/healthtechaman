// Sends an email to the project owner whenever a new contact/review submission arrives.
// Always returns 200 so the caller's UI never hangs (per project resilience rule).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = "akkumarsingh456@gmail.com";

interface Payload {
  submission_type?: string;
  sender_role?: string;
  name?: string;
  email?: string;
  subject?: string | null;
  message?: string;
  college_name?: string | null;
  branch?: string | null;
  year?: string | null;
  rating?: number | null;
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function buildHtml(p: Payload) {
  const isContact = p.submission_type === "contact";
  const title = isContact ? "📨 New Contact Message" : "⭐ New Review / Suggestion";
  const stars = p.rating ? "★".repeat(p.rating) + "☆".repeat(5 - p.rating) : "";

  const rows: Array<[string, string]> = [
    ["Type", esc(p.submission_type)],
    ["Role", esc(p.sender_role)],
    ["Name", esc(p.name)],
    ["Email", esc(p.email)],
  ];
  if (p.subject) rows.push(["Subject", esc(p.subject)]);
  if (p.college_name) rows.push(["College", esc(p.college_name)]);
  if (p.branch) rows.push(["Branch", esc(p.branch)]);
  if (p.year) rows.push(["Year", esc(p.year)]);
  if (stars) rows.push(["Rating", `${stars} (${p.rating}/5)`]);

  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;background:#f8fafc;font-weight:600;color:#475569;border:1px solid #e2e8f0;width:120px">${k}</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${v}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f1f5f9;padding:24px;margin:0">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
      <div style="background:linear-gradient(135deg,#0d9488,#10b981);padding:20px 24px;color:#fff">
        <h1 style="margin:0;font-size:18px">${title}</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9">NITW Health Centre — Admin Alert</p>
      </div>
      <div style="padding:20px 24px">
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">${tableRows}</table>
        <div style="background:#f8fafc;border-left:3px solid #10b981;padding:12px 14px;border-radius:4px">
          <div style="font-weight:600;color:#475569;font-size:12px;margin-bottom:6px">MESSAGE</div>
          <div style="white-space:pre-wrap;color:#0f172a;font-size:14px;line-height:1.5">${esc(p.message)}</div>
        </div>
        <p style="color:#94a3b8;font-size:11px;margin-top:20px;text-align:center">
          Open the admin panel to view and manage all submissions.
        </p>
      </div>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.warn("RESEND_API_KEY missing — skipping admin email");
      return new Response(JSON.stringify({ ok: true, skipped: "no_api_key" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Payload = await req.json().catch(() => ({}));
    const isContact = payload.submission_type === "contact";
    const subjectLine = isContact
      ? `📨 New contact: ${payload.subject || payload.name || "Message"}`
      : `⭐ New ${payload.sender_role || "user"} review from ${payload.name || "anonymous"}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NITW Health Portal <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        reply_to: payload.email || undefined,
        subject: subjectLine,
        html: buildHtml(payload),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Resend error:", res.status, errText);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-admin-submission error:", err);
    return new Response(JSON.stringify({ ok: true, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});