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
