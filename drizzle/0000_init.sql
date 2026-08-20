CREATE TABLE "draft_votes" (
	"draft_id" text NOT NULL,
	"pid" text NOT NULL,
	"v" smallint NOT NULL,
	CONSTRAINT "draft_votes_draft_id_pid_pk" PRIMARY KEY("draft_id","pid")
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"items" text NOT NULL,
	"author" text NOT NULL,
	"owner" text,
	"plays" integer DEFAULT 0 NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"updated" bigint NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "drafts_cat" ON "drafts" USING btree ("category");