export function formatMinutes(totalMinutes: number): string {
  const mins = Math.round(totalMinutes);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

// Checked in order (first match wins) against a lowercased subject name —
// specific subjects before the generic terms they'd otherwise also match
// (e.g. "Computer Science" would hit "science" first if that came earlier).
// UK-A-level-biased since that's who this app is actually built for, but
// the keywords are common enough to catch most GCSE/degree subjects too.
const SUBJECT_EMOJI_KEYWORDS: [string, string][] = [
  ["maths", "🧮"],
  ["math", "🧮"],
  ["computer", "💻"],
  ["computing", "💻"],
  ["coding", "💻"],
  ["programming", "💻"],
  ["physics", "⚛️"],
  ["chemistry", "🧪"],
  ["biology", "🧬"],
  ["science", "🔬"],
  ["english", "📖"],
  ["literature", "📖"],
  ["history", "🏛️"],
  ["geography", "🌍"],
  ["french", "🗣️"],
  ["spanish", "🗣️"],
  ["german", "🗣️"],
  ["language", "🗣️"],
  ["art", "🎨"],
  ["design", "🎨"],
  ["music", "🎵"],
  ["drama", "🎭"],
  ["theatre", "🎭"],
  ["pe", "🏃"],
  ["sport", "🏃"],
  ["physical education", "🏃"],
  ["economics", "📈"],
  ["business", "📈"],
  ["psychology", "🧠"],
  ["sociology", "🧠"],
  ["philosophy", "🤔"],
  ["religious", "🤔"],
  ["ethics", "🤔"],
  ["law", "⚖️"],
  ["politics", "🏛️"],
  ["media", "🎬"],
  ["film", "🎬"],
];

// Generic round-robin fallback for anything that doesn't match a keyword —
// same "no picker UI, just something sensible" treatment the color
// rotation above already gets.
const SUBJECT_EMOJI_FALLBACK = ["📘", "📝", "📚", "🗂️", "✏️"];

export function pickSubjectEmoji(name: string, fallbackIndex: number): string {
  const lower = name.toLowerCase();
  for (const [keyword, emoji] of SUBJECT_EMOJI_KEYWORDS) {
    if (lower.includes(keyword)) return emoji;
  }
  return SUBJECT_EMOJI_FALLBACK[fallbackIndex % SUBJECT_EMOJI_FALLBACK.length];
}
