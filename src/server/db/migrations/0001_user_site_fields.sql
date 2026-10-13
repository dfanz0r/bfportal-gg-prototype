ALTER TABLE "user" ADD COLUMN "discord_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "discord_username" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "hide_username" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_discord_id_unique" UNIQUE("discord_id");