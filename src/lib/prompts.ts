// One question per day, cycling through the list — deterministic by date so
// everyone (eventually) sees the same prompt on the same day, and reloading
// the page never shows a different one.
const PROMPTS = [
  "What's been on your mind lately that you haven't told anyone?",
  "What's something you're grateful for right now?",
  "Who in your life makes you feel most like yourself?",
  "What's a fear you have that you don't talk about much?",
  "What does a good life look like to you right now?",
  "What's something you're proud of that no one else really noticed?",
  "What's a belief you hold that's changed in the last year or two?",
  "What are you avoiding thinking about?",
  "What's something you're looking forward to?",
  "What's a risk you'd take if you knew you couldn't fail?",
  "What's something you're better at than you used to be?",
  "What does your ideal ordinary day look like?",
  "What's a compliment you'd like to hear more often?",
  "What's a boundary you wish you held more often?",
  "Who do you compare yourself to, and what does that comparison actually get you?",
  "What's something you're curious about right now?",
  "What would you do differently if you weren't worried what people think?",
  "What's a habit you'd like to build, and what's stopping you?",
  "What's a decision that quietly shaped who you are now?",
  "What do you need more of in your life at the moment?",
  "What do you need less of?",
  "What's something you know about yourself that took you a while to accept?",
  "What's a compliment you'd give yourself if you were being honest?",
  "What's something you keep meaning to say to someone?",
  "What does support look like when you actually need it?",
  "What's a small thing that reliably makes you feel better?",
  "What's something you're holding onto that you could probably let go of?",
  "What would you want someone to understand about you right now?",
  "What's a version of success that isn't about achievement?",
  "What's something you've forgiven yourself for, or still need to?",
  "What's a memory that still makes you smile?",
  "What are you genuinely excited about at the moment?",
  "What's something you want people to know without having to say it?",
  "What does rest actually look like for you, versus what you think it should look like?",
  "What's a pattern in your life you keep noticing?",
  "What would you tell a younger version of yourself?",
  "What's something you're doing purely because you want to, not because you feel you should?",
  "What does being proud of yourself actually feel like?",
  "What's something you've been putting off that isn't really about time?",
  "What's a question you wish someone would ask you?",
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
