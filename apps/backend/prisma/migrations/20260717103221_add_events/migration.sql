-- CreateTable
CREATE TABLE "events" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "client_id" INTEGER NOT NULL,
    "place_id" INTEGER,
    "date_start" TIMESTAMP(3) NOT NULL,
    "date_end" TIMESTAMP(3) NOT NULL,
    "type_event" VARCHAR(150) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_status_deleted_at_idx" ON "events"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "events_client_id_idx" ON "events"("client_id");

-- CreateIndex
CREATE INDEX "events_place_id_idx" ON "events"("place_id");

-- CreateIndex
CREATE INDEX "events_date_start_date_end_idx" ON "events"("date_start", "date_end");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_id_fkey" FOREIGN KEY ("id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
