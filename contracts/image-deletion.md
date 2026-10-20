# Uploaded image deletion

Decision: replacing or removing a profile picture, removing saved Board photos or deleting a Board must remove
unused uploaded images from Cloudinary and PostgreSQL. This supersedes the previous 24-hour delay for saved removals.

## Behavior

- Profile replacement/removal and committed Board edits/deletion request cleanup immediately after the database
  transaction commits. Board covers, activity covers and activity-only photos are included, including cascading deletes.
  Awaited cleanup is scoped to images removed by that change, attempts at most four and waits at most one second
  overall, including its queue query. In-flight scoped deletions may finish afterward; remaining work stays queued.
  Sign-in never waits for image deletion. Only the background worker/manual maintenance processes the global queue.
  All cleanup instances in one backend process share a maximum of two database operations, including candidate
  reads and image/intent deletion transactions. Slots stay occupied until the operation finishes even if the response
  deadline expires. Busy cleanup skips work for a later sweep, preserving eight of the default ten pool connections
  for API traffic instead of waiting in the connection queue.
- Removing a saved photo in the editor takes effect on Save; cancelling edits preserves the saved photo. Changing the
  selected cover does not delete photos still attached to the Board. Crop/resize edits retain the original upload.
- An image is deleted only when no Board, activity or profile refers to it. Saved Boards are bookmarks, so deleting
  a source Board removes its photos; a prepared remix owns independent copies and retains them.
  If older Boards share an actual uploaded-image row, deleting one Board preserves the asset and row until the final
  Board/activity/profile reference is removed. Original deletion must never break another user's saved remix.
- Cleanup uses the authenticated Cloudinary delivery type and invalidates cached variants. An already missing
  Cloudinary asset counts as successful deletion. Only after provider success are the uploaded-image row and its
  completed upload-intent row removed. A provider delivery 404 alone never triggers deletion.
- Provider/database failures leave a durable deletion request. The originating edit remains committed, and a worker
  retries on startup and every minute. Failed candidates rotate behind unattempted candidates. Concurrent workers
  lock/recheck image references before deleting, so active assets are protected.
- Fresh, unattached uploads and incomplete upload intents keep the existing 24-hour grace period. The worker cleans
  these automatically after expiry. Public editorial-library assets and external Unsplash images are excluded.

## Implementation and rollout

Migration `020_image_deletion.sql` adds deletion/retry tracking and reference triggers on profiles, Boards,
activities and their image-link tables. Triggers participate in the originating transaction, so rolled-back edits
never enqueue deletion. Reattaching a photo clears its pending request. Existing image IDs and references are retained.

`images.cleanup.ts` coordinates provider deletion through the image repository; services invoke it after saved
removals. `server.ts` starts the maintenance worker. `npm run cleanup:images` remains available for manual maintenance
and returns a nonzero exit code if any asset fails. No frontend API shape changes are required.

From `backend/`, `npm run db:images` checks migration status without applying changes. Run
`npm run db:images -- --apply` to create and verify a custom-format backup, then apply only migration 020 in a
transaction. Do not replay earlier migrations. Restart the backend after deploying the change. Consult the migration
log for shared-environment application status.

## Verification

Unit/API tests cover retry behavior, startup/interval sweeps and Cloudinary authenticated deletion/invalidation.
PostgreSQL integration tests use isolated schemas and a fake storage provider to verify actual reference tracking,
HTTP profile replacement/removal and Board deletion, saved edits, covers/activity-only photos, permissions, stale
writes, rollback safety, shared references, upload-intent removal, staging grace and editorial exclusions. These tests
do not delete real Cloudinary assets or verify Cloudinary CDN propagation.
