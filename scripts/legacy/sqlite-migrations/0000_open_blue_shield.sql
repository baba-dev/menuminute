CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_idx` ON `accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_idx` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer,
	`name` text,
	`image` text,
	`password_hash` text,
	`role` text DEFAULT 'user' NOT NULL,
	`is_demo_data` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_tokens_idx` ON `verification_tokens` (`identifier`,`token`);--> statement-breakpoint
CREATE TABLE `outlets` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`address_line1` text,
	`city` text,
	`phone` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `outlets_restaurant_idx` ON `outlets` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `qr_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`table_id` text,
	`purpose` text DEFAULT 'menu' NOT NULL,
	`label` text,
	`destination_token` text NOT NULL,
	`svg_data` text,
	`scan_count` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`table_id`) REFERENCES `restaurant_tables`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_destination_idx` ON `qr_codes` (`destination_token`);--> statement-breakpoint
CREATE INDEX `qr_restaurant_idx` ON `qr_codes` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `restaurant_members` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`invited_at` integer,
	`joined_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurant_members_unique_idx` ON `restaurant_members` (`restaurant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `restaurant_members_restaurant_idx` ON `restaurant_members` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `restaurant_members_user_idx` ON `restaurant_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `restaurant_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`outlet_id` text,
	`table_number` text NOT NULL,
	`label` text,
	`capacity` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tables_restaurant_idx` ON `restaurant_tables` (`restaurant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tables_number_idx` ON `restaurant_tables` (`restaurant_id`,`table_number`);--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`logo_url` text,
	`cover_url` text,
	`phone` text,
	`email` text,
	`website` text,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`country` text DEFAULT 'IN',
	`primary_color` text DEFAULT '#f97316',
	`secondary_color` text DEFAULT '#1c1917',
	`currency` text DEFAULT 'INR' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_demo_data` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_public_id_idx` ON `restaurants` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_slug_idx` ON `restaurants` (`slug`);--> statement-breakpoint
CREATE TABLE `menu_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`image_url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_restaurant_idx` ON `menu_categories` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `categories_sort_idx` ON `menu_categories` (`restaurant_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `menu_item_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_item_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`price_paise` integer NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `variants_item_idx` ON `menu_item_variants` (`menu_item_id`);--> statement-breakpoint
CREATE INDEX `variants_restaurant_idx` ON `menu_item_variants` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_paise` integer DEFAULT 0 NOT NULL,
	`image_url` text,
	`is_veg` integer,
	`is_vegan` integer,
	`is_gluten_free` integer,
	`spice_level` integer DEFAULT 0,
	`is_featured` integer DEFAULT false NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_demo_data` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `menu_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `items_restaurant_idx` ON `menu_items` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `items_category_idx` ON `menu_items` (`category_id`);--> statement-breakpoint
CREATE INDEX `items_sort_idx` ON `menu_items` (`category_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `menu_media` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`menu_item_id` text,
	`url` text NOT NULL,
	`thumbnail_url` text,
	`alt_text` text,
	`source` text DEFAULT 'upload' NOT NULL,
	`attribution_text` text,
	`attribution_url` text,
	`photographer_name` text,
	`external_id` text,
	`width` integer,
	`height` integer,
	`size_bytes` integer,
	`mime_type` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_restaurant_idx` ON `menu_media` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `media_item_idx` ON `menu_media` (`menu_item_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`menu_item_id` text NOT NULL,
	`variant_id` text,
	`restaurant_id` text NOT NULL,
	`item_name` text NOT NULL,
	`variant_name` text,
	`unit_price_paise` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`total_paise` integer NOT NULL,
	`notes` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`variant_id`) REFERENCES `menu_item_variants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_restaurant_idx` ON `order_items` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `order_status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`changed_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `status_events_order_idx` ON `order_status_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`table_id` text,
	`customer_name` text,
	`customer_phone` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`subtotal_paise` integer DEFAULT 0 NOT NULL,
	`tax_paise` integer DEFAULT 0 NOT NULL,
	`total_paise` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`order_number` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`table_id`) REFERENCES `restaurant_tables`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `orders_restaurant_idx` ON `orders` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`restaurant_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_created_idx` ON `orders` (`restaurant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `restaurant_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`current_period_start` integer,
	`current_period_end` integer,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subscriptions_restaurant_idx` ON `restaurant_subscriptions` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`monthly_price_paise` integer DEFAULT 0 NOT NULL,
	`features` text,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text,
	`uploaded_by` text,
	`storage_key` text NOT NULL,
	`storage_provider` text DEFAULT 'local' NOT NULL,
	`public_url` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`width` integer,
	`height` integer,
	`source` text DEFAULT 'upload' NOT NULL,
	`attribution_text` text,
	`attribution_url` text,
	`external_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `media_assets_restaurant_idx` ON `media_assets` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `media_assets_storage_key_idx` ON `media_assets` (`storage_key`);--> statement-breakpoint
CREATE TABLE `ai_usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text,
	`user_id` text,
	`provider` text NOT NULL,
	`feature` text NOT NULL,
	`tokens_used` integer,
	`success` integer DEFAULT true NOT NULL,
	`error_message` text,
	`duration_ms` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ai_usage_restaurant_idx` ON `ai_usage_records` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `ai_usage_created_idx` ON `ai_usage_records` (`created_at`);--> statement-breakpoint
CREATE TABLE `background_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`error_message` text,
	`scheduled_at` integer DEFAULT (unixepoch()) NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `background_jobs` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `background_jobs` (`type`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`restaurant_id` text,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`before` text,
	`after` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_restaurant_idx` ON `audit_logs` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);