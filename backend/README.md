# Roamboard backend

The API uses PostgreSQL through the `pg` driver. The `/health` route checks that
Express is running; `/health/db` also checks that PostgreSQL accepts a query.

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
3. Run `npm install` and `npm run dev` in this directory.
4. Check `http://localhost:3001/health` to confirm Express is running. Then
   check `http://localhost:3001/health/db`. A `200` response means the database
   connection works; `503` means it does not. Without `.env`, Express still
   starts on port 3001, but the database check returns `503`.

No application tables or migrations have been created yet.
