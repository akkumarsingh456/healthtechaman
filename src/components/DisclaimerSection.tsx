import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Mail, Send, Save, CheckCircle, XCircle, Megaphone, ShieldAlert, Star, MessageSquare, GraduationCap, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BRANCHES = [
  "Computer Science & Engineering", "Electronics & Communication", "Electrical Engineering",
  "Mechanical Engineering", "Civil Engineering", "Chemical Engineering", "Biotechnology",
  "Metallurgical & Materials Engineering", "Mathematics", "Physics", "Chemistry", "Other"
];

const DisclaimerSection = () => {
  const [contactForm, setContactForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [reviewForm, setReviewForm] = useState({
    name: "", email: "", message: "", role: "" as string,
    college_name: "", branch: "", year: "", subject: "", rating: 5,
  });
  const [sending, setSending] = useState(false);
  const [preparingMail, setPreparingMail] = useState(false);

  // Gemini-drafted mail redirect: sends the exact fields the user typed to the
  // AI composer, then opens their mail inbox (phone or laptop) pre-filled and
  // addressed to the project owner (akkumarsingh456@gmail.com).
  const handleSendMail = async () => {
    const name = contactForm.name.trim();
    const email = contactForm.email.trim();
    const subject = contactForm.subject.trim();
    const message = contactForm.message.trim();

    if (!name || !email || !subject || !message) {
      toast.error("Please fill in your name, email, subject, and message before sending mail.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setPreparingMail(true);
    const OWNER_EMAIL = "akkumarsingh456@gmail.com";
    let mailSubject = subject;
    let mailBody = [`Name: ${name}`, `Email: ${email}`, "", message].join("\r\n");
    try {
      // Gemini drafts the mail. Hard 10s cap so the button never hangs.
      const draft = await Promise.race([
        supabase.functions.invoke("compose-contact-mail", {
          body: { name, email, subject, message },
        }).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);

      const data: any = draft && (draft as any).data;
      if (data?.body) {
        mailSubject = data.subject || subject;
        mailBody = data.body;
      }
    } finally {
      const mailtoUrl =
        `mailto:${OWNER_EMAIL}` +
        `?subject=${encodeURIComponent(mailSubject)}` +
        `&body=${encodeURIComponent(mailBody)}`;

      const a = document.createElement("a");
      a.href = mailtoUrl;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();

      toast.success("Opening your mail app with the message ready to send…");
      setPreparingMail(false);
    }
  };

  const submitToDb = async (data: {
    submission_type: string; sender_role: string; name: string; email: string;
    subject?: string; message: string; college_name?: string; branch?: string;
    year?: string; rating?: number;
  }) => {
    // We do a direct insert here instead of an Edge Function to avoid 'Sending...' hangs
    try {
      const { error } = await supabase.from("contact_submissions" as any).insert({
        submission_type: data.submission_type,
        sender_role: data.sender_role,
        name: data.name,
        email: data.email,
        subject: data.subject || null,
        message: data.message,
        college_name: data.college_name || null,
        branch: data.branch || null,
        year: data.year || null,
        rating: data.rating || null,
        ai_validation_status: "valid",
      } as any);

      if (error) {
        console.error("Supabase insert error:", error);
        toast.error("Failed to submit. " + error.message);
        return false;
      }
      return true;
    } catch (e: any) {
      console.error("Exception during submission:", e);
      toast.error("An error occurred. Check your network.");
      return false;
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.subject || !contactForm.message) {
      toast.error("Please fill in all fields");
      return;
    }
    setSending(true);
    const ok = await submitToDb({
      submission_type: "contact", sender_role: "other",
      name: contactForm.name, email: contactForm.email,
      subject: contactForm.subject, message: contactForm.message,
    });
    if (ok) {
      toast.success("Message sent successfully!");
      setContactForm({ name: "", email: "", subject: "", message: "" });
    }
    setSending(false);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.name || !reviewForm.email || !reviewForm.message || !reviewForm.role) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (reviewForm.role === "student" && (!reviewForm.branch || !reviewForm.year || !reviewForm.college_name)) {
      toast.error("Please fill in branch, year, and college name");
      return;
    }
    if (reviewForm.role === "alumni" && (!reviewForm.branch || !reviewForm.year || !reviewForm.college_name)) {
      toast.error("Please fill in branch, passing year, and college name");
      return;
    }
    if (reviewForm.role === "professor" && (!reviewForm.subject || !reviewForm.college_name)) {
      toast.error("Please fill in subject and college name");
      return;
    }
    setSending(true);
    const ok = await submitToDb({
      submission_type: "review",
      sender_role: reviewForm.role as "student" | "professor",
      name: reviewForm.name, email: reviewForm.email,
      subject: reviewForm.subject, message: reviewForm.message,
      college_name: reviewForm.college_name, branch: reviewForm.branch,
      year: reviewForm.year, rating: reviewForm.rating,
    });
    if (ok) {
      toast.success("Review submitted successfully! Thank you!");
      setReviewForm({ name: "", email: "", message: "", role: "", college_name: "", branch: "", year: "", subject: "", rating: 5 });
    }
    setSending(false);
  };

  return (
    <section className="py-16 bg-destructive/5 border-y-2 border-destructive/20">
      <div className="container mx-auto px-4 max-w-5xl space-y-10">
        {/* Disclaimer Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/30">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            <span className="text-sm font-bold text-destructive uppercase tracking-wide">Important Disclaimer</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            NIT Warangal Health Centre – Personal Project
          </h2>
        </div>

        {/* Main Disclaimer Card */}
        <Card className="border-destructive/30 bg-background shadow-lg">
          <CardContent className="pt-6 space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              This project is a <strong className="text-foreground">personal academic initiative</strong>. The data used in this project is publicly available data sourced from the official NIT Warangal website. All roll numbers and phone numbers displayed are <strong className="text-foreground">dummy data</strong> created for demonstration purposes only and do not represent real individuals.
            </p>
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">⚠️ This project is NOT officially accepted or endorsed by NIT Warangal</p>
                <p className="text-sm text-muted-foreground mt-1">
                  I have already informed and described this project to the NIT Warangal administration. For any queries, clarifications, or concerns, please contact me below.
                </p>
              </div>
            </div>

            {/* ---> NEW: Aman's Bio Section <--- */}
            <div className="pt-6 border-t border-border/40 space-y-5">
              <p className="text-center font-medium italic text-muted-foreground text-lg px-4 border-l-4 border-primary bg-primary/5 py-4 rounded-r-lg">
                "Small daily improvements are the key to staggering long-term results."
              </p>
              
              <div className="space-y-4 text-muted-foreground leading-relaxed px-1">
                <h3 className="text-xl font-bold text-foreground mb-2">About Me & My Work:</h3>
                
                <p>
                  I am <strong className="text-foreground">Aman Kumar</strong>, the owner and developer of this Health Centre project, and a first-year student of Integrated B.Sc. B.Ed. at NIT Warangal, Department of Education.
                </p>
                <p>
                  I got the idea for this project six months ago while discussing with my classmate Preetham, and since then I have been continuously gathering information, maintaining daily notes, and working on the development till <strong>1 August 2026</strong>.
                </p>
                <p>
                  I have guided AI extensively on how to work and what to do for each and every task, working daily on this project since the very beginning. I have added almost everything required for the full functioning of a health centre website. For more details on how to use the website, please click on the Guide PDF.
                </p>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                  <p className="font-semibold text-foreground">Note:</p>
                  <p>
                    Our institute has also developed a similar health centre system, but it mainly includes simple features like appointment booking, doctor listing, and pharmacy. In that system, login and appointment are handled by a person sitting at the health centre.
                  </p>
                  <p>
                    I have not contributed to that institute system because the ERP technical officer I met and shared my project details with did not contact me further about the features I had added as per students' needs.
                  </p>
                  <p>
                    That is why I have shared all the information about my project here — so that the actual needs of students can be understood and better features can be considered.
                  </p>
                </div>

                <p>
                  As of now, I have restricted a few features and am actively working for the betterment of the project.
                </p>
              </div>
            </div>
            {/* ---> END NEW Bio Section <--- */}

            <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-border/40">
              {[
                { icon: CheckCircle, color: "text-primary", text: <>This is <strong>my own personal project</strong></> },
                { icon: CheckCircle, color: "text-primary", text: <>Data = <strong>public data</strong> from NIT Warangal website</> },
                { icon: CheckCircle, color: "text-primary", text: <>Roll numbers & phones = <strong>dummy / fake data</strong></> },
                { icon: Megaphone, color: "text-primary", text: <>Already <strong>informed</strong> to NIT Warangal administration</> },
                { icon: XCircle, color: "text-destructive", text: <><strong>NOT officially accepted</strong> by NIT Warangal</> },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <item.icon className={`w-4 h-4 ${item.color} shrink-0`} />
                  <span>{item.text}</span>
                </div>
              ))}
              <div className="flex items-start gap-2 text-sm">
                <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <a
                    href="mailto:akkumarsingh456@gmail.com"
                    className="text-primary hover:underline break-all font-medium"
                  >
                    akkumarsingh456@gmail.com
                  </a>
                  <a
                    href="mailto:ak25edi0022@student.nitw.ac.in"
                    className="text-primary hover:underline break-all font-medium"
                  >
                    ak25edi0022@student.nitw.ac.in
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact & Review Tabs */}
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <Tabs defaultValue="contact" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="contact" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Contact Owner
                </TabsTrigger>
                <TabsTrigger value="review" className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Reviews & Suggestions
                </TabsTrigger>
              </TabsList>

              {/* Contact Owner Tab */}
              <TabsContent value="contact">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Have questions or concerns? Reach out to the project owner.</p>
                  <form onSubmit={handleContactSubmit} className="grid sm:grid-cols-2 gap-4">
                    <Input placeholder="Your Name" value={contactForm.name} onChange={(e) => setContactForm(p => ({ ...p, name: e.target.value }))} required maxLength={100} />
                    <Input type="email" placeholder="Your Email" value={contactForm.email} onChange={(e) => setContactForm(p => ({ ...p, email: e.target.value }))} required maxLength={255} />
                    <div className="sm:col-span-2">
                      <Input placeholder="Subject" value={contactForm.subject} onChange={(e) => setContactForm(p => ({ ...p, subject: e.target.value }))} required maxLength={200} />
                    </div>
                    <div className="sm:col-span-2">
                      <Textarea placeholder="Your Message" value={contactForm.message} onChange={(e) => setContactForm(p => ({ ...p, message: e.target.value }))} required maxLength={1000} rows={4} />
                    </div>
                    <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3">
                      <Button type="submit" disabled={sending || preparingMail} className="gap-2">
                        <Save className="w-4 h-4" />
                        {sending ? "Saving..." : "Save Message"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={sending || preparingMail}
                        onClick={handleSendMail}
                        className="gap-2"
                      >
                        <Send className="w-4 h-4" />
                        {preparingMail ? "Preparing…" : "Send Mail"}
                      </Button>
                    </div>
                  </form>
                </div>
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="review">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Share your feedback! Select your role to see the relevant form.</p>

                  <div className="flex gap-3 flex-wrap">
                    <Button
                      type="button" variant={reviewForm.role === "student" ? "default" : "outline"}
                      className="flex-1 gap-2" onClick={() => setReviewForm(p => ({ ...p, role: "student" }))}
                    >
                      <GraduationCap className="w-4 h-4" /> Student
                    </Button>
                    <Button
                      type="button" variant={reviewForm.role === "alumni" ? "default" : "outline"}
                      className="flex-1 gap-2" onClick={() => setReviewForm(p => ({ ...p, role: "alumni" }))}
                    >
                      <GraduationCap className="w-4 h-4" /> Alumni
                    </Button>
                    <Button
                      type="button" variant={reviewForm.role === "professor" ? "default" : "outline"}
                      className="flex-1 gap-2" onClick={() => setReviewForm(p => ({ ...p, role: "professor" }))}
                    >
                      <BookOpen className="w-4 h-4" /> Professor / Faculty
                    </Button>
                  </div>

                  {reviewForm.role && (
                    <form onSubmit={handleReviewSubmit} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Input placeholder="Your Name *" value={reviewForm.name} onChange={(e) => setReviewForm(p => ({ ...p, name: e.target.value }))} required maxLength={100} />
                        <Input type="email" placeholder="Your Email *" value={reviewForm.email} onChange={(e) => setReviewForm(p => ({ ...p, email: e.target.value }))} required maxLength={255} />
                      </div>

                      <Input placeholder="College / University Name *" value={reviewForm.college_name} onChange={(e) => setReviewForm(p => ({ ...p, college_name: e.target.value }))} required maxLength={200} />

                      {(reviewForm.role === "student" || reviewForm.role === "alumni") && (
                        <div className="grid sm:grid-cols-2 gap-4">
                          <Select value={reviewForm.branch} onValueChange={(v) => setReviewForm(p => ({ ...p, branch: v }))}>
                            <SelectTrigger><SelectValue placeholder="Branch / Department *" /></SelectTrigger>
                            <SelectContent>
                              {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={reviewForm.year} onValueChange={(v) => setReviewForm(p => ({ ...p, year: v }))}>
                            <SelectTrigger><SelectValue placeholder={reviewForm.role === "alumni" ? "Passing Year *" : "Year of Study *"} /></SelectTrigger>
                            <SelectContent>
                              {reviewForm.role === "alumni"
                                ? ["2020", "2021", "2022", "2023", "2024", "2025", "2026"].map(y => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                  ))
                                : ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "PG 1st Year", "PG 2nd Year", "PhD"].map(y => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                  ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {reviewForm.role === "professor" && (
                        <Input placeholder="Subject / Department *" value={reviewForm.subject} onChange={(e) => setReviewForm(p => ({ ...p, subject: e.target.value }))} required maxLength={200} />
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-medium">How do you like this project?</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button key={s} type="button" onClick={() => setReviewForm(p => ({ ...p, rating: s }))}
                              className="focus:outline-none">
                              <Star className={`w-7 h-7 transition-colors ${s <= reviewForm.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <Textarea
                        placeholder={reviewForm.role === "student" ? "Your review / message *" : "Your suggestion / feedback *"}
                        value={reviewForm.message}
                        onChange={(e) => setReviewForm(p => ({ ...p, message: e.target.value }))}
                        required maxLength={1000} rows={4}
                      />

                      <Button type="submit" disabled={sending} className="gap-2">
                        <MessageSquare className="w-4 h-4" />
                        {sending ? "Submitting..." : "Submit Review"}
                      </Button>
                    </form>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default DisclaimerSection;
