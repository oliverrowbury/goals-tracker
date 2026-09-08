# Goals & Accomplishment Tracker

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

```bash
npm install
cp .env.example .env      # only the first time — .env itself is gitignored
npx prisma migrate dev    # creates prisma/dev.db and applies the schema
npx prisma db seed        # creates your user, starter subjects, exercise library
npm run dev
```

Then open http://localhost:3000 and sign in with the password from `.env`
(`APP_PASSWORD`, `year13goals` by default — change it to whatever you like).

## Status

**Phase 1, in progress.**

- [x] Scaffolding — Next.js + Tailwind + Prisma (SQLite locally), password gate
- [x] Journal — write/edit one entry per day, prev/next day navigation
- [ ] Goals — daily check-in, streaks, shown alongside the journal
- [ ] Study timer — per-subject sessions, weekly totals
- [ ] Phase 2 (workout tracker, notifications) — not started; see docs/BUILD_PLAN.md
