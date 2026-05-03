import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AppointmentNotificationRequest {
  appointmentId: string;
  action: "approved" | "rejected" | "rescheduled";
  reason?: string;
  newDate?: string;
  newTime?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Appointment notification request received");

    // Check API key — return 200 gracefully if not configured
    if (!RESEND_API_KEY || RESEND_API_KEY.trim() === '') {
      console.warn("RESEND_API_KEY not configured — skipping notification email");
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Email service not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify JWT token — must be a real, valid user token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate user identity with anon client
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Service-role client for DB lookups
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Caller must be doctor or admin
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes('doctor') && !roles.includes('admin')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // HTML escape helper for any user-controlled string interpolated into email HTML
    const esc = (s: unknown) =>
      String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

    const body = await req.json();
    const { appointmentId, action, reason, newDate, newTime }: AppointmentNotificationRequest = body;

    console.log(`Processing ${action} notification for appointment: ${appointmentId}`);

    // Validate inputs
    if (!appointmentId || !action) {
      console.error("Missing required fields");
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!["approved", "rejected", "rescheduled"].includes(action)) {
      console.error("Invalid action type");
      return new Response(JSON.stringify({ error: 'Invalid action type' }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch appointment details with student info
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        reason,
        status,
        patient_id
      `)
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error("Appointment not found:", appointmentError);
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch student details - patient_id is the auth user_id, not the student table id
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, full_name, email, roll_number, program, branch")
      .eq("user_id", appointment.patient_id)
      .maybeSingle();

    if (studentError || !student) {
      console.error("Student not found:", studentError);
      return new Response(JSON.stringify({ success: true, skipped: true, message: "Student record not found — skipping email" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // If email is missing or masked, skip gracefully
    if (!student.email || student.email === '******' || !student.email.includes('@')) {
      console.warn("Student email missing or masked — skipping notification");
      return new Response(JSON.stringify({ success: true, skipped: true, message: "Student email not available" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Sending ${action} notification to ${student.email}`);

    // Format date and time
    const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    };

    // Build email content based on action
    let subject = "";
    let statusColor = "";
    let statusIcon = "";
    let mainMessage = "";
    let additionalInfo = "";

    switch (action) {
      case "approved":
        subject = "✅ Appointment Confirmed - NIT Warangal Health Centre";
        statusColor = "#22c55e";
        statusIcon = "✅";
        mainMessage = "Your appointment has been <strong style='color: #22c55e;'>APPROVED</strong> by the doctor.";
        additionalInfo = `
          <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="margin: 0 0 8px 0; color: #166534;">Appointment Details</h3>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${appointmentDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${formatTime(appointment.appointment_time)}</p>
            <p style="margin: 4px 0;"><strong>Location:</strong> NIT Warangal Health Centre</p>
          </div>
          <p style="color: #16a34a; font-weight: 500;">Please arrive 10 minutes before your scheduled time.</p>
        `;
        break;
      case "rejected":
        subject = "❌ Appointment Request Declined - NIT Warangal Health Centre";
        statusColor = "#ef4444";
        statusIcon = "❌";
        mainMessage = "Unfortunately, your appointment request has been <strong style='color: #ef4444;'>DECLINED</strong>.";
        additionalInfo = `
          <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="margin: 0 0 8px 0; color: #991b1b;">Original Request</h3>
            <p style="margin: 4px 0;"><strong>Requested Date:</strong> ${appointmentDate}</p>
            <p style="margin: 4px 0;"><strong>Requested Time:</strong> ${formatTime(appointment.appointment_time)}</p>
            ${reason ? `<p style="margin: 12px 0 4px 0;"><strong>Reason for Denial:</strong></p><p style="margin: 4px 0; color: #dc2626;">${esc(reason)}</p>` : ''}
          </div>
          <p>You may book a new appointment for a different date/time through the Health Portal.</p>
        `;
        break;
      case "rescheduled":
        subject = "📅 Appointment Rescheduled - NIT Warangal Health Centre";
        statusColor = "#f59e0b";
        statusIcon = "📅";
        mainMessage = "Your appointment has been <strong style='color: #f59e0b;'>RESCHEDULED</strong> by the doctor.";
        const newFormattedDate = newDate ? new Date(newDate).toLocaleDateString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }) : appointmentDate;
        additionalInfo = `
          <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="margin: 0 0 8px 0; color: #92400e;">New Appointment Details</h3>
            <p style="margin: 4px 0;"><strong>New Date:</strong> ${esc(newFormattedDate)}</p>
            <p style="margin: 4px 0;"><strong>New Time:</strong> ${esc(newTime ? formatTime(newTime) : formatTime(appointment.appointment_time))}</p>
            <p style="margin: 4px 0;"><strong>Location:</strong> NIT Warangal Health Centre</p>
            ${reason ? `<p style="margin: 12px 0 4px 0;"><strong>Reason:</strong></p><p style="margin: 4px 0;">${esc(reason)}</p>` : ''}
          </div>
          <p style="color: #d97706; font-weight: 500;">Please note the updated schedule and arrive 10 minutes early.</p>
        `;
        break;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">NIT Warangal Health Centre</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Appointment Notification</p>
          </div>
          
          <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #374151;">Dear <strong>${esc(student.full_name)}</strong>,</p>
            
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              ${mainMessage}
            </p>
            
            ${additionalInfo}
            
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 14px; color: #6b7280; margin: 0;">
                <strong>Student Details:</strong><br>
                Roll Number: ${esc(student.roll_number)}<br>
                Program: ${esc(student.program)}${student.branch ? ` - ${esc(student.branch)}` : ''}
              </p>
            </div>
            
            <div style="margin-top: 24px; text-align: center;">
              <p style="font-size: 12px; color: #9ca3af;">
                This is an automated notification from NIT Warangal Health Centre.<br>
                For queries, contact: 0870-2462099
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "NIT Warangal Health Centre <onboarding@resend.dev>",
        to: [student.email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Failed to send email:", emailResult);
      // Return 200 gracefully — email failure should never block the appointment workflow
      return new Response(JSON.stringify({ 
        success: true, 
        emailSent: false, 
        warning: "Email notification could not be sent", 
        details: emailResult 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Email sent successfully to ${student.email}:`, emailResult);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${action} notification sent successfully`,
      emailId: emailResult.id 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-appointment-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
