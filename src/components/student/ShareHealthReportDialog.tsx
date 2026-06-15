import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Upload, Trash2, FileText, ShieldCheck, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface Recipient { role: string; name?: string; email: string; checked: boolean }
interface UploadedFile { name: string; path: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  userId: string;
  leaveRequestId?: string | null;
  leaveLabel?: string | null;
  hasReferral?: boolean;
  hasLeaveCertificate?: boolean;
}

const MAX_FILE_MB = 10;

export default function ShareHealthReportDialog({
  open, onOpenChange, studentId, userId, leaveRequestId, leaveLabel, hasReferral, hasLeaveCertificate,
}: Props) {
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [extraEmail, setExtraEmail] = useState("");
  const [extraName, setExtraName] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [includeReferral, setIncludeReferral] = useState(!!hasReferral);
  const [includeLeaveCert, setIncludeLeaveCert] = useState(!!hasLeaveCertificate);
  const [composing, setComposing] = useState(false);
  const [gmailUrl, setGmailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: prof } = await supabase
        .from("student_profiles")
        .select("mentor_email, hod_name, hod_email, dean_name, dean_email, cmo_name, cmo_email")
        .eq("student_id", studentId)
        .maybeSingle();
      const { data: stu } = await supabase
        .from("students")
        .select("mentor_name, mentor_email")
        .eq("id", studentId)
        .maybeSingle();
      const list: Recipient[] = [];
      const mentorEmail = (prof as any)?.mentor_email || stu?.mentor_email;
      if (mentorEmail) list.push({ role: "Mentor", name: stu?.mentor_name || undefined, email: mentorEmail, checked: true });
      if ((prof as any)?.hod_email) list.push({ role: "HOD", name: (prof as any).hod_name, email: (prof as any).hod_email, checked: true });
      if ((prof as any)?.dean_email) list.push({ role: "Dean", name: (prof as any).dean_name, email: (prof as any).dean_email, checked: false });
      if ((prof as any)?.cmo_email) list.push({ role: "Chief Medical Officer", name: (prof as any).cmo_name, email: (prof as any).cmo_email, checked: true });
      setRecipients(list);
      setIncludeReferral(!!hasReferral);
      setIncludeLeaveCert(!!hasLeaveCertificate);
    })();
  }, [open, studentId, hasReferral, hasLeaveCertificate]);

  const toggleRecipient = (idx: number) =>
    setRecipients(prev => prev.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r)));

  const addExtra = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extraEmail)) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    setRecipients(prev => [...prev, { role: "Other", name: extraName || undefined, email: extraEmail, checked: true }]);
    setExtraEmail(""); setExtraName("");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Please upload a PDF.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast({ title: "Too large", description: `Max ${MAX_FILE_MB} MB.`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("student-health-uploads").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: "application/pdf",
      });
      if (error) throw error;
      setUploadedFiles(prev => [...prev, { name: file.name, path }]);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeUpload = async (path: string) => {
    await supabase.storage.from("student-health-uploads").remove([path]);
    setUploadedFiles(prev => prev.filter(f => f.path !== path));
  };

  const handleComposeGmail = async () => {
    const selected = recipients.filter(r => r.checked);
    if (selected.length === 0) {
      toast({ title: "No recipients", description: "Select at least one recipient.", variant: "destructive" });
      return;
    }
    // Open the window SYNCHRONOUSLY in the click handler so the browser
    // treats it as a user gesture and does not block the popup. We point
    // it at about:blank first, then redirect to Gmail once the AI draft
    // returns. NOTE: do NOT pass "noopener" — it forces window.open to
    // return null, which would break the redirect. We open Gmail on a
    // named tab, on the user's own gesture, so there is no security risk
    // (Gmail cannot reach back into this app via window.opener anyway).
    const gmailWindow = window.open("about:blank", "_blank");
    if (gmailWindow) {
      // Sever the opener link manually so the new tab cannot script back
      // into this app — this is the safe equivalent of `noopener`.
      try { gmailWindow.opener = null; } catch (_) { /* ignore */ }
      try {
        gmailWindow.document.write(
          '<!doctype html><title>Preparing Gmail…</title>' +
          '<div style="font-family:system-ui;padding:24px;color:#334">' +
          'Drafting your email with AI… this window will redirect to Gmail shortly.</div>'
        );
      } catch (_) { /* cross-origin write may fail, that\'s fine */ }
    }
    setComposing(true);
    try {
      const { data, error } = await supabase.functions.invoke("compose-gmail-share", {
        body: {
          recipients: selected.map(r => ({ role: r.role, name: r.name, email: r.email })),
          uploadedFiles,
          includeReferral,
          includeLeaveCertificate: includeLeaveCert,
          leaveRequestId: leaveRequestId || null,
          appOrigin: window.location.origin,
          message: message || undefined,
        },
      });
      if (error) throw error;
      const to = (data?.to || []).join(",");
      const subject = encodeURIComponent(data?.subject || "Health Report");
      const body = encodeURIComponent(data?.body || "");
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${subject}&body=${body}`;
      setGmailUrl(url);
      if (gmailWindow && !gmailWindow.closed) {
        gmailWindow.location.href = url;
        toast({
          title: "Gmail compose opened",
          description: "AI-drafted email is prefilled. Attach the referral/leave PDFs from the links in the body.",
        });
      } else {
        // Popup blocked. Give the user a button to open Gmail from a
        // fresh user gesture (this always works), and keep the Compose
        // button in the dialog footer as a second chance.
        toast({
          title: "Click to open Gmail",
          description: "Your browser blocked the auto-popup. Tap the button to open Gmail in a new tab.",
          action: (
            <ToastAction
              altText="Open Gmail"
              onClick={() => window.open(url, "_blank")}
            >
              Open Gmail
            </ToastAction>
          ),
        });
      }
    } catch (e: any) {
      if (gmailWindow && !gmailWindow.closed) gmailWindow.close();
      toast({ title: "Compose failed", description: e.message, variant: "destructive" });
    } finally {
      setComposing(false);
    }
  };

  const handleSend = async () => {
    const selected = recipients.filter(r => r.checked);
    if (selected.length === 0) {
      toast({ title: "No recipients", description: "Please select at least one recipient.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("share-health-report", {
        body: {
          recipients: selected.map(r => ({ role: r.role, name: r.name, email: r.email })),
          uploadedFiles,
          includeReferral,
          includeLeaveCertificate: includeLeaveCert,
          leaveRequestId: leaveRequestId || null,
          message: message || undefined,
        },
      });
      if (error) throw error;
      const sent = (data?.results || []).filter((r: any) => r.status === "sent").length;
      const failed = (data?.results || []).filter((r: any) => r.status !== "sent").length;
      toast({
        title: "Share complete",
        description: `${sent} sent${failed ? `, ${failed} failed/skipped` : ""}.`,
      });
      onOpenChange(false);
      setUploadedFiles([]); setMessage("");
    } catch (e: any) {
      toast({ title: "Share failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Share Health Report</DialogTitle>
          <DialogDescription>
            {leaveLabel ? `Linked to: ${leaveLabel}` : "Send health documents to your saved recipients via email."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipients */}
          <div>
            <Label className="text-sm font-medium">Recipients</Label>
            <div className="mt-2 space-y-2">
              {recipients.length === 0 && (
                <p className="text-xs text-muted-foreground">No saved recipients yet — add Mentor / HOD / Dean emails in your profile first, or use the field below.</p>
              )}
              {recipients.map((r, i) => (
                <label key={i} className="flex items-center gap-3 p-2 rounded border hover:bg-muted/30 cursor-pointer">
                  <Checkbox checked={r.checked} onCheckedChange={() => toggleRecipient(i)} />
                  <Badge variant="outline" className="text-xs">{r.role}</Badge>
                  <div className="flex-1 min-w-0">
                    {r.name && <p className="text-sm font-medium truncate">{r.name}</p>}
                    <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input placeholder="Name (optional)" value={extraName} onChange={e => setExtraName(e.target.value)} />
              <Input type="email" placeholder="email@nitw.ac.in" value={extraEmail} onChange={e => setExtraEmail(e.target.value)} />
              <Button type="button" variant="outline" size="sm" onClick={addExtra}>Add</Button>
            </div>
          </div>

          {/* System docs */}
          {(hasReferral || hasLeaveCertificate) && (
            <div className="border rounded p-3 bg-muted/20">
              <Label className="text-sm font-medium">System documents</Label>
              <div className="mt-2 space-y-2">
                {hasReferral && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={includeReferral} onCheckedChange={v => setIncludeReferral(!!v)} />
                    <FileText className="w-3 h-3" /> Reference doctor's referral letter
                  </label>
                )}
                {hasLeaveCertificate && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={includeLeaveCert} onCheckedChange={v => setIncludeLeaveCert(!!v)} />
                    <ShieldCheck className="w-3 h-3" /> Reference medical leave certificate
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Uploads */}
          <div>
            <Label className="text-sm font-medium">Attach PDFs (optional, max {MAX_FILE_MB} MB each)</Label>
            <div className="mt-2 space-y-2">
              {uploadedFiles.map(f => (
                <div key={f.path} className="flex items-center gap-2 p-2 rounded border text-sm">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeUpload(f.path)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <label className="flex items-center gap-2 p-3 rounded border border-dashed cursor-pointer hover:bg-muted/30 text-sm">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{uploading ? "Uploading…" : "Add a PDF report"}</span>
                <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          </div>

          {/* Message */}
          <div>
            <Label className="text-sm">Message (optional)</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} placeholder="Short note for the recipients…" rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button variant="outline" onClick={handleComposeGmail} disabled={composing || sending}>
            {composing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Compose in Gmail (AI)
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}