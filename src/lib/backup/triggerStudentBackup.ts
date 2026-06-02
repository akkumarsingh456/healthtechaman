import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget Google Drive backup of a student's full record.
 * Never throws; never blocks the UI. Safe to call after any save.
 */
export function triggerStudentBackup(studentId: string | null | undefined) {
  if (!studentId) return;
  try {
    supabase.functions
      .invoke("backup-student-to-drive", { body: { student_id: studentId } })
      .then(({ error }) => {
        if (error) console.warn("[drive-backup] skipped:", error.message);
      })
      .catch((err) => console.warn("[drive-backup] skipped:", err?.message || err));
  } catch (err) {
    console.warn("[drive-backup] invoke failed:", err);
  }
}