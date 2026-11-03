import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  Clock,
  User,
  Activity,
  Filter,
  X,
  Download,
} from "lucide-react";
import { format, parseISO, subDays, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface LoginAttempt {
  id: string;
  email: string;
  success: boolean;
  ip_address: string | null;
  created_at: string;
}

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const SecurityDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [loginSearchQuery, setLoginSearchQuery] = useState("");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [loginDateFrom, setLoginDateFrom] = useState("");
  const [loginDateTo, setLoginDateTo] = useState("");
  const [loginStatusFilter, setLoginStatusFilter] = useState("all");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");

  // Fetch login attempts
  const { data: loginAttempts, isLoading: loadingLogins, refetch: refetchLogins } = useQuery({
    queryKey: ["login-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_attempts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as LoginAttempt[];
    },
  });

  // Fetch audit logs
  const { data: auditLogs, isLoading: loadingAudit, refetch: refetchAudit } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  // Filter login attempts
  const filteredLoginAttempts = useMemo(() => {
    if (!loginAttempts) return [];

    return loginAttempts.filter((attempt) => {
      // Search filter
      if (loginSearchQuery && !attempt.email.toLowerCase().includes(loginSearchQuery.toLowerCase())) {
        return false;
      }

      // Status filter
      if (loginStatusFilter === "success" && !attempt.success) return false;
      if (loginStatusFilter === "failed" && attempt.success) return false;

      // Date range filter
      const attemptDate = parseISO(attempt.created_at);
      if (loginDateFrom) {
        const fromDate = startOfDay(parseISO(loginDateFrom));
        if (isBefore(attemptDate, fromDate)) return false;
      }
      if (loginDateTo) {
        const toDate = endOfDay(parseISO(loginDateTo));
        if (isAfter(attemptDate, toDate)) return false;
      }

      return true;
    });
  }, [loginAttempts, loginSearchQuery, loginStatusFilter, loginDateFrom, loginDateTo]);

  // Filter audit logs
  const filteredAuditLogs = useMemo(() => {
    if (!auditLogs) return [];

    return auditLogs.filter((log) => {
      // Search filter
      if (auditSearchQuery) {
        const searchLower = auditSearchQuery.toLowerCase();
        if (
          !log.action.toLowerCase().includes(searchLower) &&
          !log.resource_type.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Action filter
      if (auditActionFilter !== "all" && log.action !== auditActionFilter) {
        return false;
      }

      // Date range filter
      const logDate = parseISO(log.created_at);
      if (auditDateFrom) {
        const fromDate = startOfDay(parseISO(auditDateFrom));
        if (isBefore(logDate, fromDate)) return false;
      }
      if (auditDateTo) {
        const toDate = endOfDay(parseISO(auditDateTo));
        if (isAfter(logDate, toDate)) return false;
      }

      return true;
    });
  }, [auditLogs, auditSearchQuery, auditActionFilter, auditDateFrom, auditDateTo]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!loginAttempts || !auditLogs) {
      return {
        totalLogins: 0,
        successfulLogins: 0,
        failedLogins: 0,
        failedLast24h: 0,
        totalAuditEvents: 0,
        uniqueIPs: 0,
        suspiciousActivity: 0,
      };
    }

    const yesterday = subDays(new Date(), 1);
    const failedLast24h = loginAttempts.filter(
      (a) => !a.success && isAfter(parseISO(a.created_at), yesterday)
    ).length;

    const uniqueIPs = new Set(loginAttempts.map((a) => a.ip_address).filter(Boolean)).size;

    // Count emails with 5+ failed attempts in last 24h as suspicious
    const emailFailCounts: Record<string, number> = {};
    loginAttempts
      .filter((a) => !a.success && isAfter(parseISO(a.created_at), yesterday))
      .forEach((a) => {
        emailFailCounts[a.email] = (emailFailCounts[a.email] || 0) + 1;
      });
    const suspiciousActivity = Object.values(emailFailCounts).filter((c) => c >= 5).length;

    return {
      totalLogins: loginAttempts.length,
      successfulLogins: loginAttempts.filter((a) => a.success).length,
      failedLogins: loginAttempts.filter((a) => !a.success).length,
      failedLast24h,
      totalAuditEvents: auditLogs.length,
      uniqueIPs,
      suspiciousActivity,
    };
  }, [loginAttempts, auditLogs]);

  // Get unique actions for filter
  const uniqueActions = useMemo(() => {
    if (!auditLogs) return [];
    return Array.from(new Set(auditLogs.map((log) => log.action)));
  }, [auditLogs]);

  const clearLoginFilters = () => {
    setLoginSearchQuery("");
    setLoginDateFrom("");
    setLoginDateTo("");
    setLoginStatusFilter("all");
  };

  const clearAuditFilters = () => {
    setAuditSearchQuery("");
    setAuditDateFrom("");
    setAuditDateTo("");
    setAuditActionFilter("all");
  };

  // Neutralize spreadsheet formulas: a cell starting with = + - @ (or a
  // tab/CR) would execute as a formula when the CSV is opened in Excel.
  const csvSafe = (value: unknown): string => {
    const text = String(value ?? "");
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  };

  const exportLoginAttemptsToCSV = () => {
    if (!filteredLoginAttempts.length) return;

    const headers = ["Email", "Status", "IP Address", "Timestamp"];
    const rows = filteredLoginAttempts.map((a) => [
      a.email,
      a.success ? "Success" : "Failed",
      a.ip_address || "N/A",
      format(parseISO(a.created_at), "yyyy-MM-dd HH:mm:ss"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map(csvSafe).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `login_attempts_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAuditLogsToCSV = () => {
    if (!filteredAuditLogs.length) return;

    const headers = ["Action", "Resource Type", "Resource ID", "User ID", "IP Address", "Timestamp"];
    const rows = filteredAuditLogs.map((log) => [
      log.action,
      log.resource_type,
      log.resource_id || "N/A",
      log.user_id || "N/A",
      log.ip_address || "N/A",
      format(parseISO(log.created_at), "yyyy-MM-dd HH:mm:ss"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSecurityReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 51, 102);
    doc.text("Security Dashboard Report", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, pageWidth / 2, 28, { align: "center" });

    // Stats summary
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Security Overview", 14, 45);

    doc.setFontSize(11);
    doc.text(`Total Login Attempts: ${stats.totalLogins}`, 14, 55);
    doc.text(`Successful Logins: ${stats.successfulLogins}`, 14, 62);
    doc.text(`Failed Logins: ${stats.failedLogins}`, 14, 69);
    doc.text(`Failed (Last 24h): ${stats.failedLast24h}`, 14, 76);
    doc.text(`Suspicious Activity: ${stats.suspiciousActivity} accounts`, 14, 83);
    doc.text(`Unique IP Addresses: ${stats.uniqueIPs}`, 14, 90);
    doc.text(`Total Audit Events: ${stats.totalAuditEvents}`, 14, 97);

    // Recent failed logins table
    if (loginAttempts && loginAttempts.filter((a) => !a.success).length > 0) {
      doc.setFontSize(14);
      doc.text("Recent Failed Login Attempts (Last 20)", 14, 115);

      const failedLogins = loginAttempts
        .filter((a) => !a.success)
        .slice(0, 20)
        .map((a) => [
          a.email,
          a.ip_address || "N/A",
          format(parseISO(a.created_at), "dd MMM yyyy HH:mm"),
        ]);

      autoTable(doc, {
        startY: 120,
        head: [["Email", "IP Address", "Timestamp"]],
        body: failedLogins,
        theme: "striped",
        headStyles: { fillColor: [220, 38, 38] },
        styles: { fontSize: 9 },
      });
    }

    doc.save(`security_report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (loadingLogins || loadingAudit) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Security Dashboard
          </h2>
          <p className="text-muted-foreground">Monitor login attempts and security events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchLogins(); refetchAudit(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="default" size="sm" onClick={exportSecurityReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Logins</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLogins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Successful</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.successfulLogins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failedLogins}</div>
          </CardContent>
        </Card>
        <Card className={stats.failedLast24h > 10 ? "border-red-500" : ""}>
          <CardHeader className="pb-2">
            <CardDescription>Failed (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.failedLast24h}</div>
          </CardContent>
        </Card>
        <Card className={stats.suspiciousActivity > 0 ? "border-red-500 bg-red-50 dark:bg-red-950/20" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Suspicious
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.suspiciousActivity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unique IPs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueIPs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Audit Events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAuditEvents}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="logins" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Login Attempts
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Failed Logins */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  Recent Failed Logins
                </CardTitle>
                <CardDescription>Last 10 failed login attempts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {loginAttempts?.filter((a) => !a.success).slice(0, 10).map((attempt) => (
                    <div key={attempt.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                      <div>
                        <p className="font-medium text-sm">{attempt.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {attempt.ip_address || "Unknown IP"}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(attempt.created_at), "MMM d, HH:mm")}
                      </p>
                    </div>
                  ))}
                  {(!loginAttempts || loginAttempts.filter((a) => !a.success).length === 0) && (
                    <p className="text-center text-muted-foreground py-4">No failed login attempts</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Audit Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Recent Security Events
                </CardTitle>
                <CardDescription>Last 10 security audit events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditLogs?.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border">
                      <div>
                        <p className="font-medium text-sm">{log.action}</p>
                        <p className="text-xs text-muted-foreground">{log.resource_type}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(log.created_at), "MMM d, HH:mm")}
                      </p>
                    </div>
                  ))}
                  {(!auditLogs || auditLogs.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">No audit events</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Login Attempts Tab */}
        <TabsContent value="logins" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Login Attempts</CardTitle>
                  <CardDescription>
                    Showing {filteredLoginAttempts.length} of {loginAttempts?.length || 0} attempts
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportLoginAttemptsToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters</span>
                </div>
                <div className="flex-1 min-w-48">
                  <Label className="text-xs">Search Email</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email..."
                      value={loginSearchQuery}
                      onChange={(e) => setLoginSearchQuery(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
                <div className="w-32">
                  <Label className="text-xs">Status</Label>
                  <Select value={loginStatusFilter} onValueChange={setLoginStatusFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-36">
                  <Label className="text-xs">From Date</Label>
                  <Input
                    type="date"
                    value={loginDateFrom}
                    onChange={(e) => setLoginDateFrom(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="w-36">
                  <Label className="text-xs">To Date</Label>
                  <Input
                    type="date"
                    value={loginDateTo}
                    onChange={(e) => setLoginDateTo(e.target.value)}
                    className="h-9"
                  />
                </div>
                {(loginSearchQuery || loginDateFrom || loginDateTo || loginStatusFilter !== "all") && (
                  <Button variant="ghost" size="sm" onClick={clearLoginFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Table */}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoginAttempts.slice(0, 100).map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell className="font-medium">{attempt.email}</TableCell>
                        <TableCell>
                          {attempt.success ? (
                            <Badge className="bg-green-500/10 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-700 border-red-200">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {attempt.ip_address || "N/A"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(parseISO(attempt.created_at), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredLoginAttempts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No login attempts found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {filteredLoginAttempts.length > 100 && (
                <p className="text-sm text-muted-foreground text-center">
                  Showing first 100 results. Use filters to narrow down.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Security Audit Logs</CardTitle>
                  <CardDescription>
                    Showing {filteredAuditLogs.length} of {auditLogs?.length || 0} events
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportAuditLogsToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters</span>
                </div>
                <div className="flex-1 min-w-48">
                  <Label className="text-xs">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search action or resource..."
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
                <div className="w-40">
                  <Label className="text-xs">Action</Label>
                  <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {uniqueActions.map((action) => (
                        <SelectItem key={action} value={action}>
                          {action}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-36">
                  <Label className="text-xs">From Date</Label>
                  <Input
                    type="date"
                    value={auditDateFrom}
                    onChange={(e) => setAuditDateFrom(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="w-36">
                  <Label className="text-xs">To Date</Label>
                  <Input
                    type="date"
                    value={auditDateTo}
                    onChange={(e) => setAuditDateTo(e.target.value)}
                    className="h-9"
                  />
                </div>
                {(auditSearchQuery || auditDateFrom || auditDateTo || auditActionFilter !== "all") && (
                  <Button variant="ghost" size="sm" onClick={clearAuditFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Table */}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAuditLogs.slice(0, 100).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{log.resource_type}</p>
                            {log.resource_id && (
                              <p className="text-xs text-muted-foreground truncate max-w-32">
                                {log.resource_id}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono truncate max-w-24">
                          {log.user_id || "System"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.ip_address || "N/A"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(parseISO(log.created_at), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAuditLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {filteredAuditLogs.length > 100 && (
                <p className="text-sm text-muted-foreground text-center">
                  Showing first 100 results. Use filters to narrow down.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityDashboard;