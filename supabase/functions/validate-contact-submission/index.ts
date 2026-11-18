import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isRateLimited } from "../_shared/ipRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ valid: false, notes: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip, 8, 60_000)) return new Response(JSON.stringify({ valid: false, notes: "Too many requests. Please try again in a minute." }), {
    status: 429,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
  });

  try {
    const raw = await req.json();
    const trunc = (v: unknown, n: number) => String(v ?? '').slice(0, n);
    const name = trunc(raw.name, 200);
    const email = trunc(raw.email, 320);
    const subject = trunc(raw.subject, 300);
    const message = trunc(raw.message, 1000);
    const submission_type = trunc(raw.submission_type, 50);
    const sender_role = trunc(raw.sender_role, 50);
    const college_name = trunc(raw.college_name, 200);
    const branch = trunc(raw.branch, 100);
    const year = trunc(raw.year, 50);

    const isReview = submission_type === "review";
    const blockedWords = /\b(fuck|shit|bitch|bastard|asshole|cunt|motherfucker|slut|whore)\b/i;
    if (isReview && blockedWords.test(`${name} ${subject} ${message}`)) {
      return new Response(JSON.stringify({ valid: false, notes: "Please remove offensive language before posting your review." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Do not send public visitor content to a metered AI provider.
    // Validate essential fields deterministically; reviews retain profanity screening.
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const valid = name.trim().length >= 2 && emailValid && message.trim().length >= 2;
    return new Response(JSON.stringify({
      valid,
      notes: valid ? "Basic checks passed" : "Please provide a name, valid email, and message.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Validation error:", e);
    return new Response(JSON.stringify({ valid: false, notes: "Could not process this submission. Please try again." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
