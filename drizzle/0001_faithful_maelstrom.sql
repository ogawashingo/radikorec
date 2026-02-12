PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`prevent_duplicates` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_keywords`("id", "keyword", "enabled", "prevent_duplicates", "created_at") SELECT "id", "keyword", "enabled", "prevent_duplicates", "created_at" FROM `keywords`;--> statement-breakpoint
DROP TABLE `keywords`;--> statement-breakpoint
ALTER TABLE `__new_keywords` RENAME TO `keywords`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`station_id` text,
	`title` text,
	`start_time` text,
	`duration` integer NOT NULL,
	`file_path` text,
	`size` integer NOT NULL,
	`is_watched` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_records`("id", "filename", "station_id", "title", "start_time", "duration", "file_path", "size", "is_watched", "created_at") SELECT "id", "filename", "station_id", "title", "start_time", "duration", "file_path", "size", "is_watched", "created_at" FROM `records`;--> statement-breakpoint
DROP TABLE `records`;--> statement-breakpoint
ALTER TABLE `__new_records` RENAME TO `records`;--> statement-breakpoint
CREATE UNIQUE INDEX `records_filename_unique` ON `records` (`filename`);--> statement-breakpoint
CREATE TABLE `__new_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`station_id` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`duration` integer NOT NULL,
	`title` text,
	`recurring_pattern` text,
	`day_of_week` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`is_realtime` integer DEFAULT 0 NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_schedules`("id", "station_id", "start_time", "end_time", "duration", "title", "recurring_pattern", "day_of_week", "status", "error_message", "created_at", "is_realtime", "retry_count") SELECT "id", "station_id", "start_time", "end_time", "duration", "title", "recurring_pattern", "day_of_week", "status", "error_message", "created_at", "is_realtime", "retry_count" FROM `schedules`;--> statement-breakpoint
DROP TABLE `schedules`;--> statement-breakpoint
ALTER TABLE `__new_schedules` RENAME TO `schedules`;