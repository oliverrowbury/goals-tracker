// 1 (worst) – 5 (best), shown as faces. Kept as a plain ordered array so the
// index + 1 is always the stored value — no separate id/value mapping to
// keep in sync.
export const MOODS: { value: 1 | 2 | 3 | 4 | 5; face: string; label: string }[] = [
  { value: 1, face: "😖", label: "Really bad" },
  { value: 2, face: "😕", label: "Bad" },
  { value: 3, face: "😐", label: "Okay" },
  { value: 4, face: "🙂", label: "Good" },
  { value: 5, face: "😄", label: "Really good" },
];

export function moodFace(value: number | null | undefined): string {
  return MOODS.find((m) => m.value === value)?.face ?? "";
}
