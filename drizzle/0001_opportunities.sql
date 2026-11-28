CREATE TABLE `problems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer,
	`company_id` integer,
	`activity_id` integer,
	`recording_id` integer,
	`theme` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`solvable` text DEFAULT 'no' NOT NULL,
	`solvable_note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`checked_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recording_id`) REFERENCES `recordings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `problems_theme_idx` ON `problems` (`theme`);--> statement-breakpoint
CREATE INDEX `problems_contact_idx` ON `problems` (`contact_id`);--> statement-breakpoint
ALTER TABLE `activities` ADD `problems_scanned_at` integer;