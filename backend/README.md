# Roamboard backend

## Boards discovery

`contracts/boards-discovery.md` describes the `/boards` feeds, search and three-second view protocol. The dedicated
discovery endpoints preserve the existing generic `/search` API. Apply migration 018 once on other environments with
`npm run db:discovery -- --apply`; the job first verifies a custom-format PostgreSQL backup using local `pg_dump` and
`pg_restore` (PostgreSQL 18 on Windows, or PATH elsewhere). Shared development already has 018; do not reapply it.

Run `npm run cleanup:discovery` daily through the deployment's scheduler to remove expired view challenges and browser
identities, views older than 31 days and save events older than 60 days. This does not remove Boards or active saves.
Expiry/window checks apply even before cleanup runs. The cleanup task is provided; no host scheduler is installed by
the feature. Anonymous uniqueness is per browser, not guaranteed per person. Location recognition uses stored
geographic metadata and a small built-in fallback; curated synonyms are versioned in the discovery ranking module.
NLP/semantic search is the next iteration, not part of this implementation.

## Image workflow for coding agents

Follow [the shared image workflow](../docs/IMAGE_WORKFLOW.md) and the applicable `AGENTS.md` whenever a teammate supplies images or image links. Coding agents must register them with the backend `images:add` command, verify persistence, and use the returned `library:` reference on the requested frontend page. Editorial files use public Cloudinary storage; Unsplash references retain provider delivery. User Board/activity/profile uploads remain authenticated, with saved image order and cover selections. Do not expose credentials or replace protected image URLs with public editorial URLs.

## Website image library

Development Labs at `/dev/images` manages public website images independently of protected Board/profile uploads.
The database stores reusable keys, provider IDs, credits and immutable replacement revisions. Cloudinary hosts eligible
files; Unsplash references keep Unsplash delivery. See [the image contract](../contracts/image-library.md).

From `backend/`, run `npm.cmd run images:inventory` to generate a reviewable source manifest, then
`npm.cmd run images:import` to import missing records. For a new database only, add `-- --apply-schema` to apply
migration 005 if absent. Migration 005 is already applied to the team's shared database; do not rerun older migrations.
The importer uses existing `DATABASE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
and, for new Labs Unsplash selections, `UNSPLASH_ACCESS_KEY`. No new secrets are needed. Preserve originals for rollback.
Labs uploads/selection require a real signed-in session, exact `CLIENT_ORIGIN` and backend development mode.
Remove the Labs page/navigation and development mutations before deployment; preserve public catalog reads and tooling.

## Existing API features

### Add one image from a coding agent

Run from `backend/` with its existing `.env`:

```powershell
npm.cmd run images:add -- --key home.hero --file "C:\path\photo.jpg" --alt "Mountain lake" --credit "User-provided image"
npm.cmd run images:add -- --key discover.kyoto.hero --unsplash "https://unsplash.com/photos/AiC8MRukmBg"
npm.cmd run images:add -- --key home.banner --url "https://example.com/photo.jpg" --alt "Coastal town" --credit "Photographer" --source-url "https://example.com/source"
```

The JSON result includes the saved record and `library:<assetKey>` reference for the frontend image component.
This command does not edit a page; the agent must wire the reference into the requested page afterward. Unsplash
pages/IDs fetch provider attribution; direct CDN links require supplied metadata and stay external. Other HTTPS
links must return a raster image up to 10 MB. The downloader rejects private/reserved addresses, pins DNS per redirect,
limits redirects and time, and never accepts a gallery/web page. Use files/links the teammate supplied for the task.
To replace an existing key intentionally, add `--expected-revision <current revision>`. A stale revision returns a conflict.
No new image is written by looking it up: `GET /api/v1/image-library/home.hero` returns one record; the query
`GET /api/v1/image-library?keys=home.hero,home.banner` returns found records for up to 50 keys. Both work in production.

### Existing surfaces

Existing frontend provider, destination, profile, developer Board browser and
public search features run here. See
[API_FEATURES_CONTRACT.md](API_FEATURES_CONTRACT.md) for routes, permissions,
budgets and errors; the creator uses [BOARD_API_CONTRACT.md](BOARD_API_CONTRACT.md).

Apply unapplied migrations through `010_guest_accounts.sql` in numeric order to an
independent local database. The shared Azure database already has the consolidated 004
schema, image-library 005, and reconciled profile changes in 006; do not rerun those
files there. Migration 007 is applied; do not rerun it. Destination migration 008 and photo presentation migration 009 are also recorded as applied; do not rerun them. Guest migration 010 remains pending on Azure. See
[the migration log](db/MIGRATION_LOG.md) for the remaining profile column-length difference.
The shared database also has the saved-place table from the file originally named
`005_saved_places.sql`, now `008_saved_places.sql`; do not rerun it there.
Integration tests apply the files only inside temporary test schemas.

`npm run dev` selects `NODE_ENV=development`. Cloudinary lab management, Google
Places lab operations and the developer Board list also
require a Google session. They are unavailable outside development. Deployed
startup must use `npm start`, not the development command.

Configure optional provider keys using `.env.example`. Missing keys produce
explicit unavailable states. Board search reads public, published Boards directly
from PostgreSQL and ranks matches in the API, including typo-tolerant word matching,
prefix suggestions and filters. No separate search service, credentials, index setup
or synchronization is needed.

Search contains only public, published Boards. POIs, restaurants and landmarks use
the separate Mapbox Search Box text-search endpoint, with its own conservative
495/month and 9/second application budget. These temporary provider results are
not indexed or written to the database; persistent Board locations still use Geoapify.

The API uses PostgreSQL through `pg`. `/health` checks Express; `/health/db`
checks that PostgreSQL accepts a query. The latter does not verify migrations.

## Team quick start: local backend, shared Azure database

The Azure PostgreSQL container is already deployed. Teammates do not need to install
PostgreSQL or run Docker locally. Use Node.js 24 and ask the database maintainer for
the VM hostname, your SSH username/access, the application database password, and the
team's Google web client ID. Never share private SSH keys or the database admin password.

From the repository root, install dependencies once:

```powershell
pnpm.cmd install --frozen-lockfile
npm.cmd --prefix backend ci
```

Copy `backend/.env.example` to `backend/.env` only if `.env` does not already exist.
Keep existing credentials when updating it. Set these values:

```dotenv
DATABASE_URL=postgresql://roamboard_user:YOUR_URL_ENCODED_APP_PASSWORD@127.0.0.1:15432/roamboard_dev
CLIENT_ORIGIN=http://localhost:3000
GOOGLE_CLIENT_ID=THE_TEAM_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
```

The database name and role above match our Docker setup. URL-encode punctuation in the
password. `POSTGRES_ADMIN_PASSWORD` and `ROAMBOARD_DB_PASSWORD` are used to initialize
Docker on the VM; local backends only need `DATABASE_URL`. No extra `.env` file is needed.

In terminal 1, open your connection to Azure and keep it running:

```powershell
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:15432:127.0.0.1:5432 YOUR_SSH_USER@YOUR_VM_IP
```

If your SSH key is not a default key, add `-i PATH_TO_YOUR_PRIVATE_KEY` to the command.
The maintainer must authorize your public key and allow your public IP in Azure's SSH
network rule. Do not open port 5432 publicly.

In terminal 2:

```powershell
cd backend
npm.cmd run check:setup
npm.cmd run dev
```

`check:setup` checks database connectivity, migrations 003/004, authentication tables/permissions, and
Google configuration without changing data or printing credentials. If a frontend
`.env.local` exists, it also checks that its Google client ID matches the backend.
This checks configuration, not a complete Google login or every application migration.

In another terminal, verify the running API:

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/health/db
```

Start the frontend using [its setup instructions](../frontend/README.md). Its
`NEXT_PUBLIC_API_URL` stays `http://localhost:3001`, and its
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` must exactly match backend `GOOGLE_CLIENT_ID`. Google
must authorize the frontend JavaScript origin `http://localhost:3000`. Restart each
dev server after changing its environment file. Use `localhost` consistently in the browser.

To inspect or edit the shared database, keep the tunnel open and connect pgAdmin or
DBeaver to `127.0.0.1`, port `15432`, database `roamboard_dev`, user `roamboard_user`,
with the raw application password. Database SSL is disabled on this loopback connection;
SSH encrypts traffic to Azure. Everyone sees committed changes. Do not rerun migrations
or recreate the shared database as part of onboarding.

### Login troubleshooting

- A healthy Docker container means PostgreSQL is running; it does not prove your local
  backend can connect, that migrations exist, or that Google is configured.
- `GOOGLE_AUTH_UNAVAILABLE` (503): fill backend `GOOGLE_CLIENT_ID` with the same web
  client ID as the frontend, then restart the backend. Replacing `.env` with database-only
  settings removes Google configuration and breaks login.
- `INVALID_GOOGLE_CREDENTIAL` (401): check matching client IDs and try signing in again.
- Database check failure: reopen the tunnel and run `npm.cmd run check:setup`. Check the
  database password and ask the maintainer to inspect migrations/permissions if necessary.
- A generic 500 means an unexpected backend failure; inspect the backend and run the
  setup check. Do not share ID tokens, cookies, connection URLs, or private keys in logs.

See [the deployment guide](deploy/README.md) for VM administration, migrations and backups.

### Docker Compose application deployment

When deploying the full application stack (`postgres`, `backend`, `frontend`, and `caddy`) through `backend/deploy/compose.yaml`, set these additional variables in `backend/.env`:

- `PUBLIC_DOMAIN`: The public hostname served by Caddy (for example, `roamboard.belgiumcentral.cloudapp.azure.com`), used to provision TLS certificates, route `/api/*` and `/health*` to the backend container, and set `https://<PUBLIC_DOMAIN>` as the backend's `CLIENT_ORIGIN` (and the frontend's build-time `NEXT_PUBLIC_API_URL` when building locally).
- `IMAGE_TAG`: The `main` commit SHA (`git rev-parse HEAD`) for the matched `ghcr.io/roamboard/roamboard-backend:${IMAGE_TAG}` and `ghcr.io/roamboard/roamboard-frontend:${IMAGE_TAG}` images to run.
- `DOCKER_DATABASE_URL`: The container-network PostgreSQL connection string (`postgresql://roamboard_user:YOUR_URL_ENCODED_APP_PASSWORD@postgres:5432/roamboard_dev`), required so the `backend` container connects to the `postgres` service over the Compose network while preserving `DATABASE_URL` (`127.0.0.1:15432`) for local SSH-tunneled development.

Because Next.js embeds `NEXT_PUBLIC_API_URL` (`https://${PUBLIC_DOMAIN}`) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (`GOOGLE_CLIENT_ID`) at build time, the [Docker publish workflow](../.github/workflows/docker-publish.yml) uses `PUBLIC_DOMAIN` and `GOOGLE_CLIENT_ID` GitHub secrets that must match the VM's `backend/.env`. After CI checks, it publishes both SHA-tagged images and deploys that SHA through Azure Run Command. See the [one-time setup and migration gate](deploy/README.md#one-time-automatic-deployment-setup). GHCR packages must be made public or the VM must authenticate with a `read:packages` token before pulling them.

## Alternative: independent local PostgreSQL setup

For a shared PostgreSQL database in Docker on Azure while running the backend locally,
follow [the shared database deployment guide](deploy/README.md). The existing
`DATABASE_URL` configuration supports that setup without connection-code changes.

1. Connect to your local PostgreSQL server as an administrator, for example
   with `psql -h localhost -U postgres -d postgres`, and run these two SQL
   statements (choose your own password):

    ```sql
    CREATE ROLE roamboard_user LOGIN PASSWORD 'choose-a-password';
    CREATE DATABASE roamboard_dev OWNER roamboard_user;
    ```

    Run the statements separately if your SQL tool wraps multiple statements in
    a transaction. `CREATE DATABASE` cannot run inside a transaction block.

2. Copy `.env.example` to `.env` and replace `your_password` with the role's
   password. The `.env` file is ignored by Git. If the password contains URL
   punctuation, URL-encode it in `DATABASE_URL`.
3. Apply unapplied migrations in order: `001_initial.sql`, `002_auth_session.sql`,
   `003_board_creator.sql`, `004_api_features.sql`, `005_image_library.sql`,
   `006_profile.sql`, `007_profile_tag_catalog.sql`, and `008_saved_places.sql`. Apply only missing migrations.
   The shared Azure database already has 004, 005, and the reconciled profile changes
   from 006; do not rerun them there. Migration 007 is also applied. Destination migration 008 and photo presentation migration 009 are also recorded as applied. Apply only guest migration 010 there after a fresh backup is confirmed.
   From `backend/`, for an independent database missing 006:

    ```powershell
    psql -h localhost -U roamboard_user -d roamboard_dev -v ON_ERROR_STOP=1 -f db/migrations/006_profile.sql
    ```

    Use the database name and role from your own `DATABASE_URL`. Do not rerun an
    applied migration.

    Check whether `app_user.profile_revision` exists before running 006. The API and
    local integration tests require 006; do not apply it to the shared Azure database.
    `npm run test:db` creates isolated temporary schemas in the configured
    database, applies the migrations listed by its integration fixtures, and removes those schemas after the tests.

4. Set `GOOGLE_CLIENT_ID` in `.env` to your Google web application's client ID.
   Set `CLIENT_ORIGIN` to the exact frontend origin (locally,
   `http://localhost:3000`). Google ID tokens are verified by the backend using
   [Google's recommended Node.js library](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
   For photo uploads, set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
   `CLOUDINARY_API_SECRET` from one Cloudinary product environment. Keep the API
   secret on the backend only. The app starts without these values, but image
   upload endpoints return `503 IMAGE_STORAGE_UNAVAILABLE` until configured.
5. Run `npm install` and `npm run dev` in this directory.
6. Check `http://localhost:3001/health` to confirm Express is running. Then
   check `http://localhost:3001/health/db`. A `200` response means the database
   connection works; `503` means it does not. Without `.env`, Express still
   starts on port 3001, but the database check returns `503`.

## Authentication API

- `POST /api/v1/auth/google` accepts JSON `{ "credential": "<Google ID token>" }`
  from `CLIENT_ORIGIN`. It finds or creates the user and sets a seven-day,
  HTTP-only session cookie. It returns
  `{ "data": { "user": { "userId": "...", "username": "...", "displayName": "...", "profilePictureUrl": null }, "isNew": true } }`;
  `isNew` is false for a returning user. The frontend sends requests with
  credentials.
- `GET /api/v1/auth/me` returns the current user from that cookie, or `401`.
- `POST /api/v1/auth/logout` revokes the session and clears the cookie. It
  requires `CLIENT_ORIGIN`.

New Google accounts receive normalized handles such as `ada_lovelace`, then `ada_lovelace_1`,
`ada_lovelace_2`, using the lowest available suffix. Allocation uses a transaction lock and the existing
username uniqueness constraint. On their next Google sign-in, existing handles matching the old normalized-name plus ten hex characters
are replaced with an available clean handle. Their public profile URLs change; custom handles are preserved.
Display names default to Google's given and family names together. On later sign-ins, the old first-name-only
default is expanded to the full name; other edited display names are preserved.

When no profile picture is saved, sign-in imports Google's verified photo claim into authenticated Cloudinary
storage and links it through the existing uploaded-image tables. An upload intent is committed before sending
the file, then completed into an orphan image before profile linking. Timeouts and failed profile transactions
remain tracked for the existing cleanup job. No schema migration is needed. Downloads accept
only HTTPS `lh<number>.googleusercontent.com` URLs without redirects, supported raster types, and at most 10 MB.
Google imports request a 1024-pixel source rather than the small sign-in thumbnail. Previously imported thumbnails
are upgraded on a later sign-in only when provider metadata identifies the old Google import; uploaded photos are
preserved, and concurrent photo edits take precedence. Refreshed imports use a dedicated storage prefix to avoid
re-importing them on every login. A missing photo or failed import leaves sign-in working and retries on a
later sign-in. Auth responses include a nullable `profilePictureUrl`; the frontend loads it directly with the
session cookie. The welcome page displays `displayName`, while profile links continue using `username`.

The cookie is `SameSite=Lax`, host-only, and `Secure` in production. The
frontend Google button calls these endpoints. Google email is not stored. Expired session rows may
be removed later with `DELETE FROM auth_session WHERE expires_at <= NOW()`.

## Board creator API

The [Board API contract](BOARD_API_CONTRACT.md) describes request and response
fields. The backend now implements draft save, publication, published Board editing, tags, categories,
image uploads, access checks, and Board deletion. The `/boards/new` frontend now
uses these endpoints for upload, draft save, and publication.

- `GET /api/v1/tags` and `GET /api/v1/activity-categories` return allowed
  choices. Migration `003_board_creator.sql` seeds 40 shared profile/Board tags
  and the current activity categories.
- `POST /api/v1/boards`, `PUT /api/v1/boards/:boardId`, `GET /api/v1/boards/:boardId`,
  `GET /api/v1/boards?scope=drafts&page=1&limit=20`,
  `GET /api/v1/boards?scope=published&page=1&limit=20`, and
  `DELETE /api/v1/boards/:boardId` implement creator save, resume, publish,
  published editing, authorized read, owner-only published listing, and removal.
  Owners can edit published content and visibility; Board editors can edit content
  while preserving visibility. Writes use the session cookie and exact
  `CLIENT_ORIGIN`. A full replacement includes the last returned `revision`.
- `POST /api/v1/images/upload-intents` creates a signed Cloudinary upload for
  JPEG, PNG, WebP, HEIC, or HEIF files up to 10,000,000 bytes. The browser posts
  the file directly to the returned `uploadUrl` with the returned `formFields`;
  it then calls `POST /api/v1/images/complete` with the `uploadId`. The backend
  verifies the Cloudinary asset before returning its database `imageId`.
- `GET /api/v1/images/:imageId/content?variant=display|thumbnail` checks current
  Board access on each request and streams a transformed JPEG from Cloudinary.
  Uploaded originals and variants use Cloudinary's authenticated delivery type;
  the browser never receives a Cloudinary signed delivery URL. Display
  transformations remove embedded metadata, including GPS. This route uses
  backend bandwidth and matters when choosing a production host.

Apply migration 020 with `npm run db:images -- --apply` after checking status with `npm run db:images`.
The command verifies a custom-format database backup before applying only that migration. See the
[image deletion contract](../contracts/image-deletion.md) and migration log for rollout status.

Replacing/removing a profile picture, removing photos in a saved Board edit or deleting a Board immediately
attempts Cloudinary cleanup after commit. The image row and completed upload intent are removed only after
provider success and only when no Board, activity or profile still uses the image. Covers and activity-only
photos are included. Saved remixes retain their independently copied photos; editorial images are excluded.
An immediate attempt covers only images removed by that request, at most four, and waits at most one second overall.
The worker handles the remaining queue; sign-in never waits for image cleanup.

The API server runs an image-cleanup sweep on startup and every minute, retrying durable deletion requests.
Fresh unattached uploads and expired incomplete intents retain their 24-hour grace period. Run
`npm run cleanup:images` for manual maintenance; it returns a nonzero exit code if any asset fails.

`npm run check` runs lint, typecheck, unit/API tests, and build without a live
database or Cloudinary account. `npm run test:db` runs the PostgreSQL integration
test against `TEST_DATABASE_URL` or the local `.env` `DATABASE_URL`. It creates
and removes its own temporary schema, leaving normal application tables
untouched. Live Cloudinary uploads still need an end-to-end check with the
project's credentials before production use.

Board destination migration 008_board_destination.sql adds the optional primary location and kind. Fresh databases
apply it after the existing migrations. It is already applied to shared development (2026-10-18), after backup;
do not rerun it there. See db/MIGRATION_LOG.md for the exact backup and verification. Migration 007 was subsequently applied after a verified backup; see the migration log.

Migration 009_image_presentation.sql adds non-destructive crop/resize settings and revisions for user uploads.
Apply after prior migrations on fresh databases. It is already applied to shared development (2026-10-18) after
a verified backup; do not rerun it there. See the migration log.
