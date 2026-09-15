-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "salon_name" TEXT,
    "salon_address" TEXT,
    "subscription_tier" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."competitors" (
    "id" TEXT NOT NULL,
    "place_id" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "google_rating" DECIMAL(3,2),
    "google_review_count" INTEGER,
    "facebook_rating" DECIMAL(3,2),
    "facebook_review_count" INTEGER,
    "facebook_url" TEXT,
    "yelp_rating" DECIMAL(3,2),
    "yelp_review_count" INTEGER,
    "yelp_url" TEXT,
    "instagram_url" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "h1_tag" TEXT,
    "status_code" INTEGER,
    "page_load_time" INTEGER,
    "last_crawled" TIMESTAMP(3),
    "crawl_status" TEXT,
    "crawl_errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "screenshot_path" TEXT,
    "rating" DECIMAL(3,2),
    "review_count" INTEGER,
    "price_level" INTEGER,
    "hours_per_week" INTEGER,
    "staff_band" TEXT,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."services" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "price" DECIMAL(8,2) NOT NULL,
    "price_min" DECIMAL(8,2),
    "price_max" DECIMAL(8,2),
    "duration_minutes" INTEGER,
    "confidence" DECIMAL(3,2),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."amenities" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "amenity_name" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saved_searches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "search_address" TEXT NOT NULL,
    "radius_miles" DECIMAL(5,2) NOT NULL,
    "competitor_count" INTEGER NOT NULL,
    "results" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."api_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crawl_history" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "crawl_timestamp" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "screenshot_path" TEXT,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."opening_hours" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "day_of_week" TEXT NOT NULL,
    "hours" TEXT NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crawl_logs" (
    "id" TEXT NOT NULL,
    "crawl_type" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "competitors_found" INTEGER NOT NULL,
    "competitors_processed" INTEGER NOT NULL,
    "errors_count" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "competitors_place_id_key" ON "public"."competitors"("place_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_usage_user_id_endpoint_date_key" ON "public"."api_usage"("user_id", "endpoint", "date");

-- CreateIndex
CREATE UNIQUE INDEX "opening_hours_competitor_id_day_of_week_key" ON "public"."opening_hours"("competitor_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."amenities" ADD CONSTRAINT "amenities_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_searches" ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_usage" ADD CONSTRAINT "api_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."crawl_history" ADD CONSTRAINT "crawl_history_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opening_hours" ADD CONSTRAINT "opening_hours_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
