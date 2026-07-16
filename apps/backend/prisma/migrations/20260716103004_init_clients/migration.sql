-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('client', 'place', 'event');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('activo', 'inactivo');

-- CreateTable
CREATE TABLE "entities" (
    "id" SERIAL NOT NULL,
    "type" "EntityType" NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nro_doc" VARCHAR(40) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "ubication" VARCHAR(200) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "web" VARCHAR(200),
    "status" "Status" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_nro_doc_key" ON "clients"("nro_doc");

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");

-- CreateIndex
CREATE INDEX "clients_status_deleted_at_idx" ON "clients"("status", "deleted_at");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_id_fkey" FOREIGN KEY ("id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
