const FAQS = [
  {
    q: "How do I start timing a study session?",
    a: "Go to Study and tap a subject — that starts the timer straight away. There's no separate \"start\" button; the subject itself is the button.",
  },
  {
    q: "I started a session by accident — how do I get rid of it?",
    a: "While it's running or paused, there's a small \"Started by accident? Discard it\" link under the Pause/Finish buttons. That deletes it completely — use Finish instead if you actually want to keep the time.",
  },
  {
    q: "What's the difference between Pause and Finish?",
    a: "Pause stops the clock but keeps the session open so you can Resume later. Finish ends it for good and saves the total. If you close the tab without doing either, it finishes itself automatically the next time you start a new session.",
  },
  {
    q: "Why did my timer pause itself?",
    a: "If you leave the tab in the background for more than 10 minutes while it's running, it pauses automatically so time doesn't rack up while you're not around. Hit Resume when you're back — switching tabs briefly (to check notes, a video, etc.) won't trigger this.",
  },
  {
    q: "How does a goal auto-track from Study?",
    a: "When creating a weekly-target goal (like \"study Maths 5 hours a week\"), you can link it to a subject. Its weekly total then comes straight from your timed sessions for that subject — no manual logging needed.",
  },
  {
    q: "What does archiving do — is it the same as deleting?",
    a: "No. Archiving a goal or subject just hides it from the active lists (and the Study picker) — all its history stays intact and it can be reactivated any time from Settings or Goals. Nothing is actually deleted unless you use Discard on a study session.",
  },
  {
    q: "What do the coloured dots on the Calendar mean?",
    a: "Each day can show up to three: orange means you wrote a journal entry, blue means you completed a goal, green means you logged study time. Click any day to jump straight to its journal entry.",
  },
  {
    q: "Freewrite vs List mode in the journal — what's the difference?",
    a: "Freewrite is a normal text box. List mode turns each full stop into a new bullet point automatically as you type — handy for jotting a few separate things quickly. The two journal boxes each have their own toggle, so you can mix and match.",
  },
  {
    q: "Will my reminder arrive at the exact time I set?",
    a: "Not precisely — reminders are currently checked once a day rather than continuously, so treat the time you set as a rough target. Also double check you've hit \"Enable notifications\" in Settings on each device you want reminded on.",
  },
  {
    q: "Is my data private — can anyone else see it?",
    a: "Right now, yes — this is a single-user app, so only your login can see your data.",
  },
];

export function HelpSection() {
  return (
    <div className="divide-y divide-line">
      {FAQS.map((item) => (
        <details key={item.q} className="group py-3 first:pt-0 last:pb-0">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink marker:content-none">
            {item.q}
            <span className="ml-3 shrink-0 text-ink-muted transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
