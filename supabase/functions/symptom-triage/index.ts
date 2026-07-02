// Edge function: symptom-triage
// Uses Lovable AI to classify a student's symptoms into a priority level
// (high | medium | low) and produce a short clinical summary + follow-up
// questions. The student's past visits/prescriptions are provided as context.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Payload {
  symptoms: string;
  duration?: string;
  severity?: string;
  fever?: boolean;
  additional?: string;
  freeTimeWindow?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return ok({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return ok({ error: "missing_lovable_api_key" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) return ok({ error: "unauthorized" }, 401);

  let payload: Payload;
  try { payload = await req.json(); } catch { return ok({ error: "invalid_json" }, 400); }
  if (!payload.symptoms || payload.symptoms.trim().length < 3) {
    return ok({ error: "symptoms_required" }, 400);
  }

  // Gather brief past history context
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: student } = await admin
    .from("students")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  let historyLines: string[] = [];
  if (student?.id) {
    const [{ data: visits }, { data: rx }] = await Promise.all([
      admin.from("health_visits").select("visit_date, chief_complaint, diagnosis")
        .eq("student_id", student.id).order("visit_date", { ascending: false }).limit(5),
      admin.from("prescriptions").select("prescribed_date, diagnosis")
        .eq("student_id", student.id).order("prescribed_date", { ascending: false }).limit(5),
    ]);
    for (const v of visits || []) {
      historyLines.push(`Visit ${v.visit_date}: ${v.chief_complaint || "-"} / dx: ${v.diagnosis || "-"}`);
    }
    for (const p of rx || []) {
      historyLines.push(`Rx ${p.prescribed_date}: ${p.diagnosis || "-"}`);
    }
  }

  const systemPrompt = `You are a triage assistant for a university health centre.
Classify the student's symptom report into a priority:
- "high": severe/urgent (chest pain, breathing difficulty, high fever >102F, uncontrolled bleeding, head injury, severe abdominal pain, suicidal thoughts, fainting). Needs same-day urgent slot.
- "medium": moderate (persistent fever, moderate pain, injury without red flags, worsening infection, dehydration). Needs today-only slot.
- "low": mild/non-urgent (mild cold, mild headache, routine follow-up, prescription refill). Can be scheduled any day.
Return STRICT JSON: {"priority":"high|medium|low","summary":"1-2 line clinical summary","followUp":["short question 1","short question 2"],"recommendedSpecialty":"General|ENT|Ortho|Derm|Psych|Cardio|Other"}.
Do not add markdown or commentary.`;

  const userPrompt = `Symptoms: ${payload.symptoms}
Duration: ${payload.duration || "not specified"}
Severity (1-10): ${payload.severity || "not specified"}
Fever: ${payload.fever ? "yes" : "no/unknown"}
Additional notes: ${payload.additional || "none"}
Preferred free window today: ${payload.freeTimeWindow || "any"}

Past history (most recent, may be empty):
${historyLines.slice(0, 8).join("\n") || "No prior records."}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return ok({ error: "rate_limited" }, 429);
    if (resp.status === 402) return ok({ error: "credits_exhausted" }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      return ok({ error: "ai_error", detail: t }, 500);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const priority = ["high", "medium", "low"].includes(parsed.priority)
      ? parsed.priority
      : "low";
    const summary = typeof parsed.summary === "string" ? parsed.summary : payload.symptoms.slice(0, 200);
    const followUp = Array.isArray(parsed.followUp) ? parsed.followUp.slice(0, 4) : [];
    const recommendedSpecialty = typeof parsed.recommendedSpecialty === "string" ? parsed.recommendedSpecialty : "General";

    return ok({ priority, summary, followUp, recommendedSpecialty });
  } catch (e) {
    return ok({ error: "ai_exception", detail: String(e) }, 500);
  }
});