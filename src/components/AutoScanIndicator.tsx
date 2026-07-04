import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useAutoScanOnLoad } from "@/hooks/useAutoScanOnLoad";

export default function AutoScanIndicator() {
  const status = useAutoScanOnLoad();

  const config = {
    idle:     { color: "bg-muted text-muted-foreground",       icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Starting" },
    checking: { color: "bg-amber-100 text-amber-700 border-amber-200",  icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Auto-scan" },
    online:   { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <Wifi className="h-3 w-3" />, label: "Online" },
    offline:  { color: "bg-destructive/10 text-destructive border-destructive/30", icon: <WifiOff className="h-3 w-3" />, label: "Offline" },
    retrying: { color: "bg-amber-100 text-amber-700 border-amber-200",  icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Retrying" },
  }[status];

  return (
    <div
      className={`fixed bottom-3 right-3 z-40 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium shadow-sm backdrop-blur-sm ${config.color}`}
      title={`Auto-scan status: ${status}`}
      aria-live="polite"
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}