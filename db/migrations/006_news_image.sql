-- Migration 006: Add image_url to news_item for thumbnail support
ALTER TABLE content.news_item ADD COLUMN IF NOT EXISTS image_url text;
