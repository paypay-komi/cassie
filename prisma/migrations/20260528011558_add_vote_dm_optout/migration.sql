-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserVoteStats" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "lastVote" DATETIME,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "voteStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastClaimedReward" DATETIME,
    "voteDmOptOut" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UserVoteStats" ("bestStreak", "lastClaimedReward", "lastVote", "totalVotes", "updatedAt", "userId", "voteStreak") SELECT "bestStreak", "lastClaimedReward", "lastVote", "totalVotes", "updatedAt", "userId", "voteStreak" FROM "UserVoteStats";
DROP TABLE "UserVoteStats";
ALTER TABLE "new_UserVoteStats" RENAME TO "UserVoteStats";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
