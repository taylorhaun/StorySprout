-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "character_description" TEXT;

-- AlterTable
ALTER TABLE "story_beats" ADD COLUMN     "image_left_url" TEXT,
ADD COLUMN     "image_right_url" TEXT;
