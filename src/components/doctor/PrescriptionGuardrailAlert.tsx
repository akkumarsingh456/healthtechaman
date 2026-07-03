import { AlertTriangle, CheckCircle2, ShieldAlert, PackageX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GuardrailResult } from "@/hooks/usePrescriptionGuardrail";

interface Props {
  result: GuardrailResult;
  onUseAlternative: (name: string) => void;
}

export default function PrescriptionGuardrailAlert({ result, onUseAlternative }: Props) {
  if (result.status === "idle") return null;

  if (result.status === "checking") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking allergies & pharmacy stock…
      </div>
    );
  }

  if (result.status === "ok") {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5 mt-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>
          Safe — no allergy conflict. In stock ({result.matched?.quantity} {result.matched?.unit}).
        </span>
      </div>
    );
  }

  const isDanger = result.status === "danger";
  const Icon = result.allergyConflict ? ShieldAlert : isDanger ? PackageX : AlertTriangle;
  const palette = isDanger
    ? "bg-red-50 border-red-200 text-red-800"
    : "bg-amber-50 border-amber-200 text-amber-800";

  return (
    <div className={`rounded-md border px-2.5 py-2 mt-1 ${palette}`}>
      <div className="flex items-start gap-2 text-xs">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          {result.messages.map((m, i) => (
            <div key={i} className="font-medium">{m}</div>
          ))}
          {result.alternative && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] opacity-80">
                Suggested: <strong>{result.alternative.medicine_name}</strong> ({result.alternative.quantity} {result.alternative.unit} in stock)
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] bg-white"
                onClick={() => onUseAlternative(result.alternative!.medicine_name)}
              >
                Use alternative
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}