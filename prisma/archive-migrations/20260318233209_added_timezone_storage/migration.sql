-- CreateTable
CREATE TABLE "userTimezone" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "offset" INTEGER,
    "timeZone" TEXT,
    "location" TEXT,
    "timeFormat" TEXT,
    "notifyEnabled" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);
