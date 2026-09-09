import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// No starter subjects — add your own from Settings or the Study page.
// The exercise library stays seeded (Phase 2, not yet exposed in the UI).
const STARTER_EXERCISES: { name: string; category: string }[] = [
  { name: "Barbell Back Squat", category: "Legs" },
  { name: "Barbell Bench Press", category: "Push" },
  { name: "Deadlift", category: "Pull" },
  { name: "Overhead Press", category: "Push" },
  { name: "Barbell Row", category: "Pull" },
  { name: "Pull Up", category: "Pull" },
  { name: "Push Up", category: "Push" },
  { name: "Incline Dumbbell Press", category: "Push" },
  { name: "Dumbbell Row", category: "Pull" },
  { name: "Leg Press", category: "Legs" },
  { name: "Romanian Deadlift", category: "Legs" },
  { name: "Lat Pulldown", category: "Pull" },
  { name: "Seated Cable Row", category: "Pull" },
  { name: "Dumbbell Shoulder Press", category: "Push" },
  { name: "Lateral Raise", category: "Push" },
  { name: "Bicep Curl", category: "Pull" },
  { name: "Tricep Pushdown", category: "Push" },
  { name: "Leg Curl", category: "Legs" },
  { name: "Leg Extension", category: "Legs" },
  { name: "Plank", category: "Core" },
];

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

  // Built-in library exercises have no userId — every user sees the same set.
  for (const exercise of STARTER_EXERCISES) {
    const existingExercise = await prisma.exercise.findFirst({
      where: { userId: null, name: exercise.name },
    });
    if (!existingExercise) {
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
