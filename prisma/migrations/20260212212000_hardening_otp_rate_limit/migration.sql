-- OTP tokens are short-lived; purge old plaintext tokens before moving to hash-only verification.
DELETE FROM "EmailVerificationToken";

ALTER TABLE "EmailVerificationToken"
ADD COLUMN "tokenHash" TEXT;

UPDATE "EmailVerificationToken"
SET "tokenHash" = ''
WHERE "tokenHash" IS NULL;

ALTER TABLE "EmailVerificationToken"
ALTER COLUMN "tokenHash" SET NOT NULL;

ALTER TABLE "EmailVerificationToken"
ALTER COLUMN "token" DROP NOT NULL;

DROP INDEX IF EXISTS "EmailVerificationToken_userId_purpose_token_key";

CREATE UNIQUE INDEX "EmailVerificationToken_userId_purpose_tokenHash_key"
ON "EmailVerificationToken"("userId", "purpose", "tokenHash");

CREATE INDEX "EmailVerificationToken_userId_purpose_consumedAt_expiresAt_idx"
ON "EmailVerificationToken"("userId", "purpose", "consumedAt", "expiresAt");

CREATE TABLE "ApiRateLimitEvent" (
  "id" SERIAL NOT NULL,
  "identity" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApiRateLimitEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiRateLimitEvent_identity_action_createdAt_idx"
ON "ApiRateLimitEvent"("identity", "action", "createdAt");

CREATE INDEX "ApiRateLimitEvent_createdAt_idx"
ON "ApiRateLimitEvent"("createdAt");
