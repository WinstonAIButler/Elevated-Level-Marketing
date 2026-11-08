-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "CrmProvider" AS ENUM ('HUBSPOT', 'PIPEDRIVE', 'ZOHO', 'JOBBER', 'HOUSECALL_PRO');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "leadFormKey" TEXT;
-- Give existing businesses a random form key, then make it required.
UPDATE "Business" SET "leadFormKey" = 'lf' || md5(random()::text || id || clock_timestamp()::text) WHERE "leadFormKey" IS NULL;
ALTER TABLE "Business" ALTER COLUMN "leadFormKey" SET NOT NULL;

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "source" TEXT NOT NULL DEFAULT 'other',
    "sourceDetail" TEXT,
    "elevated" BOOLEAN NOT NULL DEFAULT false,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "valueCents" INTEGER NOT NULL DEFAULT 0,
    "wonAt" TIMESTAMP(3),
    "notes" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "crm" "CrmProvider",
    "externalId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" "CrmProvider" NOT NULL,
    "method" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "extra" JSONB,
    "accountName" TEXT,
    "pushNewLeads" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncCount" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_businessId_occurredAt_idx" ON "Lead"("businessId", "occurredAt");

-- CreateIndex
CREATE INDEX "Lead_businessId_email_idx" ON "Lead"("businessId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_businessId_crm_externalId_key" ON "Lead"("businessId", "crm", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmConnection_businessId_provider_key" ON "CrmConnection"("businessId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Business_leadFormKey_key" ON "Business"("leadFormKey");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmConnection" ADD CONSTRAINT "CrmConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

