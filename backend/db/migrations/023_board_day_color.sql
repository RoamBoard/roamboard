ALTER TABLE board_day ADD COLUMN color varchar(7)
    CONSTRAINT board_day_color_hex CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$');
