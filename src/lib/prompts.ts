// One question per day, cycling through the list — deterministic by date so
// everyone (eventually) sees the same prompt on the same day, and reloading
// the page never shows a different one.
const PROMPTS = [
  "What's one thing you did today that your past self would be proud of?",
  "What's something you learned today, big or small?",
  "Who made your day better today, and how?",
  "What's a moment today you'd want to remember in a year?",
  "What did you avoid today that you know you shouldn't have?",
  "What's something you're looking forward to?",
  "If today had a headline, what would it be?",
  "What's one thing you'd do differently if you could replay today?",
  "What made you laugh today?",
  "What's a small win you almost didn't notice?",
  "What's something you're grateful for right now?",
  "What took more courage than usual today?",
  "What's a habit you kept up today, even when it was hard?",
  "What's something you said no to today, and how did it feel?",
  "What's on your mind that you haven't told anyone?",
  "What's a problem you solved today, however small?",
  "Where did your energy go today — and was it where you wanted it to go?",
  "What's something you're proud of that no one else noticed?",
  "What would you tell yourself this morning if you could?",
  "What's a risk you took today, or wish you had?",
  "What's something that annoyed you today, and why?",
  "What's a compliment you gave or received today?",
  "What did you do today purely because you wanted to, not because you had to?",
  "What's something you're curious about right now?",
  "What's a boundary you held today?",
  "What surprised you today?",
  "What's something you finished that had been hanging over you?",
  "What's a conversation that stuck with you today?",
  "What did you do today to take care of yourself?",
  "What's one thing you want to remember about this week?",
  "What's something you're avoiding thinking about?",
  "What's a small kindness you noticed today?",
  "What's something you're better at than you were a year ago?",
  "What did today teach you about what you actually want?",
  "What's a decision you're glad you made today?",
  "What's something you did today that scared you a little?",
  "What's a pattern you noticed in yourself today?",
  "What's one thing you'd change about how today went?",
  "What's something you're excited to try tomorrow?",
  "What's a moment today when you felt genuinely present?",
];

// Day-of-year in the same UTC sense used everywhere else in this app
// (dates are stored as midnight UTC calendar days).
function dayOfYear(dateISO: string): number {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
}

export function promptForDate(dateISO: string): string {
  return PROMPTS[dayOfYear(dateISO) % PROMPTS.length];
}
