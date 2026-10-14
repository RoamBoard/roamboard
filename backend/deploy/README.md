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
ssh -i <local-path-to-your-key> -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:15432:127.0.0.1:5432 YOUR_SSH_USER@YOUR_VM_IP
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
sudo docker compose --env-file ../.env exec -T postgres psql -U roamboard_user -d roamboard_dev -v ON_ERROR_STOP=1 -f /roamboard-migrations/004_your_migration.sql
```

The filename above is an example, not an existing migration. Coordinate one maintainer
to apply migrations and record applied filenames; there is currently no migration ledger.
Restarting the container does not apply new migrations to an existing database.

Record shared development applications in [the manual migration log](../db/MIGRATION_LOG.md).
Migration `004_api_features.sql` was applied on 2026-10-14; do not reapply it to
the shared database. Fresh databases still need all ordered migrations.

Useful commands from the same directory:

```bash
sudo docker compose --env-file ../.env ps
sudo docker compose --env-file ../.env logs --tail=100 postgres
sudo docker compose --env-file ../.env exec postgres psql -U roamboard_user -d roamboard_dev
```

Before schema changes and regularly while the team uses the database, create a backup:

```bash
mkdir -p backups
chmod 700 backups
sudo docker compose --env-file ../.env exec -T postgres pg_dump -U postgres -d roamboard_dev -Fc > "backups/roamboard-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Keep backups outside Git, copy them off the VM, and test restoration into a separate
database. An example restore into a fresh recovery database is:

```bash
sudo docker compose --env-file ../.env exec -T postgres createdb -U postgres -O roamboard_user roamboard_recovery
sudo docker compose --env-file ../.env exec -T postgres pg_restore -U postgres -d roamboard_recovery < backups/YOUR_BACKUP.dump
```

Keep the VM patched. Do not change the Postgres major image version without planning
a database upgrade. `restart: unless-stopped` restores the container after a Docker/VM
restart unless it was explicitly stopped; it does not provide high availability.
