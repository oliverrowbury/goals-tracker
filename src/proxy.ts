import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, LOGIN_REDIRECT_COOKIE } from "@/lib/auth";
import { CURRENT_USER_HEADER } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// Proxy (formerly "middleware") runs on the Node.js runtime by default as
// of Next.js 16, so — unlike the old Edge-only middleware — it can just
// check the session against the database directly. No signed tokens, no
// duplicating the password anywhere: the cookie is only ever an opaque
// session id.
//
// The user row fetched here is forwarded to the page/action via a request
// header (read by lib/user.ts's getCurrentUser) so it doesn't have to look
// the session up again — every protected route was hitting the database
// twice for the same row on every single request before this. The header
// never reaches the browser (Next.js only forwards it into the app's own
// server-side request handling), so this is the same trust boundary as
// keeping it in a shared variable, just across the proxy/page split
// Next.js requires.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (token) {
    const user = await prisma.user.findUnique({ where: { sessionToken: token } });
    if (user) {
      const headers = new Headers(request.headers);
      // Header values have to be plain ASCII (the Fetch API's ByteString
      // restriction) — anything a user typed into a free-text profile field
      // (bio, pronouns, name) can contain characters outside that range, so
      // the raw JSON can't go in directly. Base64 is ASCII by construction
      // regardless of what's inside it, so this can never throw here no
      // matter what someone's put in their profile.
      headers.set(CURRENT_USER_HEADER, Buffer.from(JSON.stringify(user), "utf-8").toString("base64"));
      return NextResponse.next({ request: { headers } });
    }
  }

  // The login URL itself stays plain (no `?from=`) — see LOGIN_REDIRECT_COOKIE's
  // comment in lib/auth.ts for why that matters for Safari's saved passwords.
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(LOGIN_REDIRECT_COOKIE, request.nextUrl.pathname, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });
  return response;
}

export const config = {
  // Everything except the login page and its API route, the signup page
  // (its form now runs as a server action under this same route, so there's
  // no separate api/signup anymore), forgot/reset-password and email
  // verification (all reachable by someone who isn't logged in yet, by
  // definition), the legal pages (readable without an account, like any
  // privacy policy/terms page), Next.js internals, the service worker, the
  // cron route (called by Vercel Cron, no session cookie — checks
  // CRON_SECRET itself), and the manifest/icon/robots/sitemap/OG-image
  // routes a browser or crawler fetches on its own before any cookie
  // exchange happens (Add to Home Screen, tab favicon, a link preview) —
  // gating those behind login would silently turn every one of them into a
  // redirect to /login instead of the actual file (a broken social preview
  // being the most visible way that'd show up).
  matcher: [
    "/((?!login|signup|forgot-password|reset-password|api/verify-email|privacy|terms|api/login|api/cron|sw\\.js|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml).*)",
  ],
};
