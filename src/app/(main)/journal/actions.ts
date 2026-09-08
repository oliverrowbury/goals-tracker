"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isoToDate } from "@/lib/dates";

export async function saveJournalEntry(dateISO: string, bodyText: string) {
  const user = await getCurrentUser();
  const date = isoToDate(dateISO);

  await prisma.journalEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { bodyText },
    create: { userId: user.id, date, bodyText },
  });

  revalidatePath("/journal");
}
