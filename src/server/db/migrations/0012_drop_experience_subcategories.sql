DROP TABLE "experience_subcategories" CASCADE;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."category_kind";--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('experience_main', 'script_main', 'script_sub');--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "kind" SET DATA TYPE "public"."category_kind" USING "kind"::"public"."category_kind";