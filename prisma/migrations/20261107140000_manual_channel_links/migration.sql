-- AlterTable
ALTER TABLE "ChannelConnection" ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'oauth',
ADD COLUMN     "profileUrl" TEXT,
ALTER COLUMN "accessTokenEnc" DROP NOT NULL;

