-- CreateTable
CREATE TABLE "UserGlobalCommandStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "UserGlobalCommandStats_userId_idx" ON "UserGlobalCommandStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGlobalCommandStats_userId_commandName_key" ON "UserGlobalCommandStats"("userId", "commandName");
