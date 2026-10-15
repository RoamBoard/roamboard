-- Provider budgets are shared by all API processes using this database.
CREATE TABLE api_quota_usage (
  policy_id TEXT NOT NULL,
  window_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  used BIGINT NOT NULL CHECK (used >= 0),
  previous_used BIGINT NOT NULL DEFAULT 0 CHECK (previous_used >= 0),
  previous_window_end TIMESTAMPTZ,
  PRIMARY KEY (policy_id, window_name)
);

CREATE TABLE google_place_reference (
  user_id VARCHAR(500) NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
  place_id VARCHAR(512) NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, place_id)
);

ALTER TABLE app_user
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
