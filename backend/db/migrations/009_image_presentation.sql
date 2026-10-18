-- Non-destructive presentation edits. Originals and capture metadata stay untouched.
ALTER TABLE uploaded_image
  ADD COLUMN presentation_edit JSONB,
  ADD COLUMN presentation_revision INT NOT NULL DEFAULT 0 CHECK (presentation_revision >= 0),
  ADD CONSTRAINT ck_uploaded_image_edit_object CHECK (presentation_edit IS NULL OR jsonb_typeof(presentation_edit) = 'object');
