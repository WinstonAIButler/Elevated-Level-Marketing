-- CreateTable
CREATE TABLE "VisibilityCheck" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "email" TEXT,
    "siteScore" INTEGER,
    "checks" JSONB,
    "aiScore" INTEGER,
    "ai" JSONB,
    "error" TEXT,
    "ipHash" TEXT NOT NULL,
    "businessId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'public',
    "salesBrief" JSONB,
    "salesBriefAt" TIMESTAMP(3),
    "salesNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisibilityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisibilityCheck_domain_createdAt_idx" ON "VisibilityCheck"("domain", "createdAt");

-- CreateIndex
CREATE INDEX "VisibilityCheck_ipHash_createdAt_idx" ON "VisibilityCheck"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "VisibilityCheck_createdAt_idx" ON "VisibilityCheck"("createdAt");

