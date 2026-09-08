import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate, shiftISO, formatLong } from "@/lib/dates";
import { JournalEditor } from "./JournalEditor";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dateISO = date ?? todayISO();
  const isToday = dateISO === todayISO();

  const user = await getCurrentUser();
  const entry = await prisma.journalEntry.findUnique({
    where: { userId_date: { userId: user.id, date: isoToDate(dateISO) } },
  });

  const prevISO = shiftISO(dateISO, -1);
  const nextISO = shiftISO(dateISO, 1);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{formatLong(dateISO)}</h1>
          {isToday && <p className="text-sm text-neutral-500">Today</p>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/journal?date=${prevISO}`} className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100">
            ← Prev
          </Link>
          {!isToday && (
            <Link href="/journal" className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100">
              Today
            </Link>
          )}
          <Link href={`/journal?date=${nextISO}`} className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100">
            Next →
          </Link>
        </div>
      </div>

      <JournalEditor dateISO={dateISO} initialText={entry?.bodyText ?? ""} />
    </div>
  );
}
