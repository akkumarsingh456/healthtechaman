import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Check, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function ContactOwnerForm() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        submission_type: 'contact',
        sender_role: 'other',
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      };

      const { error } = await supabase.from('contact_submissions').insert(payload);

      if (error) throw error;

      // Fire-and-forget admin email — never blocks the UI
      supabase.functions.invoke('notify-admin-submission', { body: payload }).catch(() => {});

      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
      toast.success('Message sent successfully!');

      setTimeout(() => setStatus('idle'), 3000);
    } catch (error: any) {
      setStatus('error');
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
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
            <span className="text-sm text-green-800">✅ Message sent successfully!</span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-800">❌ Please fill all fields</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Your Name *</label>
            <Input
              placeholder="Your full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Email Address *</label>
            <Input
              type="email"
              placeholder="your.email@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Subject *</label>
            <Input
              placeholder="What is this about?"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Message *</label>
            <Textarea
              placeholder="Please describe your question or concern in detail..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              disabled={loading}
              rows={5}
              className="resize-none"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
