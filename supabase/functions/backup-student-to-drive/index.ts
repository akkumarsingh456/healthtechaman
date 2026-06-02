// Edge function: backup-student-to-drive
// Pulls the full picture of a student from the database (service role)
// and uploads it as a JSON snapshot to Google Drive via the Lovable
// connector gateway. Always returns 200 so callers never block UX.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ROOT_FOLDER_NAME = "NITW Health Portal Backups";
const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const driveKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!lovableKey || !driveKey) throw new Error("Drive connector not configured");
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", driveKey);
  return fetch(`${GATEWAY}${path}`, { ...init, headers });
}

async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const q = encodeURIComponent(
    `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentClause}`,
  );
  const listRes = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`);
  if (listRes.ok) {
    const data = await listRes.json();
    if (data.files?.[0]?.id) return data.files[0].id as string;
  }
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];
  const createRes = await driveFetch(`/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!createRes.ok) throw new Error(`Folder create failed: ${createRes.status} ${await createRes.text()}`);
  const created = await createRes.json();
  return created.id as string;
}

async function findFileByName(name: string, parentId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed = false`,
  );
  const res = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function uploadJson(name: string, parentId: string, json: unknown, replaceId?: string | null) {
  const boundary = `lvbl_${crypto.randomUUID()}`;
  const metadata = replaceId ? { name } : { name, parents: [parentId] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(json, null, 2)}\r\n` +
    `--${boundary}--`;

  const path = replaceId
    ? `/upload/drive/v3/files/${replaceId}?uploadType=multipart`
    : `/upload/drive/v3/files?uploadType=multipart`;
  const method = replaceId ? "PATCH" : "POST";
  const res = await driveFetch(path, {
    method,
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) {
    throw new Error(`Drive upload failed (${res.status}): ${await res.text()}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { student_id } = (await req.json().catch(() => ({}))) as { student_id?: string };
    if (!student_id) return ok({ skipped: true, reason: "missing student_id" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull the full student picture in parallel
    const [
      studentRes,
      profileRes,
      leavesRes,
      workflowsRes,
      visitsRes,
      prescriptionsRes,
      itemsRes,
      labsRes,
      apptsRes,
    ] = await Promise.all([
      supabase.from("students").select("*").eq("id", student_id).maybeSingle(),
      supabase.from("student_profiles").select("*").eq("student_id", student_id).maybeSingle(),
      supabase.from("medical_leave_requests").select("*").eq("student_id", student_id),
      supabase
        .from("leave_approval_workflow")
        .select("*, medical_leave_requests!inner(student_id)")
        .eq("medical_leave_requests.student_id", student_id),
      supabase.from("health_visits").select("*").eq("student_id", student_id),
      supabase.from("prescriptions").select("*").eq("student_id", student_id),
      supabase
        .from("prescription_items")
        .select("*, prescriptions!inner(student_id)")
        .eq("prescriptions.student_id", student_id),
      supabase.from("lab_reports").select("*").eq("student_id", student_id),
      supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", (await supabase.from("students").select("user_id").eq("id", student_id).maybeSingle()).data?.user_id ?? "00000000-0000-0000-0000-000000000000"),
    ]);

    const student = studentRes.data;
    if (!student) return ok({ skipped: true, reason: "student not found" });

    const snapshot = {
      backed_up_at: new Date().toISOString(),
      version: 1,
      roll_number: student.roll_number,
      student,
      student_profile: profileRes.data ?? null,
      medical_leave_requests: leavesRes.data ?? [],
      leave_approval_workflow: workflowsRes.data ?? [],
      health_visits: visitsRes.data ?? [],
      prescriptions: prescriptionsRes.data ?? [],
      prescription_items: itemsRes.data ?? [],
      lab_reports: labsRes.data ?? [],
      appointments: apptsRes.data ?? [],
    };

    const rootId = await findOrCreateFolder(ROOT_FOLDER_NAME);
    const studentFolderId = await findOrCreateFolder(student.roll_number, rootId);
    const stamp = snapshot.backed_up_at.replace(/[:.]/g, "-");
    const historyName = `${student.roll_number}__${stamp}.json`;
    const latestName = `${student.roll_number}__latest.json`;

    await uploadJson(historyName, studentFolderId, snapshot);
    const latestId = await findFileByName(latestName, studentFolderId);
    await uploadJson(latestName, studentFolderId, snapshot, latestId);

    return ok({
      success: true,
      roll_number: student.roll_number,
      snapshot_file: historyName,
    });
  } catch (err) {
    console.error("backup-student-to-drive failed:", err);
    // Never block UX: report 200 with an error flag
    return ok({ success: false, error: (err as Error).message });
  }
});