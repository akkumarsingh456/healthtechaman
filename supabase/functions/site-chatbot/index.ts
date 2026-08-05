import { SITE_KNOWLEDGE } from "./knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatMsg = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are "Campus Care Assistant", the official help assistant of the ABHA Campus Care – NIT Warangal Digital Health Centre portal (a personal demo project, not the official NITW website).

STRICT RULES:
1. Answer ONLY from the VERIFIED KNOWLEDGE below plus the user's question. Never invent features, routes, statistics, names or credentials.
2. If something is not in the knowledge, say clearly: "That detail isn't part of this website's verified information — please contact Aman Kumar at akkumarsingh456@gmail.com."
3. Never reveal or guess passwords. If asked for login credentials, give the demo account emails and roles listed, explain how each role signs in, and say passwords are shared only by the project owner.
4. Always remind, when relevant, that this is a demo project and documents are not officially valid.
5. Be concise and well structured: short paragraphs, markdown bullet points, bold for feature names. Do not exceed ~200 words unless the user asks for full detail.
6. Reply in the same language the user writes in (English or Hinglish).

VERIFIED KNOWLEDGE:
${SITE_KNOWLEDGE}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { messages } = (await req.json()) as { messages?: ChatMsg[] };
    const history = (Array.isArray(messages) ? messages : []).slice(-12).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content ?? "").slice(0, 4000) }],
    }));
    if (!history.length) return json({ error: "No message provided" }, 400);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // 1) Direct Gemini (free key, independent of Lovable credits)
    if (GEMINI_API_KEY) {
      for (const model of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM }] },
                contents: history,
                generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
              }),
            },
          );
          if (res.ok) {
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
            if (text) return json({ reply: text });
            console.error(`Gemini ${model} returned empty output`);
          } else {
            console.error(`Gemini ${model} failed [${res.status}]: ${await res.text()}`);
          }
        } catch (err) {
          console.error(`Gemini ${model} request error:`, err);
        }
      }
    } else {
      console.error("GEMINI_API_KEY is not configured");
    }

    // 2) Fallback: Lovable AI Gateway
    if (LOVABLE_API_KEY) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [
              { role: "system", content: SYSTEM },
              ...(messages ?? []).slice(-12).map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content?.trim();
          if (text) return json({ reply: text });
        } else {
          console.error(`Gateway chat failed [${res.status}]: ${await res.text()}`);
        }
      } catch (err) {
        console.error("Gateway chat request error:", err);
      }
    }

    return json({ error: "The assistant is temporarily unavailable. Please try again in a moment." }, 503);
  } catch (e) {
    console.error("site-chatbot error:", e);
    return json({ error: "Could not process that message. Please try again." }, 400);
  }
});
