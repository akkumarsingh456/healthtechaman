import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Star, Mail, Trash2, Eye, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Submission {
  id: string;
  submission_type: string;
  sender_role: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  college_name: string | null;
  branch: string | null;
  year: string | null;
  rating: number | null;
  ai_validation_status: string | null;
  is_read: boolean;
  created_at: string;
}

export default function ContactSubmissionsTab() {
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [expandedGroup, setExpandedGroup] = useState(false);

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["admin-contact-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_submissions" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Submission[];
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("contact_submissions" as any).update({ is_read: true } as any).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-contact-submissions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("contact_submissions" as any).delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-submissions"] });
      toast.success("Submission deleted");
    },
  });

  const contacts = submissions?.filter(s => s.submission_type === "contact") || [];
  const reviews = submissions?.filter(s => s.submission_type === "review" || s.submission_type === "suggestion") || [];
  const studentReviews = reviews.filter(r => r.sender_role === "student");
  const alumniReviews = reviews.filter(r => r.sender_role === "alumni");
  const professorReviews = reviews.filter(r => r.sender_role === "professor");
  const otherReviews = reviews.filter(r => !["student", "alumni", "professor"].includes(r.sender_role));
  const unreadCount = submissions?.filter(s => !s.is_read).length || 0;

  const handleView = (sub: Submission) => {
    setSelectedSubmission(sub);
    if (!sub.is_read) markReadMutation.mutate(sub.id);
  };

  const exportToPdf = () => {
    const printWindow = window.open("", "", "width=900,height=700");
    if (!printWindow) return;

    const escHtml = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const rows = (reviews || []).map(r => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd">${escHtml(r.name)}</td>
        <td style="padding:8px;border:1px solid #ddd">${escHtml(r.email)}</td>
        <td style="padding:8px;border:1px solid #ddd">${escHtml(r.sender_role)}</td>
        <td style="padding:8px;border:1px solid #ddd">${escHtml(r.college_name || "-")}</td>
        <td style="padding:8px;border:1px solid #ddd">${escHtml(r.branch || r.subject || "-")}</td>
        <td style="padding:8px;border:1px solid #ddd">${escHtml(r.year || "-")}</td>
        <td style="padding:8px;border:1px solid #ddd">${"★".repeat(Math.max(0, Math.min(5, r.rating || 0)))}</td>
        <td style="padding:8px;border:1px solid #ddd">${escHtml(r.message)}</td>
        <td style="padding:8px;border:1px solid #ddd">${escHtml(format(new Date(r.created_at), "PPp"))}</td>
      </tr>
    `).join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Reviews & Feedback Report</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;max-width:1100px;margin:0 auto}
        h1{color:#1e3a5f;margin-bottom:6px}
        p.sub{color:#666;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{background:#f0f4f8;padding:8px;border:1px solid #ddd;text-align:left;font-size:10px}
        .watermark-top{text-align:center;font-size:8pt;color:#999;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:16px}
        @media print{@page{margin:10mm;size:landscape}}
      </style></head><body>
      <div class="watermark-top">⚠️ This is a student project document. No official validity.</div>
      <h1>Reviews & Feedback Report</h1>
      <p class="sub">Generated on ${format(new Date(), "PPPp")} — Total: ${reviews.length} submissions</p>
      <table><thead><tr>
        <th>Name</th><th>Email</th><th>Role</th><th>College</th><th>Branch/Subject</th><th>Year</th><th>Rating</th><th>Message</th><th>Date</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Contact & Reviews
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount} new</Badge>}
          </h2>
          <p className="text-sm text-muted-foreground">All contact form submissions and user reviews</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportToPdf}>
          <Download className="w-4 h-4" /> Export Reviews PDF
        </Button>
      </div>

      <Tabs defaultValue="reviews" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="reviews">All Reviews ({reviews.length})</TabsTrigger>
          <TabsTrigger value="students">Students ({studentReviews.length})</TabsTrigger>
          <TabsTrigger value="alumni">Alumni ({alumniReviews.length})</TabsTrigger>
          <TabsTrigger value="professors">Professors ({professorReviews.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contact Messages ({contacts.length})</TabsTrigger>
        </TabsList>

        {[
          { value: "reviews", list: reviews, empty: "No reviews yet." },
          { value: "students", list: studentReviews, empty: "No student reviews yet." },
          { value: "alumni", list: alumniReviews, empty: "No alumni reviews yet." },
          { value: "professors", list: professorReviews, empty: "No professor reviews yet." },
        ].map(group => (
          <TabsContent key={group.value} value={group.value}>
            {group.list.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">{group.empty}</CardContent></Card>
            ) : (
              <div className="grid gap-4">
                {group.list.map(r => (
                  <Card key={r.id} className={`transition-shadow hover:shadow-md ${!r.is_read ? "border-primary/30 bg-primary/5" : ""}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground">{r.name}</span>
                            <Badge variant="outline" className="text-xs capitalize">{r.sender_role}</Badge>
                            {!r.is_read && <Badge className="text-xs">New</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{r.email} • {r.college_name || "N/A"} • {r.branch || r.subject || "N/A"} • {r.year || ""}</p>
                          <div className="flex gap-0.5 mt-1">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-3.5 h-3.5 ${s <= (r.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                            ))}
                          </div>
                          <p className="text-sm mt-2 line-clamp-2">{r.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{format(new Date(r.created_at), "PPp")}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => handleView(r)}><Eye className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}

        <TabsContent value="contacts">
          {contacts.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No contact messages yet.</CardContent></Card>
          ) : (
            (() => {
              const GROUPED_EMAIL = "akprojectconnect2025@gmail.com";
              const grouped = contacts.filter(c => c.email?.toLowerCase() === GROUPED_EMAIL);
              const others = contacts.filter(c => c.email?.toLowerCase() !== GROUPED_EMAIL);
              const groupUnread = grouped.filter(g => !g.is_read).length;
              return (
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.length > 0 && (
                  <>
                    <TableRow className={`cursor-pointer ${groupUnread > 0 ? "bg-primary/5" : ""}`} onClick={() => setExpandedGroup(v => !v)}>
                      <TableCell className="font-medium">
                        Test submissions (Aman) <Badge variant="secondary" className="ml-1 text-xs">{grouped.length}</Badge>
                        {groupUnread > 0 && <Badge className="ml-1 text-xs">{groupUnread} new</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">{GROUPED_EMAIL}</TableCell>
                      <TableCell className="text-sm text-muted-foreground italic">Grouped — click to {expandedGroup ? "collapse" : "view all"}</TableCell>
                      <TableCell className="text-sm">{format(new Date(grouped[0].created_at), "PPp")}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setExpandedGroup(v => !v); }}>
                          {expandedGroup ? "Hide" : "View all"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedGroup && grouped.map(c => (
                      <TableRow key={c.id} className={`bg-muted/30 ${!c.is_read ? "bg-primary/5" : ""}`}>
                        <TableCell className="font-medium pl-8">↳ {c.name} {!c.is_read && <Badge className="ml-1 text-xs">New</Badge>}</TableCell>
                        <TableCell className="text-sm">{c.email}</TableCell>
                        <TableCell className="text-sm">{c.subject}</TableCell>
                        <TableCell className="text-sm">{format(new Date(c.created_at), "PPp")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleView(c)}><Eye className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                {others.map(c => (
                  <TableRow key={c.id} className={!c.is_read ? "bg-primary/5" : ""}>
                    <TableCell className="font-medium">{c.name} {!c.is_read && <Badge className="ml-1 text-xs">New</Badge>}</TableCell>
                    <TableCell className="text-sm">{c.email}</TableCell>
                    <TableCell className="text-sm">{c.subject}</TableCell>
                    <TableCell className="text-sm">{format(new Date(c.created_at), "PPp")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleView(c)}><Eye className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
              );
            })()
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedSubmission?.submission_type === "contact" ? "Contact Message" : "Review"}</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="font-medium text-muted-foreground">Name:</span> {selectedSubmission.name}</div>
                <div><span className="font-medium text-muted-foreground">Email:</span> {selectedSubmission.email}</div>
                {selectedSubmission.college_name && <div><span className="font-medium text-muted-foreground">College:</span> {selectedSubmission.college_name}</div>}
                {selectedSubmission.branch && <div><span className="font-medium text-muted-foreground">Branch:</span> {selectedSubmission.branch}</div>}
                {selectedSubmission.year && <div><span className="font-medium text-muted-foreground">Year:</span> {selectedSubmission.year}</div>}
                {selectedSubmission.subject && <div className="col-span-2"><span className="font-medium text-muted-foreground">Subject:</span> {selectedSubmission.subject}</div>}
                <div><span className="font-medium text-muted-foreground">Role:</span> <Badge variant="outline">{selectedSubmission.sender_role}</Badge></div>
                <div><span className="font-medium text-muted-foreground">Date:</span> {format(new Date(selectedSubmission.created_at), "PPPp")}</div>
              </div>
              {selectedSubmission.rating && (
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-muted-foreground mr-2">Rating:</span>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`w-5 h-5 ${s <= selectedSubmission.rating! ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                  ))}
                </div>
              )}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{selectedSubmission.message}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
