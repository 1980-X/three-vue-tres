CREATE TYPE "PublicationStatus" AS ENUM ('published', 'unpublished');

CREATE TABLE "publications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "status" "PublicationStatus" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "published_at" TIMESTAMP(3),
    "unpublished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "publications_public_id_key" ON "publications"("public_id");
CREATE INDEX "publications_venue_id_version_idx" ON "publications"("venue_id", "version");

ALTER TABLE "publications" ADD CONSTRAINT "publications_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
