-- Starter PostgreSQL table for selected, hotlinked Unsplash covers.
-- Do not store or rehost the image binary.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE unsplash_covers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL,
  selected_by_user_id UUID NOT NULL,

  unsplash_photo_id TEXT NOT NULL,
  raw_hotlinked_url TEXT NOT NULL,
  unsplash_page_url TEXT NOT NULL,
  photographer_name TEXT NOT NULL,
  photographer_profile_url TEXT NOT NULL,
  alt_text TEXT,
  average_color TEXT,

  crop_mode TEXT NOT NULL DEFAULT 'faces,entropy'
    CHECK (crop_mode IN ('faces,entropy', 'faces', 'entropy', 'edges', 'center')),
  preferred_variant TEXT NOT NULL DEFAULT 'hero'
    CHECK (preferred_variant IN ('hero', 'card', 'square', 'portrait')),
  quality SMALLINT NOT NULL DEFAULT 75 CHECK (quality BETWEEN 1 AND 100),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (destination_id, unsplash_photo_id)
);

CREATE INDEX unsplash_covers_destination_idx ON unsplash_covers (destination_id);

