CREATE TYPE "public"."portal_state" AS ENUM('unchecked', 'published', 'unpublished', 'missing');--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "portal_state" "portal_state" DEFAULT 'unchecked' NOT NULL;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "portal_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "portal_state_since" timestamp with time zone;