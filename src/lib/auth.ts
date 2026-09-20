import { headers } from "next/headers";

export const AUTH_COOKIE = "gt_auth";

// The app's own origin, built from the incoming request's headers rather
// than a hardcoded env var — works the same on the real domain, a Vercel
// preview URL, or localhost, with no separate "public site URL" setting to
// keep in sync. Only meaningful inside a request (a Server Action or route
// handler), never at build/module-init time.
export async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

// Where to send someone after they log in, when they were redirected to
// /login from some other protected page — a cookie rather than a
// `?from=` query param, because Safari's Password AutoFill remembers the
// exact URL a saved credential was used on and replays it verbatim next
// time (via the QuickType bar, Face ID prompt, or the Passwords app), so a
// query string baked into the login URL becomes a permanent, wrong
// redirect target the moment a password gets saved on it. A cookie rides
// along with the request instead, so the login page's own URL always stays
// the plain, stable `/login` Safari can safely remember as "the sign-in
// page" for this site.
export const LOGIN_REDIRECT_COOKIE = "gt_login_redirect";

// Set by /api/login on a successful login, read once by (main)/layout.tsx
// to know this particular page load is the moment someone just arrived —
// that's what gates the homepage's slide-in entrance and the mood-modal's
// delayed pop after it (see globals.css's page-slide-in/mood-modal-in).
// A short maxAge (rather than clearing it explicitly) is the whole
// mechanism for making this a one-time thing: it naturally can't still be
// there on any request that isn't the redirect immediately following login.
export const WELCOME_COOKIE = "gt_welcome";
export const WELCOME_COOKIE_MAX_AGE_S = 8;

// The one account that gets to see everyone's feedback (see settings/page.tsx)
// — otherwise each new signup's feedback would sit invisible in their own
// account, since Feedback rows are scoped by userId like everything else.
export const ADMIN_EMAIL = "orowbury08@gmail.com";
