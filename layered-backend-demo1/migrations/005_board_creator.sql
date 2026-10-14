ALTER TABLE boards
  ADD COLUMN status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN vibes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN highlights text[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT boards_vibes_limit CHECK (cardinality(vibes) <= 3);

CREATE TABLE board_days (
  id uuid PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number BETWEEN 1 AND 60),
  local_date date,
  UNIQUE (board_id, day_number)
);

CREATE INDEX board_days_board_idx ON board_days (board_id, day_number);

CREATE TABLE board_pins (
  id uuid PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  day_id uuid NOT NULL REFERENCES board_days(id) ON DELETE CASCADE,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  local_time time NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  category text NOT NULL DEFAULT 'other',
  source text NOT NULL CHECK (source IN ('manual', 'mapbox', 'photo')),
  location_name text,
  address text,
  latitude double precision,
  longitude double precision,
  country_name text,
  country_code text CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  city text,
  mapbox_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE INDEX board_pins_board_day_idx ON board_pins (board_id, day_id, local_time, sort_order);

CREATE TABLE board_images (
  id uuid PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  pin_id uuid REFERENCES board_pins(id) ON DELETE SET NULL,
  public_id text NOT NULL,
  source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'unsplash')),
  url text NOT NULL,
  thumbnail_url text NOT NULL,
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  captured_at text,
  latitude double precision,
  longitude double precision,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  credit text,
  credit_url text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, public_id),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE INDEX board_images_board_idx ON board_images (board_id, sort_order);
