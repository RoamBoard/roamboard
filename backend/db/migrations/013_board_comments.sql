CREATE TABLE board_comment (
  comment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  board_id INT NOT NULL REFERENCES board (board_id) ON DELETE CASCADE,
  author_user_id VARCHAR(500) NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('milliseconds', NOW()),
  edited_at TIMESTAMPTZ,
  revision INT NOT NULL DEFAULT 1,
  CONSTRAINT ck_board_comment_body CHECK (char_length(body) BETWEEN 1 AND 2000 AND body ~ '[^[:space:]]'),
  CONSTRAINT ck_board_comment_revision CHECK (revision > 0)
);

CREATE INDEX ix_board_comment_board_newest
  ON board_comment (board_id, created_at DESC, comment_id DESC);
