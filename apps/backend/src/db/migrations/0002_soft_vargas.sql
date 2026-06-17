ALTER TABLE `transcript_chunks` ADD `processed_location` text;--> statement-breakpoint
ALTER TABLE `transcript_chunks` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `transcript_chunks` ADD `transcribed_text` text;