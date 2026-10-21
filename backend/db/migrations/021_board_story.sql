-- Optional, persisted destination illustrations. Provider binaries remain on Unsplash.
ALTER TABLE board ADD COLUMN filler_images_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE board_filler_image (
    board_id INT NOT NULL REFERENCES board(board_id) ON DELETE CASCADE,
    destination_key TEXT NOT NULL,
    position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 2),
    provider_image_id TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    large_url TEXT NOT NULL,
    width INT NOT NULL CHECK (width > 0),
    height INT NOT NULL CHECK (height > 0),
    alt TEXT NOT NULL,
    photographer TEXT NOT NULL,
    photographer_url TEXT NOT NULL,
    source_url TEXT NOT NULL,
    PRIMARY KEY (board_id, position),
    UNIQUE (board_id, provider_image_id)
);

-- Legacy uploads can remain unknown; new completions record provider dimensions.
ALTER TABLE uploaded_image
    ADD COLUMN width INT CHECK (width > 0),
    ADD COLUMN height INT CHECK (height > 0);
