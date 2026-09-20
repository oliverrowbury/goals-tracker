import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET, not a form action — this is a link clicked straight out of an
// email, which might land in a browser with no session at all (a
// different device, a link opened from a mail app's in-app browser).
// Verifying doesn't require being logged in as this exact user; whoever
// controls the inbox proved that by receiving the token in the first
// place. Public route — see proxy.ts's matcher.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (token) {
    const user = await prisma.user.findUnique({ where: { verifyToken: token } });
    if (user && user.verifyTokenExpiresAt && user.verifyTokenExpiresAt > new Date() && !user.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date(), verifyToken: null, verifyTokenExpiresAt: null },
      });
    }
  }

  // Same destination whether it worked, was already used, or was expired
  // — proxy.ts sends an unauthenticated visitor on to /login itself, and
  // a logged-in one just lands back in the app with (or without) the
  // reminder banner depending on whether emailVerifiedAt actually got set.
  return NextResponse.redirect(new URL("/", request.url));
}
