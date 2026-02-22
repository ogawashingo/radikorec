CREATE INDEX `enabled_idx` ON `keywords` (`enabled`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `schedules` (`status`);--> statement-breakpoint
CREATE INDEX `station_id_idx` ON `schedules` (`station_id`);