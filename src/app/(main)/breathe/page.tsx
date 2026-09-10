import { BreathingCircle } from "./BreathingCircle";

export default function BreathePage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">A moment to breathe</h1>
      <p className="mt-1 text-sm text-ink-muted">Box breathing — in, hold, out, hold, each for 4 seconds. A few rounds is usually enough.</p>
      <BreathingCircle />
    </div>
  );
}
