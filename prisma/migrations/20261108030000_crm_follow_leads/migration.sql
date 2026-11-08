-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "crmStage" TEXT,
ADD COLUMN     "pushedAt" TIMESTAMP(3),
ADD COLUMN     "trackedAt" TIMESTAMP(3);

