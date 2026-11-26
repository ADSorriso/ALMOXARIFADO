CREATE TABLE `fleet_records` (
  `owner_id` text NOT NULL,
  `kind` text NOT NULL,
  `id` text NOT NULL,
  `payload` text NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`owner_id`,`kind`,`id`)
);
--> statement-breakpoint
CREATE INDEX `fleet_records_lookup_idx` ON `fleet_records` (`owner_id`,`kind`,`created_at`);
--> statement-breakpoint
CREATE TABLE `fleet_settings` (
  `owner_id` text PRIMARY KEY NOT NULL,
  `payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fleet_sequences` (
  `owner_id` text PRIMARY KEY NOT NULL,
  `last_number` integer NOT NULL DEFAULT 0
);
