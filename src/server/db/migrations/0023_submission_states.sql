-- The statuses. Written by hand in place of what drizzle-kit generated, which
-- dropped each type and made it again: that fails on any row still holding
-- 'rejected'. A value is renamed in place instead, so those rows follow it.
--
-- "Rejected" is "changes requested" now: it is sent back to be fixed and sent
-- in again, not turned away. What is turned away for good is 'removed'.
ALTER TYPE "public"."content_status" RENAME VALUE 'rejected' TO 'changes_requested';--> statement-breakpoint
ALTER TYPE "public"."content_status" ADD VALUE 'draft' BEFORE 'pending';--> statement-breakpoint
ALTER TYPE "public"."content_status" ADD VALUE 'removed';--> statement-breakpoint
ALTER TYPE "public"."playtest_status" RENAME VALUE 'rejected' TO 'changes_requested';--> statement-breakpoint
ALTER TYPE "public"."revision_status" RENAME VALUE 'rejected' TO 'changes_requested';--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "review_field_notes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "copied_from_id" integer;--> statement-breakpoint
ALTER TABLE "playtests" ADD COLUMN "review_field_notes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "review_field_notes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "snippets" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "snippets" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "snippets" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "snippets" ADD COLUMN "review_field_notes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "updates" ADD COLUMN "review_field_notes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_copied_from_id_experiences_id_fk" FOREIGN KEY ("copied_from_id") REFERENCES "public"."experiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippets" ADD CONSTRAINT "snippets_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
