// Edge function: student-data-sync
// Self-healing data fetch for the logged-in student.
// - Verifies the auth user
// - Locates only the student record already linked to the verified auth user
// - Never treats a submitted email or roll number as proof of record ownership
// - Returns a health report of related rows so the UI can show what was repaired
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    // Verify user with anon client
    const anon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anon.auth.getUser(token);
    if (userErr || !userData.user) {
      return json({ ok: false, error: "invalid session" }, 401);
    }
    const user = userData.user;

    // Consume the request body for compatibility, but never use user-supplied
    // identifiers to discover or reassign a student record.
    await req.json().catch(() => ({}));

    const admin = createClient(supabaseUrl, serviceKey);
    const issues: string[] = [];
    const repairs: string[] = [];

    // 1. Try by user_id first
    let { data: student } = await admin
      .from("students")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!student) {
      return json({
        ok: false,
        synced: false,
        issues: ["No student record found for this account."],
        repairs,
      });
    }

    // Pull related counts to surface visibility
    const [leavesRes, visitsRes, prescriptionsRes, labsRes, apptsRes, profileRes] =
      await Promise.all([
        admin.from("medical_leave_requests").select("id", { count: "exact", head: true }).eq("student_id", student.id),
        admin.from("health_visits").select("id", { count: "exact", head: true }).eq("student_id", student.id),
        admin.from("prescriptions").select("id", { count: "exact", head: true }).eq("student_id", student.id),
        admin.from("lab_reports").select("id", { count: "exact", head: true }).eq("student_id", student.id),
        admin.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", user.id),
        admin.from("student_profiles").select("student_id").eq("student_id", student.id).maybeSingle(),
      ]);

    if (!profileRes.data) {
      issues.push("Extended health profile was missing — created an empty one.");
      await admin.from("student_profiles").insert({ student_id: student.id });
      repairs.push("Initialized student health profile shell.");
    }

    return json({
      ok: true,
      synced: repairs.length > 0,
      student_id: student.id,
      roll_number: student.roll_number,
      counts: {
        medical_leaves: leavesRes.count ?? 0,
        health_visits: visitsRes.count ?? 0,
        prescriptions: prescriptionsRes.count ?? 0,
        lab_reports: labsRes.count ?? 0,
        appointments: apptsRes.count ?? 0,
      },
      issues,
      repairs,
    });
  } catch (err) {
    console.error("student-data-sync failed:", err);
    return json({ ok: false, error: (err as Error).message }, 200);
  }
});