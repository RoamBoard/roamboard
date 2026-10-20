# Shared development database on Azure

## Image workflow for coding agents

Follow [the shared image workflow](../../docs/IMAGE_WORKFLOW.md) and the applicable `AGENTS.md` whenever a teammate supplies images or image links. Coding agents must register them with the backend `images:add` command, verify persistence, and use the returned `library:` reference on the requested frontend page. Editorial files use public Cloudinary storage; Unsplash references retain provider delivery. User Board/activity/profile uploads remain authenticated, with saved image order and cover selections. Do not expose credentials or replace protected image URLs with public editorial URLs.

This deploys PostgreSQL, the Express backend, the Next.js frontend, and a Caddy reverse proxy in Docker on one Azure Linux VM. Developers can also continue running `npm run dev` in `backend/` locally and connecting to the same database through SSH.

The team database is deployed. Teammates developing locally should start
with [the backend quick start](../README.md#team-quick-start-local-backend-shared-azure-database),
not recreate the VM or initialize another database. The sections below are the maintainer's runbook.

## 1. Create the VM and open ports

In the Azure portal, create an Ubuntu 24.04 LTS VM with SSH key authentication.
Choose a region close to the team, check the estimated Azure cost, and keep auto-shutdown
disabled if the service needs to stay available around the clock. Use a stable public IP and configure a DNS name label (for example, `roamboard.<region>.cloudapp.azure.com`).
The VM must stay running; container restart settings cannot restart a stopped Azure VM.
On a 1 GB RAM VM (`Standard B2ats v2`), provision a 4 GB `/swapfile` before building the Next.js container.

Allow inbound SSH (TCP 22) from your teammates' public IP addresses and inbound HTTP/HTTPS (TCP 80 and 443) in the Azure network
security group. Do not open TCP 5432, 3000, or 3001 publicly. Give teammates individual SSH access;
do not share a private SSH key. Restrict Docker administration to the maintainers.

- [Azure Linux VM creation](https://learn.microsoft.com/azure/virtual-machines/linux/quick-create-portal?tabs=ubuntu)
- [SSH access](https://learn.microsoft.com/en-us/azure/virtual-machines/linux-vm-connect)
- [Install Docker Engine and the Compose plugin on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)

SSH into the VM, install Docker using the linked instructions, and enable its service:

```bash
sudo systemctl enable --now docker
```

## 2. Start the stack on the VM

Clone this repository onto the VM using your own GitHub access, then run from its root:

```bash
cd backend
cp .env.example .env
chmod 600 .env
nano .env
cd deploy
grep -q '^IMAGE_TAG=' ../.env && sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$(git rev-parse HEAD)/" ../.env || echo "IMAGE_TAG=$(git rev-parse HEAD)" >> ../.env
sudo docker compose --env-file ../.env pull
sudo docker compose --env-file ../.env up -d
sudo docker compose --env-file ../.env logs --tail=100 postgres backend frontend caddy
sudo docker compose --env-file ../.env ps
```

Replace both example passwords with different long random passwords before starting, and set:

- `PUBLIC_DOMAIN`: the public hostname (for example, `roamboard.belgiumcentral.cloudapp.azure.com`). Compose derives `https://<PUBLIC_DOMAIN>` for the backend's runtime `CLIENT_ORIGIN` (and for the frontend's `NEXT_PUBLIC_API_URL` when building locally with `--build`). Add `https://<PUBLIC_DOMAIN>` to Authorized JavaScript origins in Google Cloud Console.
- `IMAGE_TAG`: the `main` commit SHA (`git rev-parse HEAD`) for the matched `roamboard-backend` and `roamboard-frontend` images to deploy.
- `MIGRATION_READY_TAG`: leave empty unless a maintainer has applied the SQL migrations for a blocked deployment; then set it to that deployment's commit SHA.
- `DOCKER_DATABASE_URL`: `postgresql://roamboard_user:YOUR_URL_ENCODED_APP_PASSWORD@postgres:5432/roamboard_dev` so the `backend` container connects to `postgres` over the Docker network.

The [Docker publish workflow](../../.github/workflows/docker-publish.yml) builds both images after its CI checks pass,
tags them with the full commit SHA, and deploys that SHA to the VM. Next.js embeds the workflow's `PUBLIC_DOMAIN` and
`GOOGLE_CLIENT_ID` secrets at build time; keep them equal to those values in the VM's `backend/.env`. The workflow does
not use `:latest`. Newly created GHCR packages default to private visibility: either make both packages public or run
`sudo docker login ghcr.io` on the VM with a `read:packages` token before the first pull.

### One-time automatic deployment setup

1. Confirm the live checkout path (expected: `/home/azureuser/roamboard`), the exact Azure VM name and resource group,
   and that the VM can reach GitHub, GHCR, and Azure over HTTPS. Keep the VM's SSH rule limited to maintainers' IPs.
2. After the workflow first publishes images, update the VM checkout to that commit and complete one manual deployment
   using the commands above. The deploy job may fail during this bootstrap. Verify `/health/db`, the frontend, the
   current database schema and a restorable backup. Automatic deployment requires a full, known-good `IMAGE_TAG` in
   `backend/.env`.
3. Protect `main` in GitHub before granting deployment access: require pull requests and the existing backend,
   frontend and formatting CI checks, and prevent direct pushes or bypasses. A merged change to this public repository's
   workflow can otherwise run a root-level VM command.
4. In Azure, create a user-assigned managed identity for deployment and a federated credential trusting the GitHub
   subject `repo:RoamBoard@332067389/roamboard@1381981366:environment:production`. This repository uses GitHub's
   immutable OIDC subject format; in Azure's GitHub credential form, enter organization ID `332067389` and repository ID
   `1381981366`. Grant it Run Command access to this VM only. Azure's
   [OIDC guide](https://learn.microsoft.com/azure/developer/github/connect-from-azure-openid-connect) and
   [Run Command permissions](https://learn.microsoft.com/azure/virtual-machines/linux/run-command#limiting-access-to-run-command)
   describe the setup. Do not grant subscription-wide VM Contributor or store a client secret in GitHub.
5. Create a GitHub `production` environment restricted to the `main` branch, without required reviewers so successful
   merges deploy automatically. Add `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` as environment
   secrets. Add `AZURE_RESOURCE_GROUP` and `AZURE_VM_NAME` as environment variables, using their verified Azure names.
   Set optional `DEPLOY_PATH` if the checkout is not `/home/azureuser/roamboard`. Keep `PUBLIC_DOMAIN` and
   `GOOGLE_CLIENT_ID` as repository secrets for the image build.

The deploy job uses Azure Run Command; it needs no inbound SSH rule for GitHub runners and no self-hosted runner on the
public repository. It checks that the SHA belongs to `main` and that neither VM infrastructure nor SQL migrations have
changed since the deployed SHA. It pulls both images before changing `IMAGE_TAG`, starts them without building locally,
checks the API/database and frontend through Caddy, and restores the prior tag if a health check fails.

SQL migrations remain manual. If the job stops for migration changes, take and verify a backup, apply and record the
migrations as described below, set `MIGRATION_READY_TAG=<commit SHA>` in the VM's `backend/.env`, then rerun that
workflow's failed deploy job. Changes to VM Compose, Caddy, or database initialization files also stop deployment.
For those releases, update the VM checkout, set `IMAGE_TAG` to the new SHA, pull both images, and run
`sudo docker compose --env-file ../.env up -d --no-build --pull never` from `backend/deploy/` to recreate the full
stack as needed. Verify `/health/db`, the frontend, and Caddy's configuration before rerunning the failed deploy job.
The image workflow does not modify the checkout, apply SQL migrations, or roll back infrastructure changes.
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
sudo docker compose --env-file ../.env exec -T postgres psql -U roamboard_user -d roamboard_dev -v ON_ERROR_STOP=1 -f /roamboard-migrations/NNN_your_migration.sql
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
Fresh databases apply 001 through 010 once, in numeric order. Migration 005 adds the editorial image catalog and
revision history and is already applied to the shared database. The shared database was reconciled with the profile
changes in 006 on 2026-10-17; do not rerun it there. See the migration log for verification and the remaining
column-length difference. Migration 007 is applied; do not rerun it. Destination migration 008 and photo presentation migration 009 are also recorded as applied; do not rerun them. Guest migration 010 remains pending until a fresh backup is confirmed.
PostgreSQL backups contain image references, not Cloudinary files. Preserve the same Cloudinary account and its public
editorial/authenticated user assets, or migrate those files separately before changing credentials. See the
[image recovery workflow](../../docs/IMAGE_WORKFLOW.md#missing-files-and-recovery).

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

Board destination migration 008_board_destination.sql adds the optional primary location and kind. Fresh databases
apply it after the existing migrations. It is already applied to shared development (2026-10-18), after backup;
do not rerun it there. See db/MIGRATION_LOG.md for the exact backup and verification. Migration 007 was subsequently applied after a verified backup; see the migration log.

Migration 009_image_presentation.sql adds non-destructive crop/resize settings and revisions for user uploads.
Apply after prior migrations on fresh databases. It is already applied to shared development (2026-10-18) after
a verified backup; do not rerun it there. See the migration log.
