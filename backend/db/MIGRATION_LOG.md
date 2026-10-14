# Shared development database migration log

This is a manual maintenance record, not an automatic migration ledger. Verify
the target database schema before applying a migration; do not rerun recorded files.

| Date (Europe/Stockholm) | Migration              | Verification                                                                                                                                                          |
| ----------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-14              | `004_api_features.sql` | Applied in one transaction after a PostgreSQL custom-format backup. `check:setup` passed; live Mapbox map-session and Eiffel Tower POI search both returned HTTP 200. |

The pre-migration backup is in the local, Git-ignored `backend/backups/` folder.
Its archive listing was verified with `pg_restore --list`. Earlier migrations
were already present and were not reapplied. Copy the backup off this machine
through the team's approved backup workflow for durable retention.
