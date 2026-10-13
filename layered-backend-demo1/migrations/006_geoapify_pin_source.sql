ALTER TABLE board_pins DROP CONSTRAINT board_pins_source_check;
ALTER TABLE board_pins ADD CONSTRAINT board_pins_source_check
  CHECK (source IN ('manual', 'mapbox', 'geoapify', 'photo'));
