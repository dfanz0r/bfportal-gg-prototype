CREATE TABLE "experience_media" (
	"experience_id" integer NOT NULL,
	"position" integer NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "experience_media_experience_id_position_pk" PRIMARY KEY("experience_id","position")
);
--> statement-breakpoint
ALTER TABLE "experience_media" ADD CONSTRAINT "experience_media_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Written by hand: the video and the gallery pictures become one list, the
-- video first. The next migration drops where they were.
INSERT INTO "experience_media" ("experience_id", "position", "url")
SELECT "id", 0, "vid_url" FROM "experiences" WHERE "vid_url" IS NOT NULL;--> statement-breakpoint
INSERT INTO "experience_media" ("experience_id", "position", "url")
SELECT "experience_images"."experience_id",
  "experience_images"."position" + CASE WHEN "experiences"."vid_url" IS NULL THEN 0 ELSE 1 END,
  "experience_images"."url"
FROM "experience_images"
JOIN "experiences" ON "experiences"."id" = "experience_images"."experience_id";