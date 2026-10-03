import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const ALLOWED = "@student.nitw.ac.in";

/** Signs out any Google sign-in whose email is not an official student address. */
export default function GoogleStudentDomainGuard() {
  useEffect(() => {
    const check = async (session: any) => {
      const user = session?.user;
      if (!user) return;
      const viaGoogle =
        user.app_metadata?.provider === "google" ||
        (user.identities || []).some((i: any) => i.provider === "google");
      const email = (user.email || "").toLowerCase();
      if (viaGoogle && !email.endsWith(ALLOWED)) {
        await supabase.auth.signOut({ scope: "local" });
        toast({
          title: "College Gmail required",
          description: `Google sign-in is only for student emails ending with ${ALLOWED}.`,
          variant: "destructive",
        });
      }
    };
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setTimeout(() => check(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}
