export const AUTH_COOKIE = "gt_auth";

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

// The one account that gets to see everyone's feedback (see settings/page.tsx)
// — otherwise each new signup's feedback would sit invisible in their own
// account, since Feedback rows are scoped by userId like everything else.
export const ADMIN_EMAIL = "orowbury08@gmail.com";
