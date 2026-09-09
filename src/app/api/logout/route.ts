import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (token) {
    await prisma.user.updateMany({ where: { sessionToken: token }, data: { sessionToken: null } });
  }

  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
