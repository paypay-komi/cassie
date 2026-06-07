-- CreateTable
CREATE TABLE "UserVoteStats" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "lastVote" TIMESTAMP,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "voteStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastClaimedReward" TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "DblVote" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "lastVote" TIMESTAMP,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "voteStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastClaimedReward" TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);
