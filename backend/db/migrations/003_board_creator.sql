-- Apply after 001_initial.sql and 002_auth_session.sql.
-- Existing Boards remain published; new creator requests explicitly choose draft or published.
ALTER TABLE board
  ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'published'
    CONSTRAINT ck_board_status CHECK (status IN ('draft', 'published')),
  ADD COLUMN revision INT NOT NULL DEFAULT 1
    CONSTRAINT ck_board_revision CHECK (revision >= 1),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX ix_board_owner_status_updated
  ON board (owner_user_id, status, updated_at DESC, board_id DESC);

CREATE TABLE board_day (
  day_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  board_id INT NOT NULL REFERENCES board (board_id) ON DELETE CASCADE,
  day_number INT NOT NULL CHECK (day_number >= 1),
  calendar_date DATE,
  CONSTRAINT uq_board_day_number UNIQUE (board_id, day_number) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT uq_board_day_id UNIQUE (board_id, day_id)
);

ALTER TABLE activity
  ADD COLUMN day_id INT,
  ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'manual'
    CONSTRAINT ck_activity_source CHECK (source IN ('manual', 'mapbox', 'geoapify', 'photo')),
  ADD COLUMN location_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN external_image_provider VARCHAR(30),
  ADD COLUMN external_image_id VARCHAR(500),
  ADD COLUMN external_image_url TEXT,
  ADD COLUMN external_image_photographer VARCHAR(500),
  ADD COLUMN external_image_photographer_url TEXT,
  ADD COLUMN external_image_source_url TEXT,
  ADD CONSTRAINT fk_activity_board_day FOREIGN KEY (board_id, day_id)
    REFERENCES board_day (board_id, day_id) ON DELETE CASCADE;

INSERT INTO board_day (board_id, day_number)
  SELECT DISTINCT board_id, day_number FROM activity;

UPDATE activity a SET day_id = d.day_id
  FROM board_day d
  WHERE d.board_id = a.board_id AND d.day_number = a.day_number;

ALTER TABLE activity ALTER COLUMN day_id SET NOT NULL;

UPDATE activity SET location_confirmed = TRUE WHERE location_id IS NOT NULL;
CREATE INDEX ix_activity_board_order ON activity (board_id, day_number, position, activity_id);

CREATE TABLE board_image (
  board_id INT NOT NULL REFERENCES board (board_id) ON DELETE CASCADE,
  uploaded_image_id INT NOT NULL REFERENCES uploaded_image (uploaded_image_id) ON DELETE CASCADE,
  position INT NOT NULL CHECK (position >= 0),
  PRIMARY KEY (board_id, uploaded_image_id),
  CONSTRAINT uq_board_image_id UNIQUE (uploaded_image_id),
  CONSTRAINT uq_board_image_position UNIQUE (board_id, position) DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE uploaded_image
  ADD COLUMN byte_size INT CHECK (byte_size BETWEEN 1 AND 10000000),
  ADD COLUMN file_format VARCHAR(10),
  ADD COLUMN latitude DECIMAL(9,6) CHECK (latitude BETWEEN -90 AND 90),
  ADD COLUMN longitude DECIMAL(9,6) CHECK (longitude BETWEEN -180 AND 180),
  ADD COLUMN orphaned_at TIMESTAMPTZ DEFAULT NOW();

UPDATE uploaded_image i SET orphaned_at = NULL WHERE
  EXISTS (SELECT 1 FROM board_image bi WHERE bi.uploaded_image_id = i.uploaded_image_id) OR
  EXISTS (SELECT 1 FROM activity_image ai WHERE ai.uploaded_image_id = i.uploaded_image_id) OR
  EXISTS (SELECT 1 FROM board b WHERE b.cover_image_id = i.uploaded_image_id) OR
  EXISTS (SELECT 1 FROM activity a WHERE a.cover_image_id = i.uploaded_image_id) OR
  EXISTS (SELECT 1 FROM app_user u WHERE u.profile_picture_image_id = i.uploaded_image_id);

CREATE UNIQUE INDEX uq_uploaded_image_storage_key ON uploaded_image (storage_key);

CREATE TABLE image_upload_intent (
  upload_id UUID PRIMARY KEY,
  user_id VARCHAR(500) NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
  storage_key VARCHAR(500) NOT NULL UNIQUE,
  file_name VARCHAR(500) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL CHECK (size_bytes BETWEEN 1 AND 10000000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  uploaded_image_id INT UNIQUE REFERENCES uploaded_image (uploaded_image_id) ON DELETE SET NULL,
  CONSTRAINT ck_image_upload_intent_expiry CHECK (expires_at > created_at)
);

CREATE INDEX ix_image_upload_intent_expires ON image_upload_intent (expires_at);
CREATE INDEX ix_uploaded_image_orphaned_at ON uploaded_image (orphaned_at)
  WHERE orphaned_at IS NOT NULL;

INSERT INTO tag (tag_name) VALUES
  ('Food'), ('Street food'), ('Coffee'), ('Restaurants'),
  ('Museums'), ('Art'), ('Architecture'), ('History'),
  ('Culture'), ('Nature'), ('Hiking'), ('Beaches'),
  ('Mountains'), ('Wildlife'), ('Photography'), ('Nightlife'),
  ('Shopping'), ('Markets'), ('Hidden gems'), ('Local life'),
  ('Road trips'), ('Train travel'), ('Backpacking'), ('Solo travel'),
  ('Family travel'), ('Friends'), ('Romantic'), ('Adventure'),
  ('Wellness'), ('Slow travel'), ('City breaks'), ('Rural escapes'),
  ('Weekend trips'), ('Luxury'), ('Budget'), ('Sustainable travel'),
  ('Accessible travel'), ('Festivals'), ('Music'), ('Winter travel')
ON CONFLICT (tag_name) DO NOTHING;

INSERT INTO activity_type (type) VALUES
  ('landmark'), ('culture'), ('museum'), ('restaurant'), ('cafe'),
  ('bar'), ('shopping'), ('park'), ('nature'), ('hike'),
  ('beach'), ('neighborhood'), ('city'), ('address'), ('stay'),
  ('transit'), ('event'), ('activity'), ('other')
ON CONFLICT (type) DO NOTHING;
