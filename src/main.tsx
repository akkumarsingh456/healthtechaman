import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Lovable adds this badge to the published HTML outside the React app.
function personalizePublishedBadge() {
  const badgeLabel = document.getElementById("lovable-badge-cta");
  if (!badgeLabel) return;

  badgeLabel.textContent = "Aman Kumar";
  badgeLabel.removeAttribute("href");
  badgeLabel.removeAttribute("target");
  badgeLabel.removeAttribute("rel");
  badgeLabel.setAttribute("aria-label", "Aman Kumar");
  badgeLabel.removeAttribute("title");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", personalizePublishedBadge, { once: true });
} else {
  personalizePublishedBadge();
}

createRoot(document.getElementById("root")!).render(<App />);
