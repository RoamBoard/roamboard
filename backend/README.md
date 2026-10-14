# Roamboard backend

The API uses PostgreSQL through `pg`. `/health` checks Express; `/health/db`
checks that PostgreSQL accepts a query. The latter does not verify migrations.

## Local setup

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
3. Apply migrations in order: `001_initial.sql`, `002_auth_session.sql`, and
   `003_board_creator.sql`. If your database already has the first two, apply
   only `003_board_creator.sql`. From `backend/`, for example:

    ```powershell
    psql -h localhost -U roamboard_user -d roamboard_dev -v ON_ERROR_STOP=1 -f db/migrations/003_board_creator.sql
    ```

    Use the database name and role from your own `DATABASE_URL`. Do not rerun an
    applied migration.

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
  `{ "data": { "user": { "userId": "...", "username": "...", "displayName": "..." }, "isNew": true } }`;
  `isNew` is false for a returning user. The frontend sends requests with
  credentials.
- `GET /api/v1/auth/me` returns the current user from that cookie, or `401`.
- `POST /api/v1/auth/logout` revokes the session and clears the cookie. It
  requires `CLIENT_ORIGIN`.

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

Run `npm run cleanup:images` on a regular schedule in production, such as
hourly. It removes Cloudinary assets and database rows that have been unlinked
for at least 24 hours, plus abandoned upload intents after their grace period.
The command is safe to repeat. Configure the scheduler on the eventual backend
host; API requests do not run cleanup automatically.

`npm run check` runs lint, typecheck, unit/API tests, and build without a live
database or Cloudinary account. `npm run test:db` runs the PostgreSQL integration
test against `TEST_DATABASE_URL` or the local `.env` `DATABASE_URL`. It creates
and removes its own temporary schema, leaving normal application tables
untouched. Live Cloudinary uploads still need an end-to-end check with the
project's credentials before production use.
