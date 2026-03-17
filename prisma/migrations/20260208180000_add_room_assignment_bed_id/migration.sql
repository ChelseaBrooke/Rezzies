-- AlterTable
ALTER TABLE "RoomAssignment" ADD COLUMN "bedId" TEXT;

-- CreateIndex
CREATE INDEX "RoomAssignment_bedId_idx" ON "RoomAssignment"("bedId");

-- AddForeignKey
ALTER TABLE "RoomAssignment" ADD CONSTRAINT "RoomAssignment_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
