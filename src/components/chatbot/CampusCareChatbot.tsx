import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { Stethoscope, X, Send, Copy, Check, Loader2, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

// Turn portal route mentions (e.g. `/auth`) into clickable in-app links
const ROUTE_LABELS: Record<string, string> = { "/auth": "Go to Sign In page" };

const linkifyRoutes = (text: string) =>
  text
    .replace(/`(\/[a-zA-Z0-9\-/]*)`/g, (_m, route: string) => `[${ROUTE_LABELS[route] ?? route}](${route})`)
    .replace(/(^|[\s(])(\/auth)\b(?![\]\)])/g, (_m, pre: string, route: string) => `${pre}[${ROUTE_LABELS[route]}](${route})`);

const WELCOME: Msg = {
  role: "assistant",
  content:
    "**Namaste! I'm the Campus Care Assistant** 🩺\n\nBefore we begin — **may I know your name?**\n\nAfter that you can ask me anything about this NIT Warangal Digital Health Centre portal — features, role dashboards, booking an appointment, medical leave approval, lab reports, pharmacy, or demo logins.\n\n**You may use the dummy logins to check how the website works** — tap any role chip below (Student, Admin, Doctor, Medical Staff, Lab Officer, Pharmacy) to get its demo credentials instantly.\n\n_Note: this is a personal demo project, not the official NITW website._",
};

const DEMO_ROLES = [
  { label: "Student", query: "Give the student dummy login and password" },
  { label: "Admin", query: "Give the admin dummy login and password" },
  { label: "Doctor", query: "Give the doctor dummy login and password" },
  { label: "Medical Staff", query: "Give the medical staff dummy login and password" },
  { label: "Lab Officer", query: "Give the lab officer dummy login and password" },
  { label: "Pharmacy", query: "Give the pharmacy dummy login and password" },
];

const SUGGESTIONS = [
  "What features does this website have?",
  "How do I book an appointment?",
  "How does the medical leave approval work?",
  "How does each role sign in?",
];

export default function CampusCareChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const askedName = messages.length <= 2;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, loading]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("site-chatbot", {
        body: { messages: next.slice(1).map(({ role, content }) => ({ role, content })) },
      });
      const payload = data as { reply?: string; error?: string } | null;
      const reply =
        payload?.reply ??
        payload?.error ??
        (error ? "The assistant is temporarily unavailable. Please try again in a moment." : "No response received.");
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, I couldn't reach the assistant. Please check your connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (content: string, i: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Campus Care health assistant"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          <span className="relative flex h-6 w-6 items-center justify-center">
            <Stethoscope className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-emerald-400" />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="hidden text-sm font-semibold sm:inline">Ask Health Assistant</span>
        </button>
      )}

      {open && (
        <div
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
          className="fixed bottom-4 right-4 z-50 flex h-[min(560px,80vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Campus Care Assistant</p>
              <p className="truncate text-xs opacity-80">Health portal guide • AI powered • by Aman Kumar</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-full p-1 hover:bg-primary-foreground/15">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("group flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="space-y-2 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-background/70 [&_code]:px-1 [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_strong]:font-semibold [&_ul]:space-y-1">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => {
                            const to = href ?? "";
                            if (to.startsWith("/")) {
                              return (
                                <Link
                                  to={to}
                                  onClick={() => setOpen(false)}
                                  className="font-medium text-primary underline underline-offset-2"
                                >
                                  {children}
                                </Link>
                              );
                            }
                            return (
                              <a href={to} target="_blank" rel="noreferrer">
                                {children}
                              </a>
                            );
                          },
                        }}
                      >
                        {linkifyRoutes(m.content)}
                      </ReactMarkdown>
                    </div>
                  ) : (

                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
                {m.role === "assistant" && (
                  <button
                    onClick={() => copy(m.content, i)}
                    className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Copy message"
                  >
                    {copied === i ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === i ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking the portal information...
              </div>
            )}

            {messages.length > 2 && !loading && messages.length <= 4 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border bg-muted/40 px-2 py-2">
            <p className="mb-1.5 px-1 text-[11px] font-semibold text-muted-foreground">
              Dummy logins — tap a role to test the site
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_ROLES.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  disabled={loading}
                  onClick={() => send(r.query)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>



          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border p-2"
          >
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={askedName ? "Type your name to get started..." : "Ask about features, logins, appointments..."}
                rows={1}
                className="max-h-28 min-h-[40px] resize-none text-sm"
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="px-1 pt-1.5 text-[10px] leading-tight text-muted-foreground">
              Answers come only from this portal's verified information. Demo project by Aman Kumar — not officially valid.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
