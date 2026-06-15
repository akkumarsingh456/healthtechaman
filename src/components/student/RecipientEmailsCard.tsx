import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Users, GraduationCap, Building2, Save, Loader2, Stethoscope } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  studentId: string;
  /** existing mentor name pulled from students.mentor_name (read-only display fallback) */
  fallbackMentorName?: string | null;
  fallbackMentorEmail?: string | null;
  onSaved?: () => void;
}

export default function RecipientEmailsCard({ studentId, fallbackMentorName, fallbackMentorEmail, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mentorEmail, setMentorEmail] = useState("");
  const [hodName, setHodName] = useState("");
  const [hodEmail, setHodEmail] = useState("");
  const [deanName, setDeanName] = useState("");
  const [deanEmail, setDeanEmail] = useState("");
  const [cmoName, setCmoName] = useState("");
  const [cmoEmail, setCmoEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("student_profiles")
        .select("mentor_email, hod_name, hod_email, dean_name, dean_email, cmo_name, cmo_email")
        .eq("student_id", studentId)
        .maybeSingle();
      if (cancelled) return;
      setMentorEmail((data as any)?.mentor_email || fallbackMentorEmail || "");
      setHodName((data as any)?.hod_name || "");
      setHodEmail((data as any)?.hod_email || "");
      setDeanName((data as any)?.dean_name || "");
      setDeanEmail((data as any)?.dean_email || "");
      setCmoName((data as any)?.cmo_name || "");
      setCmoEmail((data as any)?.cmo_email || "");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [studentId, fallbackMentorEmail]);

  const validate = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSave = async () => {
    if (![mentorEmail, hodEmail, deanEmail, cmoEmail].every(validate)) {
      toast({ title: "Invalid email", description: "Please enter valid email addresses.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Ensure a row exists, then update
      const { data: existing } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("student_id", studentId)
        .maybeSingle();
      const payload = {
        student_id: studentId,
        mentor_email: mentorEmail || null,
        hod_name: hodName || null,
        hod_email: hodEmail || null,
        dean_name: deanName || null,
        dean_email: deanEmail || null,
        cmo_name: cmoName || null,
        cmo_email: cmoEmail || null,
        updated_at: new Date().toISOString(),
      };
      let error;
      if (existing) {
        ({ error } = await supabase.from("student_profiles").update(payload).eq("student_id", studentId));
      } else {
        ({ error } = await supabase.from("student_profiles").insert(payload));
      }
      if (error) throw error;
      toast({ title: "Recipients saved", description: "Your mentor / HOD / Dean contacts are stored." });
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message || "Could not save recipients", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Sharing Recipients
        </CardTitle>
        <CardDescription>
          Save your Mentor, HOD, and Dean emails once. They'll be reused when you share a health report.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1"><Users className="w-3 h-3" /> Mentor</Label>
                <p className="text-xs text-muted-foreground mt-1">{fallbackMentorName || "Faculty mentor"}</p>
                <Input className="mt-1" type="email" value={mentorEmail} onChange={e => setMentorEmail(e.target.value)} placeholder="mentor@nitw.ac.in" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Building2 className="w-3 h-3" /> Head of Department</Label>
                <Input className="mt-1" value={hodName} onChange={e => setHodName(e.target.value)} placeholder="HOD Name" />
                <Input className="mt-2" type="email" value={hodEmail} onChange={e => setHodEmail(e.target.value)} placeholder="hod.dept@nitw.ac.in" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Academic Dean</Label>
                <div className="grid md:grid-cols-2 gap-2 mt-1">
                  <Input value={deanName} onChange={e => setDeanName(e.target.value)} placeholder="Dean Name" />
                  <Input type="email" value={deanEmail} onChange={e => setDeanEmail(e.target.value)} placeholder="dean.academic@nitw.ac.in" />
                </div>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs flex items-center gap-1"><Stethoscope className="w-3 h-3" /> Chief Medical Officer</Label>
                <div className="grid md:grid-cols-2 gap-2 mt-1">
                  <Input value={cmoName} onChange={e => setCmoName(e.target.value)} placeholder="CMO Name" />
                  <Input type="email" value={cmoEmail} onChange={e => setCmoEmail(e.target.value)} placeholder="cmo@nitw.ac.in" />
                </div>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              Save Recipients
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}