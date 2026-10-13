CREATE TYPE "public"."file_kind" AS ENUM('export', 'script', 'spatial', 'scene', 'strings', 'other');--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "project_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"experience_id" integer,
	"snippet_id" integer,
	"kind" "file_kind" NOT NULL,
	"filename" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"body" text NOT NULL,
	"map_index" integer,
	"from_export" boolean DEFAULT false NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_files_one_project_check" CHECK (num_nonnulls("project_files"."experience_id", "project_files"."snippet_id") = 1),
	CONSTRAINT "project_files_size_check" CHECK ("project_files"."size_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "game_mode" text;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "map_rotation" jsonb;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_snippet_id_snippets_id_fk" FOREIGN KEY ("snippet_id") REFERENCES "public"."snippets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_files_experience_idx" ON "project_files" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "project_files_snippet_idx" ON "project_files" USING btree ("snippet_id");