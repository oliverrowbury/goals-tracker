import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

// A relative `file:./dev.db` URL in DATABASE_URL is resolved by `prisma
// migrate`/`prisma db seed` relative to prisma/schema.prisma, but resolved
// by the generated client at runtime relative to its own output directory
// (src/generated/prisma) — two different bases for the same string. Turning
// it into an absolute path here, anchored to the project root, sidesteps
// that mismatch. Non-file URLs (e.g. a real Postgres connection string once
// this moves off SQLite) pass through untouched.
function resolveDatasourceUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) {
    const relativePath = url.slice("file:".length);
    return `file:${path.resolve(process.cwd(), "prisma", relativePath)}`;
  }
  return url;
}

// Reuse one PrismaClient across hot reloads in dev instead of opening a
// new database connection on every file save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: resolveDatasourceUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
