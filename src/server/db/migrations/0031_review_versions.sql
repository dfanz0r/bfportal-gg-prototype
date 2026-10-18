ALTER TABLE "experiences" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;