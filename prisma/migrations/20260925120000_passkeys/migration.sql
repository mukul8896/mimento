-- Passkeys (WebAuthn) as an optional way back in, and further owner keys so each signed-in device
-- has its own revocable token.
CREATE TABLE "OwnerKey" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnerKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OwnerKey_tokenHash_key" ON "OwnerKey"("tokenHash");
CREATE INDEX "OwnerKey_ownerId_idx" ON "OwnerKey"("ownerId");
ALTER TABLE "OwnerKey" ADD CONSTRAINT "OwnerKey_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Passkey" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3),
    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");
CREATE INDEX "Passkey_ownerId_idx" ON "Passkey"("ownerId");
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WebAuthnChallenge" (
    "id" UUID NOT NULL,
    "challenge" TEXT NOT NULL,
    "ownerId" UUID,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WebAuthnChallenge_expiresAt_idx" ON "WebAuthnChallenge"("expiresAt");
