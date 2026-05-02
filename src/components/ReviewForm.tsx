import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Check, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function ReviewForm() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [form, setForm] = useState({
    name: '',
    email: '',
    college: '',
    branch: '',
    year: '',
    rating: 5,
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.college || !form.branch || !form.year || !form.message.trim()) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        submission_type: 'review',
        sender_role: 'student',
        name: form.name.trim(),
        email: form.email.trim(),
        college_name: form.college,
        branch: form.branch,
        year: form.year,
        rating: form.rating,
        message: form.message.trim(),
      };

      const { error } = await supabase.from('contact_submissions').insert(payload);

      if (error) throw error;

      // Fire-and-forget admin email — never blocks the UI
      supabase.functions.invoke('notify-admin-submission', { body: payload }).catch(() => {});

      setStatus('success');
      setForm({ name: '', email: '', college: '', branch: '', year: '', rating: 5, message: '' });
      toast.success('Review submitted successfully!');

      setTimeout(() => setStatus('idle'), 3000);
    } catch (error: any) {
      setStatus('error');
      toast.error('Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Reviews & Suggestions</CardTitle>
        <CardDescription>Share your feedback! Select your role to see the relevant form.</CardDescription>
      </CardHeader>

      <CardContent>
        {status === 'success' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 mb-4">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-800">✅ Review submitted successfully!</span>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">College *</label>
              <Input
                placeholder="Your college"
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Branch *</label>
              <Select value={form.branch} onValueChange={(val) => setForm({ ...form, branch: val })}>
                <SelectTrigger disabled={loading}>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CSE">CSE</SelectItem>
                  <SelectItem value="ECE">ECE</SelectItem>
                  <SelectItem value="Mechanical">Mechanical</SelectItem>
                  <SelectItem value="Civil">Civil</SelectItem>
                  <SelectItem value="Chemical">Chemical</SelectItem>
                  <SelectItem value="Mathematics">Mathematics</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Year *</label>
            <Select value={form.year} onValueChange={(val) => setForm({ ...form, year: val })}>
              <SelectTrigger disabled={loading}>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1st Year">1st Year</SelectItem>
                <SelectItem value="2nd Year">2nd Year</SelectItem>
                <SelectItem value="3rd Year">3rd Year</SelectItem>
                <SelectItem value="4th Year">4th Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">How do you like this project? *</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setForm({ ...form, rating: star })}
                  disabled={loading}
                  className={`text-4xl transition-all ${
                    form.rating >= star ? 'text-yellow-400' : 'text-gray-300'
                  } hover:text-yellow-400 disabled:opacity-50`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Your Review / Message *</label>
            <Textarea
              placeholder="Share your thoughts, suggestions, or experience..."
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
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Submit Review
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
