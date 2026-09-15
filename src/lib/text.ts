// The `autoCapitalize` HTML attribute only hints to mobile virtual
// keyboards — desktop browsers ignore it entirely for physical-keyboard
// input, so it does nothing there. This does the actual capitalizing:
// the very start of the text, and the first letter after ". ", "! ", "? ",
// or a newline. Idempotent (re-running it on already-correct text changes
// nothing), so it's safe to call on every keystroke.
export function autoCapitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?]\s+|\n)([a-z])/g, (_match, boundary: string, letter: string) => boundary + letter.toUpperCase());
}
