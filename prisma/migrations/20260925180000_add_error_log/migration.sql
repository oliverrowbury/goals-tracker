-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);
