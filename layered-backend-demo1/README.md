# Layered backend demo

This Express 5 backend has a todo API, a prototype user/profile and Board API, a sample travel search API, and a destination discovery API. PostgreSQL stores users, profiles, Boards, Board days and pins, confirmed image references, discovery metadata, destinations, Board visits, friendships, saved resources, todos, search-source records, quota counters, and saved Google Place ID references. Elasticsearch is a derived search index, rebuilt by the backend from PostgreSQL. Other destination provider response fields are live discovery data and are not persisted or indexed.

```text
HTTP client -> Express API -> PostgreSQL (source of truth)
                           -> Elasticsearch (search index)
```

PostgreSQL and Elasticsearch do not talk directly. The API reads the source records from PostgreSQL and indexes only public records. Creating a public published Board writes its search document in the same PostgreSQL transaction as the Board, then attempts an immediate Elasticsearch update. A failed live update does not lose the durable source record; API startup and the reindex command reconcile the derived index.

## Run all three services with Docker

From `layered-backend-demo1/`, copy `.env.example` to `.env`, replace `POSTGRES_PASSWORD` with a local password containing URL-safe letters and numbers, and run:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

To stop and start the project again later without deleting PostgreSQL or Elasticsearch data:

```powershell
docker compose down
docker compose up --build -d
```

Do not use `docker compose down -v` unless you intentionally want to delete the named data volumes. If PostgreSQL reports a password mismatch after changing `.env`, update the existing local role rather than deleting the volume:

```powershell
docker compose exec -T --user postgres postgres psql -U roamboard -d roamboard -c "ALTER ROLE roamboard WITH PASSWORD 'your-local-password';"
docker compose up -d api
```

Run the frontend separately from `frontend/` with `pnpm dev`; it uses `http://localhost:3001` from `.env.local` and is available at `http://localhost:3000`.

The API is at `http://localhost:3001`. PostgreSQL is available to local tools at `localhost:5433`, Adminer is at `http://localhost:8080`, and Elasticsearch is at `localhost:9200`; all published ports are bound to the host's loopback address. Adminer and the unsecured local Elasticsearch service are development tools, not production deployments. Compose waits for the database and search service health checks before starting the API. The API applies the SQL migrations, including the durable API quota counter, seeds missing sample travel records in PostgreSQL, and rebuilds Elasticsearch before it listens.

To browse database tables without installing a desktop application, use Adminer at `http://localhost:8080`. Select PostgreSQL and sign in with server `postgres`, username/database `roamboard`, and the `POSTGRES_PASSWORD` value from `.env`.

The frontend uses `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` so browser requests reach the published API address. Set `MAPBOX_ACCESS_TOKEN` for server-side search and routing. Prefer a separate public `pk.` `MAPBOX_PUBLIC_TOKEN`, restricted to the frontend URLs and minimum map scopes, for the interactive map; a `pk.` access token remains a backward-compatible fallback. `Open-Meteo` and Wikipedia need no key; `UNSPLASH_ACCESS_KEY` is optional and adds destination imagery. The provider lab at `http://localhost:3000/dev/providers` also exposes Mapbox routing and saved pinpoints, Unsplash, Google Places, Cloudinary upload/metadata extraction, and Elasticsearch fuzzy search/autocomplete. Saved Board destinations and pin locations use Geoapify. Set `GEOAPIFY_API_KEY` in `.env` and run `docker compose up --build -d api` to apply the adapter and database migration. Permanent Mapbox geocoding is disabled; Mapbox still displays maps and calculates routes. Google Places also requires a billing-enabled Google Cloud project. Provider credentials remain in the API container. The intentionally public browser token is released only after the backend reserves a map-load unit.

External provider calls are protected by fail-closed hard quotas. Docker uses PostgreSQL for atomic counters that survive restarts and coordinate multiple API instances. Quota limits are reviewed code constants rather than environment configuration. Read [docs/API_QUOTAS.md](docs/API_QUOTAS.md) before adding or changing any provider endpoint.

Try the endpoints in PowerShell:

```powershell
Invoke-RestMethod 'http://localhost:3001/health'
Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/v1/todos' -ContentType 'application/json' -Body '{"title":"Plan Stockholm trip"}'
Invoke-RestMethod 'http://localhost:3001/api/v1/todos'
Invoke-RestMethod 'http://localhost:3001/api/v1/search?q=stokholm'
Invoke-RestMethod 'http://localhost:3001/api/v1/search/suggestions?q=sto'
Invoke-RestMethod 'http://localhost:3001/api/v1/users/me'
Invoke-RestMethod 'http://localhost:3001/api/v1/users/me/stats'
```

Open `http://localhost:3000/dev/profile` after starting the frontend to edit the seeded `roam_demo` profile, change its picture URL, create Boards, and see its statistics and Mapbox travel footprint refresh from the API. Completed Boards shade visited countries and cities; planned destinations use a lighter style. This developer page uses the default prototype identity. It is not real login.

Until authentication is implemented, protected prototype routes use `x-demo-user-id`. If the header is omitted, the seeded user `00000000-0000-4000-8000-000000000001` is selected. A user created with `POST /api/v1/users` can be selected by sending its returned ID in that header. This behavior must be replaced by verified authentication before production use.

Restarting the computer or API preserves Boards, pins, image IDs, tags, highlights, and other saved records because PostgreSQL uses a named volume. Elasticsearch also has its own named volume; public published Board tags are derived from PostgreSQL, and startup reindexing rebuilds that index. Unsaved creator state lives only in the browser. A host API started with STORAGE=memory loses its records on process restart. `docker compose down` stops and removes the containers but keeps both named data volumes. Changing the PostgreSQL password after its volume has been initialized requires changing the database role password too; editing `.env` alone does not change an existing database.

Rebuild the derived index from the PostgreSQL records with:

```powershell
docker compose exec api npm run search:reindex:container
```

The HTTP `POST /api/v1/search/reindex` route is disabled in the production-mode Docker API unless `SEARCH_REINDEX_KEY` is configured. Use the container command for this local demo. Reindexing briefly replaces the search index, so run it when search traffic is quiet.

## Run the API locally

Run `npm install` and `npm run dev` from this directory. The default `STORAGE=memory` uses the original in-memory todo and travel source repositories. Elasticsearch still needs to run for search; use `npm run search:setup` and `npm run search:seed` to populate it.

To use the Docker database from a host-run API, set `STORAGE=postgres`, `DATABASE_URL=postgres://roamboard:<your-password>@localhost:5433/roamboard`, and `ELASTICSEARCH_NODE=http://localhost:9200` in `.env`, then run `npm run dev`. The host-run API listens on port 3000 by default; the containerized API is published on port 3001.

## Tests

Run `npm run typecheck`, `npm test`, and `npm run build`. These normal tests use the in-memory adapters. The following integration test uses the local Docker services and creates then deletes one test todo:

```powershell
$env:RUN_POSTGRES_INTEGRATION = '1'
$env:TEST_DATABASE_URL = 'postgres://roamboard:<your-password>@localhost:5433/roamboard'
npm run test:integration
```

The separate Elasticsearch integration test can also be enabled with `RUN_ELASTICSEARCH_INTEGRATION=1`. These tests reset the derived Elasticsearch index; run them only against the local demo stack.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API process health |
| `GET` | `/health/elasticsearch` | Elasticsearch connectivity |
| `GET` | `/api/v1/providers/mapbox/board-destinations` | Validate a city and country and return persistable canonical destination data |
| `GET` | `/api/v1/todos` | List todos, optionally filtered by `completed` |
| `GET` | `/api/v1/todos/:todoId` | Read a todo |
| `POST` | `/api/v1/todos` | Create a todo |
| `PATCH` | `/api/v1/todos/:todoId` | Update a todo |
| `DELETE` | `/api/v1/todos/:todoId` | Delete a todo |
| `GET` | `/api/v1/search` | Fuzzy public travel search with filters and pagination |
| `GET` | `/api/v1/search/suggestions` | Title suggestions |
| `GET` | `/api/v1/destinations/search?q=...` | Search destinations through the server-side Mapbox adapter |
| `GET` | `/api/v1/destinations/context?...` | Load weather, Wikipedia, and optional imagery for a selected destination |
| `GET` | `/api/v1/providers/config` | Report which developer provider keys are configured, without revealing values |
| `POST` | `/api/v1/providers/mapbox/map-session` | Reserve one map load and return the public browser token when quota remains |
| `GET` | `/api/v1/providers/mapbox/search?q=...` | Mapbox search prototype |
| `GET` | `/api/v1/providers/mapbox/board-search?q=...` | Geoapify search for a saved pin (legacy alias) |
| `GET` | `/api/v1/providers/mapbox/reverse?...` | Reverse-geocode coordinates into an area label, concise location detail, and geographic type |
| `GET` | `/api/v1/providers/mapbox/board-reverse?...` | Permanent reverse geocoding for a pin that may be persisted |
| `POST` | `/api/v1/providers/mapbox/directions` | Route between 2-10 saved coordinates using walking, cycling, or driving |
| `GET` | `/api/v1/providers/unsplash/search?q=...` | Unsplash image search prototype |
| `GET` | `/api/v1/providers/google-places/search?q=...` | Google Places text-search prototype |
| `POST` | `/api/v1/providers/google-places/saved` | Persist a stable Google Place ID reference |
| `GET` | `/api/v1/providers/google-places/saved` | List saved Google Place ID references |
| `DELETE` | `/api/v1/providers/google-places/saved/:placeId` | Remove a saved Google Place ID reference |
| `GET` | `/api/v1/providers/google-places/:placeId` | Fetch live Essentials data and a Google Maps link for a Place ID |
| `GET` | `/api/v1/providers/cloudinary/delivery?...` | Cloudinary responsive delivery URL prototype |
| `POST` | `/api/v1/providers/cloudinary/upload` | Upload an image up to 15 MB, including HEIC/HEIF files reported with a generic browser MIME type |
| `GET` | `/api/v1/providers/cloudinary/assets` | Load lightweight summaries of Roamboard-tagged Cloudinary uploads |
| `GET` | `/api/v1/providers/cloudinary/metadata?...` | Read and normalize capture, camera, orientation, EXIF/XMP, and degree-minute-second GPS metadata from one original asset |
| `GET` | `/api/v1/quotas` | Inspect local hard-limit usage, remaining units, reset times, and durable-storage status |
| `POST` | `/api/v1/users` | Create a prototype user with an immutable username |
| `GET` | `/api/v1/users/me` | Read the selected user's profile |
| `PATCH` | `/api/v1/users/me` | Change display name, description, location, interests, or extensible settings |
| `PUT` / `DELETE` | `/api/v1/users/me/profile-picture` | Set or clear profile-picture metadata |
| `GET` | `/api/v1/users/me/stats` | Count completed-trip countries, owned Boards, friends, saved places, and saved Boards |
| `GET` | `/api/v1/users/me/boards` | List the selected user's Boards |
| `POST` | `/api/v1/users/me/boards` | Create a prototype Board with destinations |
| `GET` | `/api/v1/users/me/recent-boards` | List recently opened, still-accessible Boards |
| `GET` | `/api/v1/users/me/map-destinations` | Return planned and completed Board destinations for a world map |
| `GET` | `/api/v1/boards?page=1&limit=20` | Paginated accessible Boards: owned drafts/private Boards and published public/friend Boards; response meta contains page, limit, hasMore |
| `DELETE` | `/api/v1/boards/:boardId` | Owner-only deletion, cascading days, pins, image references, visits, saved references, and durable search source; Cloudinary assets are retained |
| `GET` | `/api/v1/boards/:boardId` | Read an accessible Board and record a visit |
| `POST` | `/api/v1/boards` | Save a detailed draft or published Board with days, pins, image references, tags, vibes, highlights, and visibility |
| `PUT` / `DELETE` | `/api/v1/users/me/saved-boards/:boardId` | Save or unsave an accessible Board |

Deletion removes the PostgreSQL search source in the same transaction as the Board. Live Elasticsearch removal is attempted immediately; if Elasticsearch is unavailable, startup/manual reindexing reconciles stale entries. Drafts are readable only by their owner, regardless of their visibility selection.

The Elasticsearch provider lab is backed by the existing public sample records and demonstrates fuzzy search, search-as-you-type suggestions, filters, relevance scores, and development reindexing. It does not add external provider data to the index.

This is still a prototype: detailed Board creation persists, but it has no passwords or production authentication, post-save Board editing, full account lifecycle, saved-pin library, or PostGIS. Cloudinary continues to own image binaries; PostgreSQL stores Board associations and selected metadata. The `x-demo-user-id` boundary exists only to exercise frontend-to-database behavior.

The frontend saved Board browser is at `http://localhost:3000/dev/boards`. It loads accessible persisted records with pagination, expands Board details and provider image IDs, and supports confirmed owner-only deletion. Adminer remains the place to inspect every user?s private data and all SQL tables in local development.
