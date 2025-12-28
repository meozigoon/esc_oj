ALTER TABLE "Problem"
  ADD COLUMN "generatorLanguage" "Language",
  ADD COLUMN "generatorCode" TEXT,
  ADD COLUMN "solutionLanguage" "Language",
  ADD COLUMN "solutionCode" TEXT;
