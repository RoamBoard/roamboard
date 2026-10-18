-- Account-owned Geoapify suggestions, kept independently of published Boards.
CREATE TABLE saved_place (
  user_id VARCHAR(500) NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  place_id VARCHAR(512) NOT NULL,
  name VARCHAR(200) NOT NULL,
  address VARCHAR(1000) NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  city VARCHAR(100) NOT NULL,
  country CHAR(3) NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, place_id)
);
