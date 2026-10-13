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
3. Apply `db/migrations/001_initial.sql` to a **new, empty** database, then
   apply `db/migrations/002_auth_session.sql`. If you already imported the
   initial schema, apply only `002_auth_session.sql`. From `backend/`, for
   example:

    ```powershell
    psql -h localhost -U roamboard_user -d roamboard_dev -v ON_ERROR_STOP=1 -f db/migrations/002_auth_session.sql
    ```

    Use the database name and role from your own `DATABASE_URL`. Do not rerun an
    applied migration.

4. Set `GOOGLE_CLIENT_ID` in `.env` to your Google web application's client ID.
   Set `CLIENT_ORIGIN` to the exact frontend origin (locally,
   `http://localhost:3000`). Google ID tokens are verified by the backend using
   [Google's recommended Node.js library](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
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

Run `npm run check` in `backend/` before submitting backend changes. The
GitHub backend workflow runs the same lint, typecheck, test, and build steps.
