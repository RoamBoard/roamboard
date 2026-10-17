# Shared development database on Azure

This deploys PostgreSQL in Docker on one Azure Linux VM. Each developer keeps running
`npm run dev` in `backend/` and connects to the same database through SSH. Express
deployment is a separate, later step; this setup alone does not complete the hosted-server requirement.

The team database is now deployed according to the maintainer. Teammates should start
with [the backend quick start](../README.md#team-quick-start-local-backend-shared-azure-database),
not recreate the VM or initialize another database. The sections below are the maintainer's runbook.

## 1. Create the VM

In the Azure portal, create an Ubuntu 24.04 LTS VM with SSH key authentication.
A small VM with 2 GB RAM is a reasonable starting point for this development database.
Choose a region close to the team, check the estimated Azure cost, and keep auto-shutdown
disabled if the database needs to stay available around the clock. Use a stable public IP.
The VM must stay running; container restart settings cannot restart a stopped Azure VM.

Allow inbound SSH (TCP 22) from your teammates' public IP addresses in the Azure network
security group. Do not open TCP 5432 publicly. Give teammates individual SSH access;
do not share a private SSH key. Restrict Docker administration to the maintainers.

- [Azure Linux VM creation](https://learn.microsoft.com/azure/virtual-machines/linux/quick-create-portal?tabs=ubuntu)
- [SSH access](https://learn.microsoft.com/en-us/azure/virtual-machines/linux-vm-connect)
- [Install Docker Engine and the Compose plugin on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)

SSH into the VM, install Docker using the linked instructions, and enable its service:

```bash
sudo systemctl enable --now docker
```

## 2. Start the database on the VM

Clone this repository onto the VM using your own GitHub access, then run from its root:

```bash
cd backend
cp .env.example .env
chmod 600 .env
nano .env
cd deploy
sudo docker compose --env-file ../.env up -d
sudo docker compose --env-file ../.env logs --tail=100 postgres
sudo docker compose --env-file ../.env ps
```

Replace both example passwords with different long random passwords before starting.
Use the existing `backend/.env.example` as the only configuration template. If
`backend/.env` already exists, edit it rather than copying over it. Both Docker Compose
and the backend use `backend/.env`; there is no deployment-specific `.env` file.
Keep the VM's `backend/.env` out of Git. Give developers only `ROAMBOARD_DB_PASSWORD`;
their local backends do not need the administrator password or Docker settings.
The backend login is `roamboard_user`; the database is `roamboard_dev`.

On an empty volume, initialization creates the application login and applies all SQL
migrations in filename order. Wait for the logs to say initialization completed and
Postgres is ready before connecting. If initialization fails, fix the cause and inspect
which statements succeeded before proceeding; restarting does not rerun initialization
on a nonempty volume. Do not delete a volume containing data to resolve a migration error.

The named volume preserves data across container replacement and VM reboot, provided
the VM disk is retained. It is not a backup. Never use `docker compose down -v` on this
shared database. Changing `.env` passwords after initialization does not change database
role passwords; use SQL role management and update the corresponding credentials.

## 3. Connect each local backend

In a separate PowerShell terminal on each laptop, open an SSH tunnel:

```powershell
ssh -i <local-path-to-your-key> -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:15432:127.0.0.1:5432 YOUR_SSH_USER@YOUR_VM_IP
```

Keep this terminal open while developing. Port 15432 avoids a clash with a local Postgres
installation. SSH encrypts the connection to Azure; Postgres is bound only to the VM's
loopback interface. No public database port or backend TLS override is needed.

In your local `backend/.env`, replace only the database URL, retaining Google, Cloudinary
and other existing settings:

```dotenv
DATABASE_URL=postgresql://roamboard_user:YOUR_URL_ENCODED_APP_PASSWORD@127.0.0.1:15432/roamboard_dev
```

URL-encode punctuation in the password. Do not put credentials in frontend configuration.
All teammates use the same database host through their own tunnels.

```powershell
cd backend
npm run check:setup
npm run dev
Invoke-RestMethod http://localhost:3001/health/db
```

A 200 response confirms connectivity, not schema correctness. Sign in and save/read a
Board to check application behavior. If the tunnel closes, reopen it. The existing `pg`
pool reads `DATABASE_URL`; no backend connection-code changes are necessary.

## 4. Inspect and edit data

While the tunnel is open, connect pgAdmin or DBeaver using:

| Setting  | Value                                     |
| -------- | ----------------------------------------- |
| Host     | `127.0.0.1`                               |
| Port     | `15432`                                   |
| Database | `roamboard_dev`                           |
| User     | `roamboard_user`                          |
| Password | Application password from the VM `.env`   |
| SSL      | Disabled for this SSH-tunneled connection |

You can browse tables and edit rows. Everyone sees committed changes. Manual changes
still obey foreign keys and other constraints. Keep schema changes in new ordered SQL
migrations in Git, rather than making undocumented changes in a GUI. Sign in through
the application to create users with genuine Google identity IDs.

## 5. Apply future migrations and maintain the service

Pull the reviewed code on the VM. From `backend/deploy`, apply each new migration once:

```bash
sudo docker compose --env-file ../.env exec -T postgres psql -U roamboard_user -d roamboard_dev -v ON_ERROR_STOP=1 -f /roamboard-migrations/005_your_migration.sql
```

The filename above is an example, not an existing migration. Coordinate one maintainer
to apply migrations and record applied filenames; there is currently no migration ledger.
Restarting the container does not apply new migrations to an existing database.

Record shared development migration applications in the
[manual migration log](../db/MIGRATION_LOG.md). Verify the target schema before applying a migration; this
documentation is not an automatic migration ledger.

Migration `004_api_features.sql` was applied on 2026-10-14 in one transaction after
a custom-format PostgreSQL backup. `check:setup` passed, and live Mapbox map-session
and Eiffel Tower POI search returned HTTP 200. Earlier migrations were already
present and were not reapplied. Do not reapply `004` to the shared database;
fresh databases still need all ordered migrations. The pre-migration backup was
stored locally in Git-ignored `backend/backups/`, with its archive listing checked
using `pg_restore --list`; off-machine retention was not verified.

Migration `004_api_features.sql` now creates the final compact quota schema directly,
including previous-window fields. With user approval, the former local migrations
005 and 006 were consolidated into 004 on 2026-10-15. The shared Azure database
already has that final schema; do not rerun 004 or rebuild it. See the
[migration log](../db/MIGRATION_LOG.md) for reconciliation and verification.
Fresh databases apply 001 through 005 once, in order. The shared database was
reconciled with 005 on 2026-10-17; do not rerun it there. See the migration log
for its verification and remaining column-length difference.

Useful commands from the same directory:

```bash
sudo docker compose --env-file ../.env ps
sudo docker compose --env-file ../.env logs --tail=100 postgres
sudo docker compose --env-file ../.env exec postgres psql -U roamboard_user -d roamboard_dev
```

Keep the VM patched. Do not change the Postgres major image version without planning
a database upgrade. `restart: unless-stopped` restores the container after a Docker/VM
restart unless it was explicitly stopped; it does not provide high availability.

## 6. Backups and recovery

### Current VM backup configuration

Configured manually on the VM on 2026-10-15:

- Script: `/usr/local/sbin/roamboard-backup`, run as root.
- Archives: `/var/backups/roamboard/roamboard-YYYYMMDDTHHMMSSZ.dump` (UTC filenames).
- Root cron: `0 */6 * * * /usr/local/sbin/roamboard-backup >> /var/backups/roamboard/backup.log 2>&1`.
- Schedule: 00:00, 06:00, 12:00 and 18:00 in the VM's timezone. Cron must be running;
  missed runs while the VM is stopped are not caught up automatically.
- Retention: dumps older than 90 days are deleted after a successful backup,
  using `find /var/backups/roamboard -maxdepth 1 -type f -name 'roamboard-*.dump' -mmin +129600 -delete`.
- The script uses `flock` to prevent overlapping runs, a restrictive `umask 077`,
  custom-format `pg_dump`, and `pg_restore --list` to inspect the archive before
  renaming its `.partial` file to `.dump`. Archive inspection is not a restore test.

These host files are not provisioned by Docker Compose or recreated by cloning the
repository. Preserve the script and cron configuration when rebuilding the VM.
Backups include database objects and rows, not PostgreSQL cluster roles/passwords,
`.env`, application code, or image files hosted by Cloudinary. Restoring on a fresh
server requires provisioning the database roles first. Changes after the selected
backup are not recovered. Off-VM backup copying and failure alerts are not configured;
loss of the VM disk could lose both the database and its backups. Copy archives to
separate storage and monitor successful runs. The log has no rotation configured.

Inspect configuration, sizes and scheduled-run results on the VM:

```bash
sudo crontab -l
sudo systemctl is-active cron
timedatectl
sudo ls -lh /var/backups/roamboard/*.dump
sudo du -sh /var/backups/roamboard
sudo tail -n 20 /var/backups/roamboard/backup.log
```

Create an additional backup before migrations or recovery:

```bash
sudo /usr/local/sbin/roamboard-backup
```

### Restore and verify without changing the shared database

Run in the VM's SSH terminal. Choose the archive explicitly from the listing above,
replacing `YOUR_BACKUP.dump` below. Use the same terminal for all steps so variables
remain available. Never restore directly over the shared database for a test.

```bash
cd /home/azureuser/roamboard/backend/deploy
backup=/var/backups/roamboard/YOUR_BACKUP.dump
recovery="roamboard_restore_test_$(date -u +%Y%m%d%H%M%S)"
sudo test -s "$backup"
sudo docker compose --env-file ../.env exec -T postgres createdb -U postgres -O roamboard_user "$recovery"
```

Stop if any command fails. Restore the archive atomically; a restore error rolls back
its changes. Bash `pipefail` also reports a failure reading the archive.

```bash
set -o pipefail
sudo cat "$backup" | sudo docker compose --env-file ../.env exec -T postgres \
  pg_restore -U postgres -d "$recovery" --single-transaction --exit-on-error
```

Continue only if restoration succeeds:

```bash
sudo docker compose --env-file ../.env exec -T postgres \
  psql -U postgres -d "$recovery" -v ON_ERROR_STOP=1 \
  -c "SELECT COUNT(*) AS restored_boards FROM board;" \
  -c "SELECT board_id, title FROM board ORDER BY board_id LIMIT 10;"
echo "Restored database: $recovery"
```

Inspect expected users, Boards and activities with your database client. For an
application smoke test, point one local backend's `DATABASE_URL` at the recovery
database name, restart that backend, and test sign-in and Board reads. Stop that
backend afterward and restore its original configuration. A successful restore is
not proof that every application feature or external image remains available.

### Make a verified recovery database the shared database

This is a maintenance operation, not part of a routine restore test. Agree on the
backup time with the team: all changes after that backup will be absent. Have every
teammate stop their backend, jobs and database clients. Temporarily comment out the
backup cron entry with `sudo crontab -e` and wait for any running backup to finish.
Create one final backup with `sudo /usr/local/sbin/roamboard-backup` before switching.
Keep the same SSH terminal and the verified `$recovery` value from above.

The following retains the original database under a timestamped name and promotes
the restored database. Both names are changed in one transaction. It terminates
remaining connections to those two databases; clients must remain stopped.

```bash
previous="roamboard_before_restore_$(date -u +%Y%m%d%H%M%S)"
sudo docker compose --env-file ../.env exec -T postgres \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v recovery="$recovery" -v previous="$previous" <<'SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname IN ('roamboard_dev', :'recovery') AND pid <> pg_backend_pid();
BEGIN;
ALTER DATABASE roamboard_dev RENAME TO :"previous";
ALTER DATABASE :"recovery" RENAME TO roamboard_dev;
COMMIT;
SQL
echo "Original database retained as: $previous"
```

Stop on errors. After success, restart one backend using the original `roamboard_dev`
URL, run `npm run check:setup`, and verify sign-in plus Board reads/writes. Then let
the team reconnect, re-enable the backup cron entry, and create a fresh backup.
Preserve the original database until recovery is accepted. PostgreSQL dumps include all saved Board and search data; search reads the restored database directly. Do not rerun migrations already contained
in the archive; compare the restored schema with the application version first.
