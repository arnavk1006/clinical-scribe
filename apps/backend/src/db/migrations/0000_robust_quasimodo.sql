CREATE TABLE `doctors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`oauth_provider` text,
	`oauth_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doctors_email_unique` ON `doctors` (`email`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`subjective` text,
	`objective` text,
	`assessment` text,
	`plan` text,
	`doctor_edited` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`oauth_provider` text,
	`oauth_id` text,
	`mrn` text,
	`date_of_birth` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_email_unique` ON `patients` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `patients_mrn_unique` ON `patients` (`mrn`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`status` text DEFAULT 'recording' NOT NULL,
	`audio_path` text,
	`created_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`full_text` text NOT NULL,
	`raw_segments` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
