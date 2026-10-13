CREATE TABLE "experience_images" (
	"experience_id" integer NOT NULL,
	"position" integer NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "experience_images_experience_id_position_pk" PRIMARY KEY("experience_id","position")
);
--> statement-breakpoint
ALTER TABLE "experience_images" ADD CONSTRAINT "experience_images_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;