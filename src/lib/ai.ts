import Anthropic from "@anthropic-ai/sdk";

// Server-only — reads ANTHROPIC_API_KEY from the environment, same pattern
// as lib/storage.ts's Supabase client. Lazily constructed so a dev
// environment with no key set doesn't crash at import time, only when a
// Premium user actually requests advice.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const MODEL = "claude-haiku-5-5";

export type WorkoutAdviceInput = {
  label: string;
  type: "STRENGTH" | "CARDIO";
  durationMinutes: number | null;
  distanceKm: number | null;
  exercises: { name: string; sets: { reps: number; weight: number; weightUnit: "KG" | "LB"; isWarmup: boolean }[] }[];
};

// Short, templated advice on a single just-finished workout — form cues,
// a progression suggestion, a recovery note. Deliberately terse (capped
// output tokens) since this is a quick post-workout note, not a coaching
// essay, and every token here is billed.
export async function generateWorkoutAdvice(input: WorkoutAdviceInput): Promise<string> {
  const lines: string[] = [`Workout: "${input.label}" (${input.type === "CARDIO" ? "cardio" : "strength"})`];
  if (input.durationMinutes) lines.push(`Duration: ${input.durationMinutes} min`);
  if (input.distanceKm) lines.push(`Distance: ${input.distanceKm.toFixed(2)} km`);
  for (const ex of input.exercises) {
    const setsDesc = ex.sets
      .map((s) => `${s.isWarmup ? "warmup " : ""}${s.reps}×${s.weight}${s.weightUnit.toLowerCase()}`)
      .join(", ");
    lines.push(`- ${ex.name}: ${setsDesc}`);
  }

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    system:
      "You are a friendly, knowledgeable fitness coach giving brief feedback on one workout a user just logged in a fitness app. " +
      "Respond in 2-4 short sentences (no headings, no bullet points, no markdown) — a mix of what went well, a form or " +
      "programming cue if relevant, and one concrete suggestion for next time. Be specific to the numbers given, not generic. " +
      "Never invent facts about the user you weren't given.",
    messages: [{ role: "user", content: lines.join("\n") }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text.trim() : "";
}

export type PersonalizedPromptInput = {
  // Last 7 days of mood check-ins, most recent first — no journal body
  // text is sent, only the numeric mood scores, so a user's actual private
  // writing never leaves the app.
  recentMoods: number[];
  journaledDaysThisWeek: number;
  goalsCompletedThisWeek: number;
  workoutsThisWeek: number;
  studyMinutesThisWeek: number;
};

// A single reflective journaling question, tailored to how the last week's
// actually gone rather than the fixed, date-cycling list everyone else
// gets (lib/prompts.ts) — same terse, concrete style as that list, just
// pointed at this one user's recent pattern instead of being generic.
export async function generatePersonalizedPrompt(input: PersonalizedPromptInput): Promise<string> {
  const lines: string[] = [];
  if (input.recentMoods.length > 0) lines.push(`Mood check-ins this week (1=low, 5=great): ${input.recentMoods.join(", ")}`);
  lines.push(`Journaled ${input.journaledDaysThisWeek} day(s) this week`);
  lines.push(`Completed ${input.goalsCompletedThisWeek} goal check-in(s) this week`);
  lines.push(`${input.workoutsThisWeek} workout(s) this week`);
  if (input.studyMinutesThisWeek > 0) lines.push(`${input.studyMinutesThisWeek} minutes studied this week`);

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 100,
    system:
      "You write a single journaling prompt for today, for a user of a journal/goals app, based on a short summary of " +
      "their last 7 days (mood check-ins, journaling, goals, workouts, study time). Respond with ONLY the question itself — " +
      "no preamble, no quotes, no markdown. One sentence, concrete and specific to the pattern in the data given (e.g. a " +
      "low-mood streak, a goal drought, a busy week), not a generic 'how are you feeling' question. If the data doesn't " +
      "suggest anything specific, ask a warm, concrete reflective question in the same style. Never invent facts you " +
      "weren't given.",
    messages: [{ role: "user", content: lines.join("\n") }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text.trim() : "";
}
