-- CreateTable
CREATE TABLE "mesh_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "session_id" UUID,
    "provider_id" UUID NOT NULL,
    "remote_task_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "glb_temp_key" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesh_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mesh_jobs_session_id_idx" ON "mesh_jobs"("session_id");
