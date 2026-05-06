import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  User, Mail, Phone, GraduationCap, Building2, Calendar, Users,
  Activity, AlertCircle, Settings, Bell, Shield, Heart,
  Droplets, Edit3, Save, X, CheckCircle, BookOpen, FileText, Pill, Printer, ClipboardList, Camera, Loader2,
  TestTube, Download, Clock, FileCheck, Award, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { printDocument, getNitwHeaderHtml } from '@/lib/print/printDocument';
import LabReportViewer, { openLabReport, printLabReport } from '@/components/lab/LabReportViewer';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProfileCompletionIndicator from '@/components/profile/ProfileCompletionIndicator';
import LeaveApprovalWorkflowTimeline, { type ApprovalWorkflowRow } from '@/components/medical-leave/LeaveApprovalWorkflowTimeline';

interface StudentData {
  id: string;
  full_name: string;
  roll_number: string;
  email: string | null;
  phone: string | null;
  program: string;
  branch: string | null;
  batch: string;
  year_of_study: string | null;
  mentor_name: string | null;
  mentor_email: string | null;
  mentor_contact: string | null;
  photo_url: string | null;
  mentors: { name: string; email: string | null; phone: string | null; department: string } | null;
}

interface StudentHealthProfile {
  blood_group: string | null;
  known_allergies: string | null;
  current_medications: string | null;
  has_previous_health_issues: boolean | null;
  previous_health_details: string | null;
  emergency_contact: string | null;
  emergency_relationship: string | null;
  father_name: string | null;
  father_contact: string | null;
  mother_name: string | null;
  mother_contact: string | null;
  covid_vaccination_status: string | null;
}

interface PrescriptionItem {
  id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  meal_timing: string | null;
}

interface StudentPrescription {
  id: string;
  created_at: string;
  diagnosis: string | null;
  notes: string | null;
  prescription_items: PrescriptionItem[];
}

interface VisitHistoryItem {
  id: string;
  visit_date: string;
  reason_category: string;
  reason_notes: string | null;
  diagnosis: string | null;
  prescription: string | null;
  follow_up_required: boolean | null;
  doctor_name: string;
}

interface LabReport {
  id: string;
  test_name: string;
  status: string;
  notes: string | null;
  report_file_url: string | null;
  report_file_name: string | null;
  created_at: string;
  updated_at: string;
  doctor_name: string;
}

interface ReferralLetter {
  id: string;
  referral_hospital: string;
  illness_description: string | null;
  doctor_notes: string | null;
  expected_duration: string;
  leave_start_date: string | null;
  expected_return_date: string | null;
  status: string;
  health_priority: string | null;
  referral_date: string;
  referral_type: string[] | null;
  doctor_name: string;
  created_at: string;
}

interface MedicalCertificate {
  id: string;
  referral_hospital: string;
  illness_description: string | null;
  doctor_notes: string | null;
  expected_duration: string;
  leave_start_date: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;
  status: string;
  health_priority: string | null;
  referral_date: string;
  doctor_name: string;
  doctor_designation: string;
  doctor_qualification: string;
  created_at: string;
  approval_date: string | null;
  doctor_clearance: boolean | null;
  doctor_clearance_date: string | null;
  rest_days: number | null;
}

type CertificateCategory = 'all' | 'medical_leave' | 'fitness' | 'referral';

const MEAL_LABELS: Record<string, string> = {
  before_meal: 'Before Meal',
  after_meal: 'After Meal',
  with_meal: 'With Meal',
  empty_stomach: 'Empty Stomach',
  any_time: 'Any Time',
  bedtime: 'At Bedtime',
};
export default function StudentProfilePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const getDefaultTab = () => {
    const tab = searchParams.get('tab');
    if (tab === 'settings') return 'settings';
    if (tab === 'prescriptions' || tab === 'records' || tab === 'certificates' || tab === 'labtests' || tab === 'referrals') return 'records';
    return 'profile';
  };
  const getDefaultSubTab = () => {
    const tab = searchParams.get('tab');
    if (tab === 'prescriptions') return 'prescriptions';
    if (tab === 'certificates') return 'certificates';
    if (tab === 'labtests') return 'labtests';
    if (tab === 'referrals') return 'referrals';
    return 'visits';
  };
  const [activeTab, setActiveTab] = useState(getDefaultTab());
  const [recordsSubTab, setRecordsSubTab] = useState(getDefaultSubTab());
  const [certCategory, setCertCategory] = useState<CertificateCategory>('all');

  // Sync tab state when URL params change (e.g. navigating from header)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'settings') setActiveTab('settings');
    else if (['prescriptions', 'records', 'certificates', 'labtests', 'referrals'].includes(tab || '')) {
      setActiveTab('records');
      if (tab === 'prescriptions') setRecordsSubTab('prescriptions');
      else if (tab === 'certificates') setRecordsSubTab('certificates');
      else if (tab === 'labtests') setRecordsSubTab('labtests');
      else if (tab === 'referrals') setRecordsSubTab('referrals');
      else setRecordsSubTab('visits');
    } else setActiveTab('profile');
  }, [searchParams]);
  const { user, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [student, setStudent] = useState<StudentData | null>(null);
  const [healthProfile, setHealthProfile] = useState<StudentHealthProfile | null>(null);
  const [healthStats, setHealthStats] = useState({ totalVisits: 0, thisMonthVisits: 0, pendingFollowups: 0, lastVisitDate: null as string | null });
  const [prescriptions, setPrescriptions] = useState<StudentPrescription[]>([]);
  const [visitHistory, setVisitHistory] = useState<VisitHistoryItem[]>([]);
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [referralLetters, setReferralLetters] = useState<ReferralLetter[]>([]);
  const [certificates, setCertificates] = useState<MedicalCertificate[]>([]);
  const [previewCertificate, setPreviewCertificate] = useState<MedicalCertificate | null>(null);
  const [viewingLabReport, setViewingLabReport] = useState<LabReport | null>(null);
  const [workflowsByLeave, setWorkflowsByLeave] = useState<Record<string, ApprovalWorkflowRow>>({});
  const [loading, setLoading] = useState(true);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Settings state
  const [notifAppointments, setNotifAppointments] = useState(true);
  const [notifFollowups, setNotifFollowups] = useState(true);
  const [notifLeave, setNotifLeave] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [language, setLanguage] = useState('en');
  const [privacyMentor, setPrivacyMentor] = useState(true);

  useEffect(() => {
    if (!roleLoading && !user) navigate('/auth');
  }, [user, roleLoading, navigate]);

  useEffect(() => {
    if (user && !roleLoading) fetchData();
  }, [user, roleLoading]);

  const fetchData = async () => {
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select(`
          id, full_name, roll_number, email, phone, program, branch, batch, year_of_study,
          mentor_name, mentor_email, mentor_contact, photo_url,
          mentors ( name, email, phone, department )
        `)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (studentData) {
        setStudent(studentData as StudentData);
        setEditPhone(studentData.phone || '');
        setEditEmail(studentData.email || '');

        const [profileRes, visitsRes, prescriptionsRes, completedApptsRes, labReportsRes] = await Promise.all([
          supabase.from('student_profiles').select('*').eq('student_id', studentData.id).maybeSingle(),
          supabase.from('health_visits').select('id, visit_date, follow_up_required, reason_category, reason_notes, diagnosis, prescription, doctor_id').eq('student_id', studentData.id).order('visit_date', { ascending: false }),
          supabase.from('prescriptions')
            .select(`id, created_at, diagnosis, notes, prescription_items ( id, medicine_name, dosage, frequency, duration, instructions, meal_timing )`)
            .eq('student_id', studentData.id)
            .order('created_at', { ascending: false }),
          supabase.from('appointments')
            .select('id, appointment_date')
            .eq('patient_id', user!.id)
            .eq('status', 'completed'),
          supabase.from('lab_reports')
            .select('id, test_name, status, notes, report_file_url, report_file_name, created_at, updated_at, doctor_id')
            .eq('student_id', studentData.id)
            .order('created_at', { ascending: false }),
        ]);

        setHealthProfile(profileRes.data as StudentHealthProfile | null);
        setPrescriptions((prescriptionsRes.data as unknown as StudentPrescription[]) || []);

        const visits = visitsRes.data || [];
        const completedAppts = completedApptsRes.data || [];

        // Build visit history with doctor names
        const doctorIds = visits.filter((v: any) => v.doctor_id).map((v: any) => v.doctor_id);
        let doctorMap: Record<string, string> = {};
        if (doctorIds.length > 0) {
          const { data: docs } = await supabase.from('medical_officers').select('id, name').in('id', doctorIds);
          docs?.forEach(d => { doctorMap[d.id] = d.name; });
        }

        // Process lab reports with doctor names
        const labDoctorIds = (labReportsRes.data || []).filter((r: any) => r.doctor_id).map((r: any) => r.doctor_id);
        const allDocIds = [...new Set([...doctorIds, ...labDoctorIds])];
        if (allDocIds.length > 0 && labDoctorIds.length > 0) {
          const { data: labDocs } = await supabase.from('medical_officers').select('id, name').in('id', labDoctorIds);
          labDocs?.forEach(d => { doctorMap[d.id] = d.name; });
        }

        setLabReports((labReportsRes.data || []).map((r: any) => ({
          ...r,
          doctor_name: r.doctor_id ? doctorMap[r.doctor_id] || 'Doctor' : 'Health Centre',
        })));

        // Fetch referral letters
        const { data: referralData } = await supabase
          .from('medical_leave_requests')
          .select('id, referral_hospital, illness_description, doctor_notes, expected_duration, leave_start_date, expected_return_date, actual_return_date, status, health_priority, referral_date, referral_type, referring_doctor_id, approved_by_doctor_id, approval_date, created_at, doctor_clearance, doctor_clearance_date, rest_days')
          .eq('student_id', studentData.id)
          .order('created_at', { ascending: false });

        if (referralData) {
          const refDoctorIds = referralData.filter(r => r.referring_doctor_id).map(r => r.referring_doctor_id!);
          if (refDoctorIds.length > 0) {
            const { data: refDocs } = await supabase.from('medical_officers').select('id, name').in('id', refDoctorIds);
            refDocs?.forEach(d => { doctorMap[d.id] = d.name; });
          }
          setReferralLetters(referralData.map(r => ({
            ...r,
            referral_date: r.referral_date || r.created_at,
            doctor_name: r.referring_doctor_id ? doctorMap[r.referring_doctor_id] || 'Doctor' : 'Health Centre',
          })));

          // Fetch approval workflows for all referrals (RLS scoped to this student)
          const referralIds = referralData.map(r => r.id);
          if (referralIds.length > 0) {
            const { data: wfData } = await supabase
              .from('leave_approval_workflow')
              .select('*')
              .in('medical_leave_request_id', referralIds);
            const map: Record<string, ApprovalWorkflowRow> = {};
            (wfData || []).forEach((w: any) => { map[w.medical_leave_request_id] = w as ApprovalWorkflowRow; });
            setWorkflowsByLeave(map);
          }


          // Build certificates from medical leave requests with doctor details
          const certDoctorIds = [...new Set(referralData.filter(r => r.referring_doctor_id || r.approved_by_doctor_id).flatMap(r => [r.referring_doctor_id, r.approved_by_doctor_id].filter(Boolean) as string[]))];
          let certDoctorDetails: Record<string, { name: string; designation: string; qualification: string }> = {};
          if (certDoctorIds.length > 0) {
            const { data: certDocs } = await supabase.from('medical_officers').select('id, name, designation, qualification').in('id', certDoctorIds);
            certDocs?.forEach(d => { certDoctorDetails[d.id] = { name: d.name, designation: d.designation, qualification: d.qualification }; });
          }
          setCertificates(referralData.map(r => {
            const docId = r.approved_by_doctor_id || r.referring_doctor_id;
            const doc = docId ? certDoctorDetails[docId] : null;
            return {
              id: r.id,
              referral_hospital: r.referral_hospital,
              illness_description: r.illness_description,
              doctor_notes: r.doctor_notes,
              expected_duration: r.expected_duration,
              leave_start_date: r.leave_start_date,
              expected_return_date: r.expected_return_date,
              actual_return_date: r.actual_return_date,
              status: r.status,
              health_priority: r.health_priority,
              referral_date: r.referral_date || r.created_at,
              doctor_name: doc?.name || 'Medical Officer',
              doctor_designation: doc?.designation || 'Medical Officer',
              doctor_qualification: doc?.qualification || 'MBBS',
              created_at: r.created_at,
              approval_date: r.approval_date,
              doctor_clearance: (r as any).doctor_clearance || null,
              doctor_clearance_date: (r as any).doctor_clearance_date || null,
              rest_days: (r as any).rest_days || null,
            };
          }));
        }


        const visitHistoryItems: VisitHistoryItem[] = visits.map((v: any) => ({
          id: v.id,
          visit_date: v.visit_date,
          reason_category: v.reason_category,
          reason_notes: v.reason_notes,
          diagnosis: v.diagnosis,
          prescription: v.prescription,
          follow_up_required: v.follow_up_required,
          doctor_name: v.doctor_id ? doctorMap[v.doctor_id] || 'Doctor' : 'Health Centre',
        }));

        // Also add completed appointments that aren't already covered
        if (completedAppts.length > 0) {
          const { data: completedFull } = await supabase
            .from('appointments')
            .select('id, appointment_date, reason, medical_officers(name)')
            .eq('patient_id', user!.id)
            .eq('status', 'completed')
            .order('appointment_date', { ascending: false });
          
          (completedFull || []).forEach((a: any) => {
            visitHistoryItems.push({
              id: a.id,
              visit_date: a.appointment_date,
              reason_category: 'routine_checkup',
              reason_notes: a.reason,
              diagnosis: null,
              prescription: null,
              follow_up_required: false,
              doctor_name: a.medical_officers?.name || 'Doctor',
            });
          });
        }

        // Sort by date descending
        visitHistoryItems.sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
        setVisitHistory(visitHistoryItems);

        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const totalVisits = visits.length + completedAppts.length;
        const thisMonthVisits = visits.filter((v: any) => new Date(v.visit_date) >= firstDayOfMonth).length +
          completedAppts.filter((a: any) => new Date(a.appointment_date) >= firstDayOfMonth).length;
        setHealthStats({
          totalVisits,
          thisMonthVisits,
          pendingFollowups: visits.filter((v: any) => v.follow_up_required).length,
          lastVisitDate: visits[0]?.visit_date ? format(new Date(visits[0].visit_date), 'MMM d, yyyy') :
            completedAppts[0]?.appointment_date ? format(new Date(completedAppts[0].appointment_date), 'MMM d, yyyy') : null,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async () => {
    if (!student) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({ phone: editPhone, email: editEmail })
        .eq('id', student.id);

      if (error) throw error;
      setStudent(prev => prev ? { ...prev, phone: editPhone, email: editEmail } : null);
      setIsEditing(false);
      setShowSaveConfirmation(true);
      toast({ title: '✅ Profile Saved Successfully', description: `Email: ${editEmail || '—'} | Phone: ${editPhone || '—'}` });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintStudentPrescription = async (rx: StudentPrescription) => {
    const items = rx.prescription_items || [];
    const prescriptionId = `RX-${rx.id.slice(0, 8).toUpperCase()}`;
    const dateStr = format(new Date(rx.created_at), 'PPP');

    const medicinesRows = items.length > 0
      ? items.map((m, i) => `<tr><td style="text-align:center">${i + 1}</td><td><strong>${m.medicine_name}</strong></td><td>${m.dosage}</td><td>${m.frequency}</td><td>${m.duration}</td><td>${MEAL_LABELS[m.meal_timing || ''] || m.meal_timing || '-'}</td><td>${m.instructions || '—'}</td></tr>`).join('')
      : `<tr><td colspan="7" style="text-align:center;color:#888;">No medicines prescribed</td></tr>`;

    const bodyHtml = `
      ${getNitwHeaderHtml('OUTPATIENT PRESCRIPTION')}
      <div class="doc-title"><h3>MEDICAL PRESCRIPTION</h3><div class="cert-no">Prescription No.: ${prescriptionId} | Date: ${dateStr}</div></div>
      <div class="ref-date"><span><strong>Patient:</strong> ${student?.full_name}</span><span><strong>Roll No:</strong> ${student?.roll_number}</span></div>
      ${rx.diagnosis ? `<div class="section"><div class="section-title">Diagnosis</div><div class="info-box" style="background:#f0f7ff;border-color:#cce0ff;">${rx.diagnosis}</div></div>` : ''}
      <div class="section"><div class="section-title">Prescribed Medicines (Rx)</div>
        <table><thead><tr><th style="width:30px">#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Meal Timing</th><th>Instructions</th></tr></thead><tbody>${medicinesRows}</tbody></table>
      </div>
      ${rx.notes ? `<div class="notes-box"><strong>Doctor's Notes:</strong> ${rx.notes}</div>` : ''}
      <div class="section" style="margin-top:16px;"><div class="section-title">Important Instructions</div>
        <ul style="font-size:11px;color:#444;padding-left:18px;line-height:1.8"><li>Complete the full course of medication even if you feel better.</li><li>Do not share medicines with others or self-medicate.</li><li>Report any adverse reactions to the Health Centre immediately.</li><li>Return for follow-up if symptoms persist beyond the prescription duration.</li></ul>
      </div>
      <div class="signature-section"><div class="emblem-area"><img src="/nitw-emblem.png" alt="NITW Emblem" /><div class="emblem-label">NIT Warangal</div></div><div class="signature-box"><div class="online-signature">Medical Officer</div><div class="signature-line"><strong>Medical Officer</strong><div class="doctor-type">NIT Warangal Health Centre</div></div></div></div>
      <div class="doc-footer"><p>This prescription is valid for 30 days from the date of issue.</p><p>NIT Warangal Health Centre | Phone: 0870-2462022 | healthcentre@nitw.ac.in</p></div>
    `;

    await printDocument({ title: `Prescription — ${student?.full_name}`, bodyHtml, documentId: prescriptionId, documentType: 'PRESCRIPTION' });
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !student || !user) return;
    
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please upload an image under 2MB.', variant: 'destructive' });
      return;
    }

    setUploadingPhoto(true);
    try {
      // Step 1: AI Photo Validation
      toast({ title: '🔍 Validating Photo...', description: 'AI is checking your photo for face visibility and authenticity.' });
      
      const imageBase64 = await convertFileToBase64(file);
      
      const { data: validationResult, error: validationError } = await supabase.functions.invoke('validate-photo', {
        body: { imageBase64 },
      });

      if (validationError) {
        console.error('Photo validation error:', validationError);
        toast({ title: '⚠️ Validation Unavailable', description: 'Could not validate photo. Please ensure it is a clear face photo.' });
        // Continue with upload if validation service fails
      } else if (validationResult && !validationResult.valid) {
        const checks = validationResult.checks || {};
        let details = validationResult.reason || 'Photo did not pass validation.';
        
        if (!checks.face_visible) {
          details = '❌ No clear face detected. Please upload a photo with your face clearly visible (front-facing, no sunglasses or masks).';
        } else if (!checks.real_photo) {
          details = '❌ This appears to be a downloaded or fake image. Please upload a real photo taken by your camera.';
        } else if (!checks.quality_ok) {
          details = '❌ Photo quality is too low. Please upload a clearer, well-lit photo.';
        } else if (!checks.appropriate) {
          details = '❌ This photo is not appropriate for an official profile. Please upload a suitable photo.';
        }

        toast({ 
          title: '🚫 Photo Rejected', 
          description: details,
          variant: 'destructive',
          duration: 8000,
        });
        setUploadingPhoto(false);
        // Reset input
        if (e.target) e.target.value = '';
        return;
      } else {
        toast({ title: '✅ Photo Validated', description: 'AI verification passed! Uploading...' });
      }

      // Step 2: Upload to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/profile.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('student-photos')
        .getPublicUrl(filePath);

      const photoUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('students')
        .update({ photo_url: photoUrl })
        .eq('id', student.id);

      if (updateError) throw updateError;

      setStudent(prev => prev ? { ...prev, photo_url: photoUrl } : null);
      toast({ title: '✅ Photo Updated', description: 'Your profile photo has been uploaded successfully.' });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Upload Failed', description: err.message || 'Could not upload photo.', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePrintReferralLetter = async (ref: ReferralLetter) => {
    const docId = `REF-${ref.id.slice(0, 8).toUpperCase()}`;
    const dateStr = format(new Date(ref.referral_date), 'PPP');

    const bodyHtml = `
      ${getNitwHeaderHtml('MEDICAL REFERRAL LETTER')}
      <div class="doc-title">
        <h3>MEDICAL REFERRAL LETTER</h3>
        <div class="cert-no">Referral No.: ${docId} | Date: ${dateStr}</div>
      </div>
      <div class="ref-date">
        <span><strong>Patient:</strong> ${student?.full_name}</span>
        <span><strong>Roll No:</strong> ${student?.roll_number}</span>
      </div>
      <div class="info-grid" style="margin-bottom:16px;">
        <div class="info-item"><span class="info-label">Program:</span><span>${student?.program || '—'}</span></div>
        <div class="info-item"><span class="info-label">Branch:</span><span>${student?.branch || '—'}</span></div>
        <div class="info-item"><span class="info-label">Batch:</span><span>${student?.batch || '—'}</span></div>
        <div class="info-item"><span class="info-label">Year:</span><span>${student?.year_of_study || '—'}</span></div>
      </div>
      <div class="section">
        <div class="section-title">Referral Details</div>
        <div class="info-grid">
          <div class="info-item"><span class="info-label">Referred Hospital:</span><span>${ref.referral_hospital}</span></div>
          <div class="info-item"><span class="info-label">Expected Duration:</span><span>${ref.expected_duration}</span></div>
          ${ref.leave_start_date ? `<div class="info-item"><span class="info-label">Leave Start:</span><span>${format(new Date(ref.leave_start_date), 'PPP')}</span></div>` : ''}
          ${ref.expected_return_date ? `<div class="info-item"><span class="info-label">Expected Return:</span><span>${format(new Date(ref.expected_return_date), 'PPP')}</span></div>` : ''}
          ${ref.health_priority ? `<div class="info-item"><span class="info-label">Priority:</span><span>${ref.health_priority.charAt(0).toUpperCase() + ref.health_priority.slice(1)}</span></div>` : ''}
        </div>
      </div>
      ${ref.illness_description ? `<div class="section"><div class="section-title">Illness / Condition</div><div class="info-box" style="background:#f0f7ff;border-color:#cce0ff;">${ref.illness_description}</div></div>` : ''}
      ${ref.doctor_notes ? `<div class="notes-box"><strong>Doctor's Notes:</strong> ${ref.doctor_notes}</div>` : ''}
      ${ref.referral_type && ref.referral_type.length > 0 ? `<div class="section"><div class="section-title">Referral Type</div><p style="font-size:13px;">${ref.referral_type.join(', ')}</p></div>` : ''}
      <div class="section" style="margin-top:16px;">
        <div class="section-title">Instructions</div>
        <ul style="font-size:11px;color:#444;padding-left:18px;line-height:1.8">
          <li>Please carry this referral letter and your institute ID card to the hospital.</li>
          <li>Report back to the Health Centre after treatment/consultation.</li>
          <li>Submit discharge summary and medical reports upon return.</li>
          <li>Contact Health Centre for any queries: 0870-2462022</li>
        </ul>
      </div>
      <div class="signature-section">
        <div class="emblem-area"><img src="/nitw-emblem.png" alt="NITW Emblem" /><div class="emblem-label">NIT Warangal</div></div>
        <div class="signature-box">
          <div class="online-signature">Dr. ${ref.doctor_name}</div>
          <div class="signature-line">
            <strong>Dr. ${ref.doctor_name}</strong>
            <div class="doctor-type">Medical Officer, NIT Warangal Health Centre</div>
          </div>
        </div>
      </div>
      <div class="doc-footer">
        <p>This referral letter is valid for the specified duration only.</p>
        <p>NIT Warangal Health Centre | Phone: 0870-2462022 | healthcentre@nitw.ac.in</p>
      </div>
    `;

    await printDocument({ title: `Referral Letter — ${student?.full_name}`, bodyHtml, documentId: docId, documentType: 'REFERRAL LETTER' });
  };

  const handlePrintCertificate = async (cert: MedicalCertificate) => {
    const certNo = `MLC/${format(new Date(cert.created_at), 'yyyyMMdd')}/${cert.id.slice(0, 6).toUpperCase()}`;
    const dateStr = cert.approval_date ? format(new Date(cert.approval_date), 'PPP') : format(new Date(cert.created_at), 'PPP');

    const bodyHtml = `
      ${getNitwHeaderHtml('MEDICAL LEAVE CERTIFICATE')}
      <div class="doc-title">
        <h3>MEDICAL LEAVE CERTIFICATE</h3>
        <div class="cert-no">Certificate No.: ${certNo} | Date: ${dateStr}</div>
      </div>
      <div class="ref-date">
        <span><strong>Patient:</strong> ${student?.full_name}</span>
        <span><strong>Roll No:</strong> ${student?.roll_number}</span>
      </div>
      <div class="info-grid" style="margin-bottom:16px;">
        <div class="info-item"><span class="info-label">Program:</span><span>${student?.program || '—'}</span></div>
        <div class="info-item"><span class="info-label">Branch:</span><span>${student?.branch || '—'}</span></div>
        <div class="info-item"><span class="info-label">Batch:</span><span>${student?.batch || '—'}</span></div>
        <div class="info-item"><span class="info-label">Year:</span><span>${student?.year_of_study || '—'}</span></div>
      </div>
      <div class="section body-text">
        <p>This is to certify that <strong>${student?.full_name}</strong> (Roll No: <strong>${student?.roll_number}</strong>) was referred to <strong>${cert.referral_hospital}</strong> for medical treatment.</p>
        ${cert.illness_description ? `<p><strong>Illness / Condition:</strong> ${cert.illness_description}</p>` : ''}
        <div class="info-grid" style="margin:16px 0;">
          <div class="info-item"><span class="info-label">Referred Hospital:</span><span>${cert.referral_hospital}</span></div>
          <div class="info-item"><span class="info-label">Expected Duration:</span><span>${cert.expected_duration}</span></div>
          ${cert.leave_start_date ? `<div class="info-item"><span class="info-label">Leave From:</span><span>${format(new Date(cert.leave_start_date), 'PPP')}</span></div>` : ''}
          ${cert.expected_return_date ? `<div class="info-item"><span class="info-label">Expected Return:</span><span>${format(new Date(cert.expected_return_date), 'PPP')}</span></div>` : ''}
          ${cert.actual_return_date ? `<div class="info-item"><span class="info-label">Actual Return:</span><span>${format(new Date(cert.actual_return_date), 'PPP')}</span></div>` : ''}
          ${cert.health_priority ? `<div class="info-item"><span class="info-label">Priority:</span><span>${cert.health_priority.charAt(0).toUpperCase() + cert.health_priority.slice(1)}</span></div>` : ''}
        </div>
        ${cert.doctor_notes ? `<p><strong>Doctor's Notes:</strong> ${cert.doctor_notes}</p>` : ''}
        <p>The student is hereby granted medical leave for the above-mentioned period as per the medical assessment.</p>
      </div>
      <div class="signature-section">
        <div class="emblem-area"><img src="/nitw-emblem.png" alt="NITW Emblem" /><div class="emblem-label">NIT Warangal</div></div>
        <div class="signature-box" style="text-align:right;">
          <div class="online-signature">${cert.doctor_name}</div>
          <div class="signature-line">
            <strong>Dr. ${cert.doctor_name}</strong><br/>
            ${cert.doctor_designation}<br/>
            <span style="font-size:10px;">${cert.doctor_qualification}</span><br/>
            <span class="doctor-type">Health Centre, NIT Warangal</span>
          </div>
        </div>
      </div>
      <div class="doc-footer">
        <p>Date of Issue: ${format(new Date(), 'PPPP')}</p>
        <p>This certificate is valid for official purposes. For verification, contact Health Centre, NIT Warangal.</p>
        <p>NIT Warangal Health Centre | Phone: 0870-2462022 | healthcentre@nitw.ac.in</p>
      </div>
    `;

    await printDocument({ title: `Medical Leave Certificate — ${student?.full_name}`, bodyHtml, documentId: certNo, documentType: 'MEDICAL LEAVE CERTIFICATE' });
  };

  const handlePrintFitnessCertificate = async (cert: MedicalCertificate) => {
    const certNo = `FC/${format(new Date(), 'yyyyMMdd')}/${cert.id.slice(0, 6).toUpperCase()}`;
    const dateStr = cert.doctor_clearance_date ? format(new Date(cert.doctor_clearance_date), 'PPP') : format(new Date(), 'PPP');

    const bodyHtml = `
      ${getNitwHeaderHtml('FITNESS CERTIFICATE')}
      <div class="doc-title">
        <h3>FITNESS CERTIFICATE</h3>
        <div class="cert-no">Certificate No.: ${certNo} | Date: ${dateStr}</div>
      </div>
      <div class="ref-date">
        <span><strong>Patient:</strong> ${student?.full_name}</span>
        <span><strong>Roll No:</strong> ${student?.roll_number}</span>
      </div>
      <div class="info-grid" style="margin-bottom:16px;">
        <div class="info-item"><span class="info-label">Program:</span><span>${student?.program || '—'}</span></div>
        <div class="info-item"><span class="info-label">Branch:</span><span>${student?.branch || '—'}</span></div>
        <div class="info-item"><span class="info-label">Batch:</span><span>${student?.batch || '—'}</span></div>
        <div class="info-item"><span class="info-label">Year:</span><span>${student?.year_of_study || '—'}</span></div>
      </div>
      <div class="section body-text">
        <p>This is to certify that <strong>${student?.full_name}</strong> (Roll No: <strong>${student?.roll_number}</strong>) was on medical leave and was referred to <strong>${cert.referral_hospital}</strong> for treatment.</p>
        ${cert.illness_description ? `<p><strong>Condition:</strong> ${cert.illness_description}</p>` : ''}
        <div class="info-grid" style="margin:16px 0;">
          ${cert.leave_start_date ? `<div class="info-item"><span class="info-label">Leave From:</span><span>${format(new Date(cert.leave_start_date), 'PPP')}</span></div>` : ''}
          ${cert.actual_return_date ? `<div class="info-item"><span class="info-label">Returned On:</span><span>${format(new Date(cert.actual_return_date), 'PPP')}</span></div>` : ''}
          ${cert.doctor_clearance_date ? `<div class="info-item"><span class="info-label">Clearance Date:</span><span>${format(new Date(cert.doctor_clearance_date), 'PPP')}</span></div>` : ''}
          <div class="info-item"><span class="info-label">Duration:</span><span>${cert.expected_duration}</span></div>
        </div>
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:12px;margin:16px 0;">
          <p style="color:#065f46;font-weight:bold;margin-bottom:4px;">✅ FITNESS DECLARATION</p>
          <p>After thorough medical examination, the student has been found <strong>FIT</strong> to resume regular academic activities and classes.</p>
        </div>
        ${cert.doctor_notes ? `<p><strong>Doctor's Notes:</strong> ${cert.doctor_notes}</p>` : ''}
      </div>
      <div class="signature-section">
        <div class="emblem-area"><img src="/nitw-emblem.png" alt="NITW Emblem" /><div class="emblem-label">NIT Warangal</div></div>
        <div class="signature-box" style="text-align:right;">
          <div class="online-signature">${cert.doctor_name}</div>
          <div class="signature-line">
            <strong>Dr. ${cert.doctor_name}</strong><br/>
            ${cert.doctor_designation}<br/>
            <span style="font-size:10px;">${cert.doctor_qualification}</span><br/>
            <span class="doctor-type">Health Centre, NIT Warangal</span>
          </div>
        </div>
      </div>
      <div class="doc-footer">
        <p>Date of Issue: ${format(new Date(), 'PPPP')}</p>
        <p>This certificate confirms the student's fitness to attend classes. For verification, contact Health Centre, NIT Warangal.</p>
        <p>NIT Warangal Health Centre | Phone: 0870-2462022 | healthcentre@nitw.ac.in</p>
      </div>
    `;

    await printDocument({ title: `Fitness Certificate — ${student?.full_name}`, bodyHtml, documentId: certNo, documentType: 'FITNESS CERTIFICATE' });
  };

  const profileFields = student ? [
    { name: 'fullName', label: 'Full Name', filled: !!student.full_name, required: true },
    { name: 'rollNumber', label: 'Roll Number', filled: !!student.roll_number, required: true },
    { name: 'email', label: 'Email', filled: !!student.email, required: true },
    { name: 'phone', label: 'Phone', filled: !!student.phone, required: true },
    { name: 'program', label: 'Program', filled: !!student.program, required: true },
    { name: 'batch', label: 'Batch', filled: !!student.batch, required: true },
    { name: 'branch', label: 'Branch/Department', filled: !!student.branch, required: false },
    { name: 'yearOfStudy', label: 'Year of Study', filled: !!student.year_of_study, required: false },
    { name: 'mentorName', label: 'Mentor Name', filled: !!(student.mentors?.name || student.mentor_name), required: true },
  ] : [];

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto p-8 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
        <Footer />
      </div>
    );
  }

  const mentorName = student?.mentors?.name || student?.mentor_name;
  const mentorEmail = student?.mentors?.email || student?.mentor_email;
  const mentorPhone = student?.mentors?.phone || student?.mentor_contact;
  const mentorDept = student?.mentors?.department;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground text-sm">Manage your personal information and preferences</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/health-dashboard">← Dashboard</Link>
          </Button>
        </div>

        {/* Profile Hero */}
        <Card className="bg-gradient-to-br from-primary/5 via-primary/8 to-primary/12 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-primary/30">
                  {student?.photo_url ? (
                    <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <GraduationCap className="w-10 h-10 text-primary" />
                  )}
                </div>
                <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploadingPhoto ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />
                </label>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground">{student?.full_name || 'Student'}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary" className="text-sm">
                    {student?.program}{student?.batch ? ` - ${student.batch}` : ''}
                  </Badge>
                  {student?.year_of_study && (
                    <Badge variant="outline">{student.year_of_study} Year</Badge>
                  )}
                  {student?.branch && (
                    <Badge variant="outline">{student.branch}</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-2">Roll No: <span className="font-semibold text-foreground">{student?.roll_number}</span></p>
              </div>
              {/* Health Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-background/60 border text-center min-w-[70px]">
                  <p className="text-2xl font-bold text-foreground">{healthStats.totalVisits}</p>
                  <p className="text-xs text-muted-foreground">Total Visits</p>
                </div>
                <div className="p-3 rounded-lg bg-background/60 border text-center min-w-[70px]">
                  <p className="text-2xl font-bold text-foreground">{healthStats.thisMonthVisits}</p>
                  <p className="text-xs text-muted-foreground">This Month</p>
                </div>
                <div
                  className="p-3 rounded-lg bg-background/60 border text-center min-w-[70px] cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => setActiveTab('records')}
                >
                  <p className="text-2xl font-bold text-foreground">{prescriptions.length}</p>
                  <p className="text-xs text-muted-foreground">Prescriptions</p>
                </div>
                {healthStats.pendingFollowups > 0 && (
                  <div className="col-span-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-center">
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                      <AlertCircle className="w-3 h-3 inline mr-1" />
                      {healthStats.pendingFollowups} Pending Follow-up
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="records" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Health Records
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* ── PROFILE TAB ── */}
          <TabsContent value="profile" className="mt-4 space-y-4">
            {/* Profile Completion */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Profile Completion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProfileCompletionIndicator fields={profileFields} />
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/student/register">
                    <Edit3 className="w-3 h-3 mr-1" />
                    Edit Full Profile
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Save Confirmation */}
            {showSaveConfirmation && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-800 dark:text-green-200">Profile Saved Successfully</p>
                      <div className="mt-2 text-sm space-y-1 text-green-700 dark:text-green-300">
                        <p><strong>Name:</strong> {student?.full_name}</p>
                        <p><strong>Roll No:</strong> {student?.roll_number}</p>
                        <p><strong>Email:</strong> {student?.email || '—'}</p>
                        <p><strong>Phone:</strong> {student?.phone || '—'}</p>
                        <p><strong>Program:</strong> {student?.program} · {student?.batch}</p>
                        {student?.branch && <p><strong>Branch:</strong> {student.branch}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-green-700 hover:text-green-900"
                        onClick={() => setShowSaveConfirmation(false)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Personal Information */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Personal Information
                  </CardTitle>
                  {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit3 className="w-3 h-3 mr-1" />Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveContact} disabled={saving}>
                        <Save className="w-3 h-3 mr-1" />
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditPhone(student?.phone || ''); setEditEmail(student?.email || ''); }}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Roll Number</p>
                      <p className="font-medium">{student?.roll_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Program / Batch</p>
                      <p className="font-medium">{student?.program} · {student?.batch}</p>
                    </div>
                  </div>
                  {student?.branch && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <GraduationCap className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Branch / Department</p>
                        <p className="font-medium">{student.branch}</p>
                      </div>
                    </div>
                  )}
                  {student?.year_of_study && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Year of Study</p>
                        <p className="font-medium">Year {student.year_of_study}</p>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Editable fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email Address
                    </Label>
                    {isEditing ? (
                      <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="your@email.com" />
                    ) : (
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="font-medium text-sm">{student?.email || <span className="text-muted-foreground italic">Not provided</span>}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone Number
                    </Label>
                    {isEditing ? (
                      <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+91 XXXXXXXXXX" />
                    ) : (
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="font-medium text-sm">{student?.phone || <span className="text-muted-foreground italic">Not provided</span>}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Faculty Mentor */}
            {mentorName && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Faculty Mentor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground text-lg">{mentorName}</p>
                      {mentorDept && <p className="text-sm text-muted-foreground">{mentorDept}</p>}
                      <div className="mt-2 space-y-1">
                        {mentorEmail && (
                          <a href={`mailto:${mentorEmail}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                            <Mail className="w-3 h-3" />{mentorEmail}
                          </a>
                        )}
                        {mentorPhone && (
                          <a href={`tel:${mentorPhone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                            <Phone className="w-3 h-3" />{mentorPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Medical Info */}
            {healthProfile && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Heart className="w-4 h-4 text-destructive" />
                    Medical Information
                  </CardTitle>
                  <CardDescription>Basic health data on record</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {healthProfile.blood_group && (
                      <div className="p-3 rounded-lg bg-destructive/5 border text-center">
                        <Droplets className="h-5 w-5 text-destructive mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Blood Group</p>
                        <p className="font-bold text-lg">{healthProfile.blood_group}</p>
                      </div>
                    )}
                    {healthProfile.covid_vaccination_status && (
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border text-center">
                        <Shield className="h-5 w-5 text-green-600 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">COVID Vaccine</p>
                        <p className="font-medium text-sm">{healthProfile.covid_vaccination_status}</p>
                      </div>
                    )}
                    {healthProfile.emergency_contact && (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border text-center">
                        <AlertCircle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Emergency</p>
                        <p className="font-medium text-sm truncate">{healthProfile.emergency_contact}</p>
                      </div>
                    )}
                    <div className="p-3 rounded-lg bg-muted/50 border text-center">
                      <Activity className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Last Visit</p>
                      <p className="font-medium text-sm">{healthStats.lastVisitDate || '—'}</p>
                    </div>
                  </div>
                  {healthProfile.known_allergies && (
                    <div className="mt-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <p className="text-xs font-medium text-destructive mb-1">⚠ Known Allergies</p>
                      <p className="text-sm">{healthProfile.known_allergies}</p>
                    </div>
                  )}
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link to="/student/register">Update Medical Info</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── HEALTH RECORDS TAB ── */}
          <TabsContent value="records" className="mt-4 space-y-4">
            {/* Sub-tabs for Visit History and Prescriptions */}
            <div className="flex gap-2 p-1 bg-muted/50 rounded-lg w-fit">
              <Button
                variant={recordsSubTab === 'visits' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setRecordsSubTab('visits')}
                className="flex items-center gap-2"
              >
                <ClipboardList className="w-4 h-4" />
                Visit History ({visitHistory.length})
              </Button>
              <Button
                variant={recordsSubTab === 'prescriptions' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setRecordsSubTab('prescriptions')}
                className="flex items-center gap-2"
              >
                <Pill className="w-4 h-4" />
                Prescriptions ({prescriptions.length})
              </Button>
              <Button
                variant={recordsSubTab === 'labtests' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setRecordsSubTab('labtests')}
                className="flex items-center gap-2"
              >
                <TestTube className="w-4 h-4" />
                Lab Tests ({labReports.length})
              </Button>
              <Button
                variant={recordsSubTab === 'referrals' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setRecordsSubTab('referrals')}
                className="flex items-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                Referral Letters ({referralLetters.length})
              </Button>
              <Button
                variant={recordsSubTab === 'certificates' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setRecordsSubTab('certificates')}
                className="flex items-center gap-2"
              >
                <Award className="w-4 h-4" />
                Certificates ({certificates.length})
              </Button>
            </div>

            {/* Visit History Sub-tab */}
            {recordsSubTab === 'visits' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    Visit History
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {visitHistory.length} visit{visitHistory.length !== 1 ? 's' : ''} on record
                  </p>
                </CardHeader>
                <CardContent>
                  {visitHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No visit history yet</p>
                      <p className="text-sm">Your health centre visits will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visitHistory.map((visit) => (
                        <div key={visit.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                          <div>
                            <p className="font-medium text-sm">
                              {visit.reason_notes || visit.reason_category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            <p className="text-xs text-muted-foreground">{visit.doctor_name}</p>
                            {visit.diagnosis && (
                              <p className="text-xs text-muted-foreground mt-0.5">Diagnosis: {visit.diagnosis}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-muted-foreground">{format(new Date(visit.visit_date), 'MMM d, yyyy')}</p>
                            {visit.follow_up_required && (
                              <Badge variant="secondary" className="text-xs mt-1">Follow-up</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Prescriptions Sub-tab */}
            {recordsSubTab === 'prescriptions' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Pill className="w-4 h-4 text-primary" />
                    Prescription History
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} on record
                  </p>
                </CardHeader>
                <CardContent>
                  {prescriptions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Pill className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No prescriptions yet</p>
                      <p className="text-sm">Prescriptions from your health centre visits will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {prescriptions.map((rx) => (
                        <div key={rx.id} className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-foreground">
                                {format(new Date(rx.created_at), 'PPP')}
                              </p>
                              {rx.diagnosis && (
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  <strong>Diagnosis:</strong> {rx.diagnosis}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintStudentPrescription(rx)}
                            >
                              <Printer className="w-3 h-3 mr-1" />
                              Print
                            </Button>
                          </div>
                          {rx.prescription_items && rx.prescription_items.length > 0 && (
                            <div className="rounded-md border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/50">
                                    <th className="text-left p-2 font-medium">#</th>
                                    <th className="text-left p-2 font-medium">Medicine</th>
                                    <th className="text-left p-2 font-medium">Dosage</th>
                                    <th className="text-left p-2 font-medium">Frequency</th>
                                    <th className="text-left p-2 font-medium">Duration</th>
                                    <th className="text-left p-2 font-medium">Timing</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rx.prescription_items.map((item, i) => (
                                    <tr key={item.id} className="border-t">
                                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                                      <td className="p-2 font-medium">{item.medicine_name}</td>
                                      <td className="p-2">{item.dosage}</td>
                                      <td className="p-2">{item.frequency}</td>
                                      <td className="p-2">{item.duration}</td>
                                      <td className="p-2">{MEAL_LABELS[item.meal_timing || ''] || item.meal_timing || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {rx.notes && (
                            <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2">
                              <strong>Notes:</strong> {rx.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Lab Tests Sub-tab */}
            {recordsSubTab === 'labtests' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TestTube className="w-4 h-4 text-primary" />
                    Lab Test Reports
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {labReports.length} lab test{labReports.length !== 1 ? 's' : ''} on record
                  </p>
                </CardHeader>
                <CardContent>
                  {labReports.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <TestTube className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No lab tests yet</p>
                      <p className="text-sm">Lab test reports prescribed by your doctor will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {labReports.map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              report.status === 'completed' ? 'bg-green-100 dark:bg-green-900/20' : 'bg-amber-100 dark:bg-amber-900/20'
                            }`}>
                              {report.status === 'completed' ? (
                                <FileCheck className="w-5 h-5 text-green-600" />
                              ) : (
                                <Clock className="w-5 h-5 text-amber-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{report.test_name}</p>
                              <p className="text-xs text-muted-foreground">
                                Prescribed by Dr. {report.doctor_name} · {format(new Date(report.created_at), 'MMM d, yyyy')}
                              </p>
                              {report.status === 'completed' && report.report_file_url && (
                                <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  PDF Report Available
                                </p>
                              )}
                              {report.status === 'completed' && !report.report_file_url && (
                                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                  <FileCheck className="w-3 h-3" />
                                  Results Available
                                </p>
                              )}
                              {report.status !== 'completed' && (
                                <p className="text-xs text-amber-600 mt-1">Report pending from lab</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={report.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                              {report.status === 'completed' ? 'Completed' : 'Pending'}
                            </Badge>
                            {report.status === 'completed' && report.report_file_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingLabReport(report);
                                }}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View Report
                              </Button>
                            )}
                            {report.status === 'completed' && !report.report_file_url && report.notes && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingLabReport(report)}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View Results
                              </Button>
                            )}
                            {report.status === 'completed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (report.report_file_url) {
                                    const ok = await printLabReport(report.report_file_url);
                                    if (!ok) toast({ title: 'Error', description: 'Could not print report', variant: 'destructive' });
                                  } else {
                                    const reportNo = `LR/${format(new Date(report.created_at), 'yyyyMMdd')}/${report.id.slice(0, 6).toUpperCase()}`;
                                    const bodyHtml = `
                                      ${getNitwHeaderHtml('LABORATORY REPORT')}
                                      <div class="doc-title">
                                        <h3>LABORATORY INVESTIGATION REPORT</h3>
                                        <div class="cert-no">Report No.: ${reportNo}</div>
                                      </div>
                                      <div class="section">
                                        <div class="section-title">TEST: ${report.test_name.toUpperCase()}</div>
                                        <div class="body-text" style="white-space:pre-line">${report.notes || 'Results not available.'}</div>
                                      </div>
                                      <div class="signature-section">
                                        <div class="signature-box"><div class="signature-line">Lab Technician</div></div>
                                        <div class="signature-box"><div class="signature-line">Pathologist</div></div>
                                      </div>
                                    `;
                                    await printDocument({ title: `Lab Report — ${report.test_name}`, bodyHtml, documentId: reportNo, documentType: 'LAB_REPORT' });
                                  }
                                }}
                              >
                                <Printer className="w-3 h-3 mr-1" />
                                Print
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Lab Report Viewer Dialog */}
            {viewingLabReport && (
              <LabReportViewer
                open={!!viewingLabReport}
                onOpenChange={(open) => { if (!open) setViewingLabReport(null); }}
                title={`${viewingLabReport.test_name} — ${student?.full_name} (${student?.roll_number})`}
                reportFileUrl={viewingLabReport.report_file_url}
                fallbackNotes={viewingLabReport.notes}
                studentName={student?.full_name || ''}
                rollNumber={student?.roll_number || ''}
                doctorName={viewingLabReport.doctor_name}
                testDate={viewingLabReport.created_at}
              />
            )}

            {/* Referral Letters Sub-tab */}
            {recordsSubTab === 'referrals' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Referral Letters
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {referralLetters.length} referral{referralLetters.length !== 1 ? 's' : ''} on record
                  </p>
                </CardHeader>
                <CardContent>
                  {referralLetters.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No referral letters yet</p>
                      <p className="text-sm">Medical leave referrals from doctors will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {referralLetters.map((ref) => (
                        <div key={ref.id} className="p-4 rounded-lg border hover:bg-muted/30 transition-colors space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/20">
                                <Building2 className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{ref.referral_hospital}</p>
                                <p className="text-xs text-muted-foreground">
                                  Referred by Dr. {ref.doctor_name} · {format(new Date(ref.referral_date), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  ref.status === 'returned' ? 'bg-green-100 text-green-800' :
                                  ref.status === 'on_leave' ? 'bg-blue-100 text-blue-800' :
                                  ref.status === 'student_form_pending' ? 'bg-amber-100 text-amber-800' :
                                  ref.status === 'return_pending' ? 'bg-purple-100 text-purple-800' :
                                  'bg-muted text-muted-foreground'
                                }
                              >
                                {ref.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </Badge>
                              {ref.status === 'student_form_pending' && (
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/medical-leave?fill=${ref.id}`);
                                  }}
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  Fill Form
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintReferralLetter(ref);
                                }}
                              >
                                <Printer className="w-3 h-3 mr-1" />
                                Print
                              </Button>
                            </div>
                          </div>
                          {ref.illness_description && (
                            <p className="text-sm text-muted-foreground pl-13">
                              <span className="font-medium">Illness:</span> {ref.illness_description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pl-13">
                            <span>Duration: {ref.expected_duration}</span>
                            {ref.leave_start_date && (
                              <span>From: {format(new Date(ref.leave_start_date), 'MMM d, yyyy')}</span>
                            )}
                            {ref.expected_return_date && (
                              <span>Until: {format(new Date(ref.expected_return_date), 'MMM d, yyyy')}</span>
                            )}
                            {ref.health_priority && (
                              <Badge variant="secondary" className="text-xs">{ref.health_priority}</Badge>
                            )}
                          </div>
                          {ref.doctor_notes && (
                            <p className="text-xs text-muted-foreground pl-13">
                              <span className="font-medium">Doctor's Notes:</span> {ref.doctor_notes}
                            </p>
                          )}
                          {ref.referral_type && ref.referral_type.length > 0 && (
                            <div className="flex gap-1 pl-13">
                              {ref.referral_type.map((type, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{type}</Badge>
                              ))}
                            </div>
                          )}
                          {/* Approval Workflow Timeline */}
                          <div className="pt-3 mt-2 border-t">
                            <LeaveApprovalWorkflowTimeline
                              workflow={workflowsByLeave[ref.id] || null}
                              approverNames={{
                                doctor: `Dr. ${ref.doctor_name}`,
                                mentor: student?.mentors?.name || student?.mentor_name || undefined,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Certificates Sub-tab */}
            {recordsSubTab === 'certificates' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" />
                      Medical Certificates & Documents
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {certificates.length} document{certificates.length !== 1 ? 's' : ''} on record
                    </p>
                  </CardHeader>
                  <CardContent>
                    {/* Certificate Category Filters */}
                    <div className="flex gap-2 flex-wrap mb-4">
                      {([
                        { key: 'all' as CertificateCategory, label: 'All Documents', count: certificates.length },
                        { key: 'medical_leave' as CertificateCategory, label: '📋 Medical Leave', count: certificates.filter(c => c.status === 'on_leave' || c.status === 'student_form_pending' || c.status === 'doctor_referred').length },
                        { key: 'fitness' as CertificateCategory, label: '✅ Fitness Clearance', count: certificates.filter(c => c.doctor_clearance).length },
                        { key: 'referral' as CertificateCategory, label: '🏥 Referral', count: certificates.filter(c => c.status === 'returned' || c.actual_return_date).length },
                      ]).map(cat => (
                        <Button
                          key={cat.key}
                          variant={certCategory === cat.key ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCertCategory(cat.key)}
                          className="text-xs"
                        >
                          {cat.label} ({cat.count})
                        </Button>
                      ))}
                    </div>

                    {(() => {
                      let filtered = certificates;
                      if (certCategory === 'medical_leave') filtered = certificates.filter(c => c.status === 'on_leave' || c.status === 'student_form_pending' || c.status === 'doctor_referred');
                      else if (certCategory === 'fitness') filtered = certificates.filter(c => c.doctor_clearance);
                      else if (certCategory === 'referral') filtered = certificates.filter(c => c.status === 'returned' || c.actual_return_date);

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-8 text-muted-foreground">
                            <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No {certCategory === 'all' ? '' : certCategory.replace('_', ' ')} certificates yet</p>
                            <p className="text-sm">Certificates will appear here once issued by your doctor.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {filtered.map((cert) => {
                            const isFitness = cert.doctor_clearance;
                            const isOnLeave = cert.status === 'on_leave' || cert.status === 'student_form_pending' || cert.status === 'doctor_referred';
                            const certType = isFitness ? 'Fitness Clearance Certificate' : isOnLeave ? 'Medical Leave Certificate' : 'Medical Certificate';
                            const certIcon = isFitness ? '✅' : isOnLeave ? '📋' : '🏥';
                            const certBgClass = isFitness ? 'bg-emerald-50 dark:bg-emerald-900/10' : isOnLeave ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-primary/5';

                            return (
                              <div key={cert.id} className={`p-4 rounded-lg border hover:shadow-sm transition-all space-y-2 ${certBgClass}`}>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                                      isFitness ? 'bg-emerald-100 dark:bg-emerald-900/30' : isOnLeave ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-primary/10'
                                    }`}>
                                      {certIcon}
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">{certType}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {cert.referral_hospital} · Dr. {cert.doctor_name} · {format(new Date(cert.created_at), 'MMM d, yyyy')}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className={
                                        cert.status === 'returned' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                                        cert.status === 'on_leave' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                                        cert.doctor_clearance ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300' :
                                        'bg-muted text-muted-foreground'
                                      }
                                    >
                                      {cert.doctor_clearance ? 'Fit for Classes' : cert.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </Badge>
                                    {isFitness && cert.doctor_clearance_date && (
                                      <span className="text-[10px] text-muted-foreground">
                                        Cleared: {format(new Date(cert.doctor_clearance_date), 'MMM d, yyyy')}
                                      </span>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => setPreviewCertificate(cert)}>
                                      <Eye className="w-3 h-3 mr-1" />Preview
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                      if (isFitness) handlePrintFitnessCertificate(cert);
                                      else handlePrintCertificate(cert);
                                    }}>
                                      <Printer className="w-3 h-3 mr-1" />Print
                                    </Button>
                                  </div>
                                </div>
                                {cert.illness_description && (
                                  <p className="text-sm text-muted-foreground pl-[52px]">
                                    <span className="font-medium">Condition:</span> {cert.illness_description}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pl-[52px]">
                                  <span>Duration: {cert.expected_duration}</span>
                                  {cert.rest_days && <span>Rest Days: {cert.rest_days}</span>}
                                  {cert.leave_start_date && <span>From: {format(new Date(cert.leave_start_date), 'MMM d, yyyy')}</span>}
                                  {cert.expected_return_date && <span>Until: {format(new Date(cert.expected_return_date), 'MMM d, yyyy')}</span>}
                                  {cert.actual_return_date && <span>Returned: {format(new Date(cert.actual_return_date), 'MMM d, yyyy')}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Certificate Preview Dialog */}
            {previewCertificate && (
              <Dialog open={!!previewCertificate} onOpenChange={(open) => { if (!open) setPreviewCertificate(null); }}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-primary" />
                      Certificate Preview
                    </DialogTitle>
                    <DialogDescription>
                      Medical Leave Certificate — {previewCertificate.referral_hospital}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="border rounded-lg p-8 bg-white text-black">
                    {/* Official Header */}
                    <div className="border-b-2 border-[#1e3a5f] pb-6 mb-6">
                      <div className="flex items-start gap-4">
                        <img src="/nitw-emblem.png" alt="NIT Warangal" className="w-20 h-24 object-contain flex-shrink-0" />
                        <div className="flex-1 text-center">
                          <h1 className="text-xl font-bold text-[#1e3a5f] tracking-wide">NATIONAL INSTITUTE OF TECHNOLOGY</h1>
                          <p className="text-lg font-semibold text-[#1e3a5f] mt-1">WARANGAL</p>
                          <p className="text-xs text-gray-500 mt-1">(An Institution of National Importance under Ministry of Education, Govt. of India)</p>
                          <p className="text-xs text-gray-500">Warangal, Telangana - 506004</p>
                          <div className="mt-3 pt-2 border-t border-gray-200">
                            <p className="text-base font-semibold text-[#0066cc]">HEALTH CENTRE</p>
                            <p className="text-xs text-gray-500">Phone: 0870-2462022 | Email: healthcentre@nitw.ac.in</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Certificate Title */}
                    <div className="text-center mb-8">
                      <h2 className="text-lg font-bold uppercase tracking-wide border-b-2 border-gray-300 inline-block pb-1 text-[#003366]">
                        MEDICAL LEAVE CERTIFICATE
                      </h2>
                      <p className="text-xs text-gray-500 mt-2">
                        Certificate No: MLC/{format(new Date(previewCertificate.created_at), 'yyyyMMdd')}/{previewCertificate.id.slice(0, 6).toUpperCase()}
                      </p>
                    </div>

                    {/* Student Details */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2 mb-4">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <p><span className="font-semibold">Name:</span> {student?.full_name}</p>
                        <p><span className="font-semibold">Roll Number:</span> {student?.roll_number}</p>
                        <p><span className="font-semibold">Program:</span> {student?.program}</p>
                        <p><span className="font-semibold">Branch:</span> {student?.branch || '—'}</p>
                      </div>
                    </div>

                    {/* Certificate Body */}
                    <div className="space-y-4 text-sm leading-relaxed">
                      <p>This is to certify that <strong>{student?.full_name}</strong> (Roll No: <strong>{student?.roll_number}</strong>) was referred to <strong>{previewCertificate.referral_hospital}</strong> for medical treatment.</p>

                      {previewCertificate.illness_description && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                          <p className="font-semibold text-sm">Illness / Condition:</p>
                          <p>{previewCertificate.illness_description}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <p><span className="font-semibold">Hospital:</span> {previewCertificate.referral_hospital}</p>
                        <p><span className="font-semibold">Duration:</span> {previewCertificate.expected_duration}</p>
                        {previewCertificate.leave_start_date && (
                          <p><span className="font-semibold">Leave From:</span> {format(new Date(previewCertificate.leave_start_date), 'PPP')}</p>
                        )}
                        {previewCertificate.expected_return_date && (
                          <p><span className="font-semibold">Expected Return:</span> {format(new Date(previewCertificate.expected_return_date), 'PPP')}</p>
                        )}
                        {previewCertificate.actual_return_date && (
                          <p><span className="font-semibold">Actual Return:</span> {format(new Date(previewCertificate.actual_return_date), 'PPP')}</p>
                        )}
                      </div>

                      {previewCertificate.doctor_notes && (
                        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 italic text-sm">
                          <strong>Doctor's Notes:</strong> {previewCertificate.doctor_notes}
                        </div>
                      )}

                      <p>The student is hereby granted medical leave for the above-mentioned period as per the medical assessment.</p>
                    </div>

                    {/* Signature */}
                    <div className="mt-12 flex items-end justify-between">
                      <div className="text-center">
                        <img src="/nitw-emblem.png" alt="NITW Emblem" className="w-20 h-24 object-contain mx-auto" />
                        <p className="text-[9px] text-gray-500 mt-1">Official Emblem</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl text-[#003366] mb-2" style={{ fontFamily: "'Brush Script MT', cursive" }}>
                          {previewCertificate.doctor_name}
                        </p>
                        <p className="font-semibold">Dr. {previewCertificate.doctor_name}</p>
                        <p className="text-sm text-gray-500">{previewCertificate.doctor_designation}</p>
                        <p className="text-sm text-gray-500">{previewCertificate.doctor_qualification}</p>
                        <p className="text-sm text-gray-500">Health Centre, NIT Warangal</p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-4 border-t text-center">
                      <p className="text-xs text-gray-500">Date of Issue: {format(new Date(), 'PPPP')}</p>
                      <p className="text-xs text-gray-500 mt-1">This certificate is valid for official purposes. For verification, contact Health Centre, NIT Warangal.</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => setPreviewCertificate(null)}>
                      Close
                    </Button>
                    <Button onClick={() => { handlePrintCertificate(previewCertificate); }}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print Certificate
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>

          {/* ── SETTINGS TAB ── */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            {/* Notification Preferences */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Choose what updates you want to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Appointment Reminders', desc: 'Get reminded about upcoming appointments', value: notifAppointments, set: setNotifAppointments },
                  { label: 'Follow-up Alerts', desc: 'Alerts when a follow-up is scheduled', value: notifFollowups, set: setNotifFollowups },
                  { label: 'Medical Leave Updates', desc: 'Status changes on your leave applications', value: notifLeave, set: setNotifLeave },
                  { label: 'Email Notifications', desc: 'Receive notifications via email', value: notifEmail, set: setNotifEmail },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={item.value} onCheckedChange={item.set} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Privacy Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Privacy Settings
                </CardTitle>
                <CardDescription>Control who can view your health information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">Share health summary with Mentor</p>
                    <p className="text-xs text-muted-foreground">Allow your faculty mentor to view your health visit history</p>
                  </div>
                  <Switch checked={privacyMentor} onCheckedChange={setPrivacyMentor} />
                </div>
                <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Your medical details (diagnoses, prescriptions) are always confidential and only accessible to medical staff.
                </div>
              </CardContent>
            </Card>

            {/* Language & Display */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  Display Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Language</p>
                    <p className="text-xs text-muted-foreground">Select your preferred language</p>
                  </div>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="te">Telugu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Account Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/student/register">
                    <Edit3 className="w-4 h-4 mr-2" />
                    Update Full Registration Profile
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/my-appointments">
                    <Calendar className="w-4 h-4 mr-2" />
                    Manage Appointments
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/medical-leave">
                    <FileText className="w-4 h-4 mr-2" />
                    Medical Leave Applications
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}
