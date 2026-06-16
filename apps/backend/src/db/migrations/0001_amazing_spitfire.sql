CREATE TABLE `transcript_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`transcript_id` text NOT NULL,
	`sequence_number` integer NOT NULL,
	`location` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transcript_id`) REFERENCES `transcripts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `transcripts` DROP COLUMN `full_text`;--> statement-breakpoint
ALTER TABLE `transcripts` DROP COLUMN `raw_segments`;