/**
 * Shared HTML sanitizers for user-influenced document content.
 *
 * Lab report notes, student names, titles and uploaded report HTML can all
 * carry attacker-controlled text. Every place that turns such text into
 * rendered/printed HTML must escape or sanitize through this module.
 */

const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape plain text for safe interpolation into HTML markup. */
export const escapeHtml = (text: string): string =>
  String(text ?? "").replace(/[&<>"']/g, (ch) => ENTITY_MAP[ch]);

const DANGEROUS_TAGS = "script, iframe, frame, object, embed, form, link[rel='import'], meta[http-equiv='refresh'], base";

const isDangerousUrl = (value: string): boolean => {
  const clean = value.toLowerCase().replace(/[\s\u0000-\u0020]+/g, "");
  return clean.startsWith("javascript:") || clean.startsWith("vbscript:") || clean.startsWith("data:text/html");
};

/** Parse an HTML string and strip scripts, active attributes and dangerous URLs. */
const cleanDoc = (doc: Document) => {
  doc.querySelectorAll(DANGEROUS_TAGS).forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || isDangerousUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  });
};

/**
 * Sanitize a complete HTML document (e.g. an uploaded lab report file)
 * before it is displayed in an iframe or opened for printing.
 * Preserves the document structure and styles; removes anything executable.
 */
export const sanitizeHtmlDocument = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    cleanDoc(doc);
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  } catch {
    // If parsing ever fails, strip tags wholesale rather than printing raw input.
    return `<!DOCTYPE html><html><body><pre style="white-space:pre-wrap;font-family:monospace">${escapeHtml(
      html.replace(/<[^>]*>/g, ""),
    )}</pre></body></html>`;
  }
};

/**
 * Sanitize an HTML fragment (e.g. a document body built from user-influenced
 * fields) before it is embedded into a printable document.
 */
export const sanitizeHtmlFragment = (fragment: string): string => {
  try {
    const doc = new DOMParser().parseFromString(`<body>${fragment}</body>`, "text/html");
    cleanDoc(doc);
    return doc.body.innerHTML;
  } catch {
    return escapeHtml(fragment.replace(/<[^>]*>/g, ""));
  }
};
