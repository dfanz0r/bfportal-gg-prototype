CREATE TYPE "public"."playtest_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tester_region" AS ENUM('eu', 'na', 'sa', 'asia', 'oce');--> statement-breakpoint
CREATE TABLE "playtest_reports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "playtest_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"playtest_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"region" "tester_region",
	"body_md" text NOT NULL,
	"body_html" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "playtests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "playtests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"experience_id" integer,
	"title" text,
	"game" "game" NOT NULL,
	"code" text NOT NULL,
	"summary" text NOT NULL,
	"brief_md" text DEFAULT '' NOT NULL,
	"brief_html" text DEFAULT '' NOT NULL,
	"host_id" text NOT NULL,
	"regions" "tester_region"[] DEFAULT '{}' NOT NULL,
	"opens_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closes_at" timestamp with time zone,
	"together_at" timestamp with time zone,
	"status" "playtest_status" DEFAULT 'active' NOT NULL,
	"announced_at" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"discord_url" text,
	"result_update_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playtests_subject_check" CHECK ("playtests"."experience_id" is not null or "playtests"."title" is not null),
	CONSTRAINT "playtests_window_check" CHECK ("playtests"."closes_at" is null or "playtests"."closes_at" > "playtests"."opens_at")
);
--> statement-breakpoint
ALTER TABLE "playtest_reports" ADD CONSTRAINT "playtest_reports_playtest_id_playtests_id_fk" FOREIGN KEY ("playtest_id") REFERENCES "public"."playtests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playtest_reports" ADD CONSTRAINT "playtest_reports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playtests" ADD CONSTRAINT "playtests_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playtests" ADD CONSTRAINT "playtests_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playtests" ADD CONSTRAINT "playtests_result_update_id_updates_id_fk" FOREIGN KEY ("result_update_id") REFERENCES "public"."updates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playtest_reports_playtest_idx" ON "playtest_reports" USING btree ("playtest_id","created_at");--> statement-breakpoint
CREATE INDEX "playtest_reports_user_idx" ON "playtest_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "playtests_opens_idx" ON "playtests" USING btree ("opens_at");--> statement-breakpoint
CREATE INDEX "playtests_experience_idx" ON "playtests" USING btree ("experience_id");