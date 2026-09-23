-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "ExperienceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISABLED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "ModerationState" AS ENUM ('ACTIVE', 'TAKEN_DOWN');

-- CreateEnum
CREATE TYPE "ResponseVisibility" AS ENUM ('FULL', 'AGGREGATE_ONLY');

-- CreateEnum
CREATE TYPE "VersionState" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('MESSAGE', 'IMAGE', 'MULTIPLE_CHOICE', 'YES_NO_CHOICE', 'SCRATCH_REVEAL', 'GIFT_REVEAL');

-- CreateEnum
CREATE TYPE "GiftKind" AS ENUM ('VOUCHER_CODE', 'URL', 'QR_IMAGE', 'INSTRUCTION', 'PHYSICAL_MESSAGE');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('NOT_SCANNED', 'CLEAN', 'INFECTED');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('HARASSMENT', 'SEXUAL_CONTENT', 'HATE', 'SCAM_OR_FRAUD', 'VIOLENCE', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'ADMIN', 'RECIPIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ExperienceStatus" NOT NULL DEFAULT 'DRAFT',
    "moderationState" "ModerationState" NOT NULL DEFAULT 'ACTIVE',
    "takedownReason" TEXT,
    "accessTokenHash" TEXT,
    "accessTokenEnc" TEXT,
    "activeVersionId" UUID,
    "templateKey" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "disabledAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceVersion" (
    "id" UUID NOT NULL,
    "experienceId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "state" "VersionState" NOT NULL,
    "title" TEXT NOT NULL,
    "theme" JSONB NOT NULL,
    "responseVisibility" "ResponseVisibility" NOT NULL DEFAULT 'FULL',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExperienceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Step" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "key" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "StepType" NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "stepKey" UUID NOT NULL,
    "kind" "GiftKind" NOT NULL,
    "payloadEnc" TEXT NOT NULL,
    "mediaId" UUID,
    "oneTimeReveal" BOOLEAN NOT NULL DEFAULT false,
    "revealedAt" TIMESTAMPTZ(3),
    "revealedBySessionId" UUID,
    "revealCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "experienceId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'NOT_SCANNED',
    "mimeType" TEXT NOT NULL,
    "declaredSize" INTEGER NOT NULL,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipientSession" (
    "id" UUID NOT NULL,
    "experienceId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "answersShared" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecipientSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "stepId" UUID NOT NULL,
    "stepKey" UUID NOT NULL,
    "answer" JSONB NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbuseReport" (
    "id" UUID NOT NULL,
    "experienceId" UUID,
    "category" "ReportCategory" NOT NULL,
    "details" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AbuseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "requestId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_subject_key" ON "UserProfile"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "Experience_accessTokenHash_key" ON "Experience"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Experience_activeVersionId_key" ON "Experience"("activeVersionId");

-- CreateIndex
CREATE INDEX "Experience_ownerId_updatedAt_id_idx" ON "Experience"("ownerId", "updatedAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Experience_status_createdAt_id_idx" ON "Experience"("status", "createdAt" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceVersion_experienceId_number_key" ON "ExperienceVersion"("experienceId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Step_versionId_key_key" ON "Step"("versionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Step_versionId_position_key" ON "Step"("versionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_versionId_stepKey_key" ON "Gift"("versionId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_experienceId_status_idx" ON "MediaAsset"("experienceId", "status");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerId_idx" ON "MediaAsset"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipientSession_tokenHash_key" ON "RecipientSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RecipientSession_experienceId_startedAt_idx" ON "RecipientSession"("experienceId", "startedAt");

-- CreateIndex
CREATE INDEX "RecipientSession_expiresAt_idx" ON "RecipientSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Response_stepId_idx" ON "Response"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_sessionId_stepId_key" ON "Response"("sessionId", "stepId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_key_key" ON "Template"("key");

-- CreateIndex
CREATE INDEX "AbuseReport_status_createdAt_id_idx" ON "AbuseReport"("status", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "AbuseReport_experienceId_idx" ON "AbuseReport"("experienceId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_userId_key_key" ON "IdempotencyRecord"("userId", "key");

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "ExperienceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceVersion" ADD CONSTRAINT "ExperienceVersion_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExperienceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExperienceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipientSession" ADD CONSTRAINT "RecipientSession_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipientSession" ADD CONSTRAINT "RecipientSession_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExperienceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecipientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

