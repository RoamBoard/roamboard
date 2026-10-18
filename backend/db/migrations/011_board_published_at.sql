-- Record publication time for activity feed ordering.
ALTER TABLE board
  ADD COLUMN published_at TIMESTAMPTZ;

UPDATE board
  SET published_at = created_at
  WHERE status = 'published' AND published_at IS NULL;

CREATE INDEX ix_board_published_at
  ON board (published_at DESC)
  WHERE status = 'published';

