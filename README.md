# Proudly

A personal, all-in-one goals and accomplishment tracker for the Year 13 academic year.

The anchor is a **freeform daily journal** — write about your day, framed around
pride and accomplishment, with no forced prompts or streak pressure. Everything
else (goals, study sessions, workouts) is a practical tool that sits alongside
that journal and, where it makes sense, feeds a short summary back into the
day's entry.

See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md),
and [`docs/STACK.md`](docs/STACK.md) for the full plan before any code was written.

## Explicitly not building

- Alarms / countdown timers (the phone already does this well)
- AI-curated "expert advice" matching
- Social or community features
- Heavy gamification (badges, medals, etc.)

## Running it locally

Needs a Postgres database — see [Deploying](#deploying) below for how to get
a free one from Supabase. Once you have a `DATABASE_URL`:

```bash
npm install
cp .env.example .env      # only the first time — .env itself is gitignored, fill in DATABASE_URL
npx prisma migrate dev    # applies the schema to your database
npx prisma db seed        # creates your user, starter subjects, exercise library
npm run dev
```

Then open http://localhost:3000 and sign in with the password from `.env`
(`APP_PASSWORD`, `year13goals` by default — change it to whatever you like).

## Deploying

1. Create a free [Supabase](https://supabase.com) project — this is the Postgres database.
2. Project Settings → Database → Connection string → URI (the "Transaction pooler" one). That's your `DATABASE_URL`.
3. Import this repo into [Vercel](https://vercel.com) (Add New Project → your GitHub account → `goals-tracker`). It auto-detects Next.js.
4. In the Vercel project's Environment Variables, add `DATABASE_URL` and `APP_PASSWORD`.
5. Deploy.

## Status

**Phase 1 complete.**

- [x] Scaffolding — Next.js + Tailwind + Prisma (Postgres via Supabase, driver-adapter mode), password gate
- [x] Journal — write/edit one entry per day, prev/next day navigation
- [x] Goals — create/edit/archive, daily check-in, streaks, shown alongside the journal
- [x] Study timer — per-subject sessions, weekly totals, feeds today's sessions into the journal,
      and can auto-track a weekly-target goal directly (no manual logging needed for that goal)
- [ ] Phase 2 (workout tracker, notifications) — not started; see docs/BUILD_PLAN.md, treated as
      its own mini-project since it's flagged as the heaviest remaining piece
