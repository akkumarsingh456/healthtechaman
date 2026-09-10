// Public, read-only document verification endpoint.
// Returns a self-contained, non-editable HTML rendering of either the
// doctor referral letter or the medical leave certificate for a given
// medical leave request id. No third-party/paid APIs are used.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );

const fmt = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

function buildHtml(kind: "referral" | "leave-certificate", leave: any, student: any, doctorName: string) {
  const title = kind === "referral" ? "MEDICAL REFERRAL LETTER" : "MEDICAL LEAVE CERTIFICATE";
  const docNo = `${kind === "referral" ? "REF" : "MLC"}/${String(leave.id).slice(0, 8).toUpperCase()}`;

  const rows: [string, string][] =
    kind === "referral"
      ? [
          ["Student Name", student.full_name],
          ["Roll Number", student.roll_number],
          ["Programme / Branch", `${student.program || "—"} ${student.branch ? "· " + student.branch : ""}`],
          ["Referred To", leave.referral_hospital],
          ["Referral Date", fmt(leave.referral_date || leave.created_at)],
          ["Condition", leave.illness_description],
          ["Expected Duration", leave.expected_duration],
          ["Referring Doctor", `Dr. ${doctorName}`],
          ["Doctor's Notes", leave.doctor_notes || "—"],
        ]
      : [
          ["Student Name", student.full_name],
          ["Roll Number", student.roll_number],
          ["Programme / Branch", `${student.program || "—"} ${student.branch ? "· " + student.branch : ""}`],
          ["Condition Treated", leave.illness_description],
          ["Treated At", leave.referral_hospital],
          ["Leave From", fmt(leave.leave_start_date)],
          ["Expected Return", fmt(leave.expected_return_date)],
          ["Rest Days Advised", leave.rest_days == null ? "—" : String(leave.rest_days)],
          ["Medical Clearance", leave.doctor_clearance ? `Granted on ${fmt(leave.doctor_clearance_date)}` : "Pending"],
          ["Certifying Doctor", `Dr. ${doctorName}`],
        ];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)} — ${esc(student.full_name)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;background:#eef2f7;padding:16px;color:#1f2937;-webkit-user-select:none;user-select:none}
.sheet{position:relative;max-width:820px;margin:0 auto;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:34px;overflow:hidden}
.wm{position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;transform:rotate(-30deg)}
.wm span{font-size:44px;font-weight:700;color:rgba(200,0,0,.08);letter-spacing:3px;text-align:center;line-height:2.4}
header{text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:12px;margin-bottom:18px}
header h1{font-size:19px;color:#1e3a8a;letter-spacing:.5px}
header p{font-size:12px;color:#475569;margin-top:3px}
h2{font-size:15px;text-align:center;margin:16px 0 4px;color:#1e3a8a;text-decoration:underline}
.docno{text-align:center;font-size:11px;color:#64748b;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:13px;position:relative}
td{border:1px solid #e2e8f0;padding:8px 10px;vertical-align:top}
td.k{width:34%;background:#f8fafc;font-weight:700;color:#334155}
.sign{display:flex;justify-content:space-between;margin-top:44px;font-size:12px}
.sign div{text-align:center;border-top:1px solid #94a3b8;padding-top:5px;width:200px}
.note{margin-top:26px;font-size:11px;color:#dc2626;font-weight:700;text-align:center;line-height:1.5}
.meta{margin-top:8px;font-size:10px;color:#94a3b8;text-align:center}
@media print{body{background:#fff;padding:0}.sheet{border:none;border-radius:0}}
</style></head><body>
<div class="sheet">
  <div class="wm"><span>NOT AN OFFICIAL DOCUMENT<br/>VERIFICATION COPY<br/>NOT AN OFFICIAL DOCUMENT</span></div>
  <header>
    <h1>NATIONAL INSTITUTE OF TECHNOLOGY, WARANGAL</h1>
    <p>Institute Health Centre · Warangal, Telangana — 506004</p>
  </header>
  <h2>${esc(title)}</h2>
  <div class="docno">Document No.: ${esc(docNo)} · Status: ${esc(String(leave.status || "").toUpperCase())}</div>
  <table>${rows
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v || "—")}</td></tr>`)
    .join("")}</table>
  <div class="sign"><div>Student</div><div>Medical Officer, NITW Health Centre</div></div>
  <p class="note">DISCLAIMER: This is not the official website of NIT Warangal. No documents issued here are valid for official, legal, or medical purposes.</p>
  <p class="meta">Read-only verification copy generated on ${esc(new Date().toLocaleString("en-IN"))}</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  let doc = url.searchParams.get("doc") || "";
  let id = url.searchParams.get("id") || "";
  if (req.method === "POST") {
    try {
      const b = await req.json();
      doc = b.doc || doc;
      id = b.id || id;
    } catch (_) { /* ignore */ }
  }

  if (doc !== "referral" && doc !== "leave-certificate") return json({ error: "invalid_doc" }, 400);
  if (!UUID_RE.test(id)) return json({ error: "invalid_id" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: leave, error } = await admin
    .from("medical_leave_requests")
    .select(
      "id, student_id, referral_hospital, illness_description, expected_duration, leave_start_date, expected_return_date, referral_date, created_at, status, doctor_notes, rest_days, doctor_clearance, doctor_clearance_date, referring_doctor_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return json({ error: "lookup_failed" }, 500);
  if (!leave) return json({ error: "not_found" }, 404);

  const { data: student } = await admin
    .from("students")
    .select("full_name, roll_number, branch, program")
    .eq("id", leave.student_id)
    .maybeSingle();

  let doctorName = "Campus Doctor";
  if (leave.referring_doctor_id) {
    const { data: doc2 } = await admin
      .from("medical_officers")
      .select("name")
      .eq("id", leave.referring_doctor_id)
      .maybeSingle();
    if (doc2?.name) doctorName = doc2.name;
  }

  const html = buildHtml(doc as any, leave, student || { full_name: "—", roll_number: "—" }, doctorName);

  return json({
    ok: true,
    doc,
    html,
    title:
      (doc === "referral" ? "Medical Referral Letter" : "Medical Leave Certificate") +
      ` — ${student?.full_name || ""} (${student?.roll_number || ""})`,
  });
});
