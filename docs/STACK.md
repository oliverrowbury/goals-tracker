# Stack

Chosen for: solo, still-learning-to-code builder, working on this across a
whole academic year, wants to actually understand what's running.

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (TypeScript) | One framework for both the UI and the API — no separate backend service to run or deploy. Huge amount of beginner-friendly documentation and tutorials. |
| Styling | Tailwind CSS | Build a clean UI without needing deep CSS knowledge; classes read like a description of what you want. |
| Database | PostgreSQL via Supabase (free tier) | A real relational database, which matches this data model directly (goals → goal logs, workouts → sets). Supabase also gives a table UI you can look at directly, which helps a lot while learning what your app is actually storing. |
| ORM | Prisma | Schema maps 1:1 onto `docs/DATA_MODEL.md`. Type-safe queries (autocomplete, and mistakes get caught before running the app). Handles migrations for you. |
| Auth | Single password gate to start | You're the only user — a full auth system is unnecessary complexity for Phase 1. Swap to Supabase Auth later only if multi-device login without a shared password becomes worth it. |
| Hosting | Vercel (free tier) | Deploys straight from GitHub, zero server config, matches Next.js natively. |
| Phase 2 notifications | Web push (service worker) + a Vercel cron job checking goal logs | No SMS cost, no separate backend service. Email (via a simple provider like Resend) is the fallback if push turns out to be too much friction. |

## Why not other common options

- **Firebase** instead of Supabase — works fine, but its data model (NoSQL
  documents) fits this schema worse; the goals/logs/sets relationships here
  are naturally relational.
- **Separate backend (Express/FastAPI) + separate frontend** — more moving
  parts to deploy and keep in sync than a solo beginner project needs. Next.js
  API routes cover everything this app requires.
- **Mobile-native app** — a responsive web app covers "check in from my
  phone" without needing App Store accounts, native build tooling, or two
  codebases.
