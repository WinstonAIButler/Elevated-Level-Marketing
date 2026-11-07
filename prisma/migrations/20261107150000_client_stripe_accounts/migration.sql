-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeCheckedAt" TIMESTAMP(3),
ADD COLUMN     "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Business_stripeAccountId_key" ON "Business"("stripeAccountId");

