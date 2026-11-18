import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CodeSchema = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{16}$/;
const ALLOWED_TYPES = new Set([
  "prescription", "referral letter", "medical referral letter", "medical leave certificate",
  "fitness certificate", "medical certificate", "lab_report", "hospital referral card",
  "emergency_case_report",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token === authHeader) return json({ error: "Sign-in required" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Document service unavailable" }, 503);

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Sign-in required" }, 401);

  try {
    const raw = await req.json();
    const code = typeof raw.code === "string" ? raw.code : "";
    const docType = typeof raw.docType === "string" ? raw.docType.trim().slice(0, 80) : "";
    const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 300) : "";
    const html = typeof raw.html === "string" ? raw.html : "";
    const sourceId = typeof raw.sourceId === "string" ? raw.sourceId.slice(0, 120) : null;
    if (!CodeSchema.test(code) || !ALLOWED_TYPES.has(docType.toLowerCase()) || !title || html.length < 20 || html.length >= 3_000_000 || !/<html[\s>]/i.test(html) || !/<\/html\s*>/i.test(html)) {
      return json({ error: "Invalid document details" }, 400);
    }

    const service = createClient(url, serviceKey);
    const { data: roles, error: rolesError } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id);
    if (rolesError) return json({ error: "Could not verify document permissions" }, 503);

    const roleSet = new Set((roles ?? []).map((row) => row.role as string));
    const normalizedType = docType.toLowerCase();
    const mayIssue = roleSet.has("admin") || roleSet.has("doctor") || roleSet.has("medical_staff") ||
      (roleSet.has("lab_officer") && normalizedType.includes("lab"));
    if (!mayIssue) return json({ error: "Only authorized clinical staff can register verified documents" }, 403);

    const { error: insertError } = await service.from("issued_documents").insert({
      code,
      doc_type: docType,
      title,
      source_id: sourceId,
      html,
      issued_by: authData.user.id,
    });
    if (insertError) return json({ error: "Could not register this document" }, 409);
    return json({ ok: true });
  } catch {
    return json({ error: "Invalid document request" }, 400);
  }
});