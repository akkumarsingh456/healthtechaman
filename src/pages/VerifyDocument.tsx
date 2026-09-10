import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";

const VerifyDocument = () => {
  const [params] = useSearchParams();
  const doc = params.get("doc") || "";
  const id = params.get("id") || "";

  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState("Document Verification");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fnError } = await supabase.functions.invoke("verify-document", {
        body: { doc, id },
      });
      if (!active) return;
      if (fnError || !data?.ok) {
        setError(
          data?.error === "not_found"
            ? "This document could not be found. The link may be incorrect or the record was removed."
            : data?.error === "invalid_doc" || data?.error === "invalid_id"
              ? "This verification link is not valid."
              : "We could not load this document right now. Please try again.",
        );
      } else {
        setHtml(data.html);
        setTitle(data.title);
        document.title = data.title;
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [doc, id]);

  const handlePrint = () => {
    const frame = document.getElementById("verify-doc-frame") as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <div>
              <h1 className="text-lg font-semibold leading-tight">{title}</h1>
              <p className="text-xs text-muted-foreground">
                Read-only verification copy · cannot be edited
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {html && (
              <Button size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Save as PDF
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to="/">Home</Link>
            </Button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center rounded-lg border bg-background py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading document…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Document unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {!loading && html && (
          <iframe
            id="verify-doc-frame"
            title={title}
            srcDoc={html}
            sandbox="allow-modals"
            className="h-[820px] w-full rounded-lg border bg-background"
          />
        )}
      </div>
    </div>
  );
};

export default VerifyDocument;
