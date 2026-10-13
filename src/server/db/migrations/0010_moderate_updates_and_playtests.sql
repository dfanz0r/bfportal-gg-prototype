ALTER TABLE "playtest_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "playtest_reports" CASCADE;--> statement-breakpoint
ALTER TABLE "playtests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "playtests" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."playtest_status";--> statement-breakpoint
CREATE TYPE "public"."playtest_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TABLE "playtests" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."playtest_status";--> statement-breakpoint
ALTER TABLE "playtests" ALTER COLUMN "status" SET DATA TYPE "public"."playtest_status" USING "status"::"public"."playtest_status";--> statement-breakpoint
ALTER TABLE "updates" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "playtests" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "playtests" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "playtests" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "playtests" ADD CONSTRAINT "playtests_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;