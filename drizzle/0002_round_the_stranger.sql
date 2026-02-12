PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`station_id` text NOT NULL,
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
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `records_filename_unique` ON `records` (`filename`);