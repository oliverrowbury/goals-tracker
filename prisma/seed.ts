import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

const STARTER_SUBJECTS = ["Maths", "Physics", "Chemistry", "Biology", "English"];

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
  const user = await prisma.user.upsert({
    where: { email: "orowbury08@gmail.com" },
    update: {},
    create: {
      email: "orowbury08@gmail.com",
      name: "Oliver",
    },
  });

  for (const name of STARTER_SUBJECTS) {
    const existing = await prisma.subject.findFirst({ where: { userId: user.id, name } });
    if (!existing) {
      await prisma.subject.create({
        data: { userId: user.id, name, color: "#4f46e5" },
      });
    }
  }

  // Built-in library exercises have no userId — every user sees the same set.
  for (const exercise of STARTER_EXERCISES) {
    const existing = await prisma.exercise.findFirst({
      where: { userId: null, name: exercise.name },
    });
    if (!existing) {
      await prisma.exercise.create({
        data: { userId: null, name: exercise.name, category: exercise.category, isCustom: false },
      });
    }
  }

  console.log(`Seeded user ${user.email}, ${STARTER_SUBJECTS.length} subjects, ${STARTER_EXERCISES.length} exercises.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
