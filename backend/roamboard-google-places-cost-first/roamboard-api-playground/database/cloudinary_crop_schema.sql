-- Starter PostgreSQL table for Roamboard media assets.
-- Add foreign keys to your users and itineraries tables after those tables exist.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  itinerary_id UUID,

  cloudinary_public_id TEXT NOT NULL UNIQUE,
  cloudinary_version BIGINT,
  original_url TEXT NOT NULL,
  original_width INTEGER NOT NULL CHECK (original_width > 0),
  original_height INTEGER NOT NULL CHECK (original_height > 0),
  original_format TEXT NOT NULL,

  focus_x_percent NUMERIC(5, 2) NOT NULL DEFAULT 50 CHECK (focus_x_percent BETWEEN 0 AND 100),
  focus_y_percent NUMERIC(5, 2) NOT NULL DEFAULT 50 CHECK (focus_y_percent BETWEEN 0 AND 100),
  focus_size_percent NUMERIC(5, 2) NOT NULL DEFAULT 30 CHECK (focus_size_percent BETWEEN 5 AND 100),
  custom_coordinates JSONB NOT NULL,
  preferred_variant TEXT NOT NULL DEFAULT 'hero'
    CHECK (preferred_variant IN ('hero', 'card', 'square', 'portrait')),

  alt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX media_assets_owner_idx ON media_assets (owner_user_id);
CREATE INDEX media_assets_itinerary_idx ON media_assets (itinerary_id);

