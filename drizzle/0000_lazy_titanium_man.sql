CREATE TABLE IF NOT EXISTS `keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`enabled` integer DEFAULT 1,
	`prevent_duplicates` integer DEFAULT 1,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`station_id` text,
	`title` text,
	`start_time` text,
	`duration` integer,
	`file_path` text,
	`size` integer,
	`is_watched` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `records_filename_unique` ON `records` (`filename`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`station_id` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`duration` integer,
	`title` text,
	`recurring_pattern` text,
	`day_of_week` integer,
	`status` text DEFAULT 'pending',
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`is_realtime` integer DEFAULT 0,
	`retry_count` integer DEFAULT 0
);
