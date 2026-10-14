CREATE TABLE users (
  id uuid PRIMARY KEY,
  username text NOT NULL CHECK (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_username_lower_unique ON users (lower(username));

CREATE FUNCTION prevent_username_change() RETURNS trigger AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'username cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_username_immutable
BEFORE UPDATE OF username ON users
FOR EACH ROW EXECUTE FUNCTION prevent_username_change();

CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  location text CHECK (location IS NULL OR length(location) <= 120),
  interests text[] NOT NULL DEFAULT '{}',
  profile_picture_url text,
  profile_picture_key text,
  settings jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(settings) = 'object')
);

CREATE TABLE boards (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'friends', 'public')),
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX boards_owner_updated_idx ON boards (owner_id, updated_at DESC);

CREATE TABLE board_destinations (
  id uuid PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  country_name text NOT NULL CHECK (length(country_name) BETWEEN 1 AND 100),
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  city text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE INDEX board_destinations_board_idx ON board_destinations (board_id);
CREATE INDEX board_destinations_country_idx ON board_destinations (country_code);

CREATE TABLE friendships (
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE TABLE saved_boards (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, board_id)
);

CREATE TABLE saved_places (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  country_code text CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  saved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_places_user_idx ON saved_places (user_id, saved_at DESC);

CREATE TABLE board_visits (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  last_visited_at timestamptz NOT NULL DEFAULT now(),
  visit_count integer NOT NULL DEFAULT 1 CHECK (visit_count > 0),
  PRIMARY KEY (user_id, board_id)
);

CREATE INDEX board_visits_recent_idx ON board_visits (user_id, last_visited_at DESC);

INSERT INTO users (id, username, display_name) VALUES
  ('00000000-0000-4000-8000-000000000001', 'roam_demo', 'Roam Demo'),
  ('00000000-0000-4000-8000-000000000002', 'travel_friend', 'Travel Friend');

INSERT INTO user_profiles (user_id, description, location, interests, settings) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Testing the first Roamboard profile.', 'Stockholm, Sweden', ARRAY['food', 'walking', 'photography'], '{"mapStyle":"streets","emailUpdates":false}'),
  ('00000000-0000-4000-8000-000000000002', 'A seeded friend for prototype statistics.', 'Copenhagen, Denmark', ARRAY['museums'], '{}');

INSERT INTO boards (id, owner_id, title, description, visibility, is_completed, created_at, updated_at) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Copenhagen weekend', 'Coffee, canals, and long walks.', 'public', true, '2026-08-15T12:00:00Z', '2026-08-23T17:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Tokyo ideas', 'Places to consider for a future trip.', 'private', false, '2026-09-20T15:00:00Z', '2026-09-28T18:30:00Z'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'Stockholm favourites', 'A friend-owned public Board.', 'public', true, '2026-09-01T10:00:00Z', '2026-09-30T09:00:00Z');

INSERT INTO board_destinations (id, board_id, country_name, country_code, city, latitude, longitude) VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Denmark', 'DK', 'Copenhagen', 55.6761, 12.5683),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Japan', 'JP', 'Tokyo', 35.6762, 139.6503),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Sweden', 'SE', 'Stockholm', 59.3293, 18.0686);

INSERT INTO friendships (requester_id, addressee_id, status) VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'accepted');

INSERT INTO saved_boards (user_id, board_id) VALUES
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003');

INSERT INTO saved_places (id, user_id, name, country_code, latitude, longitude) VALUES
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Nyhavn', 'DK', 55.6798, 12.5904);

INSERT INTO board_visits (user_id, board_id, last_visited_at, visit_count) VALUES
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '2026-10-01T17:30:00Z', 2),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-09-29T12:00:00Z', 1);
