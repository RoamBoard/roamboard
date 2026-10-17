-- Editorial website media only. Protected Board/profile uploads remain separate.
CREATE TABLE editorial_image (
  asset_key VARCHAR(160) PRIMARY KEY,
  revision INTEGER NOT NULL CHECK (revision > 0),
  asset JSONB NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  usages TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE editorial_image_revision (
  asset_key VARCHAR(160) NOT NULL REFERENCES editorial_image(asset_key),
  revision INTEGER NOT NULL,
  asset JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (asset_key, revision)
);
