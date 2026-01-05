-- Add shared admin memo.
CREATE TABLE "AdminMemo" (
    "id" SERIAL PRIMARY KEY,
    "content" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
