import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Users, Calendar, AlertTriangle, Activity, Plus, Search, FileText, Download, Eye,
  CalendarCheck, Heart, ClipboardList, Pill, Stethoscope, Clock, ArrowRight, User,
  XCircle, RefreshCw, ChevronDown, ChevronRight, Building2, ShieldCheck, Bed
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, isPast, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HealthRecordsSection from '@/components/health/HealthRecordsSection';
import StudentMedicalLeaveSection from '@/components/medical-leave/StudentMedicalLeaveSection';
import RescheduleDialog from '@/components/appointments/RescheduleDialog';
import AddToCalendarDropdown from '@/components/appointments/AddToCalendarDropdown';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DashboardStats {
  totalStudents: number;
  visitsToday: number;
  pendingFollowUps: number;
  frequentVisitors: Array<{
    student_id: string;
    roll_number: string;
    full_name: string;
    visit_count: number;
  }>;
}

interface RecentVisit {
  id: string;
  visit_date: string;
  reason_category: string;
  students: {
    roll_number: string;
    full_name: string;
  };
}

interface StudentAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  reason: string | null;
  status: string;
  doctor_name: string | null;
}

interface StudentVisit {
  id: string;
  visit_date: string;
  reason_category: string;
  reason_notes: string | null;
  diagnosis: string | null;
  prescription: string | null;
  doctor_name: string | null;
}

interface MentorVisit {
  id: string;
  visit_date: string;
  reason_category: string;
  reason_notes: string | null;
  diagnosis: string | null;
  prescription: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  student_name: string;
  student_roll: string;
  student_email: string | null;
  student_phone: string | null;
}

interface AttentionStudent {
  student_id: string;
  roll_number: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  batch: string;
  branch: string | null;
  visit_count: number;
  primary_concern: string;
  last_visit: string;
  risk_level: 'high' | 'medium' | 'low';
}

const HealthDashboard = () => {
  const navigate = useNavigate();
  const { user, isDoctor, isMentor, isLabOfficer, isPharmacy, isMedicalStaff, loading: roleLoading, mentorId } = useUserRole();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRoll, setSearchRoll] = useState('');
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [studentHealthStats, setStudentHealthStats] = useState<any>(null);

  // Real data states for student view
  const [studentAppointments, setStudentAppointments] = useState<StudentAppointment[]>([]);
  const [studentVisits, setStudentVisits] = useState<StudentVisit[]>([]);
  const [studentPrescriptions, setStudentPrescriptions] = useState<any[]>([]);

  // Real data states for mentor view
  const [mentorRecentVisits, setMentorRecentVisits] = useState<MentorVisit[]>([]);
  const [studentsNeedingAttention, setStudentsNeedingAttention] = useState<AttentionStudent[]>([]);
  const [rescheduleApt, setRescheduleApt] = useState<StudentAppointment | null>(null);
  const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set());
  const [expandedAttention, setExpandedAttention] = useState<Set<string>>(new Set());
  const [expandedLeave, setExpandedLeave] = useState<Set<string>>(new Set());

  // Fetch medical leave students (real data) for doctor view
  const { data: medicalLeaveStudents = [] } = useQuery({
    queryKey: ['health-dashboard-medical-leave'],
    queryFn: async () => {
      const { data } = await supabase
        .from('medical_leave_requests')
        .select(`
          id,
          status,
          referral_hospital,
          illness_description,
          health_priority,
          leave_start_date,
          expected_return_date,
          actual_return_date,
          doctor_clearance,
          doctor_notes,
          expected_duration,
          rest_days,
          accompanist_name,
          accompanist_type,
          accompanist_contact,
          students!medical_leave_requests_student_id_fkey (
            full_name,
            roll_number,
            email,
            phone,
            program,
            branch,
            batch
          ),
          medical_officers!medical_leave_requests_referring_doctor_id_fkey (
            name
          )
        `)
        .in('status', ['doctor_referred', 'student_form_pending', 'on_leave', 'return_pending'])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: isDoctor || isMentor,
  });

  // Fetch enhanced recent visits for doctor view (with diagnosis, prescription, doctor info)
  const { data: doctorRecentVisits = [] } = useQuery({
    queryKey: ['health-dashboard-recent-visits-enhanced'],
    queryFn: async () => {
      const { data } = await supabase
        .from('health_visits')
        .select(`
          id,
          visit_date,
          reason_category,
          reason_subcategory,
          reason_notes,
          diagnosis,
          prescription,
          follow_up_required,
          follow_up_date,
          students!health_visits_student_id_fkey (
            full_name,
            roll_number,
            email,
            phone,
            program,
            branch,
            batch
          ),
          medical_officers!health_visits_doctor_id_fkey (
            name,
            designation
          )
        `)
        .order('visit_date', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: isDoctor && !isMentor,
  });

  // Fetch frequent visitors with their recent visit details for doctor view
  const { data: doctorAttentionStudents = [] } = useQuery({
    queryKey: ['health-dashboard-attention-students'],
    queryFn: async () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data: allVisits } = await supabase
        .from('health_visits')
        .select(`
          id,
          student_id,
          visit_date,
          reason_category,
          reason_notes,
          diagnosis,
          students!health_visits_student_id_fkey (
            full_name,
            roll_number,
            email,
            phone,
            batch,
            branch
          )
        `)
        .gte('visit_date', threeMonthsAgo.toISOString())
        .order('visit_date', { ascending: false });

      if (!allVisits) return [];

      const byStudent = new Map<string, { student: any; visits: any[]; reasons: string[] }>();
      allVisits.forEach((v: any) => {
        if (!v.students) return;
        const existing = byStudent.get(v.student_id);
        if (existing) {
          existing.visits.push(v);
          existing.reasons.push(v.reason_category);
        } else {
          byStudent.set(v.student_id, {
            student: v.students,
            visits: [v],
            reasons: [v.reason_category],
          });
        }
      });

      return Array.from(byStudent.entries())
        .filter(([_, d]) => d.visits.length >= 3)
        .map(([studentId, d]) => {
          const reasonCounts: Record<string, number> = {};
          d.reasons.forEach(r => { reasonCounts[r] = (reasonCounts[r] || 0) + 1; });
          const primaryReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
          return {
            student_id: studentId,
            ...d.student,
            visit_count: d.visits.length,
            primary_concern: primaryReason,
            last_visit: d.visits[0].visit_date,
            recent_visits: d.visits.slice(0, 5),
            risk_level: d.visits.length >= 5 ? 'high' : d.visits.length >= 3 ? 'medium' : 'low' as 'high' | 'medium' | 'low',
          };
        })
        .sort((a, b) => b.visit_count - a.visit_count);
    },
    enabled: isDoctor && !isMentor,
  });

  const toggleExpanded = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
      toast.success("Appointment cancelled");
      setStudentAppointments(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      toast.error("Failed to cancel", { description: err.message });
    }
  };

  useEffect(() => {
    if (!roleLoading && !user) {
      navigate('/auth');
      return;
    }
    // Redirect staff roles to their dedicated dashboards
    if (!roleLoading && user) {
      if (isLabOfficer) { navigate('/lab/dashboard', { replace: true }); return; }
      if (isPharmacy) { navigate('/pharmacy/dashboard', { replace: true }); return; }
      if (isMedicalStaff) { navigate('/staff/dashboard', { replace: true }); return; }
    }
  }, [user, roleLoading, navigate, isLabOfficer, isPharmacy, isMedicalStaff]);

  useEffect(() => {
    if (!roleLoading && user) {
      if (isDoctor || isMentor) {
        fetchDashboardData();
        if (isMentor) {
          fetchMentorData();
        }
      } else {
        fetchStudentProfile();
        fetchStudentAppointments();
        fetchStudentVisits();
        fetchStudentPrescriptions();
      }
    }
  }, [roleLoading, user, isDoctor, isMentor, mentorId]);

  const fetchStudentAppointments = async () => {
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          reason,
          status,
          medical_officer_id,
          visiting_doctor_id
        `)
        .eq('patient_id', user.id)
        .in('status', ['pending', 'confirmed'])
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .limit(5);

      if (data) {
        // Fetch doctor names
        const moIds = data.filter(a => a.medical_officer_id).map(a => a.medical_officer_id!);
        const vdIds = data.filter(a => a.visiting_doctor_id).map(a => a.visiting_doctor_id!);
        
        let moMap: Record<string, string> = {};
        let vdMap: Record<string, string> = {};

        if (moIds.length > 0) {
          const { data: mos } = await supabase.from('medical_officers').select('id, name').in('id', moIds);
          mos?.forEach(mo => { moMap[mo.id] = mo.name; });
        }
        if (vdIds.length > 0) {
          const { data: vds } = await supabase.from('visiting_doctors').select('id, name').in('id', vdIds);
          vds?.forEach(vd => { vdMap[vd.id] = vd.name; });
        }

        setStudentAppointments(data.map(a => ({
          id: a.id,
          appointment_date: a.appointment_date,
          appointment_time: a.appointment_time,
          reason: a.reason,
          status: a.status || 'pending',
          doctor_name: a.medical_officer_id ? moMap[a.medical_officer_id] || null : a.visiting_doctor_id ? vdMap[a.visiting_doctor_id] || null : null,
        })));
      }
    } catch (error) {
      console.error('Error fetching student appointments:', error);
    }
  };

  const fetchStudentVisits = async () => {
    if (!user) return;
    try {
      // Get student id first
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!student) return;

      // Fetch health_visits
      const { data } = await supabase
        .from('health_visits')
        .select(`
          id,
          visit_date,
          reason_category,
          reason_notes,
          diagnosis,
          prescription,
          doctor_id
        `)
        .eq('student_id', student.id)
        .order('visit_date', { ascending: false })
        .limit(6);

      let visits: StudentVisit[] = [];

      if (data && data.length > 0) {
        const doctorIds = data.filter(v => v.doctor_id).map(v => v.doctor_id!);
        let doctorMap: Record<string, string> = {};
        if (doctorIds.length > 0) {
          const { data: docs } = await supabase.from('medical_officers').select('id, name').in('id', doctorIds);
          docs?.forEach(d => { doctorMap[d.id] = d.name; });
        }

        visits = data.map(v => ({
          id: v.id,
          visit_date: v.visit_date,
          reason_category: v.reason_category,
          reason_notes: v.reason_notes,
          diagnosis: v.diagnosis,
          prescription: v.prescription,
          doctor_name: v.doctor_id ? doctorMap[v.doctor_id] || null : null,
        }));
      }

      // If no health_visits, show completed appointments as visit history
      if (visits.length === 0) {
        const { data: completedAppts } = await supabase
          .from('appointments')
          .select(`
            id,
            appointment_date,
            appointment_time,
            reason,
            status,
            medical_officer_id,
            visiting_doctor_id
          `)
          .eq('patient_id', user.id)
          .eq('status', 'completed')
          .order('appointment_date', { ascending: false })
          .limit(6);

        if (completedAppts) {
          const moIds = completedAppts.filter(a => a.medical_officer_id).map(a => a.medical_officer_id!);
          const vdIds = completedAppts.filter(a => a.visiting_doctor_id).map(a => a.visiting_doctor_id!);
          let moMap: Record<string, string> = {};
          let vdMap: Record<string, string> = {};

          if (moIds.length > 0) {
            const { data: mos } = await supabase.from('medical_officers').select('id, name').in('id', moIds);
            mos?.forEach(mo => { moMap[mo.id] = mo.name; });
          }
          if (vdIds.length > 0) {
            const { data: vds } = await supabase.from('visiting_doctors').select('id, name').in('id', vdIds);
            vds?.forEach(vd => { vdMap[vd.id] = vd.name; });
          }

          visits = completedAppts.map(a => ({
            id: a.id,
            visit_date: a.appointment_date,
            reason_category: 'routine_checkup',
            reason_notes: a.reason,
            diagnosis: null,
            prescription: null,
            doctor_name: a.medical_officer_id ? moMap[a.medical_officer_id] || null : a.visiting_doctor_id ? vdMap[a.visiting_doctor_id] || null : null,
          }));
        }
      }

      setStudentVisits(visits);
    } catch (error) {
      console.error('Error fetching student visits:', error);
    }
  };

  const fetchStudentPrescriptions = async () => {
    if (!user) return;
    try {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!student) return;

      const { data } = await supabase
        .from('prescriptions')
        .select(`
          id,
          diagnosis,
          notes,
          created_at,
          appointment_id,
          doctor_id,
          prescription_items (
            medicine_name,
            dosage,
            frequency,
            duration
          )
        `)
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        const doctorIds = data.filter(p => p.doctor_id).map(p => p.doctor_id!);
        let doctorMap: Record<string, string> = {};
        if (doctorIds.length > 0) {
          const { data: docs } = await supabase.from('medical_officers').select('id, name').in('id', doctorIds);
          docs?.forEach(d => { doctorMap[d.id] = d.name; });
        }

        setStudentPrescriptions(data.map(p => ({
          id: p.id,
          diagnosis: p.diagnosis,
          notes: p.notes,
          created_at: p.created_at,
          doctor_name: p.doctor_id ? doctorMap[p.doctor_id] || 'Doctor' : 'Doctor',
          medicines: p.prescription_items || [],
        })));
      }
    } catch (error) {
      console.error('Error fetching student prescriptions:', error);
    }
  };

  const fetchMentorData = async () => {
    if (!mentorId) return;
    try {
      // Get mentor's students
      const { data: mentorStudents } = await supabase
        .from('students')
        .select('id, full_name, roll_number, email, phone, batch, branch')
        .eq('mentor_id', mentorId);

      if (!mentorStudents || mentorStudents.length === 0) return;

      const studentIds = mentorStudents.map(s => s.id);
      const studentMap = new Map(mentorStudents.map(s => [s.id, s]));

      // Fetch recent health visits for mentees
      const { data: visits } = await supabase
        .from('health_visits')
        .select(`
          id,
          visit_date,
          reason_category,
          reason_notes,
          diagnosis,
          prescription,
          follow_up_required,
          follow_up_date,
          student_id
        `)
        .in('student_id', studentIds)
        .order('visit_date', { ascending: false })
        .limit(10);

      if (visits) {
        setMentorRecentVisits(visits.map(v => {
          const s = studentMap.get(v.student_id);
          return {
            id: v.id,
            visit_date: v.visit_date,
            reason_category: v.reason_category,
            reason_notes: v.reason_notes,
            diagnosis: v.diagnosis,
            prescription: v.prescription,
            follow_up_required: v.follow_up_required || false,
            follow_up_date: v.follow_up_date,
            student_name: s?.full_name || 'Unknown',
            student_roll: s?.roll_number || 'N/A',
            student_email: s?.email || null,
            student_phone: s?.phone || null,
          };
        }));
      }

      // Calculate students needing attention (3+ visits in last 3 months)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data: allVisits } = await supabase
        .from('health_visits')
        .select('id, student_id, visit_date, reason_category')
        .in('student_id', studentIds)
        .gte('visit_date', threeMonthsAgo.toISOString());

      if (allVisits) {
        const visitsByStudent = new Map<string, { count: number; reasons: string[]; lastVisit: string }>();
        allVisits.forEach(v => {
          const existing = visitsByStudent.get(v.student_id);
          if (existing) {
            existing.count++;
            existing.reasons.push(v.reason_category);
            if (v.visit_date > existing.lastVisit) existing.lastVisit = v.visit_date;
          } else {
            visitsByStudent.set(v.student_id, { count: 1, reasons: [v.reason_category], lastVisit: v.visit_date });
          }
        });

        const attention: AttentionStudent[] = [];
        visitsByStudent.forEach((data, studentId) => {
          if (data.count >= 2) {
            const s = studentMap.get(studentId);
            if (!s) return;
            // Determine primary concern from most frequent reason
            const reasonCounts: Record<string, number> = {};
            data.reasons.forEach(r => { reasonCounts[r] = (reasonCounts[r] || 0) + 1; });
            const primaryReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
            
            attention.push({
              student_id: studentId,
              roll_number: s.roll_number,
              full_name: s.full_name,
              email: s.email,
              phone: s.phone,
              batch: s.batch,
              branch: s.branch,
              visit_count: data.count,
              primary_concern: formatReasonCategory(primaryReason),
              last_visit: data.lastVisit,
              risk_level: data.count >= 5 ? 'high' : data.count >= 3 ? 'medium' : 'low',
            });
          }
        });

        setStudentsNeedingAttention(attention.sort((a, b) => b.visit_count - a.visit_count));
      }
    } catch (error) {
      console.error('Error fetching mentor data:', error);
    }
  };

  const fetchStudentProfile = async () => {
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select(`
          id,
          full_name,
          roll_number,
          email,
          phone,
          program,
          branch,
          batch,
          year_of_study,
          mentor_name,
          mentor_email,
          mentor_contact,
          mentors (
            name,
            email,
            phone
          )
        `)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (studentData) {
        setStudentProfile({
          fullName: studentData.full_name,
          rollNumber: studentData.roll_number,
          email: studentData.email,
          phone: studentData.phone,
          program: studentData.program,
          branch: studentData.branch,
          batch: studentData.batch,
          yearOfStudy: studentData.year_of_study,
          mentorName: studentData.mentors?.name || studentData.mentor_name,
          mentorEmail: studentData.mentors?.email || studentData.mentor_email,
          mentorPhone: studentData.mentors?.phone || studentData.mentor_contact,
        });

        // Fetch health stats from health_visits
        const currentMonth = new Date();
        const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

        const { data: visits } = await supabase
          .from('health_visits')
          .select('id, visit_date, follow_up_required')
          .eq('student_id', studentData.id)
          .order('visit_date', { ascending: false });

        // Also count completed appointments as visits
        const { data: completedAppointments } = await supabase
          .from('appointments')
          .select('id, appointment_date')
          .eq('patient_id', user?.id)
          .eq('status', 'completed');

        const healthVisitCount = visits?.length || 0;
        const completedApptCount = completedAppointments?.length || 0;
        const totalVisits = healthVisitCount + completedApptCount;

        const thisMonthHealthVisits = visits?.filter(v => 
          new Date(v.visit_date) >= firstDayOfMonth
        ).length || 0;
        const thisMonthCompletedAppts = completedAppointments?.filter(a =>
          new Date(a.appointment_date) >= firstDayOfMonth
        ).length || 0;
        const thisMonthVisits = thisMonthHealthVisits + thisMonthCompletedAppts;

        const pendingFollowups = visits?.filter(v => v.follow_up_required).length || 0;

        setStudentHealthStats({
          totalVisits,
          thisMonthVisits,
          pendingFollowups,
          lastVisitDate: visits?.[0]?.visit_date 
            ? format(new Date(visits[0].visit_date), 'MMM d, yyyy')
            : completedAppointments?.[0]?.appointment_date
            ? format(new Date(completedAppointments[0].appointment_date), 'MMM d, yyyy')
            : null
        });
      }
    } catch (error) {
      console.error('Error fetching student profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: students, count: studentCount } = await supabase
        .from('students')
        .select('id, roll_number, full_name', { count: 'exact' });

      const today = new Date().toISOString().split('T')[0];
      const { data: todayVisits } = await supabase
        .from('health_visits')
        .select('id')
        .gte('visit_date', today);

      const { data: followUps } = await supabase
        .from('health_visits')
        .select('id')
        .eq('follow_up_required', true)
        .gte('follow_up_date', today);

      const { data: recent } = await supabase
        .from('health_visits')
        .select(`
          id,
          visit_date,
          reason_category,
          students (
            roll_number,
            full_name
          )
        `)
        .order('visit_date', { ascending: false })
        .limit(5);

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const { data: allVisits } = await supabase
        .from('health_visits')
        .select(`
          student_id,
          students (
            roll_number,
            full_name
          )
        `)
        .gte('visit_date', threeMonthsAgo.toISOString());

      const visitCounts = new Map<string, { roll_number: string; full_name: string; count: number }>();
      allVisits?.forEach((visit: any) => {
        if (visit.students) {
          const key = visit.student_id;
          const existing = visitCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            visitCounts.set(key, {
              roll_number: visit.students.roll_number,
              full_name: visit.students.full_name,
              count: 1
            });
          }
        }
      });

      const frequentVisitors = Array.from(visitCounts.entries())
        .filter(([_, data]) => data.count >= 3)
        .map(([studentId, data]) => ({
          student_id: studentId,
          roll_number: data.roll_number,
          full_name: data.full_name,
          visit_count: data.count
        }))
        .sort((a, b) => b.visit_count - a.visit_count);

      setStats({
        totalStudents: studentCount || 0,
        visitsToday: todayVisits?.length || 0,
        pendingFollowUps: followUps?.length || 0,
        frequentVisitors
      });

      setRecentVisits(recent as RecentVisit[] || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchRoll.trim()) {
      navigate(`/student-profile/${searchRoll.trim()}`);
    }
  };

  const formatReasonCategory = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  const getUserDisplayName = () => {
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-7xl mx-auto p-8 space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Student Dashboard View
  if (!isDoctor && !isMentor) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">

          {/* Welcome Banner */}
          <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Welcome back, {getUserDisplayName()}! 👋
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Your personal health dashboard — stay on top of your wellbeing.
              </p>
              {studentProfile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {studentProfile.rollNumber} · {studentProfile.program}
                  {studentProfile.branch ? ` · ${studentProfile.branch}` : ''}
                  {studentProfile.yearOfStudy ? ` · Year ${studentProfile.yearOfStudy}` : ''}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" asChild>
                <Link to="/student/profile">
                  <User className="h-4 w-4 mr-1" />
                  My Profile
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/appointments">
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  Book Appointment
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/my-appointments')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentAppointments.length}</div>
                <p className="text-xs text-muted-foreground">Appointments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
                <Heart className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentHealthStats?.totalVisits || 0}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <Activity className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentHealthStats?.thisMonthVisits || 0}</div>
                <p className="text-xs text-muted-foreground">Health visits</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Next Appointment</CardTitle>
                <Clock className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                {studentAppointments.length > 0 ? (
                  <>
                    <div className="text-lg font-bold">
                      {format(new Date(studentAppointments[0].appointment_date), 'MMM d')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(studentAppointments[0].appointment_time)}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold text-muted-foreground">—</div>
                    <p className="text-xs text-muted-foreground">None scheduled</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pending follow-up alert */}
          {studentHealthStats?.pendingFollowups > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                You have <strong>{studentHealthStats.pendingFollowups} pending follow-up(s)</strong>. Please schedule a follow-up visit at the Health Centre.
              </p>
              <Button size="sm" variant="outline" className="ml-auto" asChild>
                <Link to="/appointments">Book Now</Link>
              </Button>
            </div>
          )}

          {/* Main Content - Full width, 2 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Appointments */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarCheck className="h-5 w-5 text-primary" />
                      Upcoming Appointments
                    </CardTitle>
                    <CardDescription>Your scheduled visits</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/my-appointments">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {studentAppointments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No upcoming appointments</p>
                    <Button variant="link" asChild className="mt-2 text-xs">
                      <Link to="/appointments">Book one now →</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studentAppointments.map((apt) => {
                      const canAct = !isPast(new Date(`${apt.appointment_date}T23:59:59`));
                      return (
                      <div key={apt.id} className="p-3 rounded-lg border hover:bg-muted/30 transition-colors space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Stethoscope className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{apt.doctor_name || 'Doctor'}</p>
                              <p className="text-xs text-muted-foreground">{apt.reason || 'General Consultation'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">{format(new Date(apt.appointment_date), 'MMM d')}</p>
                            <p className="text-xs text-muted-foreground">{formatTime(apt.appointment_time)}</p>
                            <Badge variant={apt.status === 'confirmed' ? 'default' : 'secondary'} className="mt-1 text-xs">
                              {apt.status}
                            </Badge>
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          {canAct && (
                            <Button size="sm" variant="outline" onClick={() => setRescheduleApt(apt)}>
                              <RefreshCw className="w-3 h-3 mr-1" /> Reschedule
                            </Button>
                          )}
                          {canAct && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <XCircle className="w-3 h-3 mr-1" /> Cancel
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cancel your appointment with {apt.doctor_name} on {format(new Date(apt.appointment_date), 'MMM d')} at {formatTime(apt.appointment_time)}?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancelAppointment(apt.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Yes, Cancel
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <AddToCalendarDropdown
                            appointmentDate={apt.appointment_date}
                            appointmentTime={apt.appointment_time}
                            doctorName={apt.doctor_name || 'Doctor'}
                            reason={apt.reason}
                          />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Visit History */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-primary" />
                      Recent Visit History
                    </CardTitle>
                    <CardDescription>Your past health centre visits</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/student/profile?tab=records">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {studentVisits.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No visit history yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studentVisits.map((visit) => (
                      <div key={visit.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div>
                          <p className="font-medium text-sm">
                            {visit.reason_notes || formatReasonCategory(visit.reason_category)}
                          </p>
                          <p className="text-xs text-muted-foreground">{visit.doctor_name || 'Health Centre'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{format(new Date(visit.visit_date), 'MMM d, yyyy')}</p>
                          {visit.prescription && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Pill className="h-3 w-3" />
                              <span className="max-w-[100px] truncate">{visit.prescription}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Prescription Records */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Pill className="h-5 w-5 text-primary" />
                    Health Records
                  </CardTitle>
                  <CardDescription>Your prescription records</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/student/profile?tab=records')}>
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {studentPrescriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Pill className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No prescriptions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentPrescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className="p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate('/student/profile?tab=records')}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{rx.diagnosis || 'General Prescription'}</p>
                          <p className="text-xs text-muted-foreground">{rx.doctor_name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{format(new Date(rx.created_at), 'MMM d, yyyy')}</p>
                      </div>
                      {rx.medicines.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {rx.medicines.slice(0, 3).map((med: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {med.medicine_name}
                            </Badge>
                          ))}
                          {rx.medicines.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{rx.medicines.length - 3} more</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Medical Leave Section */}
          {user && <StudentMedicalLeaveSection userId={user.id} />}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-1.5 text-sm" asChild>
                  <Link to="/appointments">
                    <CalendarCheck className="h-5 w-5" />
                    Book Appointment
                  </Link>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-1.5 text-sm" asChild>
                  <Link to="/my-appointments">
                    <Calendar className="h-5 w-5" />
                    My Appointments
                  </Link>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-1.5 text-sm" asChild>
                  <Link to="/medical-leave">
                    <FileText className="h-5 w-5" />
                    Medical Leave
                  </Link>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-1.5 text-sm" asChild>
                  <Link to="/student/profile?tab=records">
                    <Pill className="h-5 w-5" />
                    Prescriptions
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Doctor/Mentor Dashboard View
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Health Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overall Student Health Records &amp; Analytics
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search by Roll Number"
                value={searchRoll}
                onChange={(e) => setSearchRoll(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-48"
              />
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {isDoctor && (
              <Button onClick={() => navigate('/new-visit')}>
                <Plus className="h-4 w-4 mr-2" />
                New Visit
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalStudents || 0}</div>
              <p className="text-xs text-muted-foreground">In the system</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Visits Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.visitsToday || 0}</div>
              <p className="text-xs text-muted-foreground">Health centre visits</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Follow-ups</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{stats?.pendingFollowUps || 0}</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">On Medical Leave</CardTitle>
              <Bed className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{medicalLeaveStudents.filter((s: any) => s.status === 'on_leave').length}</div>
              <p className="text-xs text-muted-foreground">Currently on leave</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Visits - with expandable rows */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Recent Visits
              </CardTitle>
              <CardDescription>Latest health centre visits{isMentor ? ' by your mentees' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {isMentor ? (
                  mentorRecentVisits.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No recent visits by your mentees</p>
                    </div>
                  ) : (
                    mentorRecentVisits.map((visit) => (
                      <Collapsible key={visit.id} open={expandedVisits.has(visit.id)} onOpenChange={() => toggleExpanded(expandedVisits, setExpandedVisits, visit.id)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              {expandedVisits.has(visit.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <div>
                                <p className="font-medium text-sm">{visit.student_name}</p>
                                <p className="text-xs text-muted-foreground">{visit.student_roll}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="secondary" className="text-xs">{formatReasonCategory(visit.reason_category)}</Badge>
                              <p className="text-xs text-muted-foreground mt-1">{format(new Date(visit.visit_date), 'MMM d, yyyy')}</p>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-7 mr-3 mb-2 p-3 rounded-md bg-muted/30 border-l-2 border-primary/30 space-y-2 text-sm">
                            {visit.reason_notes && <div><span className="text-muted-foreground">Complaint:</span> <span>{visit.reason_notes}</span></div>}
                            {visit.diagnosis && <div><span className="text-muted-foreground">Diagnosis:</span> <span>{visit.diagnosis}</span></div>}
                            {visit.prescription && <div><span className="text-muted-foreground">Prescription:</span> <span>{visit.prescription}</span></div>}
                            {visit.follow_up_required && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Follow-up: {visit.follow_up_date ? format(new Date(visit.follow_up_date), 'MMM d') : 'TBD'}
                              </Badge>
                            )}
                            <div className="flex gap-3 pt-1">
                              {visit.student_email && <a href={`mailto:${visit.student_email}`} className="text-xs text-primary hover:underline">Email</a>}
                              {visit.student_phone && <a href={`tel:${visit.student_phone}`} className="text-xs text-primary hover:underline">Call</a>}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  )
                ) : (
                  doctorRecentVisits.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No recent visits</p>
                  ) : (
                    doctorRecentVisits.map((visit: any) => (
                      <Collapsible key={visit.id} open={expandedVisits.has(visit.id)} onOpenChange={() => toggleExpanded(expandedVisits, setExpandedVisits, visit.id)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              {expandedVisits.has(visit.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <div>
                                <p className="font-medium text-sm">{visit.students?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{visit.students?.roll_number}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="secondary" className="text-xs">{formatReasonCategory(visit.reason_category)}</Badge>
                              <p className="text-xs text-muted-foreground mt-1">{format(new Date(visit.visit_date), 'MMM d, yyyy')}</p>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-7 mr-3 mb-2 p-3 rounded-md bg-muted/30 border-l-2 border-primary/30 space-y-2 text-sm">
                            {visit.reason_notes && <div><span className="text-muted-foreground">Complaint:</span> <span>{visit.reason_notes}</span></div>}
                            {visit.diagnosis && <div><span className="text-muted-foreground">Diagnosis:</span> <span>{visit.diagnosis}</span></div>}
                            {visit.prescription && <div><span className="text-muted-foreground">Prescription:</span> <span>{visit.prescription}</span></div>}
                            {visit.medical_officers?.name && <div><span className="text-muted-foreground">Doctor:</span> <span>{visit.medical_officers.name}</span></div>}
                            {visit.follow_up_required && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Follow-up: {visit.follow_up_date ? format(new Date(visit.follow_up_date), 'MMM d') : 'TBD'}
                              </Badge>
                            )}
                            <div className="flex gap-3 pt-1">
                              {visit.students?.roll_number && (
                                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate(`/student-profile/${visit.students.roll_number}`)}>
                                  View Full Profile →
                                </Button>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Students Needing Attention - with expandable rows */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Students Needing Attention
              </CardTitle>
              <CardDescription>Students with frequent visits (3+ in 3 months)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {isMentor ? (
                  studentsNeedingAttention.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No students require attention currently</p>
                    </div>
                  ) : (
                    studentsNeedingAttention.map((student) => (
                      <Collapsible key={student.student_id} open={expandedAttention.has(student.student_id)} onOpenChange={() => toggleExpanded(expandedAttention, setExpandedAttention, student.student_id)}>
                        <CollapsibleTrigger asChild>
                          <div className={`flex items-center justify-between p-3 rounded-lg border-l-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                            student.risk_level === 'high' ? 'border-l-destructive bg-destructive/5' : student.risk_level === 'medium' ? 'border-l-amber-500 bg-amber-500/5' : 'border-l-muted-foreground'
                          }`}>
                            <div className="flex items-center gap-3">
                              {expandedAttention.has(student.student_id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <div>
                                <p className="font-medium text-sm">{student.full_name}</p>
                                <p className="text-xs text-muted-foreground">{student.roll_number} · {student.batch}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{student.primary_concern}</Badge>
                              <Badge variant="destructive" className="text-xs">{student.visit_count} visits</Badge>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-7 mr-3 mb-2 p-3 rounded-md bg-muted/30 border-l-2 border-primary/30 space-y-2 text-sm">
                            {student.branch && <div><span className="text-muted-foreground">Branch:</span> <span>{student.branch}</span></div>}
                            <div><span className="text-muted-foreground">Last Visit:</span> <span>{format(new Date(student.last_visit), 'MMM d, yyyy')}</span></div>
                            <div className="flex gap-3 pt-1">
                              {student.email && <a href={`mailto:${student.email}`} className="text-xs text-primary hover:underline">{student.email}</a>}
                              {student.phone && <a href={`tel:${student.phone}`} className="text-xs text-primary hover:underline">{student.phone}</a>}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  )
                ) : (
                  doctorAttentionStudents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No students with frequent visits</p>
                    </div>
                  ) : (
                    doctorAttentionStudents.map((student: any) => (
                      <Collapsible key={student.student_id} open={expandedAttention.has(student.student_id)} onOpenChange={() => toggleExpanded(expandedAttention, setExpandedAttention, student.student_id)}>
                        <CollapsibleTrigger asChild>
                          <div className={`flex items-center justify-between p-3 rounded-lg border-l-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                            student.risk_level === 'high' ? 'border-l-destructive bg-destructive/5' : student.risk_level === 'medium' ? 'border-l-amber-500 bg-amber-500/5' : 'border-l-muted-foreground'
                          }`}>
                            <div className="flex items-center gap-3">
                              {expandedAttention.has(student.student_id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <div>
                                <p className="font-medium text-sm">{student.full_name}</p>
                                <p className="text-xs text-muted-foreground">{student.roll_number} · {student.batch}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{formatReasonCategory(student.primary_concern)}</Badge>
                              <Badge variant="destructive" className="text-xs">{student.visit_count} visits</Badge>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-7 mr-3 mb-2 p-3 rounded-md bg-muted/30 border-l-2 border-primary/30 space-y-3 text-sm">
                            {student.branch && <div><span className="text-muted-foreground">Branch:</span> <span>{student.branch}</span></div>}
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">Recent Visit History:</p>
                              {student.recent_visits.map((v: any, i: number) => (
                                <div key={v.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-background border">
                                  <span>{format(new Date(v.visit_date), 'MMM d, yyyy')}</span>
                                  <Badge variant="outline" className="text-xs">{formatReasonCategory(v.reason_category)}</Badge>
                                </div>
                              ))}
                            </div>
                            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate(`/student-profile/${student.roll_number}`)}>
                              View Full Profile →
                            </Button>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Students on Medical Leave */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bed className="h-5 w-5 text-primary" />
              Students on Medical Leave
            </CardTitle>
            <CardDescription>Active medical leave cases — click to expand details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {medicalLeaveStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No active medical leave cases</p>
                </div>
              ) : (
                medicalLeaveStudents.map((leave: any) => {
                  const student = leave.students;
                  const doctor = leave.medical_officers;
                  const daysUntilReturn = leave.expected_return_date
                    ? differenceInDays(new Date(leave.expected_return_date), new Date())
                    : null;
                  const statusColor: Record<string, string> = {
                    doctor_referred: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                    student_form_pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                    on_leave: 'bg-destructive/10 text-destructive',
                    return_pending: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                  };
                  const statusLabel: Record<string, string> = {
                    doctor_referred: 'Doctor Referred',
                    student_form_pending: 'Form Pending',
                    on_leave: 'On Leave',
                    return_pending: 'Return Pending',
                  };

                  return (
                    <Collapsible key={leave.id} open={expandedLeave.has(leave.id)} onOpenChange={() => toggleExpanded(expandedLeave, setExpandedLeave, leave.id)}>
                      <CollapsibleTrigger asChild>
                        <div className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                          leave.health_priority === 'high' ? 'border-l-4 border-l-destructive' : leave.health_priority === 'medium' ? 'border-l-4 border-l-amber-500' : ''
                        }`}>
                          <div className="flex items-center gap-3">
                            {expandedLeave.has(leave.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <div>
                              <p className="font-medium text-sm">{student?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{student?.roll_number} · {student?.branch || student?.program}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${statusColor[leave.status] || ''}`}>
                              {statusLabel[leave.status] || leave.status}
                            </Badge>
                            {daysUntilReturn !== null && leave.status === 'on_leave' && (
                              <Badge variant="outline" className={`text-xs ${daysUntilReturn <= 1 ? 'border-destructive text-destructive' : ''}`}>
                                {daysUntilReturn <= 0 ? 'Overdue' : `${daysUntilReturn}d left`}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-7 mr-3 mb-2 p-3 rounded-md bg-muted/30 border-l-2 border-primary/30 space-y-2 text-sm">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div><span className="text-muted-foreground">Hospital:</span> <span>{leave.referral_hospital}</span></div>
                            <div><span className="text-muted-foreground">Duration:</span> <span>{leave.expected_duration}</span></div>
                            {leave.leave_start_date && <div><span className="text-muted-foreground">Leave Start:</span> <span>{format(new Date(leave.leave_start_date), 'MMM d, yyyy')}</span></div>}
                            {leave.expected_return_date && <div><span className="text-muted-foreground">Expected Return:</span> <span>{format(new Date(leave.expected_return_date), 'MMM d, yyyy')}</span></div>}
                            {doctor?.name && <div><span className="text-muted-foreground">Referring Doctor:</span> <span>{doctor.name}</span></div>}
                            {leave.health_priority && <div><span className="text-muted-foreground">Priority:</span> <Badge variant={leave.health_priority === 'high' ? 'destructive' : 'secondary'} className="text-xs ml-1">{leave.health_priority}</Badge></div>}
                          </div>
                          {leave.illness_description && (
                            <div className="pt-1 border-t">
                              <span className="text-muted-foreground">Illness:</span> <span>{leave.illness_description}</span>
                            </div>
                          )}
                          {leave.doctor_notes && (
                            <div>
                              <span className="text-muted-foreground">Doctor Notes:</span> <span>{leave.doctor_notes}</span>
                            </div>
                          )}
                          {leave.accompanist_name && (
                            <div>
                              <span className="text-muted-foreground">Accompanist:</span> <span>{leave.accompanist_name} ({leave.accompanist_type})</span>
                              {leave.accompanist_contact && <span className="ml-2">· {leave.accompanist_contact}</span>}
                            </div>
                          )}
                          <div className="flex gap-3 pt-1">
                            {student?.email && <a href={`mailto:${student.email}`} className="text-xs text-primary hover:underline">Email Student</a>}
                            {student?.phone && <a href={`tel:${student.phone}`} className="text-xs text-primary hover:underline">Call Student</a>}
                            {student?.roll_number && (
                              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate(`/student-profile/${student.roll_number}`)}>
                                View Profile →
                              </Button>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Health Records Section */}
        <HealthRecordsSection />
      </div>
      <Footer />

      {/* Reschedule Dialog */}
      {rescheduleApt && (
        <RescheduleDialog
          open={!!rescheduleApt}
          onOpenChange={(open) => {
            if (!open) {
              setRescheduleApt(null);
              fetchStudentAppointments();
            }
          }}
          appointmentId={rescheduleApt.id}
          currentDate={rescheduleApt.appointment_date}
          currentTime={rescheduleApt.appointment_time}
          doctorName={rescheduleApt.doctor_name || 'Doctor'}
        />
      )}
    </div>
  );
};

export default HealthDashboard;
