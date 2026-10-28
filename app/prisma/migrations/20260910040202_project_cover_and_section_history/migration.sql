-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "coverUrl" TEXT;

-- CreateTable
CREATE TABLE "ProjectSectionVersion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "SectionKind" NOT NULL,
    "body" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "editorId" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSectionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSectionVersion_projectId_createdAt_idx" ON "ProjectSectionVersion"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSectionVersion_sectionId_version_key" ON "ProjectSectionVersion"("sectionId", "version");

-- AddForeignKey
ALTER TABLE "ProjectSectionVersion" ADD CONSTRAINT "ProjectSectionVersion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ProjectSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSectionVersion" ADD CONSTRAINT "ProjectSectionVersion_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
