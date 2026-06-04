import { useStudentDataSync } from "@/hooks/useStudentDataSync";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, RefreshCw, Sparkles, Loader2 } from "lucide-react";

interface Props {
  rollNumberHint?: string;
  compact?: boolean;
  onSynced?: () => void;
}

/**
 * Self-healing banner: silently runs the student-data-sync edge function on
 * mount, reports any auto-repairs, and exposes a manual re-check button.
 */
export default function StudentDataSyncBanner({ rollNumberHint, compact, onSynced }: Props) {
  const { result, loading, run } = useStudentDataSync({ rollNumberHint });

  const hasIssues = !!result && (!result.ok || (result.issues && result.issues.length > 0));
  const repaired = !!result?.synced;

  if (loading && !result) {
    return (
      <Alert className="border-primary/30 bg-primary/5">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <AlertTitle className="text-sm">Auto-sync running</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          Verifying that all your records are reachable…
        </AlertDescription>
      </Alert>
    );
  }

  if (!result) return null;

  // Healthy: only show in non-compact mode
  if (result.ok && !hasIssues && !repaired) {
    if (compact) return null;
    return (
      <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          All records in sync
          <Sparkles className="h-3 w-3" />
        </AlertTitle>
        <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-300">
          {result.counts &&
            `${result.counts.medical_leaves} leave · ${result.counts.health_visits} visits · ${result.counts.prescriptions} prescriptions · ${result.counts.lab_reports} lab reports · ${result.counts.appointments} appointments`}
          <Button size="sm" variant="ghost" className="ml-2 h-6 px-2 text-xs" onClick={run} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />Re-check
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className={hasIssues && !repaired ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"}>
      {repaired ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      )}
      <AlertTitle className="text-sm">
        {repaired ? "Auto-sync repaired your data" : "Data check completed"}
      </AlertTitle>
      <AlertDescription className="text-xs space-y-1">
        {result.repairs?.map((r, i) => (
          <div key={`r-${i}`} className="text-emerald-700 dark:text-emerald-300">✓ {r}</div>
        ))}
        {result.issues?.map((iss, i) => (
          <div key={`i-${i}`} className="text-amber-800 dark:text-amber-200">• {iss}</div>
        ))}
        {result.error && <div className="text-destructive">• {result.error}</div>}
        <div className="pt-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { run(); onSynced?.(); }} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />Run again
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}