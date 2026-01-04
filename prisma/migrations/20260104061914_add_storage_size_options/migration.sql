-- CreateTable
CREATE TABLE "storage_size_options" (
    "id" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_size_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_size_features" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_size_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storage_size_options_isActive_idx" ON "storage_size_options"("isActive");

-- CreateIndex
CREATE INDEX "storage_size_options_displayOrder_idx" ON "storage_size_options"("displayOrder");

-- CreateIndex
CREATE INDEX "storage_size_features_optionId_idx" ON "storage_size_features"("optionId");

-- CreateIndex
CREATE INDEX "storage_size_features_isActive_idx" ON "storage_size_features"("isActive");

-- AddForeignKey
ALTER TABLE "storage_size_features" ADD CONSTRAINT "storage_size_features_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "storage_size_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
