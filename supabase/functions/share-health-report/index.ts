// Edge function: share-health-report
// Sends a student's health report PDFs (uploaded + system docs) to chosen
// recipients via Resend, and records every share in health_share_recipients.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Recipient { role: string; name?: string; email: string }
interface FileRef { name: string; path: string }
interface Payload {
  recipients: Recipient[];
  uploadedFiles?: FileRef[];
  includeReferral?: boolean;
  includeLeaveCertificate?: boolean;
  leaveRequestId?: string | null;
  message?: string;
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return ok({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) return ok({ error: "unauthorized" }, 401);

  let payload: Payload;
  try { payload = await req.json(); } catch { return ok({ error: "invalid_json" }, 400); }

  const recipients = (payload.recipients || []).filter((r) => r && isEmail(r.email));
  if (recipients.length === 0) return ok({ error: "no_recipients" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve student
  const { data: student } = await admin
    .from("students")
    .select("id, full_name, roll_number, email, branch, program, batch")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!student) return ok({ error: "student_not_found" }, 404);

  // Resolve leave request if asked
  let leave: any = null;
  if (payload.leaveRequestId) {
    const { data } = await admin
      .from("medical_leave_requests")
      .select("id, referral_hospital, illness_description, expected_duration, leave_start_date, expected_return_date, status, doctor_notes, rest_days, doctor_clearance, doctor_clearance_date, referring_doctor_id")
      .eq("id", payload.leaveRequestId)
      .eq("student_id", student.id)
      .maybeSingle();
    leave = data;
  }

  // Sign uploaded files (1h)
  const fileLinks: { name: string; url: string }[] = [];
  for (const f of payload.uploadedFiles || []) {
    try {
      const { data: signed } = await admin.storage
        .from("student-health-uploads")
        .createSignedUrl(f.path, 3600);
      if (signed?.signedUrl) fileLinks.push({ name: f.name, url: signed.signedUrl });
    } catch (_) { /* skip */ }
  }

  const subject = `Health report shared by ${student.full_name} (${student.roll_number})`;

  // Render shared email body
  const renderEmail = (r: Recipient) => `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1f2937">
      <div style="border-left:4px solid #059669;padding-left:12px;margin-bottom:16px">
        <h2 style="margin:0;color:#065f46">Health Report Shared</h2>
        <p style="margin:4px 0 0;color:#374151;font-size:13px">NIT Warangal Health Centre Portal</p>
      </div>
      <p>Dear ${r.name || r.role},</p>
      <p><strong>${student.full_name}</strong> (Roll No: <strong>${student.roll_number}</strong>${student.branch ? `, ${student.branch}` : ""}) has shared their health documents with you for your review${r.role ? ` as their <strong>${r.role}</strong>` : ""}.</p>
      ${leave ? `
      <h3 style="margin-top:20px;color:#065f46;font-size:15px">Linked Medical Leave</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px">
        <tr><td style="padding:6px 10px;color:#374151"><strong>Hospital:</strong></td><td style="padding:6px 10px">${leave.referral_hospital || "—"}</td></tr>
        <tr><td style="padding:6px 10px;color:#374151"><strong>Condition:</strong></td><td style="padding:6px 10px">${leave.illness_description || "—"}</td></tr>
        <tr><td style="padding:6px 10px;color:#374151"><strong>Duration:</strong></td><td style="padding:6px 10px">${leave.expected_duration || "—"}</td></tr>
        <tr><td style="padding:6px 10px;color:#374151"><strong>From → To:</strong></td><td style="padding:6px 10px">${leave.leave_start_date || "—"} → ${leave.expected_return_date || "—"}</td></tr>
        <tr><td style="padding:6px 10px;color:#374151"><strong>Status:</strong></td><td style="padding:6px 10px">${leave.status}</td></tr>
      </table>` : ""}
      ${payload.message ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-left:3px solid #6b7280;border-radius:4px"><strong>Message from student:</strong><br/>${payload.message.replace(/</g, "&lt;")}</div>` : ""}
      ${fileLinks.length ? `
      <h3 style="margin-top:20px;color:#065f46;font-size:15px">Attached Documents</h3>
      <ul style="padding-left:18px">
        ${fileLinks.map((f) => `<li><a href="${f.url}" style="color:#059669">${f.name}</a> <span style="color:#9ca3af;font-size:11px">(link valid 1 hour)</span></li>`).join("")}
      </ul>` : ""}
      ${payload.includeReferral && leave ? `<p style="margin-top:12px;color:#374151"><em>Doctor's referral letter is available on the student portal.</em></p>` : ""}
      ${payload.includeLeaveCertificate && leave ? `<p style="color:#374151"><em>Medical leave certificate is available on the student portal.</em></p>` : ""}
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
      <p style="color:#dc2626;font-size:11px"><strong>Disclaimer:</strong> This is not the official website of NIT Warangal. Documents shared here are from a student-managed portal for academic coordination.</p>
      <p style="font-size:11px;color:#6b7280">Sent via NITW Health Portal · ${new Date().toLocaleString()}</p>
    </div>`;

  // Send emails + log
  const results: any[] = [];
  for (const r of recipients) {
    let email_status = "pending";
    let email_error: string | null = null;

    if (!RESEND_KEY) {
      email_status = "skipped";
      email_error = "RESEND_API_KEY not configured";
    } else {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "NITW Health Portal <onboarding@resend.dev>",
            to: [r.email],
            reply_to: student.email || undefined,
            subject,
            html: renderEmail(r),
          }),
        });
        if (res.ok) email_status = "sent";
        else { email_status = "failed"; email_error = `${res.status} ${await res.text()}`; }
      } catch (e) {
        email_status = "failed";
        email_error = String(e);
      }
    }

    await admin.from("health_share_recipients").insert({
      student_id: student.id,
      sender_user_id: user.id,
      medical_leave_request_id: payload.leaveRequestId || null,
      recipient_role: r.role,
      recipient_name: r.name || null,
      recipient_email: r.email,
      files: fileLinks.map((f) => ({ name: f.name })),
      include_referral: !!payload.includeReferral,
      include_leave_certificate: !!payload.includeLeaveCertificate,
      message: payload.message || null,
      email_status,
      email_error,
    });
    results.push({ email: r.email, status: email_status });
  }

  return ok({ ok: true, results });
});