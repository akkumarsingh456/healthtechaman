import { useState } from 'react';
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

  const handleNotificationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    // Inject Web3Forms credentials
    formData.append("access_key", "3044b988-d5b0-4b39-831f-65d86533035b");
    formData.append("from_name", "Campus Care Health Portal");
    formData.append("subject", "New Contact Form Submission");

    try {
      await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });
      
      // Clear form after successful submission
      e.currentTarget.reset();
      setForm({ name: '', email: '', subject: '', message: '' });
      setStatus('success');
      toast.success('Message sent successfully!');
      
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error("Submission error:", error);
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
            <span className="text-sm text-red-800">❌ Failed to send message</span>
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
