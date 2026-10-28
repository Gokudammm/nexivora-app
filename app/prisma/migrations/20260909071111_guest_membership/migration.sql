-- AlterEnum
ALTER TYPE "MembershipState" ADD VALUE 'GUEST';

-- DropIndex
DROP INDEX "Idea_problemNormalised_trgm_idx";

-- DropIndex
DROP INDEX "Idea_searchVector_idx";

-- DropIndex
DROP INDEX "Post_searchVector_idx";

-- DropIndex
DROP INDEX "Project_problemNormalised_trgm_idx";

-- DropIndex
DROP INDEX "Project_searchVector_idx";

-- DropIndex
DROP INDEX "Project_title_trgm_idx";

-- DropIndex
DROP INDEX "Resource_searchVector_idx";

-- DropIndex
DROP INDEX "User_name_trgm_idx";

-- DropIndex
DROP INDEX "User_searchVector_idx";

-- DropIndex
DROP INDEX "User_username_trgm_idx";
