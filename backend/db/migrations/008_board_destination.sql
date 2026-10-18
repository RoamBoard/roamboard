-- Explicit primary destination, separate from activity locations.
-- Additive and independent of migration 007's tag catalog changes.
ALTER TABLE board
  ADD COLUMN primary_location_id INT REFERENCES location(location_id),
  ADD COLUMN primary_location_kind VARCHAR(20),
  ADD CONSTRAINT ck_board_primary_location CHECK (
    (primary_location_id IS NULL AND primary_location_kind IS NULL)
    OR (primary_location_id IS NOT NULL AND primary_location_kind IS NOT NULL
        AND primary_location_kind IN ('city', 'region', 'country'))
  );
CREATE INDEX ix_board_primary_location ON board (primary_location_id) WHERE primary_location_id IS NOT NULL;
