import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Proxy (formerly "middleware") runs on the Node.js runtime by default as
// of Next.js 16, so — unlike the old Edge-only middleware — it can just
// check the session against the database directly. No signed tokens, no
// duplicating the password anywhere: the cookie is only ever an opaque
// session id.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (token) {
    const user = await prisma.user.findUnique({ where: { sessionToken: token } });
    if (user) {
      return NextResponse.next();
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except the login page itself, its API route, the legal
  // pages (readable without an account, like any privacy policy/terms
  // page), Next.js internals, the service worker, and the cron route —
  // the latter is called by Vercel Cron (no session cookie) and checks
  // CRON_SECRET itself.
  matcher: ["/((?!login|privacy|terms|api/login|api/cron|sw\\.js|_next/static|_next/image|favicon.ico).*)"],
};
