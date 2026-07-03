import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Pill,
  Plus,
  Trash2,
  Clock,
  CalendarDays,
  Utensils,
  Stethoscope,
  FileText,
  CheckCircle2,
  Printer,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { printDocument, getNitwHeaderHtml } from "@/lib/print/printDocument";
import { MedicineCombobox } from "./MedicineCombobox";
import PrescriptionGuardrailAlert from "./PrescriptionGuardrailAlert";
import { usePrescriptionGuardrail } from "@/hooks/usePrescriptionGuardrail";

interface MedicineItem {
  id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  meal_timing: string;
}

interface PrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  studentName: string;
  onCompleted: () => void;
}

const FREQUENCY_OPTIONS = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "Every 4 hours",
  "Every 6 hours",
  "Every 8 hours",
  "As needed (SOS)",
  "Once a week",
];

const DURATION_OPTIONS = [
  "1 day",
  "2 days",
  "3 days",
  "4 days",
  "5 days",
  "6 days",
  "7 days",
  "8 days",
  "9 days",
  "10 days",
  "14 days",
  "21 days",
  "30 days",
  "Until follow-up",
  "Custom",
];

const MEAL_TIMING_OPTIONS = [
  { value: "before_meal", label: "Before Meal" },
  { value: "after_meal", label: "After Meal" },
  { value: "with_meal", label: "With Meal" },
  { value: "empty_stomach", label: "Empty Stomach" },
  { value: "any_time", label: "Any Time" },
  { value: "bedtime", label: "At Bedtime" },
];

const createEmptyMedicine = (): MedicineItem => ({
  id: crypto.randomUUID(),
  medicine_name: "",
  dosage: "",
  frequency: "Twice daily",
  duration: "5 days",
  instructions: "",
  meal_timing: "after_meal",
});

function MedicineRowGuardrail({
  medicineName,
  patientId,
  onUseAlternative,
}: {
  medicineName: string;
  patientId: string;
  onUseAlternative: (name: string) => void;
}) {
  const result = usePrescriptionGuardrail(medicineName, patientId);
  return <PrescriptionGuardrailAlert result={result} onUseAlternative={onUseAlternative} />;
}

export default function PrescriptionDialog({
  open,
  onOpenChange,
  appointmentId,
  patientId,
  doctorId,
  studentName,
  onCompleted,
}: PrescriptionDialogProps) {
  const queryClient = useQueryClient();
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medicines, setMedicines] = useState<MedicineItem[]>([createEmptyMedicine()]);
  const [labTests, setLabTests] = useState<{ id: string; test_name: string; notes: string }[]>([]);

  const addLabTest = () => {
    setLabTests(prev => [...prev, { id: crypto.randomUUID(), test_name: "", notes: "" }]);
  };

  const removeLabTest = (id: string) => {
    setLabTests(prev => prev.filter(t => t.id !== id));
  };

  const updateLabTest = (id: string, field: "test_name" | "notes", value: string) => {
    setLabTests(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addMedicine = () => {
    setMedicines((prev) => [...prev, createEmptyMedicine()]);
  };

  const removeMedicine = (id: string) => {
    if (medicines.length <= 1) return;
    setMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMedicine = (id: string, field: keyof MedicineItem, value: string) => {
    setMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const completeMutation = useMutation({
    mutationFn: async () => {
      // Validate at least one medicine has name and dosage
      const validMedicines = medicines.filter(
        (m) => m.medicine_name.trim() && m.dosage.trim()
      );

      // Resolve actual students.id from patient_id (which may be user_id)
      let resolvedStudentId = patientId;
      const { data: studentRow } = await supabase
        .from("students")
        .select("id, user_id, roll_number")
        .or(`id.eq.${patientId},user_id.eq.${patientId}`)
        .maybeSingle();

      if (studentRow) {
        resolvedStudentId = studentRow.id;
      }

      // Create prescription record
      const { data: prescription, error: prescError } = await supabase
        .from("prescriptions")
        .insert({
          appointment_id: appointmentId,
          doctor_id: doctorId,
          student_id: resolvedStudentId,
          diagnosis: diagnosis.trim() || null,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (prescError) throw prescError;

      // Insert medicine items if any
      if (validMedicines.length > 0) {
        const items = validMedicines.map((m) => ({
          prescription_id: prescription.id,
          medicine_name: m.medicine_name.trim(),
          dosage: m.dosage.trim(),
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions.trim() || null,
          meal_timing: m.meal_timing,
        }));

        const { error: itemsError } = await supabase
          .from("prescription_items")
          .insert(items);

        if (itemsError) throw itemsError;
      }

      // Insert lab test orders if any
      const validLabTests = labTests.filter(t => t.test_name.trim());
      if (validLabTests.length > 0) {
        const labItems = validLabTests.map(t => ({
          prescription_id: prescription.id,
          student_id: resolvedStudentId,
          doctor_id: doctorId,
          test_name: t.test_name.trim(),
          notes: t.notes.trim() || null,
          uploaded_by: doctorId,
          status: "pending",
        }));

        const { error: labError } = await supabase
          .from("lab_reports")
          .insert(labItems);

        if (labError) throw labError;
      }

      // Mark appointment as completed
      const { error: aptError } = await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", appointmentId);

      if (aptError) throw aptError;

      // Send prescription notification to student
      if (studentRow?.user_id) {
        const medicineList = validMedicines.length > 0
          ? validMedicines.map(m => m.medicine_name).join(", ")
          : "No medicines";
        const labTestList = validLabTests.length > 0
          ? ` Lab Tests: ${validLabTests.map(t => t.test_name).join(", ")}.`
          : "";
        const diagnosisText = diagnosis.trim() ? `Diagnosis: ${diagnosis.trim()}. ` : "";

        await supabase.from("notifications").insert({
          user_id: studentRow.user_id,
          title: validLabTests.length > 0 ? "🔬 Prescription & Lab Tests Issued" : "💊 New Prescription Issued",
          message: `${diagnosisText}Medicines: ${medicineList}.${labTestList} Click to view your prescription details.`,
          type: "prescription",
          related_appointment_id: appointmentId,
        });
      }
    },
    onSuccess: () => {
      toast.success("Prescription saved & appointment completed!");
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-appointment-stats"] });
      onCompleted();
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to save prescription");
    },
  });

  const resetForm = () => {
    setDiagnosis("");
    setNotes("");
    setMedicines([createEmptyMedicine()]);
    setLabTests([]);
  };

  const handlePrintPreview = async () => {
    const validMedicines = medicines.filter((m) => m.medicine_name.trim() && m.dosage.trim());
    const prescriptionId = crypto.randomUUID();
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

    const mealLabel = (val: string) =>
      ({ before_meal: "Before Meal", after_meal: "After Meal", with_meal: "With Meal", empty_stomach: "Empty Stomach", any_time: "Any Time", bedtime: "At Bedtime" }[val] ?? val);

    const medicinesRows = validMedicines.length > 0
      ? validMedicines.map((m, i) => `
          <tr>
            <td style="text-align:center">${i + 1}</td>
            <td><strong>${m.medicine_name}</strong></td>
            <td>${m.dosage}</td>
            <td>${m.frequency}</td>
            <td>${m.duration}</td>
            <td>${mealLabel(m.meal_timing)}</td>
            <td>${m.instructions || "—"}</td>
          </tr>`).join("")
      : `<tr><td colspan="7" style="text-align:center;color:#888;">No medicines prescribed</td></tr>`;

    const bodyHtml = `
      ${getNitwHeaderHtml("OUTPATIENT PRESCRIPTION")}

      <div class="doc-title">
        <h3>MEDICAL PRESCRIPTION</h3>
        <div class="cert-no">Prescription No.: RX-${prescriptionId.slice(0, 8).toUpperCase()} &nbsp;|&nbsp; Date: ${today}</div>
      </div>

      <div class="ref-date">
        <span><strong>Patient:</strong> ${studentName}</span>
        <span><strong>Type:</strong> OPD Visit</span>
      </div>

      ${diagnosis ? `
      <div class="section">
        <div class="section-title">Diagnosis / Clinical Notes</div>
        <div class="info-box" style="background:#f0f7ff;border-color:#cce0ff;">
          ${diagnosis}
        </div>
      </div>` : ""}

      <div class="section">
        <div class="section-title">Prescribed Medicines (Rx)</div>
        <table>
          <thead>
            <tr>
              <th style="width:30px">#</th>
              <th>Medicine</th>
              <th>Dosage</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th>Meal Timing</th>
              <th>Special Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${medicinesRows}
          </tbody>
        </table>
      </div>

      ${notes ? `
      <div class="notes-box">
        <strong>Doctor's Notes:</strong> ${notes}
      </div>` : ""}

      <div class="section" style="margin-top:16px;">
        <div class="section-title">Important Instructions</div>
        <ul style="font-size:11px;color:#444;padding-left:18px;line-height:1.8">
          <li>Complete the full course of medication even if you feel better.</li>
          <li>Do not share medicines with others or self-medicate.</li>
          <li>Report any adverse reactions to the Health Centre immediately.</li>
          <li>Return for follow-up if symptoms persist beyond the prescription duration.</li>
        </ul>
      </div>

      <div class="signature-section">
        <div class="emblem-area">
          <img src="/nitw-emblem.png" alt="NITW Emblem" />
          <div class="emblem-label">NIT Warangal</div>
        </div>
        <div class="signature-box">
          <div class="online-signature">Medical Officer</div>
          <div class="signature-line">
            <strong>Medical Officer</strong>
            <div class="doctor-type">NIT Warangal Health Centre</div>
            <div class="doctor-type">Reg. No.: As per records</div>
          </div>
        </div>
      </div>

      <div class="doc-footer">
        <p>This prescription is valid for 30 days from the date of issue.</p>
        <p>NIT Warangal Health Centre | Phone: 0870-2462022 | healthcentre@nitw.ac.in</p>
      </div>
    `;

    await printDocument({
      title: `Prescription — ${studentName}`,
      bodyHtml,
      documentId: prescriptionId,
      documentType: "PRESCRIPTION",
    });
  };

  const handleSubmit = () => {
    const hasAnyMedicine = medicines.some((m) => m.medicine_name.trim());
    if (!hasAnyMedicine && !diagnosis.trim()) {
      toast.error("Please add at least a diagnosis or one medicine");
      return;
    }
    completeMutation.mutate();
  };

  const handleSkipPrescription = async () => {
    // Complete without prescription
    const { error } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", appointmentId);

    if (error) {
      toast.error("Failed to complete appointment");
      return;
    }

    toast.success("Appointment marked as completed");
    queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
    queryClient.invalidateQueries({ queryKey: ["doctor-appointment-stats"] });
    onCompleted();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="h-5 w-5 text-primary" />
            Prescribe Medicine — {studentName}
          </DialogTitle>
          <DialogDescription>
            Add diagnosis and prescribed medicines before completing this appointment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Diagnosis */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-medium">
              <FileText className="h-4 w-4 text-primary" />
              Diagnosis
            </Label>
            <Textarea
              placeholder="E.g., Viral fever with throat infection..."
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={2}
            />
          </div>

          <Separator />

          {/* Medicines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Pill className="h-4 w-4 text-primary" />
                Prescribed Medicines
              </Label>
              <Badge variant="secondary" className="text-xs">
                {medicines.length} medicine{medicines.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {medicines.map((med, index) => (
              <div
                key={med.id}
                className="rounded-lg border bg-muted/30 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Medicine #{index + 1}
                  </span>
                  {medicines.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeMedicine(med.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Medicine Name *</Label>
                    <MedicineCombobox
                      value={med.medicine_name}
                      onChange={(val) =>
                        updateMedicine(med.id, "medicine_name", val)
                      }
                      placeholder="e.g., Paracetamol 500mg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dosage *</Label>
                    <Input
                      placeholder="e.g., 1 tablet"
                      value={med.dosage}
                      onChange={(e) =>
                        updateMedicine(med.id, "dosage", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Frequency
                    </Label>
                    <Select
                      value={med.frequency}
                      onValueChange={(val) =>
                        updateMedicine(med.id, "frequency", val)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Duration
                    </Label>
                    <Select
                      value={DURATION_OPTIONS.includes(med.duration) ? med.duration : "Custom"}
                      onValueChange={(val) => {
                        if (val === "Custom") {
                          updateMedicine(med.id, "duration", "");
                        } else {
                          updateMedicine(med.id, "duration", val);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!DURATION_OPTIONS.includes(med.duration) && (
                      <Input
                        placeholder="e.g., 15 days"
                        value={med.duration}
                        onChange={(e) => updateMedicine(med.id, "duration", e.target.value)}
                        className="mt-1.5 h-9"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Utensils className="h-3 w-3" /> Meal Timing
                    </Label>
                    <Select
                      value={med.meal_timing}
                      onValueChange={(val) =>
                        updateMedicine(med.id, "meal_timing", val)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TIMING_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Special Instructions
                  </Label>
                  <Input
                    placeholder="e.g., Take with warm water, avoid dairy..."
                    value={med.instructions}
                    onChange={(e) =>
                      updateMedicine(med.id, "instructions", e.target.value)
                    }
                  />
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={addMedicine}
              className="w-full gap-1.5 border-dashed"
            >
              <Plus className="h-4 w-4" />
              Add Another Medicine
            </Button>
          </div>

          <Separator />

          {/* Lab Tests Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <FlaskConical className="h-4 w-4 text-blue-600" />
                Prescribe Lab Tests
              </Label>
              <Badge variant="secondary" className="text-xs">
                {labTests.length} test{labTests.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {labTests.map((test, index) => (
              <div key={test.id} className="rounded-lg border bg-blue-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Test #{index + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeLabTest(test.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Test Name *</Label>
                    <Input placeholder="e.g., CBC, Blood Sugar, X-Ray Chest" value={test.test_name} onChange={(e) => updateLabTest(test.id, "test_name", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Instructions / Notes</Label>
                    <Input placeholder="e.g., Fasting required, left knee..." value={test.notes} onChange={(e) => updateLabTest(test.id, "notes", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addLabTest} className="w-full gap-1.5 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50">
              <Plus className="h-4 w-4" />
              Add Lab Test
            </Button>
          </div>

          <Separator />

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Additional Doctor Notes (optional)
            </Label>
            <Textarea
              placeholder="Any additional advice or follow-up instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 items-center justify-between w-full">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleSkipPrescription}
              className="text-muted-foreground"
            >
              Skip & Complete
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintPreview}
              className="gap-1.5"
              type="button"
            >
              <Printer className="h-4 w-4" />
              Print Preview
            </Button>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={completeMutation.isPending}
            className="gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            {completeMutation.isPending
              ? "Saving..."
              : "Save Prescription & Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
