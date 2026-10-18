ALTER TABLE "revisions" ALTER COLUMN "experience_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "snippet_id" integer;--> statement-breakpoint
ALTER TABLE "snippets" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_snippet_id_snippets_id_fk" FOREIGN KEY ("snippet_id") REFERENCES "public"."snippets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "revisions_one_pending_per_snippet" ON "revisions" USING btree ("snippet_id") WHERE "revisions"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_one_subject_check" CHECK (("revisions"."experience_id" is null) <> ("revisions"."snippet_id" is null));