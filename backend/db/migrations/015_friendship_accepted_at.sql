-- Record friendship acceptance time for accurate "Recently added" ordering.
ALTER TABLE friendship
  ADD COLUMN accepted_at TIMESTAMPTZ;

UPDATE friendship
  SET accepted_at = CURRENT_TIMESTAMP
  WHERE status = 'accepted';

