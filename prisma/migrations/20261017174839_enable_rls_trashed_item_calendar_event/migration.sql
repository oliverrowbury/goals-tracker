-- Match every other table's RLS posture: enabled with no policies, which
-- denies all direct PostgREST access by default. The app itself never goes
-- through PostgREST (Prisma connects over the plain Postgres connection
-- string), so this is defense-in-depth rather than something the app
-- depends on, but it's what the Supabase linter expects and what every
-- pre-existing table already does.
ALTER TABLE "TrashedItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent" ENABLE ROW LEVEL SECURITY;
