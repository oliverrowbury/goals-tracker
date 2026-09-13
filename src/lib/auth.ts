export const AUTH_COOKIE = "gt_auth";

// The one account that gets to see everyone's feedback (see settings/page.tsx)
// — otherwise each new signup's feedback would sit invisible in their own
// account, since Feedback rows are scoped by userId like everything else.
export const ADMIN_EMAIL = "orowbury08@gmail.com";
