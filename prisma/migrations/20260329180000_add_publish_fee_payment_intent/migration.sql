-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "publishFeePaymentIntentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Trip_publishFeePaymentIntentId_key" ON "Trip"("publishFeePaymentIntentId");
