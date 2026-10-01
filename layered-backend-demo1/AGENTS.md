# Roamboard backend instructions

These instructions apply to work inside `layered-backend-demo1/`. Roamboard is a student project, so keep the backend understandable, testable, and easy for the team to explain. Make small, focused changes and preserve the existing architecture unless the task requires a deliberate migration.

This is a living project guide. Agents may and should update `AGENTS.md` when the backend architecture, frontend contract, infrastructure, testing process, security policy, or supported features change. Keep updates factual, concise, and consistent with the code that actually exists. Clearly label planned work so future agents do not mistake it for an implemented feature.

## Current status and product context

This folder is the TypeScript backend prototype for Roamboard. It has an Express 5 todo API, a sample travel search API, a destination discovery API, and a server-side provider lab. Local development defaults to in-memory repositories; Docker Compose runs the API with PostgreSQL persistence and a derived Elasticsearch index. It does not have real Boards or authentication. Provider discovery data is not persisted or indexed, and the provider lab is integrated with the frontend at `/dev/providers`.

The frontend is a Next.js App Router application in `frontend/`. Read [frontend/AGENTS.md](../frontend/AGENTS.md) and [frontend/REQUIREMENTS.md](../frontend/REQUIREMENTS.md) when an API change affects the UI. The frontend currently uses mock data and the Board model in `frontend/src/types/board.ts` is a provisional contract, not proof that persistence or authentication exists.

Roamboard Boards are planned itineraries or travel journals. The eventual backend needs to support users and profiles, Boards, ordered activities and other items, locations, images, tags, visibility, friends, saved Boards, search, and travel history. Implement only the requested slice; do not build the entire requirements document for a narrow task.

## Architecture

Keep the existing feature-first, layered flow:

```text
HTTP request
  -> global middleware
  -> feature router
  -> validation middleware
  -> controller
  -> service
  -> repository or provider adapter
```

Use this structure for each feature:

```text
src/features/<feature>/
  <feature>.routes.ts
  <feature>.controller.ts
  <feature>.service.ts
  <feature>.repository.ts
  <feature>.schemas.ts
  <feature>.module.ts
  <feature>.types.ts       # when feature types need a separate file
```

- **Routes** declare HTTP methods, paths, and middleware. Keep them thin.
- **Schemas** validate and transform request body, params, and query values with Zod.
- **Controllers** translate HTTP input into service calls and service results into responses. Do not put business rules or database queries here.
- **Services** own business rules, authorization decisions, orchestration, and provider coordination. Keep them independent of Express where practical.
- **Repositories** own persistence and expose interfaces for services. The todo and search source features each have an in-memory implementation and a PostgreSQL implementation. SQL stays out of controllers.
- **Provider adapters** wrap Cloudinary, Mapbox, Google Places, Unsplash, Elasticsearch, and similar services. Keep third-party SDK types and request details behind an interface.
- **Modules** construct repositories, services, controllers, and routers. Preserve dependency injection so tests can provide fakes or in-memory implementations.
- **Middleware** handles cross-cutting concerns such as authentication, authorization helpers, validation, request logging, not-found handling, and centralized errors.
- **Shared code** belongs in `src/shared/` only when it is genuinely used across features. Avoid creating a generic abstraction for one caller.

The `todo` feature is the reference implementation for layering and test injection. The search feature reads sample travel records from PostgreSQL, indexes only public records in Elasticsearch, and supports full reindexing. Those records have no write API; when real Board writes arrive, design durable index updates and retries before claiming the search index stays synchronized.

## Backend stack and planned infrastructure

Current stack:

- Node.js 18 or newer.
- TypeScript with strict checks, ES modules, and NodeNext resolution.
- Express 5.
- Zod for runtime validation and inferred TypeScript types.
- Helmet and CORS for security and cross-origin middleware.
- `debug` for application, integration, provider, and development logging, using stable namespaces such as `roamboard:http`, `roamboard:auth`, `roamboard:db`, `roamboard:search`, and `roamboard:media`.
- `pino-http` may remain as request middleware where useful, but it must not replace the required `debug` logging convention for application/debug logs.
- `pg` for parameterized PostgreSQL queries and `@elastic/elasticsearch` for the derived search index.
- Node's built-in test runner with Supertest for API tests.
- npm is the package manager for this folder. Keep `package-lock.json` in sync and do not create another lockfile here.

Implemented demo infrastructure:

- **PostgreSQL:** persistent todos and sample travel search documents, with a SQL migration. The in-memory adapters remain for tests and local development.
- **Elasticsearch:** public sample travel search, suggestions, filters, and reindexing from PostgreSQL when the Docker stack is used.
- **Docker Compose:** API, PostgreSQL, and Elasticsearch services with health checks and separate named data volumes. The local configuration disables Elasticsearch security and is not a production deployment.
- **Provider configuration:** Docker passes optional `MAPBOX_ACCESS_TOKEN`, `UNSPLASH_ACCESS_KEY`, `GOOGLE_PLACES_API_KEY`, and Cloudinary credentials into the API container. The browser receives only provider status and normalized responses, except for the intentionally public Mapbox `pk.` token needed by Mapbox GL. Google Places requires a billing-enabled Google Cloud project. Cloudinary uploads are tagged, accept HEIC/HEIF files that browsers report with a generic MIME type, and normalize EXIF/XMP degree-minute-second GPS metadata for prototype handoff. Asset listings remain lightweight; metadata is fetched from the original asset through the single-resource Admin API. Board ownership and PostgreSQL media persistence are not implemented.

Planned Roamboard infrastructure, to be introduced incrementally:

- **PostgreSQL:** expand the system of record to users, profiles, Boards, items, locations, media metadata, tags, friend relationships, saved resources, visibility, and travel history. Use migrations, foreign keys, unique constraints, timestamps, and indexes.
- **Elasticsearch:** expand the derived index to real public Board, destination, and location discovery. Add a durable update/retry path and keep private data out of the index.
- **Docker:** harden the current local demo before deployment. Continue using service names and environment variables inside Compose, never `localhost` for another container.
- **Cloudinary or another object store:** store uploaded media; PostgreSQL stores metadata, ownership, association, provider key, URL, MIME type, dimensions, and extraction status rather than large binary content.
- **Mapbox:** map display, geocoding, and routes where approved. Treat provider results as external data and persist only the data the product needs.
- **Google Places API and Unsplash:** location/place enrichment and application-provided imagery through provider adapters. Never expose provider secrets to the frontend.
- **Image metadata and autofill:** uploads may be inspected server-side for EXIF GPS coordinates and other metadata, then optionally used to suggest a location or itinerary item. Treat extracted data as untrusted suggestions: validate coordinates, handle missing or stripped EXIF, make user confirmation explicit, and avoid exposing private metadata unintentionally.
- **Recommendations:** a future discovery/recommendation service may combine Board activity, search signals, provider data, and trend calculations. Keep this behind a service boundary and return explainable, testable results. Do not add machine-learning infrastructure until the product slice and data contract are agreed.

Not in the current plan: WebSockets, Redis, and PostGIS. Do not add them merely because they appear in the broader proposal. Revisit them only when a concrete requirement and owner justify the operational complexity.

## API conventions

- Use versioned routes under `/api/v1`.
- Use HTTP methods and status codes consistently: `200` for reads/updates, `201` for creation, `204` for successful deletion without a body, `400` for invalid input, `401` for missing or invalid authentication, `403` for insufficient permission, `404` for missing resources, `409` for conflicts, and `500` only for unexpected failures.
- Successful resource responses use `{ "data": ... }`, matching the current todo API.
- Errors use a stable machine-readable code and a safe human-readable message. Prefer this shape for new endpoints:

```json
{
  "error": {
    "code": "BOARD_NOT_FOUND",
    "message": "The requested Board could not be found.",
    "details": {}
  }
}
```

Do not expose stack traces, SQL, provider credentials, passwords, tokens, or internal implementation details. Keep error handling centralized through `AppError` and the error middleware.

- Use cursor or page-based pagination for potentially large lists and return enough metadata for the frontend to render loading, empty, and error states.
- Use ISO 8601 timestamps with timezone information in API responses. Store activity dates and times with an explicit timezone strategy; do not silently convert a user's local itinerary time to the server's local time.
- Use stable UUIDs for public resource identifiers unless a documented reason requires another identifier.
- Keep request and response field names consistent with the frontend's provisional Board model: `visibility`, `isCompleted`, `destinations`, ordered `items`, `coverImage`, `createdAt`, and `updatedAt`. Agree on contract changes before changing shared shapes.
- Never trust frontend visibility controls. Every read and mutation involving a Board, profile, image, saved resource, or friend relationship must enforce access on the server.

## Authentication and authorization

Use an explicit authentication boundary. The preferred initial approach is short-lived JWT access tokens in secure, HTTP-only cookies, with a refresh strategy added only when needed. Keep token creation and verification behind an auth service; do not read JWT details directly in feature controllers.

- Hash passwords with a reviewed password-hashing library. Never store or log plaintext passwords.
- Use secure, `HttpOnly`, `SameSite`, and production-appropriate `Secure` cookie settings. Configure CORS for the known frontend origin rather than enabling broad origins.
- Authentication middleware should attach a small authenticated-user identity to the request, not the full user record. Load current records through repositories when needed.
- Authorization belongs in backend services or dedicated policy helpers. Enforce ownership and Board visibility for every endpoint.
- Board visibility is `private`, `friends`, or `public`: private should be owner/collaborator-only once collaboration is implemented, friends requires an accepted relationship, and public can be read by anyone where appropriate.
- Return `401` when the caller is not authenticated and `403` when the caller is authenticated but lacks permission. Do not reveal whether private resources exist to unauthorized callers when that would leak information.
- Keep collaboration permissions separate from visibility. Do not imply real-time collaboration; WebSockets are intentionally out of scope for now.

## Validation and external data

Validate all important input at the API boundary and validate again in provider/database boundaries where appropriate. Use strict Zod objects for request bodies, explicit UUID and date formats, bounded string lengths, valid URLs, valid country codes, and valid latitude/longitude ranges. Reject unknown fields unless a documented endpoint intentionally allows them.

Use regex only for a clearly defined product rule, such as a documented username or slug format. Do not invent restrictive name rules without product agreement. Normalize values where useful, such as trimming user-entered text and canonicalizing case, while preserving user-visible content where appropriate.

External provider responses are untrusted and may be incomplete, rate-limited, duplicated, or unavailable. Normalize them into internal types, handle partial failures deliberately, apply timeouts, and avoid sequential requests when independent requests can safely run concurrently with `Promise.all` or an equivalent. Deduplicate search and provider results using stable provider IDs and canonical keys, not display names alone. Uploaded image types and metadata are also untrusted: enforce size/type limits, validate GPS ranges, and keep raw metadata out of logs.

Never call external APIs directly from controllers or expose provider API keys to the frontend. Keep provider-specific retry, timeout, quota, and mapping behavior in adapters/services. Log provider failures without secrets or user-uploaded sensitive metadata.

## Logging and errors

Use the npm `debug` package for application and development logs. Create a module-level logger with a stable namespace, for example `const log = debug("roamboard:boards")`, and use namespaces that identify the subsystem rather than logging arbitrary strings. Use structured, non-sensitive values where practical. Add `debug` to `package.json` when implementing logging; do not assume it is installed just because this guide requires it.

Do not use `console.log`, `console.error`, or ad hoc prints for application or debugging logs. `pino-http` may provide request middleware, but `debug` remains the required convention for backend logs. Startup/configuration failures may be reported through the chosen process logger until the startup path has a consistent logger, but must never include secrets.

Log enough context to diagnose failures: request ID, route, user ID when known, resource ID, and provider operation. Do not log passwords, JWTs, cookies, full upload metadata, raw EXIF, or complete user content by default.

Keep `AppError` as the application error type or extend it without changing the centralized response contract. Map database constraint errors, provider failures, and validation failures to meaningful safe API errors. Unexpected errors should remain generic to clients and detailed only in server logs.

## Testing and verification

API tests are a first-class deliverable, not self-validation added merely to make an implementation appear complete. Every feature should have independent tests for its service rules and full HTTP contract. At minimum, cover:

- Successful create, read, update, and delete behavior where applicable.
- Zod validation failures and unknown fields.
- `401` and `403` authentication/authorization cases.
- Private, friends-only, and public Board access.
- Ownership checks and resource-not-found behavior.
- Ordering persistence after activity reordering.
- Upload type/size validation and provider failure handling.
- Search filters, pagination, and duplicate removal.
- Database constraint and transaction behavior once PostgreSQL is introduced.

### Independent API-test workflow

When a feature or API is implemented, separate feature implementation from test authorship whenever practical:

1. One agent or developer owns the feature contract and implementation. They document endpoints, permissions, expected state changes, failure cases, and any provider/database effects.
2. A separate agent or developer, who did not implement the feature, reviews the contract and writes the API tests independently. They should not copy the implementation's branches, fixtures, helper names, or internal assumptions into the tests.
3. The test author verifies behavior through the public HTTP API, including response status, response body, persistence/state changes, authorization, validation, error handling, and relevant external-service boundaries. Tests must fail for a meaningful feature defect, not only for a missing route.
4. A reviewer compares the test cases to the requirements and contract, checks that important cases are not omitted, and runs the tests against the real feature wiring. Do not accept tests that only exercise mocks, the repository directly, or a happy path when the feature has meaningful failure and permission rules.

The implementation agent must not create tests solely to validate its own assumptions when an independent test author is available. If staffing makes separation impossible, record that limitation in the handoff and require a separate review of test intent and coverage before treating the feature as verified. Do not weaken tests to match an implementation; change the implementation or explicitly revise the agreed contract.

Use the built-in Node test runner and Supertest patterns already in `test/` unless the team agrees to another runner. API tests should import `createApp` without opening a network port for isolated tests, and should also include appropriately marked integration tests against real PostgreSQL, Elasticsearch, or provider boundaries when those integrations are part of the feature. Inject repositories and provider fakes for deterministic unit tests, but do not let fakes replace the API-level coverage required for the feature. Tests must not require live Cloudinary, Google, Mapbox, Unsplash, Elasticsearch, or PostgreSQL services unless explicitly marked and documented as integration tests.

Run from `layered-backend-demo1/`:

```bash
npm install
npm run typecheck
npm test
npm run check
npm run build
docker compose up --build -d    # after creating .env from .env.example
```

The README documents Docker Compose and an opt-in test against PostgreSQL and Elasticsearch. The normal API tests still use in-memory adapters. Run the opt-in integration test when changing database or search wiring. Do not claim authentication, Boards, or persistent Board media exist. Provider endpoints are implemented, but live provider behavior still depends on valid credentials and external network access.

## Code style and consistency

- Use `const` only. Do not introduce `let` or `var`; use immutable transformations, helper functions, or explicit state objects instead.
- Use descriptive names and explicit interfaces/types for public functions, module options, repository contracts, provider adapters, and request data.
- Keep imports ordered and use the existing `.js` suffix for relative ESM imports in TypeScript source.
- Prefer `async`/`await`, early returns, small functions, and straightforward control flow.
- Avoid `any`, unsafe casts, duplicated validation, hidden global state, and broad barrel exports unless there is a clear benefit.
- Keep formatting consistent with the existing files: two-space indentation, double quotes, semicolons, trailing commas where the formatter produces them.
- Do not add comments that restate code. Add a short comment only for a non-obvious architectural or security decision.
- Keep route names, feature filenames, response envelopes, error codes, and environment variable names predictable. Use singular feature folder names when matching a resource (`board`, `user`, `image`) and plural route paths (`/boards`, `/users`, `/images`).
- Keep database migrations, Docker files, provider configuration, and API contract changes reviewable and focused. Do not commit `.env` files, secrets, generated build output, `node_modules`, or provider exports.

## Working with agents

Before editing, inspect the nearest implementation, its tests, and any existing frontend contract. State the local behavior or contract being changed and make the smallest testable edit. Ask the user before making an ambiguous product or security decision, including retention of image GPS metadata, auth cookie/refresh policy, Board collaborator semantics, public search indexing rules, or a breaking API response change.

When a requirement is unclear, preserve the current behavior and document the open choice rather than inventing a broad framework. Keep planned integrations behind interfaces so they can be replaced without rewriting routes and services. Update README or API documentation when an endpoint, environment variable, Docker service, or operational command changes.

Before handoff, run the narrowest relevant test first, then typecheck/build as appropriate. Review the diff for unrelated changes and report checks that could not run. Make it clear whether behavior is real, mocked, in-memory, or planned.
