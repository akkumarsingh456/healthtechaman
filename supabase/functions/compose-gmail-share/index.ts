// Edge function: compose-gmail-share
// Uses Lovable AI to draft a short, formal email body and returns subject,
// body, and signed URLs for any uploaded PDFs + verification links for the
// system referral letter / leave certificate. The frontend opens Gmail
// compose with the result prefilled.
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
  appOrigin?: string;
  message?: string;
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return ok({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) return ok({ error: "unauthorized" }, 401);

  let payload: Payload;
  try { payload = await req.json(); } catch { return ok({ error: "invalid_json" }, 400); }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: student } = await admin
    .from("students")
    .select("id, full_name, roll_number, email, branch, program, batch")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!student) return ok({ error: "student_not_found" }, 404);

  let leave: any = null;
  if (payload.leaveRequestId) {
    const { data } = await admin
      .from("medical_leave_requests")
      .select("id, referral_hospital, illness_description, expected_duration, leave_start_date, expected_return_date, status, doctor_notes, rest_days, doctor_clearance, doctor_clearance_date")
      .eq("id", payload.leaveRequestId)
      .eq("student_id", student.id)
      .maybeSingle();
    leave = data;
  }

  // Sign uploaded files (24h for Gmail use)
  const fileLinks: { name: string; url: string }[] = [];
  for (const f of payload.uploadedFiles || []) {
    try {
      const { data: signed } = await admin.storage
        .from("student-health-uploads")
        .createSignedUrl(f.path, 60 * 60 * 24);
      if (signed?.signedUrl) fileLinks.push({ name: f.name, url: signed.signedUrl });
    } catch (_) { /* skip */ }
  }

  // System document verification links (open the printable doc in-app)
  const origin = (payload.appOrigin || "").replace(/\/$/, "");
  const systemDocs: { name: string; url: string }[] = [];
  if (leave) {
    if (payload.includeReferral && origin) {
      systemDocs.push({
        name: "Doctor Referral Letter (PDF)",
        url: `${origin}/verify?doc=referral&id=${encodeURIComponent(leave.id)}`,
      });
    }
    if (payload.includeLeaveCertificate && leave.doctor_clearance && origin) {
      systemDocs.push({
        name: "Medical Leave Certificate (PDF)",
        url: `${origin}/verify?doc=leave-certificate&id=${encodeURIComponent(leave.id)}`,
      });
    }
  }

  // Compose subject + AI body
  const recipientLine = payload.recipients
    .map((r) => `${r.name || r.role} <${r.email}>`).join(", ");

  const subject = leave
    ? `Medical Leave Intimation — ${student.full_name} (${student.roll_number})`
    : `Health Records Sharing — ${student.full_name} (${student.roll_number})`;

  let body = "";
  if (LOVABLE_API_KEY) {
    const ctx = {
      student: {
        name: student.full_name,
        roll: student.roll_number,
        branch: student.branch,
        program: student.program,
        batch: student.batch,
        email: student.email,
      },
      leave: leave ? {
        hospital: leave.referral_hospital,
        illness: leave.illness_description,
        duration: leave.expected_duration,
        from: leave.leave_start_date,
        to: leave.expected_return_date,
        status: leave.status,
        rest_days: leave.rest_days,
        doctor_notes: leave.doctor_notes,
      } : null,
      recipients: payload.recipients.map((r) => ({ role: r.role, name: r.name || null })),
      attachments: [
        ...systemDocs.map((d) => d.name),
        ...fileLinks.map((f) => f.name),
      ],
      student_message: payload.message || null,
    };

    const prompt = `Write a SHORT, formal, respectful email body (no subject line, no greeting list — address all recipients politely as "Respected Sir/Madam,") from a student to academic and medical authorities to inform them about a medical leave and share supporting documents.

Rules:
- Maximum 110 words.
- Plain text only. No markdown, no bullet symbols other than "-".
- Mention: student name, roll number, branch/programme, brief reason, leave dates/duration, that referral letter and/or medical leave certificate are attached as links below.
- DO NOT invent details not present in the context.
- End with "Regards," on its own line, then student name + roll number on the next line.
- Do NOT include any "Attachments:" list — the system appends links after your text.

Context JSON:
${JSON.stringify(ctx)}`;

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You draft short formal Indian academic emails. Plain text only." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (aiRes.ok) {
        const j = await aiRes.json();
        body = (j.choices?.[0]?.message?.content || "").trim();
      }
    } catch (_) { /* fall through */ }
  }

  if (!body) {
    // Fallback non-AI body
    body = [
      "Respected Sir/Madam,",
      "",
      `I am ${student.full_name} (Roll No: ${student.roll_number}${student.branch ? `, ${student.branch}` : ""}).`,
      leave ? `I am writing to inform you about my medical leave: ${leave.illness_description || "medical condition"} — ${leave.expected_duration}${leave.leave_start_date ? ` (from ${leave.leave_start_date}${leave.expected_return_date ? ` to ${leave.expected_return_date}` : ""})` : ""}.` : "I am sharing my health documents for your review.",
      "Relevant referral letter and medical leave certificate links are provided below.",
      payload.message ? "" : null,
      payload.message || null,
      "",
      "Regards,",
      `${student.full_name}`,
      `Roll No: ${student.roll_number}`,
    ].filter((l) => l !== null).join("\n");
  }

  // Append attachments / links section deterministically
  const allLinks = [...systemDocs, ...fileLinks];
  if (allLinks.length) {
    body += "\n\n--- Attached Documents ---\n";
    for (const l of allLinks) body += `• ${l.name}: ${l.url}\n`;
    body += "(Links are valid for 24 hours.)";
  }

  return ok({
    subject,
    body,
    to: payload.recipients.map((r) => r.email),
    recipientLine,
    systemDocs,
    fileLinks,
  });
});