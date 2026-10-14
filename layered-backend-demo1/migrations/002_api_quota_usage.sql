CREATE TABLE IF NOT EXISTS api_quota_usage (
  policy_id text NOT NULL,
  window_name text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  used bigint NOT NULL CHECK (used >= 0),
  PRIMARY KEY (policy_id, window_name, window_start)
);

CREATE INDEX IF NOT EXISTS api_quota_usage_window_end_idx ON api_quota_usage (window_end);
