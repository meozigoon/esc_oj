CREATE TYPE "SubmissionType" AS ENUM ('CODE', 'TEXT');

ALTER TABLE "Problem"
  ADD COLUMN "submissionType" "SubmissionType" NOT NULL DEFAULT 'CODE',
  ADD COLUMN "textAnswer" TEXT;
