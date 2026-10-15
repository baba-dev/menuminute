CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" bigint NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_demo_data" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"table_id" text,
	"purpose" text DEFAULT 'menu' NOT NULL,
	"label" text,
	"destination_token" text NOT NULL,
	"svg_data" text,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"table_number" text NOT NULL,
	"label" text,
	"capacity" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"outlet_type" text DEFAULT 'restaurant' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"public_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo_url" text,
	"cover_url" text,
	"phone" text,
	"email" text,
	"website" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text DEFAULT 'IN',
	"primary_color" text DEFAULT '#f97316',
	"secondary_color" text DEFAULT '#1c1917',
	"currency" text DEFAULT 'INR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_demo_data" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurants_org_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_outlet_unique" UNIQUE("restaurant_id","id")
);
--> statement-breakpoint
CREATE TABLE "menu_item_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"menu_item_id" text NOT NULL,
	"restaurant_id" text NOT NULL,
	"name" text NOT NULL,
	"price_paise" integer NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_paise" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"is_veg" boolean,
	"is_vegan" boolean,
	"is_gluten_free" boolean,
	"spice_level" integer DEFAULT 0,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_demo_data" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_outlet_unique" UNIQUE("restaurant_id","id"),
	CONSTRAINT "item_price_nonnegative" CHECK ("menu_items"."price_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_media" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"menu_item_id" text,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"alt_text" text,
	"source" text DEFAULT 'upload' NOT NULL,
	"attribution_text" text,
	"attribution_url" text,
	"photographer_name" text,
	"external_id" text,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"mime_type" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"variant_id" text,
	"restaurant_id" text NOT NULL,
	"item_name" text NOT NULL,
	"variant_name" text,
	"unit_price_paise" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_paise" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "order_status_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"restaurant_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"changed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"table_id" text,
	"customer_name" text,
	"customer_phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"subtotal_paise" integer DEFAULT 0 NOT NULL,
	"tax_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"order_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"monthly_price_paise" integer DEFAULT 0 NOT NULL,
	"features" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text,
	"uploaded_by" text,
	"storage_key" text NOT NULL,
	"storage_provider" text DEFAULT 'local' NOT NULL,
	"public_url" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"width" integer,
	"height" integer,
	"source" text DEFAULT 'upload' NOT NULL,
	"attribution_text" text,
	"attribution_url" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_records" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text,
	"user_id" text,
	"provider" text NOT NULL,
	"feature" text NOT NULL,
	"tokens_used" integer,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"error_message" text,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"restaurant_id" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"before" text,
	"after" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_outlets" (
	"organization_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	CONSTRAINT "brand_outlet_unique" UNIQUE("brand_id","outlet_id")
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "brand_org_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "org_member_user_unique" UNIQUE("organization_id","user_id"),
	CONSTRAINT "org_member_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_grants" (
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"roles" text[] NOT NULL,
	CONSTRAINT "outlet_member_unique" UNIQUE("member_id","outlet_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_variants" ADD CONSTRAINT "menu_item_variants_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_variants" ADD CONSTRAINT "menu_item_variants_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_variants" ADD CONSTRAINT "menu_item_variants_restaurant_id_menu_item_id_menu_items_restaurant_id_id_fk" FOREIGN KEY ("restaurant_id","menu_item_id") REFERENCES "public"."menu_items"("restaurant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_category_id_menu_categories_restaurant_id_id_fk" FOREIGN KEY ("restaurant_id","category_id") REFERENCES "public"."menu_categories"("restaurant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_media" ADD CONSTRAINT "menu_media_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_media" ADD CONSTRAINT "menu_media_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_menu_item_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."menu_item_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_subscriptions" ADD CONSTRAINT "restaurant_subscriptions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_subscriptions" ADD CONSTRAINT "restaurant_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_outlets" ADD CONSTRAINT "brand_outlets_organization_id_brand_id_brands_organization_id_id_fk" FOREIGN KEY ("organization_id","brand_id") REFERENCES "public"."brands"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_outlets" ADD CONSTRAINT "brand_outlets_organization_id_outlet_id_restaurants_organization_id_id_fk" FOREIGN KEY ("organization_id","outlet_id") REFERENCES "public"."restaurants"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_grants" ADD CONSTRAINT "outlet_grants_organization_id_member_id_organization_members_organization_id_id_fk" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organization_members"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_grants" ADD CONSTRAINT "outlet_grants_organization_id_outlet_id_restaurants_organization_id_id_fk" FOREIGN KEY ("organization_id","outlet_id") REFERENCES "public"."restaurants"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_idx" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_destination_idx" ON "qr_codes" USING btree ("destination_token");--> statement-breakpoint
CREATE INDEX "qr_restaurant_idx" ON "qr_codes" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "tables_restaurant_idx" ON "restaurant_tables" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_number_idx" ON "restaurant_tables" USING btree ("restaurant_id","table_number");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurants_public_id_idx" ON "restaurants" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurants_slug_idx" ON "restaurants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_restaurant_idx" ON "menu_categories" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "categories_sort_idx" ON "menu_categories" USING btree ("restaurant_id","sort_order");--> statement-breakpoint
CREATE INDEX "variants_item_idx" ON "menu_item_variants" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "variants_restaurant_idx" ON "menu_item_variants" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "items_restaurant_idx" ON "menu_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "menu_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "items_sort_idx" ON "menu_items" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE INDEX "media_restaurant_idx" ON "menu_media" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "media_item_idx" ON "menu_media" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_restaurant_idx" ON "order_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "status_events_order_idx" ON "order_status_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_restaurant_idx" ON "orders" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("restaurant_id","status");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_restaurant_idx" ON "restaurant_subscriptions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "media_assets_restaurant_idx" ON "media_assets" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "media_assets_storage_key_idx" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "ai_usage_restaurant_idx" ON "ai_usage_records" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "background_jobs" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "background_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_restaurant_idx" ON "audit_logs" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");