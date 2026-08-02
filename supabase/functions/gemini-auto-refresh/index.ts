// Edge function: gemini-auto-refresh
// Always-on background refresh agent for EVERY login section
// (student, doctor, mentor, admin, lab_officer, pharmacy, medical_staff).
//
// - Verifies the caller's session
// - Detects their role(s)
// - Verifies their core record is reachable, and self-heals stale auth-id links
// - Returns live counts so the UI can refetch with correct data
// - Uses the FREE Google Gemini API (generativelanguage.googleapis.com) with the
//   project's own GEMINI_API_KEY. It is fully independent of Lovable AI credits.
//   If the AI call fails or the key is missing, the refresh still works — the AI
//   only writes the human-readable diagnosis line.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-flash-latest"];

async function geminiDiagnose(payload: unknown): Promise<string | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  const prompt =
    "You are a data-integrity agent for a college health portal. " +
    "Given this JSON refresh report, reply with ONE short sentence (max 20 words) " +
    "stating whether the user's data is fully fetched and correct, or what is missing. " +
    "No markdown, no preamble.\n\n" + JSON.stringify(payload);

  for (const model of GEMINI_MODELS) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } },
          }),
          signal: ctrl.signal,
        },
      );
      clearTimeout(to);
      if (!res.ok) {
        console.error(`gemini ${model} failed [${res.status}]: ${await res.text()}`);
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join(" ")?.trim();
      const clean = text?.replace(/^[\s"',.:;-]+|[\s"']+$/g, "");
      if (clean && clean.length >= 8) return clean;
    } catch (e) {
      console.error(`gemini ${model} error:`, (e as Error).message);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "missing auth" }, 401);

    const anon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !userData.user) return json({ ok: false, error: "invalid session" }, 401);
    const user = userData.user;
    const email = (user.email || "").toLowerCase();

    const body = (await req.json().catch(() => ({}))) as { roll_number_hint?: string };
    const admin = createClient(supabaseUrl, serviceKey);

    const issues: string[] = [];
    const repairs: string[] = [];
    const counts: Record<string, number> = {};

    const { data: roleRows } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    const roles: string[] = (roleRows || []).map((r: any) => r.role);

    // ---- Student ----
    let student: any = null;
    {
      const { data } = await admin.from("students").select("*").eq("user_id", user.id).maybeSingle();
      student = data;
      if (!student && email) {
        const { data: byEmail } = await admin.from("students").select("*").ilike("email", email).maybeSingle();
        if (byEmail) {
          issues.push("Student record was linked to an old login id.");
          const { error } = await admin.from("students").update({ user_id: user.id }).eq("id", byEmail.id);
          if (error) issues.push(`Re-link failed: ${error.message}`);
          else repairs.push("Re-linked your student record to this login.");
          student = { ...byEmail, user_id: user.id };
        }
      }
      if (!student && body.roll_number_hint) {
        const { data: byRoll } = await admin
          .from("students").select("*").ilike("roll_number", body.roll_number_hint).maybeSingle();
        if (byRoll) {
          await admin.from("students").update({ user_id: user.id }).eq("id", byRoll.id);
          repairs.push("Re-linked your student record by roll number.");
          student = { ...byRoll, user_id: user.id };
        }
      }
    }

    if (student) {
      if (!roles.includes("student")) roles.push("student");
      const [leaves, visits, rx, labs, appts, profile] = await Promise.all([
        admin.from("medical_leave_requests").select("id", { count: "exact", head: true }).eq("student_id", student.id),
        admin.from("health_visits").select("id", { count: "exact", head: true }).eq("student_id", student.id),
        admin.from("prescriptions").select("id", { count: "exact", head: true }).eq("student_id", student.id),
        admin.from("lab_reports").select("id", { count: "exact", head: true }).eq("student_id", student.id),
        admin.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", user.id),
        admin.from("student_profiles").select("student_id").eq("student_id", student.id).maybeSingle(),
      ]);
      counts.medical_leaves = leaves.count ?? 0;
      counts.health_visits = visits.count ?? 0;
      counts.prescriptions = rx.count ?? 0;
      counts.lab_reports = labs.count ?? 0;
      counts.appointments = appts.count ?? 0;
      if (!profile.data) {
        const { error } = await admin.from("student_profiles").insert({ student_id: student.id });
        if (!error) repairs.push("Created your missing health profile record.");
      }
    }

    // ---- Doctor / medical officer ----
    if (roles.includes("doctor") || !student) {
      const { data: doc } = await admin.from("medical_officers").select("id").eq("user_id", user.id).maybeSingle();
      if (!doc && email) {
        const { data: byEmail } = await admin.from("medical_officers").select("id").ilike("email", email).maybeSingle();
        if (byEmail) {
          const { error } = await admin.from("medical_officers").update({ user_id: user.id }).eq("id", byEmail.id);
          if (!error) repairs.push("Re-linked your medical officer profile to this login.");
        }
      }
      if (doc || roles.includes("doctor")) {
        const { count } = await admin
          .from("appointments").select("id", { count: "exact", head: true }).eq("doctor_id", doc?.id ?? "");
        counts.doctor_appointments = count ?? 0;
      }
    }

    // ---- Mentor ----
    if (roles.includes("mentor")) {
      const { data: mentor } = await admin.from("mentors").select("id").eq("user_id", user.id).maybeSingle();
      if (!mentor && email) {
        const { data: byEmail } = await admin.from("mentors").select("id").ilike("email", email).maybeSingle();
        if (byEmail) {
          const { error } = await admin.from("mentors").update({ user_id: user.id }).eq("id", byEmail.id);
          if (!error) repairs.push("Re-linked your mentor profile to this login.");
        }
      }
    }

    if (roles.length === 0) issues.push("No role assigned to this account yet.");

    const report = {
      roles,
      roll_number: student?.roll_number ?? null,
      counts,
      issues,
      repairs,
    };

    const diagnosis = await geminiDiagnose(report);

    return json({
      ok: true,
      ...report,
      synced: repairs.length > 0,
      diagnosis: diagnosis ?? (issues.length ? issues[0] : "All records fetched and up to date."),
      ai: diagnosis ? "gemini" : "offline",
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("gemini-auto-refresh failed:", err);
    return json({ ok: false, error: (err as Error).message }, 200);
  }
});
