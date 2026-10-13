CREATE TABLE auth_session (
  token_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(500) NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT ck_auth_session_expiry CHECK (expires_at > created_at)
);

CREATE INDEX ix_auth_session_user_id ON auth_session (user_id);
CREATE INDEX ix_auth_session_expires_at ON auth_session (expires_at);
