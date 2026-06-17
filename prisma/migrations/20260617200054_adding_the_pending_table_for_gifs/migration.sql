-- CreateTable
CREATE TABLE "SubmittedReactonGif" (
    "id" TEXT NOT NULL,
    "actions" TEXT[],
    "fileType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "pending" BOOLEAN NOT NULL DEFAULT true,
    "submittedBy" TEXT NOT NULL,
    "approvedBy" TEXT,

    CONSTRAINT "SubmittedReactonGif_pkey" PRIMARY KEY ("id")
);
