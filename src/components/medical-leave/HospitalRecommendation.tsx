import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Building2, MapPin, Navigation, Phone, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { getUserLocation, rankHospitals, NITW_ORIGIN, type RankedHospital } from "@/lib/hospitals/hospitalCoordinates";
import { toast } from "sonner";

interface HospitalRecommendationProps {
  priority: "high" | "medium" | "low";
  selectedHospital?: string;
  onSelect: (hospitalName: string) => void;
}

export default function HospitalRecommendation({ priority, selectedHospital, onSelect }: HospitalRecommendationProps) {
  const [loading, setLoading] = useState(true);
  const [ranked, setRanked] = useState<RankedHospital[]>([]);
  const [source, setSource] = useState<"geo" | "campus">("campus");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const origin = await getUserLocation();
      if (!alive) return;
      const list = rankHospitals(origin, priority, { studentEntitlement: true });
      setRanked(list.slice(0, 3));
      setSource(origin.source);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [priority]);

  if (priority === "low") return null;

  const isHigh = priority === "high";

  return (
    <Card className={`p-4 mb-4 border-2 ${isHigh ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isHigh ? "bg-destructive/15" : "bg-primary/15"}`}>
          {isHigh ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Sparkles className="h-5 w-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`font-semibold ${isHigh ? "text-destructive" : "text-primary"}`}>
              {isHigh ? "High-Priority Recommendation" : "Recommended Nearby Hospitals"}
            </h4>
            <Badge variant="outline" className="text-[10px]">
              {source === "geo" ? "Your location" : `From ${NITW_ORIGIN.label}`}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isHigh
              ? "Closest empanelled super-specialty hospitals — ranked by real distance."
              : "Closest empanelled hospitals ranked by distance from your location."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Calculating closest hospitals…
        </div>
      ) : (
        <div className="space-y-2">
          {ranked.map((h, idx) => {
            const active = selectedHospital === h.name;
            return (
              <div
                key={h.name}
                className={`p-3 rounded-lg border transition-all ${active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium text-sm text-foreground truncate">{h.name}</span>
                        {h.superSpecialty && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Super-Specialty</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{h.location}</span>
                        <span className="font-semibold text-primary">{h.distanceKm.toFixed(1)} km away</span>
                        {h.phone && (
                          <a href={`tel:${h.phone}`} className="flex items-center gap-1 hover:underline">
                            <Phone className="h-3 w-3" />{h.phone}
                          </a>
                        )}
                      </div>
                      {h.specialties && h.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {h.specialties.slice(0, 3).map((s) => (
                            <Badge key={s} variant="outline" className="text-[9px] px-1 py-0">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => window.open(h.directionsUrl, "_blank", "noopener")}
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      Directions
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? "secondary" : "default"}
                      className="h-7 text-xs"
                      onClick={() => {
                        onSelect(h.name);
                        toast.success(`Selected ${h.name}`, { description: `${h.distanceKm.toFixed(1)} km from ${source === "geo" ? "your location" : "NITW"}` });
                      }}
                    >
                      {active ? <><CheckCircle2 className="h-3 w-3 mr-1" />Selected</> : "Use this"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}