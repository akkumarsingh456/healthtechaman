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

    // Resolve this student by the authenticated user id first.
    let { data: student, error: studentLookupError } = await admin.from("students").select("*").eq("user_id", user.id).maybeSingle();
    if (studentLookupError) throw studentLookupError;
    // Recover legacy rows only through the caller's verified email.
    // Never take a row from another active auth account.
    if (!student && user.email && user.email_confirmed_at) {
      const verifiedEmail = user.email.trim().toLowerCase();
      const { data: candidates, error: candidateError } = await admin.from("students").select("id, user_id, email").ilike("email", verifiedEmail).limit(2);
      if (candidateError) throw candidateError;
      if (candidates?.length === 1) {
        const candidate = candidates[0];
        let canRecover = candidate.user_id == null;
        if (candidate.user_id && candidate.user_id !== user.id) {
          const { data: previousOwner, error: previousOwnerError } = await admin.auth.admin.getUserById(candidate.user_id);
          if (previousOwner) issues.push("A matching student record is linked to another active login. No account link was changed.");
          else if (previousOwnerError && previousOwnerError.status === 404) canRecover = true;
          else if (previousOwnerError) throw previousOwnerError;
        }
        if (canRecover) {
          let update = admin.from("students").update({ user_id: user.id, updated_at: new Date().toISOString() }).eq("id", candidate.id);
          update = candidate.user_id == null ? update.is("user_id", null) : update.eq("user_id", candidate.user_id);
          const { data: linked, error: linkError } = await update.select("*").maybeSingle();
          if (linkError) throw linkError;
          if (linked) { student = linked; repairs.push("Reconnected your existing student record to this verified login."); }
        }
      } else if ((candidates?.length ?? 0) > 1) issues.push("Multiple student records match this verified email. Administrator review is required.");
      else issues.push("No student record matches this verified login email.");
    }
    if (!student) return json({ ok: false, synced: false, issues: issues.length ? issues : ["No student record found for this account."], repairs });
    const { data: existingRole, error: roleLookupError } = await admin.from("user_roles").select("user_id").eq("user_id", user.id).eq("role", "student").maybeSingle();
    if (roleLookupError) throw roleLookupError;
    if (!existingRole) {
      const { error: roleInsertError } = await admin.from("user_roles").insert({ user_id: user.id, role: "student" });
      if (roleInsertError && roleInsertError.code !== "23505") throw roleInsertError;
      if (!roleInsertError) repairs.push("Restored the student role for this login.");
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