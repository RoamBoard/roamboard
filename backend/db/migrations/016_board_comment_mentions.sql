ALTER TABLE board_comment_notification
  ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'comment',
  ADD CONSTRAINT ck_board_comment_notification_kind CHECK (kind IN ('comment', 'mention'));

CREATE TABLE board_comment_mention (
  comment_id INT NOT NULL REFERENCES board_comment (comment_id) ON DELETE CASCADE,
  user_id VARCHAR(500) NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
  handle VARCHAR(64) NOT NULL,
  PRIMARY KEY (comment_id, handle),
  CONSTRAINT uq_board_comment_mention_user UNIQUE (comment_id, user_id)
);
