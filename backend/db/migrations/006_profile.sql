ALTER TABLE app_user
    ADD COLUMN default_board_visibility VARCHAR(20) NOT NULL DEFAULT 'collaborators'
        CHECK (default_board_visibility IN ('collaborators', 'friends', 'public')),
    ADD COLUMN profile_revision INT NOT NULL DEFAULT 1 CHECK (profile_revision > 0);

UPDATE app_user SET username = lower(username);
CREATE UNIQUE INDEX uq_app_user_username_lower ON app_user (lower(username));

ALTER TABLE saved_boards ADD COLUMN saved_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX idx_saved_boards_user_recent ON saved_boards (user_id, saved_at DESC, board_id DESC);

INSERT INTO language (language_name) VALUES
    ('Arabic'), ('Bengali'), ('Cantonese'), ('Danish'), ('Dutch'), ('English'),
    ('Finnish'), ('French'), ('German'), ('Greek'), ('Hindi'), ('Indonesian'),
    ('Italian'), ('Japanese'), ('Korean'), ('Mandarin Chinese'), ('Norwegian'),
    ('Polish'), ('Portuguese'), ('Russian'), ('Spanish'), ('Swedish'), ('Thai'),
    ('Turkish'), ('Ukrainian'), ('Vietnamese')
ON CONFLICT DO NOTHING;
