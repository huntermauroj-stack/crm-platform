ALTER TABLE `activities` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `activities_external_idx` ON `activities` (`external_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_external_idx` ON `tasks` (`external_id`);