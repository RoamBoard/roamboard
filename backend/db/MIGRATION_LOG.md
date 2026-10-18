# Shared development database migration log

## Pending guest account migration

`010_guest_accounts.sql` adds the `guest_account` table. It has not been applied to the shared Azure database. It was renamed from `008_guest_accounts.sql` during merge reconciliation because 008 and 009 were already used by the applied Board destination and photo presentation migrations. Apply 010 after the team's backup and migration checks; do not rerun previously applied files.

## Profile tag catalog — 2026-10-18

The user reports applying `007_profile_tag_catalog.sql` to the shared Azure database. A read-only call to the live
`GET /api/v1/tags` endpoint returned all 24 names from that migration (64 tags total). Do not rerun 007. The backup
details for this application were not independently verified here.

## Editorial image library — 2026-10-17

Applied additive migration `005_image_library.sql` through the guarded image importer after checking database access
and confirming the tables were absent. Existing product tables and migrations were not rerun or modified. A failed
upload of the oversized welcome photograph was resumed after optimizing only the migration copy. All original
frontend files remain intact. Completed records were retained on a second import without increasing their revisions.
Cloudinary image responses and stored provider IDs were checked for all 70 uploaded raster files. Unsplash references
retain their original delivery URLs; known source credits/page IDs were preserved and missing credits remain marked.
See `frontend-image-inventory.json` and [the image contract](../../contracts/image-library.md) for the current inventory
and authoring workflow. No destructive cleanup or database recreation was performed.

This is a manual maintenance record, not an automatic migration ledger. Verify
the target database schema before applying a migration; do not rerun recorded files.

## Applied migrations

| Date (Europe/Stockholm) | Migration              | Verification                                                                                                                                                          |
| ----------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-14              | `004_api_features.sql` | Applied in one transaction after a PostgreSQL custom-format backup. `check:setup` passed; live Mapbox map-session and Eiffel Tower POI search both returned HTTP 200. |

The pre-migration backup is in the local, Git-ignored `backend/backups/` folder.
Its archive listing was verified with `pg_restore --list`. Earlier migrations
were already present and were not reapplied. Copy the backup off this machine
through the team's approved backup workflow for durable retention.

## Quota migrations applied on 2026-10-15

Migrations 005 and 006 were applied in order to the shared Azure database
`roamboard_dev` through the SSH tunnel using local, not-yet-pushed files.
The user confirmed all backends and provider jobs were stopped. No other database
connections were present immediately before application. Each migration committed
its own transaction.

- `005_compact_quota_counters.sql`: retained the latest counter per policy/window,
  changed the primary key to `(policy_id, window_name)`, and removed the expiry
  index. Counter rows decreased from 33 to 16, matching the 16 policy/window pairs.
- `006_provider_quota_windows.sql`: added `previous_used` and
  `previous_window_end` and converted eligible counters to rolling windows.
  Previously discarded usage cannot be reconstructed.
- Pre-migration custom-format backup:
  `backend/backups/pre-005-006-20261015T124959Z.dump` (53,693 bytes, Git-ignored).
  Archive listing verified with `pg_restore --list`; restoration not tested.
- Verified the primary key and columns directly. Backend build passed, and
  `node dist/jobs/check-setup.js` passed all configuration, schema and auth
  permission checks. The normal tsx launcher failed with
  `uv_os_get_passwd` / `ENOMEM`, so the compiled setup check was used.
  No live login or provider calls were performed.

Migration 004's API tables already existed and were not recreated. No migrations
remain pending through 006. The associated changes have not been pushed.
Restart only with the updated backend quota repository; older code is incompatible
with the new key. Copy the local backup off-machine for durable retention.

## Consolidated API migration on 2026-10-15

The user explicitly approved combining 004, 005 and 006 and refreshing the database
if needed. Migration 004 now creates the final quota table directly, including
its compact primary key and previous-window fields. Files 005 and 006 were removed;
future schema changes start at 005. The earlier entries above retain the actual
application history rather than implying the original rollout never happened.

A temporary isolated schema was created on the shared database and migrations
001 through the consolidated 004 were applied from scratch. Its columns,
constraints and indexes across all tables matched the existing public schema.
The temporary schema was removed afterward. No shared tables were reset, no
existing data was deleted, and 004 was not rerun against public tables.
The shared database is therefore reconciled with the consolidated 004 baseline.
Any other database using the original 004 must be checked separately before using
the updated backend; do not rerun 004 over existing tables.

## Profile migration reconciliation on 2026-10-17

The shared Azure database already had `app_user.default_board_visibility` and
`saved_boards.saved_at`, so running the then-named `005_profile.sql` directly failed on the
duplicate column and rolled back. The user reports applying the remaining profile
statements with the single-transaction command. The file was subsequently renamed
to `006_profile.sql` to leave 005 for the image-library migration. Do not rerun the
profile migration on this database. Fresh databases apply the available migrations
in numeric order.

Read-only verification through the SSH tunnel found the profile revision column and
check constraint, both valid indexes, lowercase unique usernames, and all 26 seeded
languages. There were no invalid profile values, missing save dates, or lowercase
username collisions. The 22 expected tables were present, no constraints were
unvalidated, and `npm run check:setup` passed against Azure. The database retained
5 users, 6 Boards, and 20 image records at verification time.

One schema difference remains: Azure's preexisting
`app_user.default_board_visibility` is `VARCHAR(500)`, whereas the profile migration specifies
`VARCHAR(20)`. Its `NOT NULL` setting, `collaborators` default, and validated check
constraint for `collaborators`, `friends`, and `public` match the migration. Align
the column length separately if an exact schema match is required. Backup status
was not independently verified during this read-only check.

## Saved places on 2026-10-17

Current status: the destination page's save-location action was removed on 2026-10-18.
The backend API and table remain; this historical migration must not be undone or reapplied.

The user requested account-owned saved destination places. Verified that
`public.saved_place` was absent, then applied only `005_saved_places.sql` in one
transaction and verified its nine columns before committing. This creates one
new table; existing tables and data were unchanged. No new pre-migration backup
was created for this additive change. The existing backup procedure remains in
`deploy/README.md`.

The repository and account-isolation tests also passed against an isolated
PostgreSQL schema that was removed by transaction rollback. Do not reapply 005
to the shared development database.

The saved-places file was later renamed to `008_saved_places.sql` when the branches
were combined, because 005 is used by the image library. This is the same SQL and
does not need to run again on the shared database. Fresh databases use the current
filename after 007.

## Explicit Board destination - 2026-10-18

Applied only 008_board_destination.sql to the configured shared development database after verifying both columns
were absent. It adds primary_location_id, primary_location_kind, a paired-value constraint and an index; no
existing Board content was rewritten. Verified both columns after the transaction. Migration 007 was still pending at this point; it was applied separately later that day, as recorded below.

Before application, pg_dump created backend/backups/pre-008-2026-10-18T152146856Z.dump in custom format.
pg_restore --list verified its archive listing; restoration and off-machine retention were not tested.
An isolated-schema PostgreSQL integration test verified destination save/read/change/clear and preservation by
an older write omitting the new property.

## Non-destructive upload presentation - 2026-10-18

Applied only 009_image_presentation.sql after checking the columns were absent and verifying a custom-format backup
archive with pg_restore --list. Added presentation_edit and presentation_revision; source images, capture metadata
and Board/photo links were retained. Verified both columns after committing the additive migration.
Backup: backend/backups/pre-009-2026-10-18T155028513Z.dump (Git-ignored). Restore and off-machine retention were not
tested. Migration 007 was still pending at this point; its later application is recorded below. Isolated-schema tests exercise save/read/reset and stale edits.

## Shared profile and Board tag catalog — 2026-10-18

Verified all current names against `shared/roamboard-tags.json`, then applied only `007_profile_tag_catalog.sql`
in a transaction after verifying a fresh custom-format backup with `pg_restore --list`.
All 40 current profile tag names are now present. Existing legacy names and integer IDs were verified unchanged,
so existing Board and profile selections remain valid. This supersedes the pending-007 notes above.
Backup: `backend/backups/pre-007-2026-10-18T161334007Z.dump` (Git-ignored). Restoration and off-machine retention
were not tested. Board choices now use the same editorial catalog as profile choices, restricted to persisted names;
retired database names are retained for existing selections but are not offered as new Board choices.
