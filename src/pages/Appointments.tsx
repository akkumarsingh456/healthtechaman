import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, getDay, startOfDay, isSameDay } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Stethoscope,
  ChevronRight,
  CheckCircle,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { User as SupabaseUser } from "@supabase/supabase-js";

interface MedicalOfficer {
  id: string;
  name: string;
  designation: string;
  qualification: string;
}

interface VisitingDoctor {
  id: string;
  name: string;
  specialization: string;
  visit_day: string;
  visit_time_start: string;
  visit_time_end: string;
  is_monthly: boolean;
  month_week: number | null;
}

const DAY_MAP: { [key: string]: number } = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6
};

type Priority = 'high' | 'medium' | 'low';

interface TriageResult {
  priority: Priority;
  summary: string;
  followUp: string[];
  recommendedSpecialty?: string;
}

// Free-window chips represent times the student is FREE from classes today
const FREE_WINDOWS: { id: string; label: string; startH: number; endH: number }[] = [
  { id: 'early',    label: 'Before 9 AM',   startH: 0,  endH: 9 },
  { id: 'morning',  label: '9 AM – 12 PM',  startH: 9,  endH: 12 },
  { id: 'lunch',    label: '12 – 1 PM',     startH: 12, endH: 13 },
  { id: 'afternoon',label: '1 – 4 PM',      startH: 13, endH: 16 },
  { id: 'evening',  label: 'After 4 PM',    startH: 16, endH: 24 },
  { id: 'any',      label: 'Any time',      startH: 0,  endH: 24 },
];

const generateTimeSlots = (startTime: string, endTime: string) => {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`);
    currentMin += 30;
    if (currentMin >= 60) {
      currentMin = 0;
      currentHour++;
    }
  }
  
  return slots;
};

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes} ${ampm}`;
};

export default function Appointments() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [step, setStep] = useState(1);
  const [doctorType, setDoctorType] = useState<'medical_officer' | 'visiting_doctor'>('medical_officer');
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [bookingComplete, setBookingComplete] = useState(false);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);

  // AI Triage state (Step 2)
  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState('');
  const [fever, setFever] = useState(false);
  const [additional, setAdditional] = useState('');
  const [freeWindow, setFreeWindow] = useState<string>('any');
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check profile completion
  useEffect(() => {
    if (!user) return;
    const checkProfile = async () => {
      setCheckingProfile(true);
      try {
        const { data: student } = await supabase
          .from('students')
          .select('id, full_name, roll_number, email, phone, program, batch, mentor_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!student) {
          setProfileComplete(false);
          return;
        }

        // Check required fields
        const requiredFilled = !!(student.full_name && student.roll_number && student.email && student.phone && student.program && student.batch);
        
        // Also check student_profiles exists
        const { data: profile } = await supabase
          .from('student_profiles')
          .select('blood_group, emergency_contact')
          .eq('student_id', student.id)
          .maybeSingle();

        const hasHealthProfile = !!(profile?.blood_group && profile?.emergency_contact);
        setProfileComplete(requiredFilled && hasHealthProfile);
      } catch {
        setProfileComplete(false);
      } finally {
        setCheckingProfile(false);
      }
    };
    checkProfile();
  }, [user]);

  // Handle URL params
  useEffect(() => {
    const doctorId = searchParams.get('doctor');
    const type = searchParams.get('type');
    
    if (doctorId && type) {
      setDoctorType(type as 'medical_officer' | 'visiting_doctor');
      setSelectedDoctor(doctorId);
      setStep(2);
    }
  }, [searchParams]);

  const { data: medicalOfficers } = useQuery({
    queryKey: ['medical-officers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medical_officers')
        .select('id, name, designation, qualification')
        .order('is_senior', { ascending: false });
      if (error) throw error;
      return data as MedicalOfficer[];
    }
  });

  const { data: visitingDoctors } = useQuery({
    queryKey: ['visiting-doctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visiting_doctors')
        .select('*')
        .order('visit_day');
      if (error) throw error;
      return data as VisitingDoctor[];
    }
  });

  const selectedDoctorData = doctorType === 'medical_officer'
    ? medicalOfficers?.find(d => d.id === selectedDoctor)
    : visitingDoctors?.find(d => d.id === selectedDoctor);

  const visitingDoctorSchedule = doctorType === 'visiting_doctor' && selectedDoctor
    ? visitingDoctors?.find(d => d.id === selectedDoctor)
    : null;

  // Get available dates for visiting doctors
  const getAvailableDates = () => {
    if (!visitingDoctorSchedule) return undefined;
    
    const dayOfWeek = DAY_MAP[visitingDoctorSchedule.visit_day];
    const availableDates: Date[] = [];
    const today = startOfDay(new Date());
    
    for (let i = 0; i < 60; i++) {
      const date = addDays(today, i);
      if (getDay(date) === dayOfWeek) {
        if (visitingDoctorSchedule.is_monthly && visitingDoctorSchedule.month_week === 1) {
          // First occurrence of the day in the month
          const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
          let firstOccurrence = firstOfMonth;
          while (getDay(firstOccurrence) !== dayOfWeek) {
            firstOccurrence = addDays(firstOccurrence, 1);
          }
          if (isSameDay(date, firstOccurrence) && date >= today) {
            availableDates.push(date);
          }
        } else {
          availableDates.push(date);
        }
      }
    }
    
    return availableDates;
  };

  const availableDates = getAvailableDates();

  // Fetch existing bookings for the selected doctor on the selected date
  const { data: existingBookings } = useQuery({
    queryKey: ['existing-bookings', selectedDoctor, selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null, doctorType],
    queryFn: async () => {
      if (!selectedDoctor || !selectedDate) return [];
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const doctorField = doctorType === 'medical_officer' ? 'medical_officer_id' : 'visiting_doctor_id';
      const { data, error } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq(doctorField, selectedDoctor)
        .eq('appointment_date', dateStr)
        .in('status', ['pending', 'confirmed']);
      if (error) throw error;
      return data?.map(a => a.appointment_time) || [];
    },
    enabled: !!selectedDoctor && !!selectedDate,
  });

  const bookedTimes = new Set(existingBookings || []);

  const timeSlots = visitingDoctorSchedule
    ? generateTimeSlots(visitingDoctorSchedule.visit_time_start, visitingDoctorSchedule.visit_time_end)
    : generateTimeSlots('09:00', '17:00');

  const bookAppointment = useMutation({
    mutationFn: async () => {
      if (!user || !selectedDoctor || !selectedDate || !selectedTime) {
        throw new Error('Missing required information');
      }

      const appointmentData = {
        patient_id: user.id,
        doctor_type: doctorType,
        medical_officer_id: doctorType === 'medical_officer' ? selectedDoctor : null,
        visiting_doctor_id: doctorType === 'visiting_doctor' ? selectedDoctor : null,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        appointment_time: selectedTime,
        reason: reason || triage?.summary || null,
        status: 'pending' as const,
        ai_priority: triage?.priority ?? null,
        ai_summary: triage?.summary ?? null,
        free_time_window: freeWindow || null,
        triage_details: triage
          ? {
              symptoms,
              duration,
              severity,
              fever,
              additional,
              followUp: triage.followUp,
              recommendedSpecialty: triage.recommendedSpecialty,
            }
          : null,
      };

      const { error } = await supabase.from('appointments').insert(appointmentData);
      if (error) throw error;
    },
    onSuccess: () => {
      setBookingComplete(true);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: "Appointment Booked!",
        description: "Your appointment has been scheduled successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const runTriage = async () => {
    setTriageLoading(true);
    setTriageError(null);
    try {
      const { data, error } = await supabase.functions.invoke('symptom-triage', {
        body: {
          symptoms,
          duration,
          severity,
          fever,
          additional,
          freeTimeWindow: FREE_WINDOWS.find(w => w.id === freeWindow)?.label,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as TriageResult;
      setTriage(result);
      // High/medium force today only — pre-select today
      if (result.priority === 'high' || result.priority === 'medium') {
        setSelectedDate(startOfDay(new Date()));
      }
    } catch (e: any) {
      setTriageError(e?.message || 'AI triage failed. You can continue without it.');
    } finally {
      setTriageLoading(false);
    }
  };

  const priorityBadge = (p?: Priority | null) => {
    if (!p) return null;
    const map: Record<Priority, { label: string; cls: string }> = {
      high:   { label: 'High priority — see today', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
      medium: { label: 'Medium priority — today only', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400' },
      low:    { label: 'Low priority — schedule anytime', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400' },
    };
    const m = map[p];
    return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <CalendarIcon className="w-12 h-12 mx-auto text-primary mb-4" />
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>
                Please sign in to book an appointment with our medical team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild className="w-full">
                <Link to="/auth">Sign In to Continue</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/medical-team">View Medical Team</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Profile incomplete gate
  if (user && profileComplete === false && !checkingProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <User className="w-12 h-12 mx-auto text-warning mb-4" />
              <CardTitle>Complete Your Profile First</CardTitle>
              <CardDescription>
                You need to complete your profile before booking an appointment. This ensures we have your medical and emergency contact information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild className="w-full">
                <Link to="/student/register">Complete Profile</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/student/profile">View My Profile</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (bookingComplete) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4 text-center">
            <CardContent className="pt-8 pb-6">
              <CheckCircle className="w-16 h-16 mx-auto text-success mb-4" />
              <h2 className="text-2xl font-bold mb-2">Appointment Confirmed!</h2>
              <p className="text-muted-foreground mb-6">
                Your appointment has been successfully booked.
              </p>
              <div className="bg-muted rounded-lg p-4 mb-6 text-left space-y-2">
                <p><strong>Doctor:</strong> {selectedDoctorData && 'name' in selectedDoctorData ? selectedDoctorData.name : ''}</p>
                <p><strong>Date:</strong> {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                <p><strong>Time:</strong> {selectedTime && formatTime(selectedTime)}</p>
              </div>
              <div className="space-y-3">
                <Button onClick={() => navigate('/my-appointments')} className="w-full">
                  View My Appointments
                </Button>
                <Button onClick={() => {
                  setBookingComplete(false);
                  setStep(1);
                  setSelectedDoctor(null);
                  setSelectedDate(undefined);
                  setSelectedTime(null);
                  setReason('');
                }} variant="outline" className="w-full">
                  Book Another Appointment
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {s}
                </div>
                {s < 4 && (
                  <div className={`w-16 md:w-24 h-1 ${step > s ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Select Doctor */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Book an Appointment</h1>
                <p className="text-muted-foreground">Select a doctor to schedule your visit</p>
              </div>

              <div className="space-y-4">
                <Label className="text-lg font-semibold">Select Doctor Type</Label>
                <RadioGroup 
                  value={doctorType} 
                  onValueChange={(v) => {
                    setDoctorType(v as 'medical_officer' | 'visiting_doctor');
                    setSelectedDoctor(null);
                  }}
                  className="grid md:grid-cols-2 gap-4"
                >
                  <Label 
                    htmlFor="medical_officer" 
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                      doctorType === 'medical_officer' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="medical_officer" id="medical_officer" />
                    <div className="flex items-center gap-3">
                      <User className="w-8 h-8 text-primary" />
                      <div>
                        <p className="font-semibold">Medical Officer</p>
                        <p className="text-sm text-muted-foreground">General OPD consultations</p>
                      </div>
                    </div>
                  </Label>
                  <Label 
                    htmlFor="visiting_doctor" 
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                      doctorType === 'visiting_doctor' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="visiting_doctor" id="visiting_doctor" />
                    <div className="flex items-center gap-3">
                      <Stethoscope className="w-8 h-8 text-secondary" />
                      <div>
                        <p className="font-semibold">Specialist Doctor</p>
                        <p className="text-sm text-muted-foreground">Visiting specialists</p>
                      </div>
                    </div>
                  </Label>
                </RadioGroup>
              </div>

              <div className="space-y-4 mt-8">
                <Label className="text-lg font-semibold">
                  {doctorType === 'medical_officer' ? 'Select Medical Officer' : 'Select Specialist'}
                </Label>
                <div className="grid gap-4 md:grid-cols-2">
                  {(doctorType === 'medical_officer' ? medicalOfficers : visitingDoctors)?.map((doctor) => (
                    <Card 
                      key={doctor.id}
                      className={`cursor-pointer transition-all ${
                        selectedDoctor === doctor.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedDoctor(doctor.id)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            doctorType === 'medical_officer' ? 'bg-primary/10' : 'bg-secondary/10'
                          }`}>
                            {doctorType === 'medical_officer' 
                              ? <User className="w-6 h-6 text-primary" />
                              : <Stethoscope className="w-6 h-6 text-secondary" />
                            }
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{doctor.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {'specialization' in doctor ? doctor.specialization : doctor.designation}
                            </p>
                            {'visit_day' in doctor && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Clock className="w-3 h-3" />
                                {doctor.is_monthly && doctor.month_week === 1 ? '1st ' : ''}{doctor.visit_day}
                              </div>
                            )}
                          </div>
                          {selectedDoctor === doctor.id && (
                            <CheckCircle className="w-5 h-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!selectedDoctor}
                  size="lg"
                >
                  Continue <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: AI Symptom Triage */}
          {step === 2 && (
            <div className="space-y-6">
              <Button variant="ghost" onClick={() => setStep(1)} className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>

              <div className="text-center mb-4">
                <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-primary" /> AI Symptom Triage
                </h1>
                <p className="text-muted-foreground">
                  Answer a few quick questions so we can prioritise your slot correctly.
                </p>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="symptoms">What are your symptoms? *</Label>
                    <Textarea
                      id="symptoms"
                      placeholder="e.g. throat pain since 2 days, mild fever"
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration</Label>
                      <Input
                        id="duration"
                        placeholder="e.g. 2 days"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="severity">Severity (1-10)</Label>
                      <Input
                        id="severity"
                        type="number"
                        min={1}
                        max={10}
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fever?</Label>
                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={fever ? 'default' : 'outline'}
                          onClick={() => setFever(true)}
                        >Yes</Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={!fever ? 'default' : 'outline'}
                          onClick={() => setFever(false)}
                        >No</Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="additional">Anything else the doctor should know? (optional)</Label>
                    <Textarea
                      id="additional"
                      placeholder="Allergies, ongoing medicines, injury details…"
                      value={additional}
                      onChange={(e) => setAdditional(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>When are you free today (outside classes)?</Label>
                    <div className="flex flex-wrap gap-2">
                      {FREE_WINDOWS.map((w) => (
                        <Button
                          key={w.id}
                          type="button"
                          size="sm"
                          variant={freeWindow === w.id ? 'default' : 'outline'}
                          onClick={() => setFreeWindow(w.id)}
                        >
                          {w.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Time slots will be filtered to this window.</p>
                  </div>

                  {triage && (
                    <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                          <Sparkles className="w-4 h-4 text-primary" /> AI Assessment
                        </div>
                        {priorityBadge(triage.priority)}
                      </div>
                      <p className="text-sm">{triage.summary}</p>
                      {triage.recommendedSpecialty && triage.recommendedSpecialty !== 'General' && (
                        <p className="text-xs text-muted-foreground">
                          Suggested specialty: <strong>{triage.recommendedSpecialty}</strong>
                        </p>
                      )}
                      {triage.followUp?.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <p className="font-medium mb-1">Doctor may also ask:</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {triage.followUp.map((q, i) => <li key={i}>{q}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {triageError && (
                    <div className="flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle className="w-4 h-4 mt-0.5" />
                      <span>{triageError}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={runTriage}
                      disabled={triageLoading || symptoms.trim().length < 3}
                      variant={triage ? 'outline' : 'default'}
                    >
                      {triageLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analysing…</>
                      ) : triage ? 'Re-run AI triage' : (
                        <><Sparkles className="w-4 h-4 mr-2" /> Run AI triage</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!triage}
                  size="lg"
                >
                  Continue <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Select Date & Time */}
          {step === 3 && (
            <div className="space-y-6">
              <Button variant="ghost" onClick={() => setStep(2)} className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>

              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Select Date & Time</h1>
                <p className="text-muted-foreground">
                  Choose your preferred appointment slot
                </p>
                {triage && (
                  <div className="flex justify-center mt-3">{priorityBadge(triage.priority)}</div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Calendar */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5" />
                      Select Date
                    </CardTitle>
                    {triage && (triage.priority === 'high' || triage.priority === 'medium') ? (
                      <CardDescription className="text-amber-600 dark:text-amber-400">
                        {triage.priority === 'high'
                          ? 'Urgent — only today available.'
                          : 'Moderate — restricted to today only.'}
                      </CardDescription>
                    ) : doctorType === 'visiting_doctor' && visitingDoctorSchedule && (
                      <CardDescription>
                        Available on {visitingDoctorSchedule.is_monthly && visitingDoctorSchedule.month_week === 1 ? '1st ' : ''}
                        {visitingDoctorSchedule.visit_day}s
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => {
                        const today = startOfDay(new Date());
                        if (date < today) return true;
                        // High or Medium priority → today only
                        if (triage && (triage.priority === 'high' || triage.priority === 'medium')) {
                          return !isSameDay(date, today);
                        }
                        if (doctorType === 'visiting_doctor' && availableDates) {
                          return !availableDates.some(d => isSameDay(d, date));
                        }
                        // For medical officers, only disable past dates
                        return false;
                      }}
                      className="rounded-md border"
                    />
                  </CardContent>
                </Card>

                {/* Time Slots */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Select Time
                    </CardTitle>
                    {freeWindow && freeWindow !== 'any' && (
                      <CardDescription>
                        Showing your free window: {FREE_WINDOWS.find(w => w.id === freeWindow)?.label}
                      </CardDescription>
                    )}
                    {visitingDoctorSchedule && (
                      <CardDescription>
                        {formatTime(visitingDoctorSchedule.visit_time_start)} - {formatTime(visitingDoctorSchedule.visit_time_end)}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {selectedDate ? (
                      <div className="grid grid-cols-3 gap-2">
                        {timeSlots.map((time) => {
                          const isBooked = bookedTimes.has(time);
                          const isToday = isSameDay(selectedDate, new Date());
                          const now = new Date();
                          const [slotH, slotM] = time.split(':').map(Number);
                          const isPast = isToday && (slotH < now.getHours() || (slotH === now.getHours() && slotM <= now.getMinutes()));
                          const win = FREE_WINDOWS.find(w => w.id === freeWindow);
                          const inWindow = !win || win.id === 'any' || (slotH >= win.startH && slotH < win.endH);
                          const isDisabled = isBooked || isPast || !inWindow;
                          return (
                            <Button
                              key={time}
                              variant={selectedTime === time ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setSelectedTime(time)}
                              className={`text-sm ${isDisabled ? 'opacity-40 line-through' : ''}`}
                              disabled={isDisabled}
                              title={isPast ? 'This time has already passed' : isBooked ? 'This slot is already booked' : !inWindow ? 'Outside your free window' : ''}
                            >
                              {formatTime(time)}
                            </Button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Please select a date first
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(4)} 
                  disabled={!selectedDate || !selectedTime}
                  size="lg"
                >
                  Continue <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="space-y-6">
              <Button variant="ghost" onClick={() => setStep(3)} className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>

              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Confirm Appointment</h1>
                <p className="text-muted-foreground">
                  Review your appointment details
                </p>
                {triage && (
                  <div className="flex justify-center mt-3">{priorityBadge(triage.priority)}</div>
                )}
              </div>

              <Card className="max-w-xl mx-auto">
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        doctorType === 'medical_officer' ? 'bg-primary/20' : 'bg-secondary/20'
                      }`}>
                        {doctorType === 'medical_officer' 
                          ? <User className="w-6 h-6 text-primary" />
                          : <Stethoscope className="w-6 h-6 text-secondary" />
                        }
                      </div>
                      <div>
                        <p className="font-semibold">{selectedDoctorData && 'name' in selectedDoctorData ? selectedDoctorData.name : ''}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedDoctorData && ('specialization' in selectedDoctorData 
                            ? selectedDoctorData.specialization 
                            : selectedDoctorData.designation)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <CalendarIcon className="w-4 h-4" />
                          <span className="text-sm">Date</span>
                        </div>
                        <p className="font-semibold">
                          {selectedDate && format(selectedDate, 'EEE, MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">Time</span>
                        </div>
                        <p className="font-semibold">
                          {selectedTime && formatTime(selectedTime)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reason">Reason for Visit (Optional)</Label>
                      <Textarea
                        id="reason"
                        placeholder="Briefly describe your health concern..."
                        value={reason || (triage?.summary ?? '')}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  <Badge variant="outline" className="w-full justify-center py-2">
                    Status: Pending Confirmation
                  </Badge>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                      Back
                    </Button>
                    <Button 
                      onClick={() => bookAppointment.mutate()} 
                      disabled={bookAppointment.isPending}
                      className="flex-1"
                    >
                      {bookAppointment.isPending ? 'Booking...' : 'Confirm Booking'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
