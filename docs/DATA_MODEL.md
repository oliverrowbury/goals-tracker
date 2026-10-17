# Data model

Real multi-user accounts — every table is scoped by `user_id`, and nothing reads
across users except the friends feed (`Follow`, below), which is explicitly
gated by an accepted, one-directional follow (Instagram-style — needs the
other person's acceptance, but accepting never implies they follow back)
plus the other user's own per-category `share_*_streak` opt-in.

## User
| field | type | notes |
|---|---|---|
| id | uuid | |
| email | text | private — never shown to other users, including friends |
| username | text | public handle, unique — how people find/follow each other (`/friends/add/[username]`) |
| username_changed_at | timestamp, nullable | set whenever username actually changes (not on signup) — gates a 7-day change cooldown in settings/actions.ts |
| name | text | display name, not unique |
| xp | integer | simple points total; level is derived from this at display time rather than stored |
| share_journal_streak | boolean | opt-in: whether followers can see this user's journal streak |
| share_study_streak | boolean | opt-in: whether followers can see this user's study streak |
| share_workout_streak | boolean | opt-in: whether followers can see this user's workout streak |
| birthday | date, nullable | nullable at the schema level, but treated as required by the app — `/onboarding` gates the rest of the app behind it (see `hasCompletedProfile` in `lib/user.ts`) |
| gender | enum, nullable | `male` \| `female` \| `non_binary` \| `prefer_not_to_say`; same required-by-app-not-schema treatment as birthday |
| city | text, nullable | same required-by-app-not-schema treatment as birthday |
| bio | text, nullable | optional, shown on the Friends page profile card |
| pronouns | text, nullable | optional, freeform |
| avatar_url | text, nullable | optional, public URL of a photo uploaded to Supabase Storage |
| weight_kg | float, nullable | optional; canonical kg, converted to the user's `weight_unit` at the UI's edges same as Workout |
| height_cm | float, nullable | optional; canonical cm, converted to cm/in based on `distance_unit` (km ⇒ cm, mi ⇒ in) at the UI's edges |
| focus_tags | enum[] | `journaling` \| `goals` \| `study` \| `workouts` — not mutually exclusive, shown on the profile card |
| is_premium | boolean | Proudly Premium — manually toggled by the admin in Settings (`toggleUserPremium`), no payment processing yet. Gates the free-tier caps in `lib/limits.ts`, the weekly recap lock, the second streak freeze, PDF export, premium-exclusive badges, and AI workout advice |
| free_recap_shown_at | timestamp, nullable | free-tier users get the full weekly recap exactly once, ever — set the first time it's shown (via a client effect, not during the page's own render — see `MarkRecapSeen`), every recap after that is locked unless `is_premium` |
| created_at | timestamp | |

## JournalEntry
One row per calendar day. This table stores **only** what was freely written —
nothing auto-generated lives here. A day's page is assembled at read time by
combining this row with any `StudySession` / `Workout` rows on the same date.

| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| date | date | unique per user |
| body_text | text | freeform, no structure enforced |
| notes | text, nullable | a separate open freewrite, no set prompt — distinct from `body_text`'s own "what are you proud of" prompt |
| photo_url | text, nullable | optional photo attached from the journal editor — capped at 3 per user on the free tier (`FREE_LIMITS.PHOTOS_PER_CATEGORY`), Premium unlimited |
| created_at / updated_at | timestamp | |

## Goal
Free tier is capped at `FREE_LIMITS.GOALS` active goals — the cap only
blocks creating a new one past the limit, never touches existing goals.
Premium is unlimited.

| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| title | text | e.g. "Gym 3x a week" |
| description | text | optional |
| frequency_type | enum | `daily` \| `specific_days` \| `weekly_target` |
| target_days | day[] | used when `specific_days`, e.g. [Mon, Wed, Fri] |
| target_value | number | e.g. `10` for "10 minutes"; null for simple yes/no goals |
| unit | text | e.g. "minutes", "sessions"; null for yes/no goals |
| subject_id | uuid, nullable | when set, weekly total auto-tracks from `StudySession`, still toppable-up manually (see `GoalLog` below) |
| workout_metric | enum, nullable | `sessions` \| `minutes` — when set, weekly total auto-tracks from `Workout` instead; mutually exclusive with `subject_id` |
| active | boolean | |
| start_date / end_date | date | end_date nullable (ongoing) |
| created_at | timestamp | |

## GoalLog
One row per goal per day it's checked in. Streaks and history are computed by
querying consecutive `completed = true` rows — there's no separate streak
counter to keep in sync.

| field | type | notes |
|---|---|---|
| id | uuid | |
| goal_id | uuid | |
| date | date | |
| completed | boolean | |
| value | number | optional, for quantity goals (e.g. minutes studied). For an auto-tracked goal (`subject_id`/`workout_metric` set), this is a manual top-up on top of the auto-tracked total — not stored anywhere else, and never overwrites it — for when the timer/log missed something (see `GoalExtraInput`). |
| note | text | optional |

## Subject
For the study tracker. Free tier is capped at `FREE_LIMITS.SUBJECTS` active
subjects (new-creation only, same as Goal); Premium is unlimited.

| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| name | text | e.g. "Maths", "Physics", "EPQ" |
| color | text | for the UI |

## StudySession
One row per timer run.

| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| subject_id | uuid | |
| started_at / ended_at | timestamp | |
| duration_minutes | integer | derived, stored for easy querying |
| note | text | optional |
| visibility | enum | `private` \| `friends` — chosen on the post-finish summary screen; combines with the user's `share_study_streak` to gate the friend feed |

Indexed on `(user_id, started_at)` — every query here filters by user, usually with a date range too.

## Exercise
Pre-loaded library plus user-added custom exercises.

| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid, nullable | null = built-in library item |
| name | text | |
| category | text | e.g. "Push", "Pull", "Legs" |
| is_custom | boolean | |

## Workout
| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| type | enum | `strength` \| `cardio` |
| date | date | the calendar day this counts toward |
| label | text | e.g. "Push day" (strength) or "Run" (cardio) |
| started_at / ended_at | timestamp | nullable until finished — live timer state |
| duration_minutes | integer | derived from started_at/ended_at, stored for easy querying (same convention as `StudySession`) |
| distance_km | number, nullable | cardio only |
| route | json, nullable | cardio only — tracked GPS points `{lat, lng, t?, alt?}[]`; splits and elevation gain are derived from this at render time (see `lib/workout.ts`), not stored |
| visibility | enum | `private` \| `friends` — chosen on the post-finish summary screen; combines with the user's `share_workout_streak` to gate the friend feed |
| photo_url | text, nullable | optional photo attached on the post-finish summary screen — capped at 3 per user on the free tier (`FREE_LIMITS.PHOTOS_PER_CATEGORY`), Premium unlimited |
| note | text | optional — free text about the workout, editable both while it's open (WorkoutNoteField) and afterwards from the log (updateWorkoutDetails) |
| ai_advice | text, nullable | Premium only — short AI-generated note on this workout (`getAiWorkoutAdvice`), generated once and cached here so re-viewing never re-calls the API |
| ai_advice_generated_at | timestamp, nullable | set alongside `ai_advice`; also doubles as the per-user daily rate-limit counter (`DAILY_AI_ADVICE_LIMIT`) without a separate request-log table |

For `type = strength`, has `WorkoutSet` rows. For `type = cardio`, `distance_km` +
`duration_minutes` are the whole record — no sets.

Indexed on `(user_id, date)` — every query here filters by user, usually with a
date range too.

Everything on a finished workout is editable from the log, not just at
finish time: name, note, date, distance/duration (cardio), and per-set
weight/reps (strength) — see `updateWorkoutDetails`/`updateWorkoutSet` in
`workout/actions.ts`.

## WorkoutSet
| field | type | notes |
|---|---|---|
| id | uuid | |
| workout_id | uuid | |
| exercise_id | uuid | |
| set_number | integer | |
| reps | integer | |
| weight | number | |
| weight_unit | enum | `kg` \| `lb` |
| is_warmup | boolean | |

Indexed on `workout_id` (every set add/remove counts and lists by it — the
single most frequent write in the app) and `exercise_id` (grouped across a
user's whole history for the "last time" hint and the progression view).

Progression view = best (highest estimated-1RM) set per exercise per day,
across the same recent-workouts window used for "last time you did this"
(see `LAST_PERFORMED_LOOKBACK` in `workout/page.tsx`) rather than a
separate all-time query — /workout reloads on every set logged, so this
keeps that reload bounded regardless of how long someone's used the app.

## Reminder
Per-goal, not global — each goal picks its own days, plus which of the day's
fixed slots to fire in. Vercel's Hobby cron plan only lets a single job run
once a day, so "multiple times a day" is done with several separate cron
jobs instead of an arbitrary time — see `vercel.json` and
`src/app/api/cron/reminders/route.ts`.

| field | type | notes |
|---|---|---|
| id | uuid | |
| goal_id | uuid | |
| days_of_week | day[] | |
| slots | enum[] | `morning` \| `afternoon` \| `evening` \| `night`; each backed by its own cron job |
| channel | enum | `push` \| `email` |
| enabled | boolean | |

## Deadline
A specific date to hit (an exam, an assignment) — distinct from `Goal`, which
is a recurring habit rather than a one-off with a due date. Free tier is
capped at `FREE_LIMITS.DEADLINES` active (not-yet-completed) deadlines at
once (new-creation only); Premium is unlimited.

| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| title | text | |
| subject_id | uuid, nullable | optional link to a Subject, same idea as `Goal.subject_id` |
| due_date | date | |
| due_time | text | "HH:mm", defaults to end of day — combined with due_date for reminder timing |
| notes | text | optional |
| completed | boolean | |
| created_at | timestamp | |

## DeadlineReminderSent
Tracks which reminders have actually gone out for a deadline, so an hourly
cron check (see `vercel.json` and `src/app/api/cron/deadline-reminders/route.ts`)
never double-sends the same one.

| field | type | notes |
|---|---|---|
| id | uuid | |
| deadline_id | uuid | |
| kind | enum | `week_before` \| `day_before` \| `hour_before` |
| sent_at | timestamp | |

Unique on `(deadline_id, kind)`.

## Follow
Instagram-style private-by-default follow: requesting to follow someone
needs their acceptance (`status` starts `pending`, flips to `accepted` on
their say-so), but that acceptance is still one-directional — `follower_id`
and `following_id` aren't a symmetric pair the way the old `Friendship`
model's requester/addressee was, and accepting a request never creates or
implies the reverse row. If A follows B (`accepted`), A sees B's shared
content; B seeing A's back requires B's own separate `Follow` row toward A,
accepted on its own. A `FRIENDS`-visibility activity (see
`ActivityVisibility` on `Workout`/`StudySession`) shows to whoever has an
`accepted` follow on its owner.

| field | type | notes |
|---|---|---|
| id | uuid | |
| follower_id | uuid | the user doing the following |
| following_id | uuid | the user being followed |
| status | enum | `pending` \| `accepted` |
| created_at | timestamp | |

Unique on `(follower_id, following_id)`. Also indexed on `following_id` alone,
since "who follows me" / "my incoming requests" (feed + follower-count)
lookups filter by it just as often.

## Cheer
A "like" on one specific activity (a workout or study session) in a
friend's activity feed on the Friends page — not a once-a-day thing.
Exactly one of `workout_id`/`study_session_id` is set per row. Plain string
FKs, not enforced foreign keys — a like on since-deleted activity just
stops showing up in the feed, no cleanup needed.

| field | type | notes |
|---|---|---|
| id | uuid | |
| from_user_id | uuid | |
| to_user_id | uuid | |
| workout_id | uuid, nullable | set when liking a workout |
| study_session_id | uuid, nullable | set when liking a study session |
| created_at | timestamp | |

Unique on `(from_user_id, workout_id)` and `(from_user_id, study_session_id)`
separately — one like per person per activity. Also indexed on `workout_id`
and `study_session_id` alone, since the friend feed's like-count lookup
filters by those directly, not by `from_user_id`.

## Message
Direct messages between two users, gated to mutual follows only (see
`src/lib/friends.ts`'s `isMutualFollow`) — a stricter bar than `Follow`
itself, which is one-directional. There's no separate thread/conversation
table: a thread is just "every `Message` between these two `user_id`s,"
derived at query time the same way pace/splits are derived on `Workout`
rather than stored.

| field | type | notes |
|---|---|---|
| id | uuid | |
| sender_id | uuid | |
| recipient_id | uuid | |
| body | text | plain text, capped at 2000 characters at the application layer |
| created_at | timestamp | |
| read_at | timestamp, nullable | set when the recipient opens the thread |

Indexed on `(sender_id, recipient_id, created_at)` and
`(recipient_id, sender_id, created_at)` — one per direction, since a thread
lookup is "every message between A and B, either direction." Also indexed
on `(recipient_id, read_at)` for the unread-count nav badge and mark-as-read
queries, which filter by recipient alone.

## UserBadge
A fixed, curated set of milestones (first journal entry, streaks, XP levels,
lifetime workout/study totals, first follow, time-of-day, etc. — the full
list and copy lives in `src/lib/badgeInfo.ts`, imported by both the
server-only award logic in `src/lib/badges.ts` and the client-side
`AchievementWatcher` toast) rather than an open-ended point system, so each badge
means something specific. Awarded automatically from the same actions that
award XP; `AchievementWatcher` (mounted in the (main) layout) diffs the current
user's badges against what it's already shown (tracked in localStorage) and
pops up a toast for anything earned in roughly the last few minutes — not a
push mechanism, just piggybacking on the router refresh every award-eligible
action already triggers.

| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| badge | enum | see `src/lib/badges.ts` for the full set and their descriptions |
| earned_at | timestamp | |

Unique on `(user_id, badge)`.

A handful of badges are Premium-exclusive extended tiers sitting further out
on the same milestone ladders (e.g. a 365-day streak, level 100, 250
lifetime workouts) rather than a separate badge pool — gated by `is_premium`
at award time in `lib/badges.ts`, so a free user who hits the same number
just doesn't unlock the badge for it. `PREMIUM_SUPPORTER` is awarded once,
automatically, when Premium is turned on for a user.

## CalendarEvent
A manual, Notion/Google-Calendar-style entry a user adds to a specific day —
distinct from the calendar's other dots (journal/goal/study/deadline),
which are all derived live from their own tables, not stored here. Shown
and managed from the day page (`calendar/[date]`), any day past, today, or
future.

| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| title | text | |
| date | date | the day this event is on |
| time | text, nullable | freeform, e.g. "14:30" — not combined with `date` into a single timestamp |
| notes | text, nullable | |
| created_at | timestamp | |

Indexed on `(user_id, date)`.

## Relationships

```
User 1─* JournalEntry
User 1─* Goal 1─* GoalLog
User 1─* Subject 1─* StudySession
User 1─* Exercise (custom only)
User 1─* Workout 1─* WorkoutSet *─1 Exercise
User 1─* Deadline *─1 Subject (optional)
Deadline 1─* DeadlineReminderSent
User 1─* Follow (as follower) *─1 User (as followed)
User 1─* Cheer (as sender) *─1 User (as recipient)
User 1─* Message (as sender) *─1 User (as recipient)
User 1─* UserBadge
Goal 1─* Reminder
```

No foreign key ever points *into* JournalEntry from Goal/StudySession/Workout —
the connection is a same-date query, not a stored relationship. That's what
keeps the journal "freeform" while still feeling connected to the rest of the app.
