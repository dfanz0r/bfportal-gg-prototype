ALTER TABLE "experiences" ADD COLUMN "playground_id" text;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "copy_allowed" boolean;--> statement-breakpoint
CREATE INDEX "experiences_playground_idx" ON "experiences" USING btree ("playground_id");