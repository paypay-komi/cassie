-- CreateTable
CREATE TABLE "userTimezone" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "offset" INTEGER,
    "timeZone" TEXT,
    "location" TEXT,
    "timeFormat" TEXT,
    "notifyEnabled" BOOLEAN DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
