CREATE TYPE "public"."experience_type" AS ENUM('script', 'blocks', 'spatial', 'verified');--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "game" "game";--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "types" "experience_type"[] DEFAULT '{}' NOT NULL;