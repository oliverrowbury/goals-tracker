# Build plan

Two phases. Phase 1 must be live and in daily use before Phase 2 starts —
no exceptions, even if Phase 2 ideas are more exciting to build.

## Phase 1 — core loop

Goal: something used every single day within about 4 weeks.

1. **Scaffolding** — project setup, single-user auth (password gate is enough
   to start), deployed skeleton with nothing in it yet. Getting *something*
   live on day one matters more than it having features.
2. **Journal** — create/edit one entry per date, a simple calendar or list to
   navigate between days.
3. **Goals** — create/edit goals, daily check-in, streak/history view,
   rendered on the same page as that day's journal entry (not a separate tab).
4. **Study timer** — start/stop a timer against a subject, log to
   `StudySession`, weekly per-subject totals, and let a goal reference a
   subject's weekly total (e.g. "5 hours of Maths this week").
5. **Polish + daily-use checkpoint** — no new modules here. Fix whatever's
   annoying about actually using it every day. This is the gate before Phase 2.

## Phase 2 — once Phase 1 is a real habit

Goal: consolidate the workout tracker and, last, notifications.

6. **Exercise library** — seed ~50-100 common exercises, plus a form to add
   custom ones.
7. **Workout logging** — log sets/reps/weight against an exercise, workout
   history list.
8. **Progression view** — chart of max weight (or estimated 1RM) per exercise
   over time.
9. **Rest timer** — simple countdown between sets, once logging itself works.
10. **Auto-feed into journal** — a finished workout writes a one-line summary
    (e.g. "Workout logged: Push day") that shows on that day's journal view,
    without living inside the freeform text itself.
11. **Notifications** — goal-specific, schedulable nudges. Flagged now: this
    needs a real background job plus a delivery channel, which is a bigger
    technical lift than everything above combined. If it threatens to eat
    more than ~1-2 weeks, cut scope to email-only rather than building push
    infrastructure.

## Working agreement

- Don't start item *n+1* until item *n* is something actually being used, not
  just something that compiles.
- If the workout tracker (items 6-9) is taking noticeably longer than the
  rest of Phase 1 combined, stop and simplify rather than pushing through —
  flag it and we'll cut scope together.
