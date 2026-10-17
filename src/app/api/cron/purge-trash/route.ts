import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/lib/trash";

// Daily sweep of the Premium recovery trash — see lib/trash.ts for why
// this runs separately from the restore/list paths rather than filtering
// at read time (an item's "N days left" should stay stable, not get swept
// mid-render).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const purged = await purgeExpiredTrash();
  return NextResponse.json({ purged });
}
