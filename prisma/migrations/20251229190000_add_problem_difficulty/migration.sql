CREATE TYPE "ProblemDifficulty" AS ENUM ('LOW', 'LOW_MID', 'MID', 'MID_HIGH', 'HIGH', 'VERY_HIGH');

ALTER TABLE "Problem"
  ADD COLUMN "difficulty" "ProblemDifficulty" NOT NULL DEFAULT 'MID';
