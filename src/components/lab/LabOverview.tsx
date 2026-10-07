import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TestTubes, Clock, CheckCircle2, AlertTriangle, TrendingUp,
  Plus, User, Stethoscope, ArrowRight,
  FlaskConical, FileText, Bell, Activity, Microscope,
  ClipboardCheck, BarChart3, RefreshCw, Eye, ShieldCheck
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LabReport {
  id: string;
  test_name: string;
  notes: string | null;
  status: string;
  report_file_url: string | null;
  report_file_name: string | null;
  created_at: string;
  updated_at: string;
  student_id: string;
  doctor_id: string | null;
  prescription_id: string | null;
  student?: { full_name: string; roll_number: string; branch: string | null; program: string };
  doctor?: { name: string; designation: string };
}

interface LabOverviewProps {
  totalToday: number;
  pending: number;
  completed: number;
  critical: number;
  recentUpdates: Array<{ time: string; text: string; type: "success" | "info" | "warning" }>;
  allReports: LabReport[];
  pendingReports: LabReport[];
  onNavigate: (section: string) => void;
  onRefresh: () => void;
}

export default function LabOverview({
  totalToday, pending, completed, critical, recentUpdates,
  allReports, pendingReports, onNavigate, onRefresh
}: LabOverviewProps) {
  const { toast } = useToast();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Test type distribution
  const testCounts = new Map<string, number>();
  allReports.forEach(r => testCounts.set(r.test_name, (testCounts.get(r.test_name) || 0) + 1));
  const testDistribution = Array.from(testCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const uniqueStudents = new Set(allReports.map(r => r.student_id)).size;

  // Latest pending first
  const urgentPending = pendingReports
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const priorityColor = (createdAt: string) => {
    const hours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
    if (hours > 24) return "border-l-destructive";
    if (hours > 6) return "border-l-amber-500";
    return "border-l-blue-500";
  };

  const completionRate = allReports.length > 0
    ? Math.round((allReports.filter(r => r.status === "completed").length / allReports.length) * 100)
    : 0;

  // Recent uploads for verification (last 5 completed reports)
  const recentUploads = allReports
    .filter(r => r.status === "completed")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Microscope className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Laboratory Dashboard</h2>
              <p className="text-blue-200 text-sm mt-0.5">
                {format(new Date(), "EEEE, dd MMMM yyyy")} • NIT Warangal Health Centre
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="bg-white text-[#1e3a8a] hover:bg-blue-50 font-semibold"
              onClick={() => onNavigate("register")}
            >
              <Plus className="w-4 h-4 mr-1" />Register New Sample
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={onRefresh}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Inline Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div
            className="bg-white/10 backdrop-blur-sm rounded-lg p-3 cursor-pointer hover:bg-white/20 transition-colors"
            onClick={() => onNavigate("processing")}
          >
            <div className="flex items-center gap-2 mb-1">
              <TestTubes className="w-4 h-4 text-blue-200" />
              <span className="text-xs text-blue-200">Samples Today</span>
            </div>
            <p className="text-2xl font-bold">{totalToday}</p>
          </div>
          <div
            className="bg-white/10 backdrop-blur-sm rounded-lg p-3 cursor-pointer hover:bg-white/20 transition-colors"
            onClick={() => onNavigate("processing")}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-300" />
              <span className="text-xs text-blue-200">Pending</span>
            </div>
            <p className="text-2xl font-bold">{pending}</p>
          </div>
          <div
            className="bg-white/10 backdrop-blur-sm rounded-lg p-3 cursor-pointer hover:bg-white/20 transition-colors"
            onClick={() => onNavigate("completed")}
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span className="text-xs text-blue-200">Completed</span>
            </div>
            <p className="text-2xl font-bold">{completed}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-green-300" />
              <span className="text-xs text-blue-200">Completion Rate</span>
            </div>
            <p className="text-2xl font-bold">{completionRate}%</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Register Sample", icon: Plus, color: "text-primary", bg: "bg-primary/10 hover:bg-primary/20", action: "register" },
          { label: "Processing Queue", icon: FlaskConical, color: "text-amber-600", bg: "bg-amber-50 hover:bg-amber-100", action: "processing" },
          { label: "Completed Tests", icon: ClipboardCheck, color: "text-emerald-600", bg: "bg-emerald-50 hover:bg-emerald-100", action: "completed" },
          { label: "Student Records", icon: User, color: "text-blue-600", bg: "bg-blue-50 hover:bg-blue-100", action: "students" },
          { label: "Analytics", icon: BarChart3, color: "text-purple-600", bg: "bg-purple-50 hover:bg-purple-100", action: "analytics" },
        ].map((item) => (
          <button
            key={item.action}
            onClick={() => onNavigate(item.action)}
            className={`${item.bg} rounded-xl p-4 flex flex-col items-center gap-2 transition-colors border border-transparent hover:border-border`}
          >
            <item.icon className={`w-6 h-6 ${item.color}`} />
            <span className="text-xs font-medium text-foreground">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Urgent Pending Queue */}
        <Card className="border-t-4 border-t-amber-400">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Urgent Pending Tests
                {pendingReports.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 text-[10px] ml-1">{pendingReports.length}</Badge>
                )}
              </CardTitle>
              {pendingReports.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => onNavigate("processing")}>
                  View All <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {urgentPending.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">All Clear!</p>
                <p className="text-xs text-muted-foreground mt-1">No pending tests in the queue</p>
              </div>
            ) : (
              <div className="space-y-2">
                {urgentPending.map(r => (
                  <div
                    key={r.id}
                    className={`border-l-4 ${priorityColor(r.created_at)} bg-muted/30 rounded-r-lg p-3 cursor-pointer hover:bg-muted/60 transition-colors`}
                    onClick={() => onNavigate("processing")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{r.student?.full_name}</span>
                        <Badge variant="outline" className="text-[10px]">{r.student?.roll_number}</Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-blue-100 text-blue-800 text-[10px]">{r.test_name}</Badge>
                      {r.doctor?.name && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Stethoscope className="w-2.5 h-2.5" />{r.doctor.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Completions */}
        <Card className="border-t-4 border-t-emerald-400">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Recent Completions
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => onNavigate("completed")}>
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {recentUpdates.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recent completions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentUpdates.map((u, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      u.type === "success" ? "bg-emerald-500" : u.type === "warning" ? "bg-amber-500" : "bg-blue-500"
                    }`} />
                    <div className="flex-1">
                      <span className="text-foreground">{u.text}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{u.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Test Distribution + Lab Summary */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Test Type Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TestTubes className="w-4 h-4 text-primary" />
              Test Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {testDistribution.length === 0 ? (
              <div className="text-center py-6">
                <FlaskConical className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No tests recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {testDistribution.map(([name, count]) => {
                  const pct = Math.round((count / allReports.length) * 100);
                  return (
                    <div key={name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="truncate mr-2 font-medium">{name}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lab Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Lab Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                <TestTubes className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{allReports.length}</p>
                <p className="text-xs text-muted-foreground">Total Reports</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
                <User className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{uniqueStudents}</p>
                <p className="text-xs text-muted-foreground">Unique Students</p>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{allReports.filter(r => r.status === "completed").length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
                <Microscope className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{testCounts.size}</p>
                <p className="text-xs text-muted-foreground">Test Types</p>
              </div>
            </div>
            {pendingReports.length > 0 && (
              <div className="mt-4 p-3 border border-amber-200 bg-amber-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-800 font-medium">{pendingReports.length} tests awaiting processing</span>
                </div>
                <Button variant="outline" size="sm" className="text-xs border-amber-300 hover:bg-amber-100" onClick={() => onNavigate("processing")}>
                  Process Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Uploads Verification Panel */}
      {recentUploads.length > 0 && (
        <Card className="border-t-4 border-t-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Recent Uploads — Verification
              <Badge variant="outline" className="text-xs ml-1">{recentUploads.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-2">
              {recentUploads.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      r.report_file_url ? 'bg-emerald-100' : 'bg-amber-100'
                    }`}>
                      {r.report_file_url ? (
                        <FileText className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.test_name} — {r.student?.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.student?.roll_number} · {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                        {r.report_file_name && ` · 📎 ${r.report_file_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.report_file_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={verifyingId === r.id}
                        onClick={async () => {
                          setVerifyingId(r.id);
                          try {
                            const path = r.report_file_url!;
                            if (path.startsWith("http")) {
                              window.open(path, "_blank");
                            } else {
                              const { data, error } = await supabase.storage.from("lab-reports").createSignedUrl(path, 3600);
                              if (error) throw error;
                              window.open(data.signedUrl, "_blank");
                            }
                            toast({ title: "✅ PDF Verified", description: "File opened successfully" });
                          } catch (err: any) {
                            toast({ title: "❌ Verification Failed", description: err.message, variant: "destructive" });
                          } finally {
                            setVerifyingId(null);
                          }
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        {verifyingId === r.id ? "Opening..." : "Verify PDF"}
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-xs">No file</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
