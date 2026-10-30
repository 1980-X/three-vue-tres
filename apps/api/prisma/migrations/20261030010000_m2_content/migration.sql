CREATE TYPE "AssetKind" AS ENUM ('panorama_image', 'panorama_video', 'scene_package', 'audio', 'other');
CREATE TYPE "VenueStatus" AS ENUM ('draft');
CREATE TYPE "TrackKind" AS ENUM ('panorama', 'scene3d');

CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "title" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "cover_asset_id" UUID,
    "primary_track_id" UUID,
    "status" "VenueStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "venue_tracks" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "track_kind" "TrackKind" NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "entry_asset_id" UUID,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "venue_tracks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hotspots" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "hotspots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tours" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "steps_json" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assets_project_id_idx" ON "assets"("project_id");
CREATE INDEX "assets_sha256_idx" ON "assets"("sha256");
CREATE INDEX "venues_project_id_idx" ON "venues"("project_id");
CREATE INDEX "venue_tracks_venue_id_sort_order_idx" ON "venue_tracks"("venue_id", "sort_order");

ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "venues" ADD CONSTRAINT "venues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "venues" ADD CONSTRAINT "venues_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "venue_tracks" ADD CONSTRAINT "venue_tracks_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "venue_tracks" ADD CONSTRAINT "venue_tracks_entry_asset_id_fkey" FOREIGN KEY ("entry_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hotspots" ADD CONSTRAINT "hotspots_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hotspots" ADD CONSTRAINT "hotspots_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "venue_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tours" ADD CONSTRAINT "tours_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tours" ADD CONSTRAINT "tours_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "venue_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
