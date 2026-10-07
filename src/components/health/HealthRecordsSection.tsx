import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Download, Eye, User, Calendar, Stethoscope, ClipboardList, Printer, Award, UserCheck, TestTube, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import LabReportViewer from '@/components/lab/LabReportViewer';

interface HealthRecord {
  id: string;
  title: string;
  date: string;
  type: 'Medical Report' | 'Lab Report' | 'Certificate' | 'Assessment' | 'Prescription' | 'Checkup';
  student: string;
  studentRoll: string;
  doctor: string;
  department: string;
  summary: string;
  details: string[];
  recommendations?: string[];
  validUntil?: string;
  status?: 'approved' | 'pending' | 'completed';
}

const getRecordTypeBadgeColor = (type: string) => {
  switch (type) {
    case 'Medical Report': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'Lab Report': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'Certificate': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'Assessment': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'Prescription': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
    case 'Checkup': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getRecordIcon = (type: string) => {
  switch (type) {
    case 'Medical Report': return Stethoscope;
    case 'Lab Report': return TestTube;
    case 'Certificate': return Award;
    case 'Assessment': return ClipboardList;
    case 'Prescription': return FileText;
    case 'Checkup': return UserCheck;
    default: return FileText;
  }
};

const formatReasonCategory = (category: string) =>
  category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const HealthRecordsSection = () => {
  const navigate = useNavigate();
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [labReportViewerOpen, setLabReportViewerOpen] = useState(false);
  const [labReportViewerData, setLabReportViewerData] = useState<{ title: string; url: string | null; notes?: string | null; studentName?: string; rollNumber?: string; doctorName?: string; testDate?: string }>({ title: '', url: null });

  // Fetch real health visits
  const { data: healthVisits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ['health-records-visits'],
    queryFn: async () => {
      const { data } = await supabase
        .from('health_visits')
        .select(`
          id, visit_date, reason_category, reason_subcategory, reason_notes, diagnosis, prescription, follow_up_required, follow_up_date,
          students!health_visits_student_id_fkey ( full_name, roll_number, program ),
          medical_officers!health_visits_doctor_id_fkey ( name, designation )
        `)
        .order('visit_date', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // Fetch real prescriptions - fixed query
  const { data: prescriptions = [], isLoading: loadingRx } = useQuery({
    queryKey: ['health-records-prescriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          id, diagnosis, notes, created_at, student_id,
          medical_officers:doctor_id ( name, designation ),
          prescription_items ( medicine_name, dosage, frequency, duration, instructions, meal_timing )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Prescriptions fetch error:', error);
        return [];
      }

      // Fetch student info separately to avoid join issues
      if (!data || data.length === 0) return [];
      
      const studentIds = [...new Set(data.map(p => p.student_id))];
      const { data: students } = await supabase
        .from('students')
        .select('id, full_name, roll_number')
        .in('id', studentIds);

      const studentMap = new Map((students || []).map(s => [s.id, s]));

      return data.map(p => ({
        ...p,
        student_info: studentMap.get(p.student_id) || null,
      }));
    },
  });

  // Fetch medical leave certificates
  const { data: leaveCerts = [], isLoading: loadingLeave } = useQuery({
    queryKey: ['health-records-leave-certs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('medical_leave_requests')
        .select(`
          id, status, referral_hospital, illness_description, leave_start_date, expected_return_date, expected_duration, doctor_notes, health_priority, created_at,
          students!medical_leave_requests_student_id_fkey ( full_name, roll_number ),
          medical_officers!medical_leave_requests_referring_doctor_id_fkey ( name, designation )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Fetch lab reports
  const { data: labReports = [], isLoading: loadingLabs } = useQuery({
    queryKey: ['health-records-lab-reports'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lab_reports')
        .select(`
          id, test_name, status, notes, report_file_url, created_at,
          students!lab_reports_student_id_fkey ( full_name, roll_number ),
          medical_officers:doctor_id ( name, designation )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const isLoading = loadingVisits || loadingRx || loadingLeave || loadingLabs;

  // Transform real data into HealthRecord format
  const records: HealthRecord[] = useMemo(() => {
    const allRecords: HealthRecord[] = [
      // Health visits
      ...healthVisits.map((v: any) => ({
        id: `visit-${v.id}`,
        title: v.diagnosis ? `Visit: ${v.diagnosis}` : `Health Visit — ${formatReasonCategory(v.reason_category)}`,
        date: v.visit_date,
        type: (v.reason_category === 'routine_checkup' ? 'Checkup' : v.reason_category === 'mental_wellness' ? 'Assessment' : 'Medical Report') as HealthRecord['type'],
        student: v.students?.full_name || 'Unknown',
        studentRoll: v.students?.roll_number || 'N/A',
        doctor: v.medical_officers?.name ? `${v.medical_officers.name}` : 'Health Centre',
        department: v.medical_officers?.designation || 'General Medicine',
        summary: v.reason_notes || v.diagnosis || `${formatReasonCategory(v.reason_category)} visit`,
        details: [
          `Category: ${formatReasonCategory(v.reason_category)}`,
          ...(v.reason_subcategory ? [`Subcategory: ${v.reason_subcategory}`] : []),
          ...(v.reason_notes ? [`Complaint: ${v.reason_notes}`] : []),
          ...(v.diagnosis ? [`Diagnosis: ${v.diagnosis}`] : []),
          ...(v.prescription ? [`Prescription: ${v.prescription}`] : []),
          `Date: ${format(new Date(v.visit_date), 'MMMM d, yyyy h:mm a')}`,
          ...(v.follow_up_required ? [`Follow-up Required: ${v.follow_up_date ? format(new Date(v.follow_up_date), 'MMM d, yyyy') : 'TBD'}`] : []),
        ],
        status: 'completed' as const,
      })),
      // Prescriptions - fixed
      ...prescriptions.map((p: any) => {
        const items = p.prescription_items || [];
        return {
          id: `rx-${p.id}`,
          title: p.diagnosis ? `Rx: ${p.diagnosis}` : 'Prescription',
          date: p.created_at,
          type: 'Prescription' as const,
          student: p.student_info?.full_name || 'Unknown',
          studentRoll: p.student_info?.roll_number || 'N/A',
          doctor: p.medical_officers?.name ? `${p.medical_officers.name}` : 'Doctor',
          department: p.medical_officers?.designation || 'General Medicine',
          summary: p.diagnosis || 'Prescription issued',
          details: [
            ...(p.diagnosis ? [`Diagnosis: ${p.diagnosis}`] : []),
            ...items.map((m: any) => `💊 ${m.medicine_name} — ${m.dosage}, ${m.frequency}, ${m.duration}`),
            ...(p.notes ? [`Doctor Notes: ${p.notes}`] : []),
          ],
          status: 'completed' as const,
        };
      }),
      // Certificates
      ...leaveCerts.map((l: any) => ({
        id: `leave-${l.id}`,
        title: `Medical Leave Certificate — ${l.referral_hospital}`,
        date: l.created_at,
        type: 'Certificate' as const,
        student: l.students?.full_name || 'Unknown',
        studentRoll: l.students?.roll_number || 'N/A',
        doctor: l.medical_officers?.name ? `${l.medical_officers.name}` : 'Health Centre',
        department: l.medical_officers?.designation || 'General Medicine',
        summary: l.illness_description || `Medical leave referral to ${l.referral_hospital}`,
        details: [
          `Hospital: ${l.referral_hospital}`,
          `Duration: ${l.expected_duration}`,
          ...(l.leave_start_date ? [`Leave Start: ${format(new Date(l.leave_start_date), 'MMM d, yyyy')}`] : []),
          ...(l.expected_return_date ? [`Expected Return: ${format(new Date(l.expected_return_date), 'MMM d, yyyy')}`] : []),
          ...(l.illness_description ? [`Illness: ${l.illness_description}`] : []),
          ...(l.doctor_notes ? [`Doctor Notes: ${l.doctor_notes}`] : []),
          `Status: ${l.status.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}`,
          ...(l.health_priority ? [`Priority: ${l.health_priority}`] : []),
        ],
        status: l.status === 'on_leave' || l.status === 'return_pending' ? 'approved' as const : 'completed' as const,
        validUntil: l.expected_return_date || undefined,
      })),
      // Lab reports
      ...labReports.map((lr: any) => ({
        id: `lab-${lr.id}`,
        title: `Lab: ${lr.test_name}`,
        date: lr.created_at,
        type: 'Lab Report' as const,
        student: lr.students?.full_name || 'Unknown',
        studentRoll: lr.students?.roll_number || 'N/A',
        doctor: lr.medical_officers?.name ? `${lr.medical_officers.name}` : 'Health Centre',
        department: lr.medical_officers?.designation || 'General Medicine',
        summary: `${lr.test_name} — ${lr.status === 'completed' ? 'Report Ready' : 'Pending'}`,
        details: [
          `Test: ${lr.test_name}`,
          `Status: ${lr.status === 'completed' ? 'Completed' : 'Pending'}`,
          ...(lr.notes ? lr.notes.split("\n").filter((l: string) => l.trim()).map((l: string) => {
            if (l.startsWith("LAB RESULTS:")) return null;
            return l;
          }).filter(Boolean) as string[] : []),
          ...(lr.report_file_url ? [`Report available for download`] : []),
        ],
        status: lr.status === 'completed' ? 'completed' as const : 'pending' as const,
      })),
    ];

    // Sort: first by student name, then by roll number, then by date (newest first)
    return allRecords.sort((a, b) => {
      const nameCompare = a.student.localeCompare(b.student);
      if (nameCompare !== 0) return nameCompare;
      const rollCompare = a.studentRoll.localeCompare(b.studentRoll);
      if (rollCompare !== 0) return rollCompare;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [healthVisits, prescriptions, leaveCerts, labReports]);

  const handleView = async (record: HealthRecord) => {
    if (record.id.startsWith('lab-')) {
      const labId = record.id.replace('lab-', '');
      const labReport = labReports.find((lr: any) => lr.id === labId);
      if (labReport) {
        setLabReportViewerData({
          title: `${labReport.test_name} — ${record.student} (${record.studentRoll})`,
          url: labReport.report_file_url || null,
          notes: labReport.notes,
          studentName: record.student,
          rollNumber: record.studentRoll,
          doctorName: labReport.medical_officers?.name,
          testDate: labReport.created_at,
        });
        setLabReportViewerOpen(true);
        return;
      }
    }
    setSelectedRecord(record);
    setIsViewOpen(true);
  };

  const handleDownload = async (record: HealthRecord) => {
    if (record.id.startsWith('lab-')) {
      const labId = record.id.replace('lab-', '');
      const labReport = labReports.find((lr: any) => lr.id === labId);
      if (labReport?.report_file_url) {
        try {
          const path = labReport.report_file_url;
          let url = path;
          if (!path.startsWith('http')) {
            const { data, error } = await supabase.storage.from('lab-reports').createSignedUrl(path, 3600);
            if (error) throw error;
            url = data.signedUrl;
          }
          if (path.endsWith('.html')) {
            const res = await fetch(url);
            const html = await res.text();
            const blob = new Blob([html], { type: 'text/html' });
            window.open(URL.createObjectURL(blob), '_blank');
          } else {
            window.open(url, '_blank');
          }
          toast.success('Opening lab report...');
          return;
        } catch (err: any) {
          toast.error('Could not download report', { description: err.message });
          return;
        }
      }
    }

    toast.success(`Downloading ${record.title}...`, {
      description: `Document for ${record.student} (${record.studentRoll})`
    });
    
    const content = `
${record.title.toUpperCase()}
${'='.repeat(50)}

Student: ${record.student}
Roll Number: ${record.studentRoll}
Date: ${format(new Date(record.date), 'MMMM d, yyyy')}
Doctor: ${record.doctor}
Department: ${record.department}

SUMMARY
-------
${record.summary}

DETAILS
-------
${record.details.map(d => `• ${d}`).join('\n')}

${record.recommendations ? `RECOMMENDATIONS
---------------
${record.recommendations.map(r => `• ${r}`).join('\n')}` : ''}

${record.validUntil ? `Valid Until: ${format(new Date(record.validUntil), 'MMMM d, yyyy')}` : ''}

---
NIT Warangal Health Centre
This is a computer-generated document.
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.title.replace(/\s+/g, '_')}_${record.studentRoll}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = async () => {
    if (!selectedRecord) return;
    const { printDocument, getNitwHeaderHtml } = await import('@/lib/print/printDocument');
    const docId = `HR-${selectedRecord.id.slice(0, 8).toUpperCase()}`;

    const bodyHtml = `
      ${getNitwHeaderHtml(selectedRecord.type.toUpperCase())}
      <div class="doc-title">
        <h3>${selectedRecord.title.toUpperCase()}</h3>
        <p class="cert-no">Date: ${format(new Date(selectedRecord.date), 'MMMM d, yyyy')}</p>
      </div>
      <div class="info-grid" style="margin-bottom:16px;">
        <div class="info-item"><span class="info-label">Patient:</span><span>${selectedRecord.student}</span></div>
        <div class="info-item"><span class="info-label">Roll Number:</span><span>${selectedRecord.studentRoll}</span></div>
        <div class="info-item"><span class="info-label">Doctor:</span><span>${selectedRecord.doctor}</span></div>
        <div class="info-item"><span class="info-label">Department:</span><span>${selectedRecord.department}</span></div>
      </div>
      <div class="section">
        <div class="section-title">Summary</div>
        <p style="font-size:13px;">${selectedRecord.summary}</p>
      </div>
      <div class="section">
        <div class="section-title">Details</div>
        <ul style="font-size:12px;padding-left:20px;">
          ${selectedRecord.details.map(d => `<li style="margin-bottom:4px;">${d}</li>`).join('')}
        </ul>
      </div>
      ${selectedRecord.recommendations ? `
      <div class="section">
        <div class="section-title">Recommendations</div>
        <ul style="font-size:12px;padding-left:20px;">
          ${selectedRecord.recommendations.map(r => `<li style="margin-bottom:4px;">${r}</li>`).join('')}
        </ul>
      </div>` : ''}
      ${selectedRecord.validUntil ? `<p style="font-size:12px;margin-top:12px;"><strong>Valid Until:</strong> ${format(new Date(selectedRecord.validUntil), 'MMMM d, yyyy')}</p>` : ''}
      <div class="signature-section">
        <div class="signature-box">
          <div class="emblem-area">
            <img src="/nitw-emblem.png" alt="NIT Warangal" />
            <p class="emblem-label">Official Emblem</p>
          </div>
        </div>
        <div class="signature-box" style="text-align:right;">
          <div class="online-signature">${selectedRecord.doctor}</div>
          <div class="signature-line">
            <strong>${selectedRecord.doctor}</strong><br/>
            ${selectedRecord.department}<br/>
            <span class="doctor-type">Health Centre, NIT Warangal</span>
          </div>
        </div>
      </div>
    `;

    await printDocument({
      title: `${selectedRecord.title} - ${selectedRecord.student}`,
      bodyHtml,
      documentId: docId,
      documentType: selectedRecord.type,
    });

    toast.success('Print dialog opened');
  };

  // Filter by tab type
  const getTypeFilteredRecords = (recs: HealthRecord[]) => {
    if (activeTab === 'all') return recs;
    return recs.filter(record => {
      switch (activeTab) {
        case 'reports': return record.type === 'Medical Report';
        case 'labs': return record.type === 'Lab Report';
        case 'certificates': return record.type === 'Certificate';
        case 'checkups': return record.type === 'Checkup' || record.type === 'Assessment';
        case 'prescriptions': return record.type === 'Prescription';
        default: return true;
      }
    });
  };

  // Filter by search query
  const searchFilteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(r =>
      r.student.toLowerCase().includes(q) ||
      r.studentRoll.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.doctor.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const filteredRecords = getTypeFilteredRecords(searchFilteredRecords);

  const getTabCount = (tabType: string) => {
    const base = searchFilteredRecords;
    if (tabType === 'all') return base.length;
    return base.filter(record => {
      switch (tabType) {
        case 'reports': return record.type === 'Medical Report';
        case 'labs': return record.type === 'Lab Report';
        case 'certificates': return record.type === 'Certificate';
        case 'checkups': return record.type === 'Checkup' || record.type === 'Assessment';
        case 'prescriptions': return record.type === 'Prescription';
        default: return true;
      }
    }).length;
  };

  // Group records by student for better display
  const groupedRecords = useMemo(() => {
    const groups: { key: string; student: string; roll: string; records: HealthRecord[] }[] = [];
    const map = new Map<string, HealthRecord[]>();
    
    for (const r of filteredRecords) {
      const key = `${r.student}|${r.studentRoll}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    
    for (const [key, recs] of map) {
      const [student, roll] = key.split('|');
      groups.push({ key, student, roll, records: recs });
    }
    
    return groups;
  }, [filteredRecords]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Health Records & Documents
          </CardTitle>
          <CardDescription>Medical reports, certificates, lab results, checkups, and prescriptions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name, roll number, title, or doctor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-3 lg:grid-cols-6 mb-4">
                  <TabsTrigger value="all" className="text-xs sm:text-sm">
                    All ({getTabCount('all')})
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="text-xs sm:text-sm">
                    <Stethoscope className="h-3 w-3 mr-1 hidden sm:inline" />
                    Reports ({getTabCount('reports')})
                  </TabsTrigger>
                  <TabsTrigger value="labs" className="text-xs sm:text-sm">
                    <TestTube className="h-3 w-3 mr-1 hidden sm:inline" />
                    Labs ({getTabCount('labs')})
                  </TabsTrigger>
                  <TabsTrigger value="certificates" className="text-xs sm:text-sm">
                    <Award className="h-3 w-3 mr-1 hidden sm:inline" />
                    Certificates ({getTabCount('certificates')})
                  </TabsTrigger>
                  <TabsTrigger value="checkups" className="text-xs sm:text-sm">
                    <UserCheck className="h-3 w-3 mr-1 hidden sm:inline" />
                    Checkups ({getTabCount('checkups')})
                  </TabsTrigger>
                  <TabsTrigger value="prescriptions" className="text-xs sm:text-sm">
                    <FileText className="h-3 w-3 mr-1 hidden sm:inline" />
                    Prescriptions ({getTabCount('prescriptions')})
                  </TabsTrigger>
                </TabsList>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {groupedRecords.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No records found{searchQuery ? ` matching "${searchQuery}"` : ' in this category'}</p>
                    </div>
                  ) : (
                    groupedRecords.map((group) => (
                      <div key={group.key} className="space-y-2">
                        {/* Student header - clickable */}
                        <div
                          className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => navigate(`/student-profile/${group.roll}`)}
                        >
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-medium text-primary hover:underline">{group.student}</span>
                          <Badge variant="outline" className="text-xs">{group.roll}</Badge>
                          <Badge variant="secondary" className="text-xs ml-auto">{group.records.length} record{group.records.length > 1 ? 's' : ''}</Badge>
                        </div>

                        {/* Records for this student */}
                        {group.records.map((record) => {
                          const IconComponent = getRecordIcon(record.type);
                          return (
                            <div
                              key={record.id}
                              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors ml-4"
                            >
                              <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <IconComponent className="h-5 w-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{record.title}</p>
                                  <p className="text-xs text-muted-foreground sm:hidden">
                                    {format(new Date(record.date), 'MMM d, yyyy')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                                <div className="hidden md:flex flex-col items-end gap-1">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRecordTypeBadgeColor(record.type)}`}>
                                    {record.type}
                                  </span>
                                  {record.status && (
                                    <Badge variant={record.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                                      {record.status}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-sm text-muted-foreground hidden sm:inline whitespace-nowrap">
                                  {format(new Date(record.date), 'MMM d, yyyy')}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleView(record)}
                                    title="View Document"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownload(record)}
                                    title="Download Document"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Document Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRecord && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <DialogTitle className="text-xl">{selectedRecord.title}</DialogTitle>
                    <DialogDescription>
                      {format(new Date(selectedRecord.date), 'MMMM d, yyyy')}
                    </DialogDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRecordTypeBadgeColor(selectedRecord.type)}`}>
                      {selectedRecord.type}
                    </span>
                    {selectedRecord.status && (
                      <Badge variant={selectedRecord.status === 'approved' ? 'default' : 'secondary'}>
                        {selectedRecord.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Patient</span>
                    </div>
                    <p
                      className="font-medium text-primary cursor-pointer hover:underline"
                      onClick={() => {
                        setIsViewOpen(false);
                        navigate(`/student-profile/${selectedRecord.studentRoll}`);
                      }}
                    >
                      {selectedRecord.student}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedRecord.studentRoll}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Stethoscope className="h-4 w-4" />
                      <span>Attending Doctor</span>
                    </div>
                    <p className="font-medium">{selectedRecord.doctor}</p>
                    <p className="text-sm text-muted-foreground">{selectedRecord.department}</p>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <p className="text-sm">{selectedRecord.summary}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Details</h4>
                  <ul className="space-y-2">
                    {selectedRecord.details.map((detail, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedRecord.recommendations && (
                  <div className="p-4 border-l-4 border-primary bg-primary/5 rounded-r-lg">
                    <h4 className="font-semibold mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {selectedRecord.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="text-primary">→</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedRecord.validUntil && (
                  <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      Valid Until: {format(new Date(selectedRecord.validUntil), 'MMMM d, yyyy')}
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t print:hidden">
                  <Button onClick={() => handleDownload(selectedRecord)} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                </div>

                <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                  <p>NIT Warangal Health Centre</p>
                  <p>This is a computer-generated document</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lab Report Viewer */}
      <LabReportViewer
        open={labReportViewerOpen}
        onOpenChange={setLabReportViewerOpen}
        title={labReportViewerData.title}
        reportFileUrl={labReportViewerData.url}
        fallbackNotes={labReportViewerData.notes}
        studentName={labReportViewerData.studentName}
        rollNumber={labReportViewerData.rollNumber}
        doctorName={labReportViewerData.doctorName}
        testDate={labReportViewerData.testDate}
      />
    </>
  );
};

export default HealthRecordsSection;
