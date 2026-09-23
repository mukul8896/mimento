-- Accounts are replaced by anonymous owner identities. Creators are identified by a secret
-- owner token (cookie) instead of an OIDC subject; each experience additionally gets its own
-- manage token so a recovery link grants access to that experience alone.

ALTER TABLE "UserProfile" ADD COLUMN "ownerTokenHash" TEXT;

ALTER TABLE "Experience"
  ADD COLUMN "manageTokenHash" TEXT,
  ADD COLUMN "manageTokenEnc" TEXT;

CREATE UNIQUE INDEX "UserProfile_ownerTokenHash_key" ON "UserProfile" ("ownerTokenHash");
CREATE UNIQUE INDEX "Experience_manageTokenHash_key" ON "Experience" ("manageTokenHash");
