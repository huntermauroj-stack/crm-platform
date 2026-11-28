CREATE TABLE `email_campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `activities` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `activities` ADD `campaign_id` integer REFERENCES email_campaigns(id);--> statement-breakpoint
CREATE INDEX `activities_campaign_idx` ON `activities` (`campaign_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `activities_external_idx` ON `activities` (`external_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_external_idx` ON `tasks` (`external_id`);