# Roamboard backend agent instructions

These instructions apply to `backend/`. Use `../layered-backend-demo1/` as the reference for the **feature-first layered structure**, not as a source of product rules or database schema. Keep changes small and understandable enough for the team to explain. Update this file when an agreed architecture or workflow changes; describe implemented and planned behavior separately.

## Current state and sources of truth

- This is a Node.js 24, TypeScript, Express 5 API using npm. `src/app.ts` creates the app; `src/server.ts` starts it. `src/db.ts` owns the shared `pg` pool. The first feature module, `src/features/auth/`, verifies Google ID tokens and manages PostgreSQL-backed sessions. The frontend uses this module for Google sign-in, session lookup, and logout.
- PostgreSQL schema lives in ordered files under `db/migrations/`; `001_initial.sql` is the baseline and `002_auth_session.sql` adds sessions. Treat migrations as the database source of truth. Do not treat the demo's in-memory Todo model or the frontend's mock data as persistent Roamboard behavior.
- Check the relevant schema, `../frontend/REQUIREMENTS.md`, and `../frontend/src/types/` before defining a feature's contract. Preserve the product decisions already represented in the schema; ask about genuinely unresolved behavior instead of silently substituting the demo's choices.
- Keep `backend/.env` and credentials out of Git. Document new variables in `.env.example` and `README.md` without real secrets.

## Architecture: follow the demo's layers

For each feature, follow the flow:

```text
HTTP request -> global/route middleware -> router -> Zod validation
             -> controller -> service -> repository or provider adapter
```

Use a feature folder under `src/features/<feature>/` with the relevant files:

```text
<feature>.routes.ts       HTTP paths and middleware only
<feature>.schemas.ts      request validation and transformation
<feature>.controller.ts   HTTP input/output translation
<feature>.service.ts      business rules, authorization, orchestration
<feature>.repository.ts   PostgreSQL queries and row mapping
<feature>.types.ts        feature contracts and types, when needed
<feature>.module.ts       dependency construction and router wiring
```

- `src/app.ts` mounts feature routers; it does not contain feature business rules or SQL. Keep `createApp()` usable by API tests without opening a port. Keep the port listener in `src/server.ts`.
- Routes declare methods, paths, and middleware. Validate body, path, and query data with Zod before the controller. Controllers call services and choose status codes and response bodies; they do not query PostgreSQL or decide permissions.
- Services enforce domain rules and resource access. They depend on repository/provider contracts and should be usable without Express request or response objects.
- Repositories own SQL, transactions, and mapping between database rows and domain data. Use parameterized queries. Do not put SQL in routes, controllers, or services. Use the existing `pg` dependency and share database connection management rather than creating a pool for each request.
- External services belong behind provider adapters. Do not pass provider SDK response types through controllers or expose secrets to the frontend.
- Modules construct repositories, services, controllers, and routers in that order, as in `../layered-backend-demo1/src/features/todos/todo.module.ts`. Allow explicit dependency injection where tests need a fake repository or provider. Do not create a generic framework for a single feature.
- Put truly cross-feature middleware, errors, configuration, and helpers in `src/middleware/`, `src/shared/`, or `src/config/` as appropriate. Add these folders as needed; they do not exist in this backend yet. Use centralized error handling once product routes are added.
- Use `.js` suffixes for relative TypeScript imports under NodeNext/ESM, as the current backend and demo do.

## API and data rules

- Mount product endpoints under `/api/v1`, following the demo. Keep `/health` and `/health/db` as operational endpoints outside that prefix.
- Define a feature's request/response contract, permissions, success cases, and failure cases before implementing its endpoint. Use consistent HTTP status codes and a consistent error shape. Never send raw SQL, stack traces, tokens, or provider secrets to clients.
- The schema uses `app_user.user_id` for the Google `sub`. Verify Google identity server-side before trusting it; do not accept a client-supplied user ID as proof of identity. Enforce ownership, board visibility, and membership on the server for every protected read or write.
- Cookie-authenticated mutations need CSRF protection. The current auth routes require the exact configured `CLIENT_ORIGIN` on POST requests; apply an equivalent check to future write routes. CORS alone does not stop a forged request.
- The current board visibility values are `public`, `friends`, and `collaborators`. Consult the migration and agreed feature behavior rather than copying the demo guide's older `private` terminology or UUID identifier advice. Board and activity IDs are database-generated integers.
- Keep schema changes in new, ordered migrations. Do not edit `001_initial.sql` after it has been applied to a database unless the team explicitly decides to rebuild that database. Coordinate SQL constraints with service validation; application checks do not replace database integrity constraints.
- Keep operations that must succeed or fail together in a transaction. Avoid N+1 queries and return only data the caller may see. Treat provider data and user input as untrusted.

## Tests and GitHub workflow

- `../.github/workflows/backend-ci.yml` runs on pushes and pull requests to `main`, and on manual dispatch. It uses Node.js 24, runs from `backend/`, installs with `npm ci`, then runs `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Keep `backend/package-lock.json` synchronized with `backend/package.json`.
- Before handoff, run the relevant test and the same backend CI checks locally (`npm run check` runs those checks in sequence). Documentation-only changes need a content/diff review, not an application test run. Report any check that could not run.
- Add meaningful service and HTTP tests for new behavior, especially validation, permissions, errors, and state changes. Follow the demo's pattern of importing `createApp()` and using Supertest without starting a listener. Inject fakes for deterministic tests; mark tests requiring a real PostgreSQL instance as integration tests and document how to run them. Do not make the normal CI suite depend on an unconfigured local database or live external provider.
- Review the diff before committing. Keep changes focused, do not commit `.env`, build output, dependencies, or generated files, and do not include unrelated work. The frontend has its own `frontend/AGENTS.md` and CI workflow; follow those instructions when changing frontend files.
