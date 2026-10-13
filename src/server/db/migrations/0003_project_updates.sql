CREATE TABLE "updates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "updates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"experience_id" integer,
	"snippet_id" integer,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"body_html" text NOT NULL,
	"status" "content_status" NOT NULL,
	"published_at" timestamp with time zone,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "updates_one_project_check" CHECK (num_nonnulls("updates"."experience_id", "updates"."snippet_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "repo_url" text;--> statement-breakpoint
ALTER TABLE "snippets" ADD COLUMN "repo_url" text;--> statement-breakpoint
ALTER TABLE "updates" ADD CONSTRAINT "updates_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "updates" ADD CONSTRAINT "updates_snippet_id_snippets_id_fk" FOREIGN KEY ("snippet_id") REFERENCES "public"."snippets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "updates" ADD CONSTRAINT "updates_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "updates" ADD CONSTRAINT "updates_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "updates_feed_idx" ON "updates" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "updates_experience_idx" ON "updates" USING btree ("experience_id","published_at");--> statement-breakpoint
CREATE INDEX "updates_snippet_idx" ON "updates" USING btree ("snippet_id","published_at");