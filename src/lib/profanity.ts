import filter from "leo-profanity";

// Usernames are a single token (no spaces — see USERNAME_RE in constants.ts),
// but leo-profanity's own `check()` only does whole-word lookups split on
// whitespace, so "fuckboy123" as one token would slip straight past it. We
// instead do our own substring scan against its dictionary.
//
// Only words of 4+ characters are used for the scan — leo-profanity's list
// includes very short entries ("ass", "cum", "sex", …) that are also
// substrings of completely ordinary words ("class", "assassin", "cucumber",
// "essex"), and a false-positive block on signup is worse than letting a
// handful of short, milder words through.
const BAD_WORDS = filter.list().filter((w) => w.length >= 4);

// Cheap leetspeak/typo normalization so "fu_ck" or "sh1t" still get caught,
// without going as far as full fuzzy matching.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/_/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
}

export function containsProfanity(text: string): boolean {
  const normalized = normalize(text);
  return BAD_WORDS.some((word) => normalized.includes(word));
}
