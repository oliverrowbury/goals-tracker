import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// No starter subjects — add your own from Settings or the Study page.
// A broad built-in exercise library, grouped the way Hevy groups its own
// (by muscle group / movement pattern rather than push/pull), so the
// picker on the Workout page has real breadth out of the box.
const STARTER_EXERCISES: { name: string; category: string }[] = [
  // Chest
  { name: "Barbell Bench Press", category: "Chest" },
  { name: "Incline Barbell Bench Press", category: "Chest" },
  { name: "Decline Barbell Bench Press", category: "Chest" },
  { name: "Dumbbell Bench Press", category: "Chest" },
  { name: "Incline Dumbbell Press", category: "Chest" },
  { name: "Decline Dumbbell Bench Press", category: "Chest" },
  { name: "Machine Chest Press", category: "Chest" },
  { name: "Cable Fly", category: "Chest" },
  { name: "Pec Deck", category: "Chest" },
  { name: "Push Up", category: "Chest" },
  // Back
  { name: "Deadlift", category: "Back" },
  { name: "Sumo Deadlift", category: "Back" },
  { name: "Rack Pull", category: "Back" },
  { name: "Barbell Row", category: "Back" },
  { name: "Pendlay Row", category: "Back" },
  { name: "T-Bar Row", category: "Back" },
  { name: "Dumbbell Row", category: "Back" },
  { name: "Seated Cable Row", category: "Back" },
  { name: "Lat Pulldown", category: "Back" },
  { name: "Wide-Grip Lat Pulldown", category: "Back" },
  { name: "Close-Grip Lat Pulldown", category: "Back" },
  { name: "Pull Up", category: "Back" },
  { name: "Chin Up", category: "Back" },
  { name: "Straight Arm Pulldown", category: "Back" },
  // Shoulders
  { name: "Overhead Press", category: "Shoulders" },
  { name: "Seated Dumbbell Shoulder Press", category: "Shoulders" },
  { name: "Dumbbell Shoulder Press", category: "Shoulders" },
  { name: "Arnold Press", category: "Shoulders" },
  { name: "Push Press", category: "Shoulders" },
  { name: "Lateral Raise", category: "Shoulders" },
  { name: "Cable Lateral Raise", category: "Shoulders" },
  { name: "Front Raise", category: "Shoulders" },
  { name: "Rear Delt Fly", category: "Shoulders" },
  { name: "Face Pull", category: "Shoulders" },
  { name: "Upright Row", category: "Shoulders" },
  // Biceps
  { name: "Bicep Curl", category: "Biceps" },
  { name: "Barbell Curl", category: "Biceps" },
  { name: "EZ-Bar Curl", category: "Biceps" },
  { name: "Dumbbell Curl", category: "Biceps" },
  { name: "Hammer Curl", category: "Biceps" },
  { name: "Incline Dumbbell Curl", category: "Biceps" },
  { name: "Preacher Curl", category: "Biceps" },
  { name: "Cable Curl", category: "Biceps" },
  { name: "Concentration Curl", category: "Biceps" },
  // Triceps
  { name: "Tricep Pushdown", category: "Triceps" },
  { name: "Overhead Tricep Extension", category: "Triceps" },
  { name: "Skull Crusher", category: "Triceps" },
  { name: "Close-Grip Bench Press", category: "Triceps" },
  { name: "Tricep Dip", category: "Triceps" },
  { name: "Cable Overhead Extension", category: "Triceps" },
  { name: "Tricep Kickback", category: "Triceps" },
  // Legs
  { name: "Barbell Back Squat", category: "Legs" },
  { name: "Front Squat", category: "Legs" },
  { name: "Goblet Squat", category: "Legs" },
  { name: "Bulgarian Split Squat", category: "Legs" },
  { name: "Leg Press", category: "Legs" },
  { name: "Hack Squat", category: "Legs" },
  { name: "Romanian Deadlift", category: "Legs" },
  { name: "Stiff-Leg Deadlift", category: "Legs" },
  { name: "Leg Curl", category: "Legs" },
  { name: "Leg Extension", category: "Legs" },
  { name: "Walking Lunge", category: "Legs" },
  { name: "Reverse Lunge", category: "Legs" },
  { name: "Step Up", category: "Legs" },
  { name: "Calf Raise (Standing)", category: "Legs" },
  { name: "Calf Raise (Seated)", category: "Legs" },
  { name: "Good Morning", category: "Legs" },
  // Glutes
  { name: "Hip Thrust", category: "Glutes" },
  { name: "Glute Bridge", category: "Glutes" },
  { name: "Cable Kickback", category: "Glutes" },
  { name: "Sumo Squat", category: "Glutes" },
  { name: "Glute Ham Raise", category: "Glutes" },
  // Core
  { name: "Plank", category: "Core" },
  { name: "Side Plank", category: "Core" },
  { name: "Crunch", category: "Core" },
  { name: "Sit Up", category: "Core" },
  { name: "Hanging Leg Raise", category: "Core" },
  { name: "Cable Crunch", category: "Core" },
  { name: "Russian Twist", category: "Core" },
  { name: "Ab Wheel Rollout", category: "Core" },
  { name: "Mountain Climber", category: "Core" },
  { name: "Bicycle Crunch", category: "Core" },
  { name: "V-Up", category: "Core" },
  // Olympic & Full Body
  { name: "Clean", category: "Olympic & Full Body" },
  { name: "Power Clean", category: "Olympic & Full Body" },
  { name: "Snatch", category: "Olympic & Full Body" },
  { name: "Clean and Jerk", category: "Olympic & Full Body" },
  { name: "Thruster", category: "Olympic & Full Body" },
  { name: "Farmer's Carry", category: "Olympic & Full Body" },
  { name: "Kettlebell Swing", category: "Olympic & Full Body" },
  { name: "Burpee", category: "Olympic & Full Body" },
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
