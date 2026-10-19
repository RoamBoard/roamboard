CREATE TABLE board_comment_subscription (
  board_id INT NOT NULL REFERENCES board (board_id) ON DELETE CASCADE,
  user_id VARCHAR(500) NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id)
);

CREATE TABLE board_comment_notification (
  notification_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comment_id INT NOT NULL REFERENCES board_comment (comment_id) ON DELETE CASCADE,
  recipient_user_id VARCHAR(500) NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('milliseconds', NOW()),
  read_at TIMESTAMPTZ,
  CONSTRAINT uq_board_comment_notification UNIQUE (comment_id, recipient_user_id)
);

CREATE INDEX ix_board_comment_notification_newest
  ON board_comment_notification (recipient_user_id, created_at DESC, notification_id DESC);

CREATE INDEX ix_board_comment_notification_unread
  ON board_comment_notification (recipient_user_id)
  WHERE read_at IS NULL;
