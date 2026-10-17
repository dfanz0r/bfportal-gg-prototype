CREATE TABLE "held_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" text NOT NULL,
	"kind" "file_kind" NOT NULL,
	"filename" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"body" text NOT NULL,
	"summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "held_files_size_check" CHECK ("held_files"."size_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "held_files" ADD CONSTRAINT "held_files_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "held_files_uploaded_by_idx" ON "held_files" USING btree ("uploaded_by");