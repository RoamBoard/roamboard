-- A committed removal is eligible immediately; new, unattached uploads retain their grace period.
ALTER TABLE uploaded_image ADD COLUMN deletion_requested_at TIMESTAMPTZ;
ALTER TABLE uploaded_image ADD COLUMN cleanup_attempted_at TIMESTAMPTZ;
ALTER TABLE image_upload_intent ADD COLUMN cleanup_attempted_at TIMESTAMPTZ;

CREATE INDEX ix_uploaded_image_deletion_requested ON uploaded_image (deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

CREATE FUNCTION track_uploaded_image_reference() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  previous_id INT;
  next_id INT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    previous_id := (to_jsonb(OLD) ->> TG_ARGV[0])::INT;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    next_id := (to_jsonb(NEW) ->> TG_ARGV[0])::INT;
  END IF;
  IF previous_id IS NOT DISTINCT FROM next_id THEN
    RETURN NULL;
  END IF;
  IF previous_id IS NOT NULL THEN
    UPDATE uploaded_image
    SET deletion_requested_at = COALESCE(deletion_requested_at, NOW()),
        orphaned_at = COALESCE(orphaned_at, NOW())
    WHERE uploaded_image_id = previous_id;
  END IF;
  IF next_id IS NOT NULL THEN
    UPDATE uploaded_image SET deletion_requested_at = NULL, orphaned_at = NULL
    WHERE uploaded_image_id = next_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER track_profile_image
  AFTER INSERT OR UPDATE OF profile_picture_image_id OR DELETE ON app_user
  FOR EACH ROW EXECUTE FUNCTION track_uploaded_image_reference('profile_picture_image_id');
CREATE TRIGGER track_board_cover_image
  AFTER INSERT OR UPDATE OF cover_image_id OR DELETE ON board
  FOR EACH ROW EXECUTE FUNCTION track_uploaded_image_reference('cover_image_id');
CREATE TRIGGER track_activity_cover_image
  AFTER INSERT OR UPDATE OF cover_image_id OR DELETE ON activity
  FOR EACH ROW EXECUTE FUNCTION track_uploaded_image_reference('cover_image_id');
CREATE TRIGGER track_board_image
  AFTER INSERT OR UPDATE OF uploaded_image_id OR DELETE ON board_image
  FOR EACH ROW EXECUTE FUNCTION track_uploaded_image_reference('uploaded_image_id');
CREATE TRIGGER track_activity_image
  AFTER INSERT OR UPDATE OF uploaded_image_id OR DELETE ON activity_image
  FOR EACH ROW EXECUTE FUNCTION track_uploaded_image_reference('uploaded_image_id');
