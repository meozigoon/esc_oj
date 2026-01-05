-- Add hint markdown to problems.
ALTER TABLE "Problem" ADD COLUMN "hintMd" TEXT NOT NULL DEFAULT '';
