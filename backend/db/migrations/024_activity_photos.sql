CREATE TABLE activity_photo (
    activity_photo_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    activity_id INT NOT NULL REFERENCES activity(activity_id) ON DELETE CASCADE,
    position INT NOT NULL CHECK (position >= 0),
    source VARCHAR(20) NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'unsplash')),
    uploaded_image_id INT REFERENCES uploaded_image(uploaded_image_id),
    external_photo JSONB,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (activity_id, position),
    CHECK ((source = 'upload' AND uploaded_image_id IS NOT NULL AND external_photo IS NULL)
        OR (source = 'unsplash' AND uploaded_image_id IS NULL AND jsonb_typeof(external_photo) = 'object'
            AND external_photo->>'source' = 'unsplash' AND length(external_photo->>'providerImageId') > 0
            AND external_photo->>'url' LIKE 'https://images.unsplash.com/%'))
);
CREATE UNIQUE INDEX activity_photo_uploaded_unique ON activity_photo(uploaded_image_id) WHERE uploaded_image_id IS NOT NULL;
CREATE UNIQUE INDEX activity_photo_external_unique ON activity_photo(activity_id, (external_photo->>'providerImageId')) WHERE source = 'unsplash';
CREATE UNIQUE INDEX activity_photo_one_cover ON activity_photo(activity_id) WHERE is_cover;
CREATE FUNCTION valid_activity_photo_presentation(value JSONB) RETURNS BOOLEAN LANGUAGE SQL IMMUTABLE AS $$
 SELECT CASE WHEN value IS NULL OR value = 'null'::jsonb THEN TRUE
 WHEN jsonb_typeof(value) <> 'object' OR NOT value ?& ARRAY['x','y','width','height','outputWidth','outputHeight']
      OR (value - ARRAY['x','y','width','height','outputWidth','outputHeight']) <> '{}'::jsonb THEN FALSE
 WHEN EXISTS (SELECT 1 FROM jsonb_each(value) e WHERE jsonb_typeof(e.value) <> 'number') THEN FALSE
 ELSE (value->>'x')::numeric >= 0 AND (value->>'y')::numeric >= 0
 AND (value->>'width')::numeric BETWEEN 0.01 AND 1 AND (value->>'height')::numeric BETWEEN 0.01 AND 1
 AND (value->>'x')::numeric + (value->>'width')::numeric <= 1.000001
 AND (value->>'y')::numeric + (value->>'height')::numeric <= 1.000001
 AND (value->>'outputWidth')::numeric BETWEEN 32 AND 4096 AND (value->>'outputHeight')::numeric BETWEEN 32 AND 4096
 AND (value->>'outputWidth')::numeric = trunc((value->>'outputWidth')::numeric)
 AND (value->>'outputHeight')::numeric = trunc((value->>'outputHeight')::numeric) END;
$$;
ALTER TABLE activity_photo ADD CONSTRAINT activity_photo_presentation_check CHECK (valid_activity_photo_presentation(external_photo->'presentation'));
INSERT INTO activity_photo(activity_id, position, uploaded_image_id, is_cover)
 SELECT ai.activity_id, row_number() OVER (PARTITION BY ai.activity_id ORDER BY ai.position, ai.uploaded_image_id)::int - 1,
 ai.uploaded_image_id, COALESCE(ai.uploaded_image_id = a.cover_image_id, FALSE) FROM activity_image ai JOIN activity a USING(activity_id);
INSERT INTO activity_photo(activity_id, position, uploaded_image_id, is_cover)
 SELECT a.activity_id, (SELECT count(*)::int FROM activity_photo p WHERE p.activity_id=a.activity_id), a.cover_image_id, TRUE
 FROM activity a WHERE a.cover_image_id IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM activity_photo p WHERE p.uploaded_image_id=a.cover_image_id);
INSERT INTO activity_photo(activity_id, position, source, external_photo, is_cover)
 SELECT a.activity_id, (SELECT count(*)::int FROM activity_photo p WHERE p.activity_id = a.activity_id), 'unsplash',
 jsonb_build_object('source','unsplash','providerImageId',a.external_image_id,'url',a.external_image_url,
 'thumbnailUrl',a.external_image_url,'alt',a.title,'width',1,'height',1,'photographer',a.external_image_photographer,
 'photographerUrl',a.external_image_photographer_url,'sourceUrl',a.external_image_source_url,
 'context',a.external_image_context,'presentation',NULL),
 a.cover_image_id IS NULL FROM activity a WHERE a.external_image_provider = 'unsplash';
UPDATE activity_photo p SET is_cover = TRUE WHERE p.position = 0 AND NOT EXISTS
 (SELECT 1 FROM activity_photo cover WHERE cover.activity_id = p.activity_id AND cover.is_cover);
DROP TABLE activity_image;
CREATE VIEW activity_image AS SELECT uploaded_image_id, activity_id, position FROM activity_photo WHERE source = 'upload' WITH LOCAL CHECK OPTION;
CREATE TRIGGER track_activity_photo AFTER INSERT OR UPDATE OF uploaded_image_id OR DELETE ON activity_photo
 FOR EACH ROW EXECUTE FUNCTION track_uploaded_image_reference('uploaded_image_id');
