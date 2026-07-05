import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Check, Loader2, Save, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function ContactOwnerForm() {
  const [loading, setLoading] = useState(false);
  const [mailLoading, setMailLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleNotificationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');

    const formData = new FormData(e.currentTarget);
    
    // Inject Web3Forms credentials
    formData.append("access_key", "3044b988-d5b0-4b39-831f-65d86533035b");
    formData.append("from_name", "Campus Care Health Portal");
    formData.append("to_email", "ak25edi0022@student.nitw.ac.in");
    formData.append("subject", form.subject || "New Contact Form Submission");
    formData.append("redirect", "false");

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        // Clear form after successful submission
        e.currentTarget.reset();
        setForm({ name: '', email: '', subject: '', message: '' });
        setStatus('success');
        toast.success('Message sent successfully! Check your email.');
        
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        throw new Error(result.message || 'Submission failed');
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      setStatus('error');
      toast.error(error.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // AI-verified mail redirect: validates the entered fields, then opens the user's
  // default mail client with the EXACT same name/subject/message prefilled and sent
  // to the project owner (akkumarsingh456@gmail.com).
  const handleSendMail = async () => {
    const name = form.name.trim();
    const email = form.email.trim();
    const subject = form.subject.trim();
    const message = form.message.trim();

    if (!name || !email || !subject || !message) {
      toast.error('Please fill in your name, email, subject, and message before sending mail.');
      return;
    }
    // Basic email sanity check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setMailLoading(true);
    try {
      // AI/content validation via existing edge function (spam/abuse check).
      // Non-blocking: if the function is unavailable we still allow the mail.
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('validate-contact-submission', {
          body: { name, email, subject, message },
        });
        if (!error && data && data.valid === false) {
          toast.error(data.reason || 'Message failed validation. Please revise and try again.');
          setMailLoading(false);
          return;
        }
      } catch {
        // ignore validation transport errors — proceed to open mail client
      }

      const OWNER_EMAIL = 'akkumarsingh456@gmail.com';
      const bodyLines = [
        `Name: ${name}`,
        `Email: ${email}`,
        '',
        message,
      ];
      const mailtoUrl =
        `mailto:${encodeURIComponent(OWNER_EMAIL)}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(bodyLines.join('\r\n'))}`;

      // Open the user's default mail inbox with fields prefilled.
      window.location.href = mailtoUrl;
      toast.success('Opening your mail inbox with the message prefilled…');
    } finally {
      setMailLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Contact Owner</CardTitle>
        <CardDescription>Have questions or concerns? Reach out to the project owner.</CardDescription>
      </CardHeader>

      <CardContent>
        {status === 'success' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 mb-4">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-800">✅ Message sent successfully! Check your email.</span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-800">❌ Failed to send message. Please try again.</span>
          </div>
        )}

        <form onSubmit={handleNotificationSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Your Name *</label>
            <Input
              placeholder="Your full name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Email Address *</label>
            <Input
              type="email"
              placeholder="your.email@example.com"
              name="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Subject *</label>
            <Input
              placeholder="What is this about?"
              name="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Message *</label>
            <Textarea
              placeholder="Please describe your question or concern in detail..."
              name="message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              disabled={loading}
              rows={5}
              className="resize-none"
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="submit" disabled={loading || mailLoading} className="w-full" size="lg">
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Message
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleSendMail}
              disabled={loading || mailLoading}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {mailLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Preparing…
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5 mr-2" />
                  Send Mail
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
