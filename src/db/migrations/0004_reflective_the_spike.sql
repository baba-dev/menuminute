CREATE TABLE "dish_media" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"size_bytes" integer NOT NULL,
	"source_key" text NOT NULL,
	"derivative_key" text,
	"thumbnail_key" text,
	"width" integer,
	"height" integer,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rights" text NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_assignments" (
	"organization_id" text NOT NULL,
	"menu_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"brand_id" text,
	CONSTRAINT "menu_outlet_assignment" UNIQUE("menu_id","outlet_id")
);
--> statement-breakpoint
CREATE TABLE "menu_overrides" (
	"menu_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"dish_id" text NOT NULL,
	"price_minor" integer,
	"sold_out" boolean,
	CONSTRAINT "menu_outlet_dish_override" UNIQUE("menu_id","outlet_id","dish_id")
);
--> statement-breakpoint
CREATE TABLE "menu_releases" (
	"menu_id" text NOT NULL,
	"revision" integer NOT NULL,
	"organization_id" text NOT NULL,
	"document" jsonb NOT NULL,
	"published_by" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_revision" UNIQUE("menu_id","revision")
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"document" jsonb NOT NULL,
	"published_revision" integer,
	"archived" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_org_id" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "free_menu_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dish_media" ADD CONSTRAINT "dish_media_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_media" ADD CONSTRAINT "dish_media_outlet_id_restaurants_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_assignments" ADD CONSTRAINT "menu_assignments_organization_id_menu_id_menus_organization_id_id_fk" FOREIGN KEY ("organization_id","menu_id") REFERENCES "public"."menus"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_assignments" ADD CONSTRAINT "menu_assignments_organization_id_outlet_id_restaurants_organization_id_id_fk" FOREIGN KEY ("organization_id","outlet_id") REFERENCES "public"."restaurants"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_overrides" ADD CONSTRAINT "menu_overrides_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_overrides" ADD CONSTRAINT "menu_overrides_outlet_id_restaurants_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_releases" ADD CONSTRAINT "menu_releases_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_releases" ADD CONSTRAINT "menu_releases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_outlet_id_restaurants_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;