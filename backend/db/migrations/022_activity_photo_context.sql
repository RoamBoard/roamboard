-- Preserve the distinction between a location photograph and an illustrative regional photograph.
ALTER TABLE activity ADD COLUMN external_image_context JSONB;
ALTER TABLE activity ADD CONSTRAINT activity_external_image_context_check CHECK (
    external_image_context IS NULL OR (
        external_image_provider = 'unsplash'
        AND jsonb_typeof(external_image_context) = 'object'
        AND external_image_context ?& ARRAY['kind', 'scope', 'locationLabel']
        AND (external_image_context - ARRAY['kind', 'scope', 'locationLabel']) = '{}'::jsonb
        AND external_image_context->>'kind' = 'illustrative'
        AND external_image_context->>'scope' IN ('nearby', 'region')
        AND jsonb_typeof(external_image_context->'locationLabel') = 'string'
        AND length(btrim(external_image_context->>'locationLabel')) BETWEEN 1 AND 500
    ) IS TRUE
);
