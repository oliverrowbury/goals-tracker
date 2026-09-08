# Data model

One user for now, but every table is scoped by `user_id` so the app never has to be
rewritten if that changes.

## User
| field | type | notes |
|---|---|---|
| id | uuid | |
| email | text | |
| name | text | |
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
| date | date | |
| label | text | e.g. "Push day" |
| started_at / ended_at | timestamp | nullable until finished |
| note | text | optional |

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

## Reminder (Phase 2)
| field | type | notes |
|---|---|---|
| id | uuid | |
| goal_id | uuid | |
| days_of_week | day[] | |
| time_of_day | time | |
| channel | enum | `push` \| `email` |
| enabled | boolean | |

## Relationships

```
User 1─* JournalEntry
User 1─* Goal 1─* GoalLog
User 1─* Subject 1─* StudySession
User 1─* Exercise (custom only)
User 1─* Workout 1─* WorkoutSet *─1 Exercise
Goal 1─* Reminder
```

No foreign key ever points *into* JournalEntry from Goal/StudySession/Workout —
the connection is a same-date query, not a stored relationship. That's what
keeps the journal "freeform" while still feeling connected to the rest of the app.
