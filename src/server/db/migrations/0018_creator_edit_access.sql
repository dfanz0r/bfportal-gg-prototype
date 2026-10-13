ALTER TABLE "experience_creators" ADD COLUMN "can_edit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "snippet_creators" ADD COLUMN "can_edit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "experience_creators" ADD CONSTRAINT "experience_creators_edit_check" CHECK ("experience_creators"."user_id" is not null or not "experience_creators"."can_edit");--> statement-breakpoint
ALTER TABLE "snippet_creators" ADD CONSTRAINT "snippet_creators_edit_check" CHECK ("snippet_creators"."user_id" is not null or not "snippet_creators"."can_edit");