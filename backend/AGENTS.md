# Roamboard backend agent instructions

These instructions apply to `backend/`. Follow the **feature-first layered structure** documented below and implemented in `src/features/`. Keep changes small and understandable enough for the team to explain. Update this file when an agreed architecture or workflow changes; describe implemented and planned behavior separately.

## Current state and sources of truth

- `/boards` discovery uses dedicated search/suggestions, Featured, Recently Published, owned and saved summary feeds
  in `board-discovery/`; generic `/search` remains compatible. Search enforces recognized destination/activity-location
  eligibility, excludes own Boards, and uses curated weighted text matches. Featured defaults to rolling 30 days,
  with a 7-day option and public-first publication fallbacks. Migration 018 is applied to shared development after
  a verified backup; do not rerun it. View qualification uses a server challenge plus three visible client seconds,
  per-account/browser deduplication and same-browser sign-in merging. Run `cleanup:discovery` daily in deployment;
  no host schedule is installed by this feature. See `../contracts/boards-discovery.md` and the migration log.

- Saved Board remix preparation uses `POST /api/v1/boards/:boardId/remix-content` with session/Origin checks and
  current saved membership/read access. It stages independently owned authenticated photo copies and returns
  content with new photo references, no persisted child IDs and no calendar dates. It creates no Board until the
  existing save endpoint is used. Unattached copies use existing upload cleanup; no migration is needed.
  See [the remix contract](../contracts/saved-board-remix.md).

- This is a Node.js 24, TypeScript, Express 5 API using npm. `src/app.ts` creates the app; `src/server.ts` starts it. `src/db.ts` owns the shared `pg` pool. The `auth` feature manages Google sign-in and sessions; `boards` and `images` persist canonical documents and protected uploads; `providers`, `destinations`, `users`, `search`, and `quotas` connect the existing frontend API surfaces. See `BOARD_API_CONTRACT.md` and `API_FEATURES_CONTRACT.md` for implemented behavior.
- Board search reads canonical public, published PostgreSQL Boards on each request and ranks matches in application code; no separate search store or synchronization is needed. Geoapify supplies permanent activity location lookups; confirmed locations are stored in PostgreSQL. Mapbox serves maps, routes and temporary discovery.
- Public destination guides use selected city/country/coordinates, matched Wikivoyage introductions, distinct Unsplash photos and fresh public Boards within 25 km. Optional `kind=country` reuses this flow for country guides: Boards match the whole country, country article/tip titles must match exactly, and city-distance cutoffs do not apply. Country guides reuse the places list for the country Wikivoyage city map group; city guides retain See listings. Country city selections open city guides and load descriptions plus credited Wikimedia photos through the existing place-details endpoint with kind=country, without place-match calls. Details prefer the country listing and can fall back to its linked city article intro/lead image. Intro-only reads never replace cached full pages; official Creative Commons HTTP license links are normalized to HTTPS. Country scope remains in provider cache identities. Travel-guide sights come from Wikivoyage See listings, including linked district guides when needed. Selecting a sight tries a same-name Mapbox match within 500 m for temporary map display. Original travel-guide data remains canonical for Board preparation, with source attribution. The obsolete permanent-place confirmation endpoint was removed. Wikivoyage introductions, Unsplash photos and Wikivoyage sights have bounded one-hour caches. Existing shared provider budgets remain in use. City tips and selected-place descriptions use Wikivoyage plain-text extracts; listing-linked photos use Commons metadata and license credits. Details are public reads validated against the destination sight list. See `API_FEATURES_CONTRACT.md` and the destination schemas/types.
- No current frontend page uses `saved-places/`. Account saving is undecided; existing records and backend routes remain until the team decides whether to remove them. These routes implement session-owned list/save/remove operations with Origin checks on writes. Migration 008 adds `saved_place`, separate from saved Board activities and Google Place references. It was applied to the shared development database on 2026-10-17 under the former `005_saved_places.sql` name; do not reapply it. Saved place data is editable user-owned content and does not grant Board access.
- Board documents include a safe current-author summary for the published viewer: username, biography and optional profile photo. Author-photo image URLs carry the Board ID; each request checks Board read access and the owner's current photo linkage. See `BOARD_API_CONTRACT.md`.
- Board documents expose `savedCount`, a live count of other accounts' bookmarks, with zero for drafts. Profile statistics expose `savesReceived`: owners see saves across their published Boards; visitors count only Boards visible through public/friend profile access. Save totals expose no saver identities and do not change content revisions. No schema migration is needed.
- Public handle profiles use `GET /api/v1/users/by-handle/:handle`. The users repository filters published public Boards and friends-only Boards allowed by the viewer's accepted friendship in SQL. Profile maps include primary destinations and confirmed activity locations, exclude collaborator-only Boards, and offer saved locations shared with the owner and accepted friends. Travel totals follow visible published Boards; `activitiesDone` currently counts activities on all visible published Boards. Public profile photo URLs carry `profileHandle`; the image service checks the current photo association. `/me` remains owner-only.
  Handle responses also include `savedBoards` for the profile collections, filtered for both saver and visitor access;
  public saved collections are separate from the friends-only saved-map endpoint. See `API_FEATURES_CONTRACT.md`.
- PostgreSQL schema lives in ordered files under `db/migrations/`: 001 is the baseline, 002 adds sessions, 003 adds canonical Board content/uploads, 004 adds compact shared provider counters with previous-bucket fields for conservative rolling guards, caller-owned place references and profile timestamps, 005 adds the editorial image library, 006 adds profile revision, default visibility, and saved Board ordering, and 007 adds the remaining names from the shared editorial tag catalog without deleting legacy tags. Migration 004 was consolidated with user approval on 2026-10-15. The shared Azure database has 005 and was reconciled with the profile changes now numbered 006 on 2026-10-17; its preexisting default-visibility column has a wider type than the migration specifies. Migration 007 has since been applied; do not rerun 004 through 007 on that database. See `db/MIGRATION_LOG.md` for verification. Treat migrations as the database source of truth. Do not treat frontend mock data as persistent Roamboard behavior.
- Migration 010 adds persistent guest accounts linked to `app_user`. It is pending on the shared database. Development-only `/api/v1/auth/guests` routes list, create, and sign into these accounts without credentials; created sessions use the existing cookie. Any development user can access each guest account, so guest data is shared.
- Migration 013 adds Board comments. Migration 015 separately adds the friendship acceptance timestamp and has already been applied to the shared database. The `board-comments` feature implements the approved [`board-comments` contract](../contracts/board-comments.md): published Board access checks, public reads when authorized, session/Origin protected writes, author edits and deletion, owner deletion, cursor pagination, and current author details. Apply the comment migrations separately after database review.
- Migration 016 adds persisted Board comment mentions and distinguishes mention notifications from general comment notifications. It is applied on the shared development database. The existing authenticated user search supplies editor suggestions. Mention writes and notifications share the comment transaction. See [the mentions extension](../contracts/board-comment-mentions.md).
- Migration 017 removes the per-comment, per-user uniqueness constraint from saved mention handles so both an old and current handle can keep linking to the same account after a rename. Notification recipients remain unique by user ID. Migration 017 is pending on the shared development database.
- Migration 019 seeds 79 additional spoken languages (106 total) matching `shared/spoken-languages.json` to satisfy `user_language` foreign key constraints when users save expanded profile languages. It is applied on the shared development database.
- Check the relevant schema, `../frontend/REQUIREMENTS.md`, and `../frontend/src/types/` before defining a feature's contract. Preserve the product decisions already represented in the schema; ask about genuinely unresolved behavior instead of silently substituting assumptions.
- Keep `backend/.env` and credentials out of Git. Document new variables in `.env.example` and `README.md` without real secrets.
- Team development uses a shared PostgreSQL container on Azure through SSH tunnels; the backend still runs locally. See `README.md` for onboarding and `deploy/README.md` for maintenance. Do not recreate the shared database or rerun applied migrations when onboarding. `npm run check:setup` checks auth configuration and database access without changing data. Backend `GOOGLE_CLIENT_ID` must match frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

`GET /api/v1/boards/collections/:context` provides viewer-authorized Board summaries, broad contextual search,
sorting, exact totals and twenty-item numbered pagination through the board-discovery feature. Source descriptors
retain profile/saved/friend/category/Featured/map scopes; saved map reads retain owner/friend restrictions. Global
Board search includes eligible owned published Boards and allows direct title matches past automatic location
gating. No migration is needed. See `../contracts/board-collection-grid.md` for context parameters and permissions.

## Smart Create

The `smart-create` feature resolves up to 30 caller-owned completed image IDs per request through
`POST /api/v1/images/smart-create`, requiring a session and exact frontend Origin. Cloudinary Admin inspection
uses `media_metadata`; `images/photo-metadata.ts` normalizes EXIF GPS and preserves camera wall-clock time.
Smart Create uses nearby Geoapify POIs (75m radius) then reverse addresses; every upstream request uses the
existing shared `geoapify.geocoding` budget, with paced calls and no automatic provider retries or raised quotas.
The endpoint does not persist activities. The creator proposes grouping and numbered days, and existing Board
save endpoints persist the confirmed document. Board writes allow repeated photo batches and at most 31 days.
Explicit `POST /api/v1/images/:imageId/refresh-location` checks uploader ownership before inspecting the saved
original, updates normalized image metadata, and returns a suggestion without changing Board activities. Full
North/South/East/West EXIF references are supported. Saved-location search accepts paired optional GPS context as
a soft Geoapify bias; exact generic category queries use Places discovery without a hard area filter.
Smart Create itself needs no migration. Explicit Board destinations use migration 008, linking a primary location
and city/region/country kind on Board; activity locations stay independent. Shared database 008 was applied after
a verified custom-format backup on 2026-10-18; 007 was subsequently applied after a verified backup; see the migration log.
Saved destination lookup uses
Geoapify type=locality, reusing the Home search interaction without persisting temporary Mapbox discovery data.
See [the Smart Create contract](../contracts/smart-create.md).

## Editorial website image library

See [the shared image workflow](../docs/IMAGE_WORKFLOW.md) for authoring, rendering and missing-file recovery.
PostgreSQL stores references, not Cloudinary bytes: do not delete image rows or change cover/order links when a provider
file is missing. Preserve the configured Cloudinary account and authenticated assets across teammate setups. Delivery
404s return `IMAGE_ASSET_MISSING`; restoring original storage keys must preserve protected delivery and existing IDs.

`src/features/image-library/` and migration `005_image_library.sql` implement public editorial image records separately
from protected user uploads. Cloudinary files use `roamboard/editorial/`; keep them out of uploaded-image cleanup.
`GET /api/v1/image-library` remains available after Labs removal. Upload/Unsplash mutations require development mode,
a signed-in session and exact frontend Origin. See [the image contract](../contracts/image-library.md) for shapes.
Never expose credentials or turn this feature into an arbitrary URL fetcher. New Unsplash selections fetch canonical
metadata and trigger the download-equivalent request through shared quota management; rendering/searching do not.

From `backend/`, `npm.cmd run images:inventory` writes a no-write source inventory; review metadata, then run
`npm.cmd run images:import`. Add `-- --apply-schema` only for a database missing migration 005. The shared database
already has 005 applied on 2026-10-17; do not recreate it. Reruns preserve existing revisions and merge source usages.
Original frontend files/URLs remain rollback fallbacks. Removing development Labs must preserve public delivery,
catalog records, stable references, revision history and developer import tooling.

## Agent image registration and lookup

Agents adding individual frontend images should run `npm.cmd run images:add -- --key <stable-key>` with exactly one
of `--file`, `--unsplash` (photo page or ID), or `--url` (direct public HTTPS raster URL). Files/ordinary links also need
`--alt` and `--credit`; preserve provenance with `--source-url`. Unsplash CDN links stay external, not rehosted.
The command uses the configured backend environment without browser authentication and returns a verified reference;
never expose credentials or create an unauthenticated upload endpoint for agents. Existing keys require an explicitly
authorized replacement with `--expected-revision`. `GET /api/v1/image-library/:assetKey` and the `?keys=a,b` list filter
provide public database lookups (maximum 50 batch keys). Keep these reads available after Labs is removed.

## Formatting

Use the repository root [`../.prettierrc`](../.prettierrc) for all supported backend files, including `.ts`. Use four spaces, no tabs, double quotes in JavaScript and TypeScript, no trailing commas, and LF line endings with a final newline. The configured print width is 120 to keep longer imports, type declarations, and function signatures together where Prettier allows. Do not add a backend-specific Prettier configuration. SQL migrations are excluded from Prettier; preserve their existing formatting.

Every agent must run `pnpm.cmd format` and `pnpm.cmd format:check` from the repository root after final edits and before handoff or PR preparation. On Linux/macOS, use `pnpm format` and `pnpm format:check`. Use the root-installed Prettier; do not install another copy in backend. These repository-wide formatting commands are separate from ESLint and the backend's npm application checks, which remain required for application changes. Respect the root `.prettierignore`, including its SQL exclusion, and review the formatting diff.

## Architecture: feature-first layers

Both applications share code rules through `../eslint.shared.mjs`. Use strict equality, no `var` or console calls, and `const` wherever a binding is not reassigned. Backend state may use `let` when reassignment is necessary. Every agent must also run `pnpm.cmd lint` from the repository root before handoff or PR preparation. ESLint warnings fail the check; root dependencies must be installed for the shared Prettier compatibility config.

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
- Modules construct repositories, services, controllers, and routers in that order; see `src/features/auth/auth.module.ts` for an implemented example. Allow explicit dependency injection where tests need a fake repository or provider. Do not create a generic framework for a single feature.
- Put truly cross-feature middleware, errors, configuration, and helpers in `src/middleware/`, `src/shared/`, or `src/config/` as appropriate. Add these folders as needed; they do not exist in this backend yet. Use centralized error handling once product routes are added.
- Use `.js` suffixes for relative TypeScript imports under NodeNext/ESM, as the current backend does.

## API and data rules

Provider quota behavior is implemented in `src/features/quotas/` and documented with
official sources in `API_FEATURES_CONTRACT.md`. Google monthly free usage uses
America/Los_Angeles calendar months; Mapbox billing months use UTC. Other windows
use conservative rolling guards, counting the current and entire previous bucket
in one row; the Open-Meteo monthly guard covers 31 days. This can block earlier or
longer than the provider and must not be described as an exact rolling log or a
verified provider reset timezone. Keep counters shared in PostgreSQL, including
anonymous users. Do not replace them with per-process counters.

Forward the quota observer to every quota-managed HTTP or Cloudinary Admin call,
including Home destination context and protected image verification. Honor
`Retry-After`, Mapbox-style reset headers and Cloudinary SDK reset metadata.
Exhaustion feedback is stored as one shared cooldown row per policy; delayed
responses cannot shorten a cooldown. Successful last-allowance responses still
return their data. Rate-limit failures return 429 and a safe `Retry-After` when
known; do not automatically retry upstream calls. Missing reset information uses
a documented conservative fallback, never an invented reset timezone. Limits
are application budgets, not a guarantee against provider billing: external usage,
public-token reuse, Cloudinary storage/bandwidth/transformations and restored old
quota state require separate account-level controls. Do not silently raise caps
based on public pricing; confirm the team's plan and update tests/docs.

Country codes in application contracts and responses are validated ISO 3166-1
alpha-3. Reuse `shared/country-codes.json` through `src/shared/countries.ts`;
convert provider alpha-2 responses to alpha-3 and convert outgoing Geoapify
country filters to alpha-2. Include the shared JSON when deploying backend builds.

- Mount product endpoints under `/api/v1`. Keep `/health` and `/health/db` as operational endpoints outside that prefix.
- Define a feature's request/response contract, permissions, success cases, and failure cases before implementing its endpoint. Use consistent HTTP status codes and a consistent error shape. Never send raw SQL, stack traces, tokens, or provider secrets to clients.
- The schema uses `app_user.user_id` for the Google `sub`. Verify Google identity server-side before trusting it; do not accept a client-supplied user ID as proof of identity. Enforce ownership, board visibility, and membership on the server for every protected read or write.
- Cookie-authenticated mutations need CSRF protection. The current auth routes require the exact configured `CLIENT_ORIGIN` on POST requests; apply an equivalent check to future write routes. CORS alone does not stop a forged request.
- The current board visibility values are `public`, `friends`, and `collaborators`. Consult the migrations and agreed feature behavior for supported values and identifiers. Board and activity IDs are database-generated integers.
- Keep schema changes in new, ordered migrations. Do not edit `001_initial.sql` after it has been applied to a database unless the team explicitly decides to rebuild that database. Coordinate SQL constraints with service validation; application checks do not replace database integrity constraints.
- Keep operations that must succeed or fail together in a transaction. Avoid N+1 queries and return only data the caller may see. Treat provider data and user input as untrusted.

## Tests and GitHub workflow

- `../.github/workflows/backend-ci.yml` runs on pushes and pull requests to `main`, and on manual dispatch. It uses Node.js 24, runs from `backend/`, installs with `npm ci`, then runs `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Keep `backend/package-lock.json` synchronized with `backend/package.json`.
- Before handoff, run the relevant test and the same backend CI checks locally (`npm run check` runs those checks in sequence). Documentation-only changes need a content/diff review, not an application test run. Report any check that could not run.
- Add meaningful service and HTTP tests for new behavior, especially validation, permissions, errors, and state changes. Import `createApp()` and use Supertest without starting a listener. Inject fakes for deterministic tests; mark tests requiring a real PostgreSQL instance as integration tests and document how to run them. Do not make the normal CI suite depend on an unconfigured local database or live external provider.
- Review the diff before committing. Keep changes focused, do not commit `.env`, build output, dependencies, or generated files, and do not include unrelated work. The frontend has its own `frontend/AGENTS.md` and CI workflow; follow those instructions when changing frontend files.

## Activity photo matching

The provider adapter searches Unsplash by exact place plus city/country, checks at most three canonical photo
details, and rejects generic matches and contradictory GPS. Accept within 100m, or an exact normalized place name
plus city/country evidence with no GPS more than 3km away. This is conservative metadata evidence, not visual
verification. GET /providers/unsplash/activity-photo only discovers; authenticated exact-Origin POST selects and
records the download-equivalent event. Every search/detail/selection call uses the unchanged shared Unsplash budget.
No match returns null, and failures preserve user uploads and allow saving without an automatic photo.

## Protected upload presentation

Migration 009 stores nullable crop/resize JSON and an integer presentation revision on uploaded_image. It was applied
to shared development on 2026-10-18 after a verified backup; no originals or EXIF fields were rewritten. GET and PUT
/images/:imageId/presentation require uploader ownership; PUT also requires exact Origin and an expected revision.
Normalized crop bounds and 32 to 4096px resize limits are validated; stale saves return 409. Signed authenticated
Cloudinary delivery chains crop, resize and existing display/thumbnail limits. The owner-only original variant
omits presentation edits and limits the editor source to 4096px. Existing read permissions protect other variants.

Publishing now requires an explicit destination, while drafts may omit it. Published replacements that omit the
property validate against the stored destination. POST /providers/locations/suggest-area requires session/Origin and
3 to 100 activity points, finds a clear majority area and makes at most one quota-managed Geoapify reverse city/state
lookup. It does not mutate Boards or overwrite chosen destinations.
