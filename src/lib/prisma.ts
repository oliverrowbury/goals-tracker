import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Reuse one PrismaClient (and its connection pool) across hot reloads in
// dev instead of opening a new one on every file save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // `pg.Pool` defaults to up to 10 connections per instance — fine for one
  // long-lived server, but Vercel can spin up many concurrent serverless
  // function instances, each getting its own pool, which can add up past
  // Postgres's connection limit under real (or even light-but-bursty)
  // traffic and start failing new connections outright. Capped low since
  // each function instance only ever runs one request at a time anyway.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 3 });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
