import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, Stethoscope, Calendar, Eye, FileText, Pill, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { PrescriptionWithDetails } from "./types";

interface PrescriptionCardProps {
  p: PrescriptionWithDetails;
  showActions: boolean;
  onDispense: (p: PrescriptionWithDetails, action: "approved" | "denied") => void;
}

export function PrescriptionCard({ p, showActions, onDispense }: PrescriptionCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 space-y-2 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{p.student?.full_name || "Unknown"}</span>
              <Badge variant="outline">{p.student?.roll_number}</Badge>
              {p.student?.branch && <Badge variant="secondary" className="text-xs">{p.student.branch}</Badge>}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <Stethoscope className="w-3 h-3" />
              <span>{p.doctor?.name || "Unknown"}</span>
              <span>•</span>
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(p.created_at), "dd MMM yyyy, hh:mm a")}</span>
            </div>
            {p.diagnosis && (
              <p className="text-sm"><strong>Diagnosis:</strong> {p.diagnosis}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-1">
              {p.items?.map((item) => (
                <Badge key={item.id} variant="outline" className="text-xs">
                  {item.medicine_name} - {item.dosage}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Prescription Details
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Patient</p>
                      <p className="font-medium">{p.student?.full_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Roll Number</p>
                      <p className="font-medium">{p.student?.roll_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Doctor</p>
                      <p className="font-medium">{p.doctor?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="font-medium">{format(new Date(p.created_at), "dd MMM yyyy, hh:mm a")}</p>
                    </div>
                  </div>
                  {p.diagnosis && (
                    <div>
                      <p className="text-xs text-muted-foreground">Diagnosis</p>
                      <p className="font-medium">{p.diagnosis}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Medicines</p>
                    <div className="space-y-2">
                      {p.items?.map((item) => (
                        <div key={item.id} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Pill className="w-4 h-4 text-primary" />
                            <span className="font-medium">{item.medicine_name}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-1 text-sm text-muted-foreground">
                            <span>Dosage: {item.dosage}</span>
                            <span>Frequency: {item.frequency}</span>
                            <span>Duration: {item.duration}</span>
                          </div>
                          {item.instructions && (
                            <p className="text-xs text-muted-foreground mt-1">Instructions: {item.instructions}</p>
                          )}
                          {item.meal_timing && (
                            <p className="text-xs text-muted-foreground">Timing: {item.meal_timing === "before_meal" ? "Before Meal" : "After Meal"}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {p.notes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Doctor's Notes</p>
                      <p className="text-sm">{p.notes}</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            {showActions && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onDispense(p, "approved")}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onDispense(p, "denied")}>
                  <XCircle className="w-4 h-4 mr-1" /> Deny
                </Button>
              </>
            )}
            {!showActions && (
              <Badge variant={p.dispensing_status === "approved" ? "default" : "destructive"}>
                {p.dispensing_status === "approved" ? "Dispensed" : "Denied"}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
