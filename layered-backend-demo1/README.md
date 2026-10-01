# Layered backend demo

This Express 5 backend has a todo API, a sample travel search API, and a destination discovery API. PostgreSQL stores the todos and sample travel records. Elasticsearch is a derived search index, rebuilt by the backend from PostgreSQL. Destination provider responses are live, short-lived discovery data and are not persisted or indexed.

```text
HTTP client -> Express API -> PostgreSQL (source of truth)
                           -> Elasticsearch (search index)
```

PostgreSQL and Elasticsearch do not talk directly. The API reads the source records from PostgreSQL and indexes only public records. There is no endpoint for changing travel records yet, so a full rebuild at API startup and the reindex command are enough for this demo. Future Board writes will need a durable retry mechanism such as an outbox before they can safely update the search index.

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

The API is at `http://localhost:3001`. PostgreSQL is available to local tools at `localhost:5433`, and Elasticsearch at `localhost:9200`; all published ports are bound to the host's loopback address. Elasticsearch security is disabled for local development, so this Compose file is not a production deployment. Compose waits for the database and search service health checks before starting the API. The API applies `migrations/001_demo_tables.sql`, seeds missing sample travel records in PostgreSQL, and rebuilds Elasticsearch before it listens.

The frontend uses `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` so browser requests reach the published API address. Set a valid public `pk.` `MAPBOX_ACCESS_TOKEN` in the API environment to enable destination search and the interactive map. `Open-Meteo` and Wikipedia need no key; `UNSPLASH_ACCESS_KEY` is optional and adds destination imagery. The provider lab at `http://localhost:3000/dev/providers` also exposes Mapbox routing and saved pinpoints, Unsplash, Google Places, Cloudinary upload/metadata extraction, and Elasticsearch fuzzy search/autocomplete. Google Places requires a billing-enabled Google Cloud project. These provider keys stay in the API container, except the intentionally public Mapbox `pk.` token used by Mapbox GL in the browser.

Try the endpoints in PowerShell:

```powershell
Invoke-RestMethod 'http://localhost:3001/health'
Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/v1/todos' -ContentType 'application/json' -Body '{"title":"Plan Stockholm trip"}'
Invoke-RestMethod 'http://localhost:3001/api/v1/todos'
Invoke-RestMethod 'http://localhost:3001/api/v1/search?q=stokholm'
Invoke-RestMethod 'http://localhost:3001/api/v1/search/suggestions?q=sto'
```

Restarting the API preserves todos because PostgreSQL uses a named volume. `docker compose down` stops and removes the containers but keeps both named data volumes. Changing the PostgreSQL password after its volume has been initialized requires changing the database role password too; editing `.env` alone does not change an existing database.

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
| `GET` | `/api/v1/providers/mapbox/search?q=...` | Mapbox search prototype |
| `GET` | `/api/v1/providers/mapbox/reverse?...` | Mapbox reverse-geocoding prototype |
| `POST` | `/api/v1/providers/mapbox/directions` | Route between 2-10 saved coordinates using walking, cycling, or driving |
| `GET` | `/api/v1/providers/unsplash/search?q=...` | Unsplash image search prototype |
| `GET` | `/api/v1/providers/google-places/search?q=...` | Google Places text-search prototype |
| `GET` | `/api/v1/providers/cloudinary/delivery?...` | Cloudinary responsive delivery URL prototype |
| `POST` | `/api/v1/providers/cloudinary/upload` | Upload an image up to 15 MB, including HEIC/HEIF files reported with a generic browser MIME type |
| `GET` | `/api/v1/providers/cloudinary/assets` | Load lightweight summaries of Roamboard-tagged Cloudinary uploads |
| `GET` | `/api/v1/providers/cloudinary/metadata?...` | Read and normalize capture, camera, orientation, EXIF/XMP, and degree-minute-second GPS metadata from one original asset |

The Elasticsearch provider lab is backed by the existing public sample records and demonstrates fuzzy search, search-as-you-type suggestions, filters, relevance scores, and development reindexing. It does not add external provider data to the index.

This is still a prototype: it has no Board persistence, accounts, authorization, live travel-record writes, or PostGIS. The frontend home page uses the destination discovery API; Boards and the Elasticsearch sample search remain separate demos.
