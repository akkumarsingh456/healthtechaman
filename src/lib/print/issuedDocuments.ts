import { supabase } from "@/integrations/supabase/client";

/** Public site so QR codes open for anyone, without login. */
export const PUBLIC_ORIGIN = "https://campus-care-amankumar456.lovable.app";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Unique, unguessable verification code (16 chars). */
export const newVerificationCode = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
};

export const getCodeVerifyUrl = (code: string) => `${PUBLIC_ORIGIN}/verify?code=${code}`;

/** Make relative asset URLs absolute so the saved copy renders anywhere. */
const absolutize = (html: string) =>
  html.replace(/(src|href)=(["'])\/(?!\/)/g, `$1=$2${PUBLIC_ORIGIN}/`);

/** Saves an exact snapshot of an issued document, linked to its QR code. */
export const saveIssuedDocument = async (opts: {
  code: string;
  docType: string;
  title: string;
  html: string;
  sourceId?: string;
}) => {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("issued_documents").insert({
      code: opts.code,
      doc_type: opts.docType.slice(0, 80),
      title: opts.title.slice(0, 300),
      html: absolutize(opts.html),
      source_id: opts.sourceId?.slice(0, 120) ?? null,
      issued_by: data.user.id,
    });
    if (error) console.warn("QR snapshot save failed", error.message);
  } catch (e) {
    console.warn("QR snapshot save failed", e);
  }
};
