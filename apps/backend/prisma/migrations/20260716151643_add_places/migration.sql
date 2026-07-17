-- CreateTable
CREATE TABLE "places" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "ubication" VARCHAR(300) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "places_name_key" ON "places"("name");

-- CreateIndex
CREATE INDEX "places_status_deleted_at_idx" ON "places"("status", "deleted_at");

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_id_fkey" FOREIGN KEY ("id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
