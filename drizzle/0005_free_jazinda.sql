CREATE TYPE "public"."drive_type" AS ENUM('shared_folder', 'shared_drive');--> statement-breakpoint
CREATE TABLE "biograph"."drive_sync" (
	"id" text PRIMARY KEY NOT NULL,
	"start_page_token" text NOT NULL,
	"drive_type" "drive_type" NOT NULL,
	"last_sync_at" timestamp with time zone DEFAULT now() NOT NULL
);
