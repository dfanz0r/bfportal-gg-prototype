ALTER TABLE "experiences" ADD COLUMN "draft_form" jsonb;--> statement-breakpoint
ALTER TABLE "held_files" ADD COLUMN "experience_id" integer;--> statement-breakpoint
ALTER TABLE "held_files" ADD CONSTRAINT "held_files_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "held_files_experience_idx" ON "held_files" USING btree ("experience_id");