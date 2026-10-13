CREATE TABLE "submission_drafts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"fields" jsonb NOT NULL,
	"errors" jsonb NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission_drafts" ADD CONSTRAINT "submission_drafts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;