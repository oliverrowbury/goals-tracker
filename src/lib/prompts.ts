// One question per day, cycling through the list — deterministic by date so
// everyone (eventually) sees the same prompt on the same day, and reloading
// the page never shows a different one.
// Each one is deliberately concrete — anchored to a specific person, moment,
// or thing rather than a pure abstract "what does X mean to you" question,
// which is easy to write but hard to actually sit down and answer.
const PROMPTS = [
  "Who's someone you're grateful to have in your life right now, and why?",
  "What's a small moment from the last few days that's stuck with you?",
  "What's something you've been avoiding — a task, a conversation, a decision?",
  "What's a compliment someone gave you that you still think about?",
  "What's one thing about your daily routine you'd change if you could?",
  "What's a worry that's been quietly sitting in the back of your mind?",
  "Describe a moment recently when you felt genuinely happy.",
  "What's something you did recently that you're proud of, even if no one noticed?",
  "Who's someone you'd like to reconnect with, and what's stopping you?",
  "What's a habit you have that you'd like to change?",
  "What's something you're looking forward to in the next few weeks?",
  "What's a decision you're currently putting off?",
  "What's a memory from when you were younger that still makes you smile?",
  "What's something you wish people understood about you?",
  "What's a place that makes you feel calm — when did you last go there?",
  "What's something you learned about yourself recently?",
  "What's a fear that's been holding you back lately?",
  "Who do you think of when you imagine being truly supported?",
  "What's something you've forgiven yourself for?",
  "What's a goal you have that you haven't told many people about?",
  "What's a boundary you've set, or want to set, with someone?",
  "What's something small that reliably improves your mood?",
  "What's a risk you've been thinking about taking?",
  "What's something you did today that felt genuinely like you?",
  "What's a piece of advice you'd give your younger self?",
  "What's a conversation you keep replaying in your head?",
  "What's something you're better at now than you were a year ago?",
  "What's a story from your life you like telling people?",
  "What's something you need to let go of?",
  "Who's someone that's shaped who you are, and how?",
  "Is there a comparison you make with someone else that isn't helping you?",
  "What's something you're currently curious about learning or trying?",
  "What does feeling properly rested actually look like for you?",
  "What's a compliment you'd give yourself right now, honestly?",
  "What's a pattern you keep noticing in how you react to things?",
  "What's something you did today purely for yourself?",
  "What's a question you wish someone would ask you more often?",
  "What's a belief about yourself you've outgrown?",
  "What's something you're excited about that you haven't told anyone yet?",
  "What's a small win from today that's easy to overlook?",
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
