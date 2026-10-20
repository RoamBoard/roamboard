# Roamboard

Roamboard is a travel planning and sharing application. Travelers organize destinations, daily itineraries,
activities and photographs into **Boards**, then publish them, share them with friends or keep access limited to
collaborators. Other travelers can discover Boards, save inspiration and remix saved trips into their own plans.

The project pairs a Next.js frontend with a TypeScript and Express backend. PostgreSQL holds application data,
while external providers supply maps, geographic search, travel information and image storage. The backend owns
authentication, permissions, persistence and provider usage controls.

## Features

- **Trip planning:** create and resume drafts, arrange activities into days, choose a primary destination, add tags,
  upload photographs and publish a Board. Existing Boards can be edited with revision checks.
- **Discovery:** search Boards, browse Featured and Recently Published feeds, and explore paginated collections
  scoped to profiles, friends, saved Boards or destinations.
- **Destination guides:** search cities and countries, browse travel descriptions and sights, and find nearby
  published Boards with map-based exploration.
- **Photo-assisted creation:** Smart Create uses photo location metadata and nearby place lookups to propose
  activities. The traveler reviews the proposal before saving a Board.
- **Sharing and conversation:** save Boards, prepare independent remixes, manage friendships, comment on published
  Boards and mention other travelers with comment notifications.
- **Profiles:** edit account details, interests, languages and a profile photograph; view published and saved Boards,
  travel statistics and planned or visited destinations on a map.

## Technology and repository layout

| Area       | Implementation                                                             |
| ---------- | -------------------------------------------------------------------------- |
| Backend    | Node.js 24, TypeScript, Express 5, Zod, PostgreSQL through `pg`            |
| Frontend   | Next.js App Router, React, TypeScript, Tailwind CSS and Motion             |
| Media      | Cloudinary for uploaded images; Unsplash for credited provider photography |
| Deployment | Docker Compose and Caddy on an Azure Linux VM                              |
| Checks     | ESLint, Prettier, TypeScript, Node/TSX tests, Supertest and GitHub Actions |

```text
backend/
  src/
    app.ts              Express application and feature wiring
    server.ts           HTTP listener
    db.ts               Shared PostgreSQL connection pool
    features/           Feature modules, business rules and persistence
    middleware/         Sessions, Origin checks, validation and error handling
    shared/             Common errors, cookies and reference-data helpers
    jobs/               Setup checks, image tooling and cleanup commands
  db/migrations/        Ordered SQL migrations: the schema source of truth
  test/                 Unit and HTTP API tests
  integration/          PostgreSQL integration tests
  deploy/               Compose stack, reverse proxy and database initialization
frontend/               Web application and frontend tests
shared/                 Country, language, tag and editorial-image reference data
contracts/              Feature behavior and frontend/backend agreements
docs/                   Workflows, implementation notes and UI audits
```

`frontend/` and `backend/` are the supported applications. The old demo backends have been removed.

## Backend architecture

The backend is one Express application organized into feature modules. Each feature keeps its HTTP interface,
business rules and database access together, with explicit responsibilities for each layer:

```text
HTTP request
  -> middleware: session, Origin checks and request validation
  -> router: endpoint and middleware selection
  -> controller: translate HTTP input and output
  -> service: business rules, permissions and orchestration
  -> repository: PostgreSQL queries and transactions
     or provider adapter: external service calls
```

Feature folders use files such as `boards.routes.ts`, `boards.schemas.ts`, `boards.controller.ts`,
`boards.service.ts`, `boards.repository.ts`, `boards.types.ts` and `boards.module.ts`. Module factories assemble
dependencies, and [`app.ts`](backend/src/app.ts) mounts the routers. `createApp()` accepts replacement dependencies
so API tests can use fake repositories and providers without a running database or external accounts.

### Feature modules

| Module                                          | Responsibility                                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `auth`                                          | Verify Google sign-in, create accounts and manage database-backed sessions. Guest-account endpoints are development-only.         |
| `boards`                                        | Create, read, replace and delete Board documents; validate days, activities, tags and images; enforce access and prepare remixes. |
| `board-discovery`                               | Search, suggestions, contextual collections, Featured/Recent/owned/saved feeds and qualified view tracking.                       |
| `users`                                         | Account and public profiles, friendships, saved Boards, statistics and map destinations.                                          |
| `board-comments`, `board-comment-notifications` | Authorized comment reads and writes, mentions and per-user notification state.                                                    |
| `images`                                        | Signed upload intents, asset verification, protected delivery, photo metadata and crop/resize settings.                           |
| `smart-create`                                  | Resolve owned photo locations into proposed activities without saving a Board automatically.                                      |
| `destinations`, `providers`                     | Destination guides, geographic lookup, maps, routes and provider photography.                                                     |
| `image-library`                                 | Public editorial-image records, stable asset keys, attribution and replacement revisions.                                         |
| `quotas`                                        | Shared PostgreSQL-backed provider budgets and cooldowns.                                                                          |

The separate `search` module retains the generic public Board search API. A `saved-places` API also exists, but no
current frontend page uses it; its future product role remains undecided.

### Data and consistency

PostgreSQL stores users, sessions, Boards, ordered days and activities, locations, image references, friendships,
saves, comments, notifications and provider counters. SQL lives in repositories and uses parameterized queries.
Related changes use transactions, and revision checks reject stale Board or profile updates.

The ordered files in [`backend/db/migrations/`](backend/db/migrations/) define the schema. Applied migrations and
shared-environment reconciliation are recorded in the [migration log](backend/db/MIGRATION_LOG.md). Application
startup does not replace the migration workflow.

Board search reads PostgreSQL data and ranks results in the application; there is no separate search service or
index to synchronize. Discovery feeds apply visibility rules and paginate results. View tracking uses a server
challenge and three visible seconds before a view qualifies, with account/browser deduplication. Semantic search
is planned work.

### Authentication and access

The API verifies Google identity tokens server-side and issues an HTTP-only session cookie. Session tokens are
stored as hashes in PostgreSQL. Protected operations resolve the current user from that session, and services
enforce ownership, membership and the Board visibility values `public`, `friends` and `collaborators`.

Cookie-authenticated writes require the configured frontend Origin. Zod schemas validate request bodies, parameters
and queries. Central error handling returns a consistent `{ error: { code, message } }` response without exposing
database errors or credentials.

### Images and external services

User photographs and public website imagery have separate delivery paths. For Board and profile uploads, the API
creates a signed Cloudinary upload intent, verifies completion and saves an image reference. Content requests check
current access before the backend streams authenticated image delivery. Crop/resize settings preserve the original.

The editorial image library stores reusable `library:<assetKey>` references, attribution and revision history.
Eligible editorial files use public Cloudinary storage; Unsplash images retain provider delivery and credits.
See the [image workflow](docs/IMAGE_WORKFLOW.md) for registration, rendering and missing-file recovery.

Mapbox supplies maps, routes and temporary destination discovery; Geoapify supplies persistent activity-location
lookups and Smart Create place matching. Wikivoyage/Wikimedia supply travel descriptions, sights and credited images,
while Unsplash supplies travel photography. Additional provider adapters support development tools.

Provider adapters share database-backed budgets and cooldowns across users and backend instances. Quota failures
return explicit errors and `Retry-After` when known. These are application usage controls, not a guarantee against
provider billing. Detailed routes, permissions and provider behavior are documented in the
[API feature contract](backend/API_FEATURES_CONTRACT.md) and [Board API contract](backend/BOARD_API_CONTRACT.md).

### Operations and deployment

`GET /health` checks the API process; `GET /health/db` checks database connectivity. Neither confirms that every
migration is applied. `npm run check:setup` provides additional read-only database and authentication setup checks.

The [Compose stack](backend/deploy/compose.yaml) runs PostgreSQL, the backend, the frontend and Caddy. Caddy terminates
HTTPS and routes API requests to Express and page requests to Next.js. Database data uses a persistent volume;
backups and migration procedures are covered by the [deployment runbook](backend/deploy/README.md).

Maintenance commands include `npm run cleanup:images` for abandoned uploads and unlinked user images, and
`npm run cleanup:discovery` for expired discovery tracking data. Production hosts must schedule these jobs explicitly.

## Local development

Use Node.js 24, pnpm for root/frontend dependencies and npm for the backend. From the repository root:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd --dir frontend install --frozen-lockfile
npm.cmd --prefix backend ci
```

The team's development database runs in Docker on Azure. Local backend instances connect through individual SSH
tunnels; teammates do not need a local PostgreSQL or Docker installation. Obtain access and credentials from the
maintainer, then follow the [backend quick start](backend/README.md#team-quick-start-local-backend-shared-azure-database)
to configure `backend/.env` and open the tunnel. Preserve existing environment files and do not recreate the shared
database or rerun applied migrations during onboarding.

Set up `frontend/.env.local` using the [frontend instructions](frontend/README.md#local-development). The backend's
`GOOGLE_CLIENT_ID` and frontend's `NEXT_PUBLIC_GOOGLE_CLIENT_ID` must match. Locally, the frontend uses
`http://localhost:3000`, the API uses `http://localhost:3001`, and backend `CLIENT_ORIGIN` must match the frontend origin.
Provider credentials belong in the backend environment; see [`backend/.env.example`](backend/.env.example).

With the SSH tunnel running, start the backend:

```powershell
npm.cmd --prefix backend run check:setup
npm.cmd --prefix backend run dev
```

In another terminal, start the frontend:

```powershell
pnpm.cmd --dir frontend dev
```

## Validation and contributor guides

Run repository-wide formatting and lint checks from the root:

```powershell
pnpm.cmd format
pnpm.cmd format:check
pnpm.cmd lint
```

`npm.cmd --prefix backend run check` runs backend lint, TypeScript, unit/API tests and the build. Its normal test suite
does not require a live database or provider account. `npm.cmd --prefix backend run test:db` runs integration tests
against PostgreSQL using temporary schemas; see the [backend guide](backend/README.md) for connection setup.

Frontend checks are `pnpm.cmd --dir frontend test`, `pnpm.cmd --dir frontend exec tsc --noEmit` and
`pnpm.cmd --dir frontend build`. The Discover CSS layout regression needs Chromium; set `CHROME_BIN` if it is not
found automatically. On Linux/macOS, use `pnpm` and `npm` in place of `pnpm.cmd` and `npm.cmd`.

GitHub Actions runs formatting and both applications' lint, type checks, tests and builds on pull requests and pushes
to `main`. Before contributing, read the [shared agent instructions](AGENTS.md) and the applicable
[backend](backend/AGENTS.md) or [frontend](frontend/AGENTS.md) guide. Feature agreements live in [`contracts/`](contracts/).
