import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";
import { EXERCISE_LIBRARY as STARTER_EXERCISES } from "./exerciseLibrary";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// No starter subjects — add your own from Settings or the Study page.
// The exercise library itself lives in ./exerciseLibrary.ts (shared with
// the one-off scripts that seed it directly into local/production).

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "orowbury08@gmail.com" } });

  const user = existing
    ? existing
    : await prisma.user.create({
        data: {
          email: "orowbury08@gmail.com",
          name: "Oliver",
          passwordHash: await hashPassword(process.env.APP_PASSWORD ?? "year13goals"),
        },
      });

  // Built-in library exercises have no userId — every user sees the same
  // set. Re-running this seed updates an existing entry's category (e.g.
  // after a taxonomy change like Push/Pull → Chest/Back/...) instead of
  // skipping it, so the library stays in sync with this list.
  for (const exercise of STARTER_EXERCISES) {
    const existingExercise = await prisma.exercise.findFirst({
      where: { userId: null, name: { equals: exercise.name, mode: "insensitive" } },
    });
    if (existingExercise) {
      if (existingExercise.category !== exercise.category) {
        await prisma.exercise.update({ where: { id: existingExercise.id }, data: { category: exercise.category } });
      }
    } else {
      await prisma.exercise.create({
        data: { userId: null, name: exercise.name, category: exercise.category, isCustom: false },
      });
    }
  }

  console.log(`Seeded user ${user.email}, ${STARTER_EXERCISES.length} exercises. No starter subjects.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
