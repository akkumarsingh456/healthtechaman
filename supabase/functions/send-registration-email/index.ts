import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RegistrationEmailRequest {
  email: string;
  name: string;
  userType: "student" | "doctor" | "mentor" | "pharmacy" | "lab_officer" | "medical_staff";
  rollNumber?: string;
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email) && email.length <= 255;
};

const validateName = (name: string): boolean => {
  return name.length >= 2 && name.length <= 100 && /^[a-zA-Z\s.'-]+$/.test(name);
};

const validateUserType = (type: string): type is RegistrationEmailRequest["userType"] => {
  return ["student", "doctor", "mentor", "pharmacy", "lab_officer", "medical_staff"].includes(type);
};

const sanitizeHtml = (str: string): string => {
  return str.replace(/[<>&"']/g, (char) => {
    const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return entities[char] || char;
  });
};

const getUserTypeLabel = (userType: string): string => {
  const labels: Record<string, string> = {
    student: "Student", doctor: "Medical Officer", mentor: "Faculty Mentor",
    pharmacy: "Pharmacy Staff", lab_officer: "Lab Officer", medical_staff: "Medical Staff",
  };
  return labels[userType] || userType;
};

const getWelcomeMessage = (userType: string): string => {
  const messages: Record<string, string> = {
    student: `<p>You now have access to:</p><ul><li>📅 Book appointments with doctors</li><li>📋 View your health records</li><li>🏥 Access empanelled hospital information</li><li>💊 Track prescriptions and medications</li></ul>`,
    doctor: `<p>You now have access to:</p><ul><li>👨‍⚕️ View and manage patient records</li><li>📝 Write prescriptions and diagnoses</li><li>📅 Manage appointment schedules</li><li>📊 Access health analytics</li></ul>`,
    mentor: `<p>You now have access to:</p><ul><li>👥 View your assigned mentees</li><li>📋 Monitor mentee health visits</li><li>🔔 Receive wellness alerts</li><li>📊 Access mentee health reports</li></ul>`,
    pharmacy: `<p>You now have access to:</p><ul><li>💊 Manage medicine inventory</li><li>📋 Process prescriptions</li><li>📦 Track stock and expiry</li><li>📊 View dispensing analytics</li></ul>`,
    lab_officer: `<p>You now have access to:</p><ul><li>🔬 Process lab test requests</li><li>📋 Upload and manage reports</li><li>🧪 Register and track samples</li><li>📊 View lab analytics</li></ul>`,
    medical_staff: `<p>You now have access to:</p><ul><li>🏥 Access health centre operations</li><li>📋 View medical leave requests</li><li>📝 Manage administrative tasks</li><li>📊 Access operational reports</li></ul>`,
  };
  return messages[userType] || "";
};

const buildEmailHtml = (sanitizedName: string, userType: string, rollNumber?: string): string => {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to NIT Warangal Health Portal</title></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 24px;">🏥 NIT Warangal Health Portal</h1>
      <p style="color: #e2e8f0; margin: 10px 0 0;">Your Digital Health Companion</p>
    </div>
    <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
      <h2 style="color: #1a365d; margin-top: 0;">Welcome, ${sanitizedName}! 🎉</h2>
      <p>Thank you for registering with the NIT Warangal Health Portal as a <strong>${getUserTypeLabel(userType)}</strong>.</p>
      ${rollNumber ? `<p><strong>Roll Number:</strong> ${sanitizeHtml(rollNumber)}</p>` : ''}
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">${getWelcomeMessage(userType)}</div>
      <div style="background: #eef2ff; padding: 15px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 20px 0;">
        <p style="margin: 0; color: #3730a3;"><strong>🔒 Security Reminder:</strong> Your health data is encrypted and ABDM-compliant. Only authorized personnel with your consent can access your records.</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://healthportal.nitw.ac.in" style="background: #1a365d; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Access Health Portal</a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="color: #64748b; font-size: 14px; margin-bottom: 5px;">Need help? Contact the Health Centre:</p>
      <p style="color: #1a365d; font-size: 14px; margin: 0;">📞 +91 870 246 2087 | ✉️ healthcentre@nitw.ac.in</p>
    </div>
    <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">This is an automated email from the NIT Warangal Health Portal.<br>Please do not reply to this email.</p>
    </div>
  </body></html>`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if RESEND_API_KEY is configured before proceeding
    if (!RESEND_API_KEY || RESEND_API_KEY.trim() === '') {
      console.warn("RESEND_API_KEY not configured — skipping email send");
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Email service not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Registration notices may only be sent to the authenticated account's
    // address, never to a caller-selected third party.
    if (!data.user.email || data.user.email.toLowerCase() !== String((await req.clone().json().catch(() => ({}))).email || "").trim().toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Email must match the signed-in account' }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json();
    const { email, name, userType, rollNumber }: RegistrationEmailRequest = body;

    // Validate inputs
    if (!email || !validateEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!name || !validateName(name)) {
      return new Response(JSON.stringify({ error: 'Invalid name format' }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!userType || !validateUserType(userType)) {
      return new Response(JSON.stringify({ error: 'Invalid user type' }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const sanitizedName = sanitizeHtml(name);
    const emailHtml = buildEmailHtml(sanitizedName, userType, rollNumber);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NIT Warangal Health Portal <onboarding@resend.dev>",
        to: [email],
        subject: `Welcome to NIT Warangal Health Portal - Registration Successful! 🏥`,
        html: emailHtml,
      }),
    });

    const emailResponse = await response.json();

    if (!response.ok) {
      // Log error but return 200 so client doesn't see a 500
      console.error("Resend API error:", emailResponse);
      return new Response(
        JSON.stringify({ success: false, skipped: true, message: "Email delivery failed but registration is complete" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Registration email sent successfully:", emailResponse);
    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-registration-email function:", error);
    // Return 200 with error info so registration flow isn't broken
    return new Response(
      JSON.stringify({ success: false, skipped: true, message: "Email service error" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
