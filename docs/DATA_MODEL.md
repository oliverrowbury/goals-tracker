# Data model

Real multi-user accounts — every table is scoped by `user_id`, and nothing reads
across users except the friends feed (`Friendship`, below), which is explicitly
gated by an accepted friendship plus the other user's own `share_activity` opt-in.

## User
| field | type | notes |
|---|---|---|
| id | uuid | |
| email | text | |
| name | text | |
| accent_theme | enum | `terracotta` \| `ocean` \| `forest` \| `berry` \| `slate` — Settings → Appearance |
| xp | integer | simple points total; level is derived from this at display time rather than stored |
| share_activity | boolean | opt-in: whether accepted friends can see this user's streaks/level |
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
| created_at / updated_at | timestamp | |

## Goal
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
| subject_id | uuid, nullable | when set, weekly total auto-tracks from `StudySession` instead of manual `GoalLog.value` entry |
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
| value | number | optional, for quantity goals (e.g. minutes studied) |
| note | text | optional |

## Subject
For the study tracker.

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
| distance_km | number, nullable | cardio only, manually entered — no GPS tracking |
| note | text | optional |

For `type = strength`, has `WorkoutSet` rows. For `type = cardio`, `distance_km` +
`duration_minutes` are the whole record — no sets.

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

Progression view = all `WorkoutSet` rows for one exercise, ordered by the parent
workout's date, tracking max weight (or estimated 1RM) over time.

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
is a recurring habit rather than a one-off with a due date.

| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| title | text | |
| subject_id | uuid, nullable | optional link to a Subject, same idea as `Goal.subject_id` |
| due_date | date | |
| notes | text | optional |
| completed | boolean | |
| created_at | timestamp | |

## Friendship
One row per pair, not two — whoever adds first is the requester. `status`
starts `pending`; the addressee accepting flips the same row to `accepted`
rather than creating a second row. If the addressee had *already* sent
their own request first, adding back accepts that one instead of leaving
two crossed pending rows for the same pair.

| field | type | notes |
|---|---|---|
| id | uuid | |
| requester_id | uuid | the user who sent the request |
| addressee_id | uuid | the user who received it |
| status | enum | `pending` \| `accepted` |
| created_at | timestamp | |

Unique on `(requester_id, addressee_id)` — direction-specific, so the "already
requested the other way" case is checked in application code, not the schema.

## Relationships

```
User 1─* JournalEntry
User 1─* Goal 1─* GoalLog
User 1─* Subject 1─* StudySession
User 1─* Exercise (custom only)
User 1─* Workout 1─* WorkoutSet *─1 Exercise
User 1─* Deadline *─1 Subject (optional)
User 1─* Friendship (as requester) *─1 User (as addressee)
Goal 1─* Reminder
```

No foreign key ever points *into* JournalEntry from Goal/StudySession/Workout —
the connection is a same-date query, not a stored relationship. That's what
keeps the journal "freeform" while still feeling connected to the rest of the app.
