-- Discovery activity starts at deployment. Existing publication timestamps are preserved.
CREATE TABLE board_browser (
  browser_id UUID PRIMARY KEY,
  user_id VARCHAR(500) REFERENCES app_user(user_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);
CREATE INDEX ix_board_browser_expiry ON board_browser(expires_at);

CREATE TABLE board_view (
  board_id INT NOT NULL REFERENCES board(board_id) ON DELETE CASCADE,
  viewer_key TEXT NOT NULL,
  user_id VARCHAR(500) REFERENCES app_user(user_id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, viewer_key)
);
CREATE INDEX ix_board_view_recent ON board_view(board_id, viewed_at DESC);
CREATE INDEX ix_board_view_viewer ON board_view(viewer_key);

CREATE TABLE board_view_challenge (
  board_id INT NOT NULL REFERENCES board(board_id) ON DELETE CASCADE,
  viewer_key TEXT NOT NULL,
  token UUID NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (board_id, viewer_key)
);
CREATE INDEX ix_board_view_challenge_viewer ON board_view_challenge(viewer_key, started_at DESC);

-- Keep a qualifying save event when its active relationship is removed. Re-saving within
-- thirty days restores that event rather than generating a fresh popularity contribution.
CREATE TABLE board_save_event (
  board_id INT NOT NULL REFERENCES board(board_id) ON DELETE CASCADE,
  user_id VARCHAR(500) NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (board_id, user_id, saved_at)
);
INSERT INTO board_save_event SELECT board_id, user_id, saved_at FROM saved_boards;
CREATE INDEX ix_board_save_event_recent ON board_save_event(board_id, saved_at DESC);

CREATE FUNCTION record_board_save_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM board_save_event
    WHERE board_id=NEW.board_id AND user_id=NEW.user_id
      AND saved_at > NEW.saved_at - INTERVAL '30 days') THEN
    INSERT INTO board_save_event VALUES (NEW.board_id, NEW.user_id, NEW.saved_at);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER record_board_save AFTER INSERT ON saved_boards
  FOR EACH ROW EXECUTE FUNCTION record_board_save_event();
