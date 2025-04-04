CREATE TABLE "biograph"."hypotheses_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hypothesis_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"keywords" text[],
	"scientific_entities" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "biograph"."file_metadata" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "biograph"."hypotheses_summary" ADD CONSTRAINT "hypotheses_summary_hypothesis_id_hypotheses_id_fk" FOREIGN KEY ("hypothesis_id") REFERENCES "biograph"."hypotheses"("id") ON DELETE cascade ON UPDATE cascade;