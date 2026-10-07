import { supabase } from "@/integrations/supabase/client";

interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: string;
  relatedId?: string;
}

/**
 * Create a notification for a user
 */
export const createNotification = async (data: NotificationData) => {
  const { error } = await supabase.from("notifications").insert({
    user_id: data.userId,
    title: data.title,
    message: data.message,
    type: data.type,
    related_appointment_id: data.relatedId || null,
  });

  if (error) {
    console.error("Failed to create notification:", error);
    throw error;
  }
};

/**
 * Notify student about a new medical leave referral
 */
export const notifyStudentOfReferral = async (
  studentUserId: string,
  referralData: {
    hospital: string;
    doctorName: string;
    expectedDuration: string;
    leaveRequestId?: string;
  }
) => {
  await createNotification({
    userId: studentUserId,
    title: "📋 Medical Leave Referral Issued",
    message: `${referralData.doctorName} has referred you to ${referralData.hospital} for treatment (Duration: ${referralData.expectedDuration}). ⚠️ REQUIRED: Complete the departure form before leaving campus. Your referral letter and hospital card are available in Medical Leave section. Tap to open.`,
    type: "medical_leave_referral",
    relatedId: referralData.leaveRequestId,
  });
};

/**
 * Notify student about status updates
 */
export const notifyStudentOfStatusUpdate = async (
  studentUserId: string,
  status: string,
  details: string
) => {
  const statusMessages: Record<string, { title: string; message: string }> = {
    on_leave: {
      title: "✅ Leave Form Submitted Successfully",
      message: `Your departure has been recorded. Your printed referral letter and hospital card are available in the Medical Leave section. ${details}`,
    },
    return_pending: {
      title: "⏰ Return Expected Soon",
      message: `Please submit your return notification within 2 hours of arriving back on campus. After returning, you must visit the health centre for a fitness checkup. ${details}`,
    },
    returned: {
      title: "🏠 Welcome Back!",
      message: `Your return has been recorded. ${details}`,
    },
  };

  const notification = statusMessages[status];
  if (!notification) return;

  await createNotification({
    userId: studentUserId,
    title: notification.title,
    message: notification.message,
    type: `medical_leave_${status}`,
  });
};

/**
 * Notify student that a certificate has been issued
 */
export const notifyStudentOfCertificate = async (
  studentUserId: string,
  certificateData: {
    type: 'medical_leave' | 'fitness' | 'referral';
    doctorName: string;
    details: string;
  }
) => {
  const titles: Record<string, string> = {
    medical_leave: '📋 Medical Leave Certificate Issued',
    fitness: '✅ Fitness Certificate Issued',
    referral: '🏥 Referral Certificate Issued',
  };

  await createNotification({
    userId: studentUserId,
    title: titles[certificateData.type] || '📄 Certificate Issued',
    message: `${certificateData.doctorName} has issued a ${certificateData.type.replace('_', ' ')} certificate for you. ${certificateData.details} Tap to view and download.`,
    type: 'certificate_issued',
  });
};

/**
 * Notify mentor about student's medical leave
 */
export const notifyMentorOfStudentLeave = async (
  mentorUserId: string,
  studentData: {
    studentName: string;
    rollNumber: string;
    hospital: string;
    status: string;
  }
) => {
  const statusMessages: Record<string, { title: string; message: string }> = {
    on_leave: {
      title: "Student on Medical Leave",
      message: `Your mentee ${studentData.studentName} (${studentData.rollNumber}) has departed for treatment at ${studentData.hospital}.`,
    },
    returned: {
      title: "Student Returned from Leave",
      message: `Your mentee ${studentData.studentName} (${studentData.rollNumber}) has returned from medical leave at ${studentData.hospital}.`,
    },
  };

  const notification = statusMessages[studentData.status];
  if (!notification) return;

  await createNotification({
    userId: mentorUserId,
    title: notification.title,
    message: notification.message,
    type: `mentee_leave_${studentData.status}`,
  });
};

/**
 * Notify doctor about student form submission
 */
export const notifyDoctorOfFormSubmission = async (
  doctorUserId: string,
  studentData: {
    studentName: string;
    rollNumber: string;
    status: string;
    hospital: string;
  }
) => {
  const statusMessages: Record<string, { title: string; message: string }> = {
    on_leave: {
      title: "Student Departure Confirmed",
      message: `${studentData.studentName} (${studentData.rollNumber}) has submitted the departure form and left for ${studentData.hospital}.`,
    },
    returned: {
      title: "Student Return Confirmed",
      message: `${studentData.studentName} (${studentData.rollNumber}) has returned from medical leave at ${studentData.hospital}.`,
    },
  };

  const notification = statusMessages[studentData.status];
  if (!notification) return;

  await createNotification({
    userId: doctorUserId,
    title: notification.title,
    message: notification.message,
    type: `referral_${studentData.status}`,
  });
};

/**
 * Get student's user_id from student record
 */
export const getStudentUserId = async (studentId: string): Promise<string | null> => {
  const { data } = await supabase
    .from("students")
    .select("user_id")
    .eq("id", studentId)
    .single();
  
  return data?.user_id || null;
};

/**
 * Get mentor's user_id from mentor record
 */
export const getMentorUserId = async (mentorId: string): Promise<string | null> => {
  const { data } = await supabase
    .from("mentors")
    .select("user_id")
    .eq("id", mentorId)
    .single();
  
  return data?.user_id || null;
};

/**
 * Get doctor's user_id from medical_officers record
 */
export const getDoctorUserId = async (doctorId: string): Promise<string | null> => {
  const { data } = await supabase
    .from("medical_officers")
    .select("user_id")
    .eq("id", doctorId)
    .single();
  
  return data?.user_id || null;
};
