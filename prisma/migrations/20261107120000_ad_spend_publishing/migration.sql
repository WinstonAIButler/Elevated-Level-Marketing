-- CreateEnum
CREATE TYPE "AdSpendMode" AS ENUM ('WALLET', 'OWN_ACCOUNTS');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('META', 'GOOGLE_ADS', 'GOOGLE_BUSINESS', 'LINKEDIN', 'TIKTOK', 'X');

-- CreateEnum
CREATE TYPE "WalletEntryKind" AS ENUM ('TOPUP', 'SPEND', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PublishKind" AS ENUM ('POST', 'AD');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHING', 'PUBLISHED', 'PAUSED', 'FAILED', 'NEEDS_TEAM');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "adSpendMode" "AdSpendMode" NOT NULL DEFAULT 'WALLET',
ADD COLUMN     "walletBalanceCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "WalletEntryKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "provider" "Provider",
    "reference" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "accountId" TEXT,
    "accountName" TEXT,
    "adAccountId" TEXT,
    "extra" JSONB,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAllocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "splits" JSONB NOT NULL,
    "basedOn" JSONB,
    "status" "AllocationStatus" NOT NULL DEFAULT 'PROPOSED',
    "clientNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "campaignId" TEXT,
    "allocationId" TEXT,
    "provider" "Provider" NOT NULL,
    "kind" "PublishKind" NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dailyBudgetCents" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "decidedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMetric" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "date" DATE NOT NULL,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ChannelMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletEntry_businessId_createdAt_idx" ON "WalletEntry"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletEntry_businessId_reference_key" ON "WalletEntry"("businessId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_businessId_provider_key" ON "ChannelConnection"("businessId", "provider");

-- CreateIndex
CREATE INDEX "BudgetAllocation_businessId_createdAt_idx" ON "BudgetAllocation"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "PublishItem_businessId_status_idx" ON "PublishItem"("businessId", "status");

-- CreateIndex
CREATE INDEX "PublishItem_status_scheduledFor_idx" ON "PublishItem"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMetric_businessId_provider_date_key" ON "ChannelMetric"("businessId", "provider", "date");

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishItem" ADD CONSTRAINT "PublishItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMetric" ADD CONSTRAINT "ChannelMetric_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

