ALTER TABLE "experience_reports" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "experience_reports" ADD COLUMN "resolved_by" text;--> statement-breakpoint
ALTER TABLE "experience_reports" ADD CONSTRAINT "experience_reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experience_reports_open_idx" ON "experience_reports" USING btree ("experience_id") WHERE "experience_reports"."resolved_at" is null;