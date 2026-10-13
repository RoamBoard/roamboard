CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_documents (
  id text PRIMARY KEY,
  document jsonb NOT NULL,
  CONSTRAINT search_document_id_matches CHECK (document->>'id' = id)
);
