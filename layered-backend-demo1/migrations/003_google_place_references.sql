CREATE TABLE google_place_references (
  place_id text PRIMARY KEY,
  saved_at timestamptz NOT NULL DEFAULT now()
);
