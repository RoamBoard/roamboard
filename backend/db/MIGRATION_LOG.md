# Shared development database migration log

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
