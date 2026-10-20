CREATE TABLE "OAuthChallenge" (
 "stateHash" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "sessionHash" TEXT NOT NULL,
 "verifier" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "OAuthChallenge_pkey" PRIMARY KEY ("stateHash")
);
CREATE INDEX "OAuthChallenge_expiresAt_idx" ON "OAuthChallenge"("expiresAt");
