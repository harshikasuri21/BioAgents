CREATE TABLE "biograph"."gdrive_channels" (
	"kind" text,
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"resource_uri" text,
	"expiration" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
