CREATE SCHEMA "biograph";
--> statement-breakpoint
CREATE TYPE "public"."hypothesis_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "biograph"."file_metadata" (
	"hash" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tags" text[],
	CONSTRAINT "file_metadata_pkey" PRIMARY KEY("hash")
);
--> statement-breakpoint
CREATE TABLE "biograph"."hypotheses" (
	"id" uuid NOT NULL,
	"hypothesis" text NOT NULL,
	"files_used" text[],
	"status" "hypothesis_status" DEFAULT 'pending',
	"judgellm_score" numeric(5, 2),
	"human_score" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hypotheses_pkey" PRIMARY KEY("id")
);
