// Free-tier caps for Proudly Premium — one place for every number so
// they're never duplicated (and never drift) between the check at
// creation time and whatever copy tells someone why they're blocked.
// Caps only ever block *new* creation, never touch something someone
// already has, even if they're over the cap because it just changed or
// Premium lapsed — see each call site.
export const FREE_LIMITS = {
  GOALS: 5,
  DEADLINES: 3,
  SUBJECTS: 5,
  PHOTOS_PER_CATEGORY: 3,
} as const;

export const STREAK_FREEZES_PER_WINDOW = { FREE: 1, PREMIUM: 2 } as const;
