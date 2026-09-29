# Layered Express backend demo

A small, runnable TypeScript Express API demonstrating feature-first organization with layers inside each feature. The todo repository is an in-memory `Map` that stands in for PostgreSQL. Elasticsearch is an optional, derived search index for the seeded travel records.

## Architecture

```text
HTTP request
  -> global middleware
  -> feature router
  -> validation middleware
  -> controller
  -> service
  -> repository
```

- **Router:** declares HTTP methods, paths, and route middleware.
- **Controller:** translates HTTP input into service calls and service results into HTTP responses.
- **Service:** owns application and business rules.
- **Repository:** owns persistence. This demo uses an in-memory `Map`.
- **Module:** constructs the feature and connects its dependencies.

The `Map` remains authoritative. Elasticsearch can be deleted and rebuilt from the source records with no data loss. Production writes should commit to PostgreSQL first and publish an outbox event for a background worker; a failed Elasticsearch update must not roll back or report a committed PostgreSQL write as failed.

## Run the project

Run these commands in three separate terminals.

Run them from the repository root (`roamboard`).

**Terminal 1: Elasticsearch**

```powershell
cd layered-backend-demo1
Copy-Item .env.example .env
docker compose up -d
```

**Terminal 2: backend API**

```powershell
cd layered-backend-demo1
npm install
npm run search:setup
npm run search:seed
npm run dev
```

The API runs at `http://localhost:3000`.

**Terminal 3: frontend**

```powershell
cd frontend
pnpm install
pnpm dev -- --port 5173
```

Open `http://localhost:5173`. The frontend calls the backend API; it does not connect to Elasticsearch directly.

## Elasticsearch purpose and structure

Elasticsearch is a derived read/search index. It provides fuzzy search, relevance scoring, autocomplete, filters, and fast result retrieval. The backend `Map` is still the source of truth and can rebuild Elasticsearch at any time.

```text
src/features/search/
  search.client.ts       Elasticsearch client and local/Cloud connection
  search.index.ts        roamboard-search-v1 mapping and creation
  search.documents.ts    sample destination/place/itinerary records
  search.repository.ts   authoritative Map source for the prototype
  search.query.ts        fuzzy search and autocomplete DSL
  search.service.ts      indexing, reindexing, search, readiness
  search.controller.ts   HTTP handlers
  search.routes.ts       /api/v1/search routes
  search.module.ts       dependency wiring
```

The flow is:

```text
Map source -> reindex helper -> Elasticsearch index -> search API -> frontend
```

Elasticsearch is never used for authentication, ownership checks, domain writes, or authoritative persistence.

## Elasticsearch commands

This project uses npm and pins `@elastic/elasticsearch` to `8.18.2`, matching the local Elasticsearch Docker image. Local security is disabled for this prototype and port 9200 is bound to loopback. Never expose port 9200 publicly.

Start Elasticsearch:

```bash
docker compose up -d
docker compose ps
```

Create the versioned index and seed the sample destination, place, and public itinerary records:

```bash
npm run search:setup
npm run search:seed
```

The seed source is a `Map` in `src/features/search/search.repository.ts`; it is deliberately separate from the todo `Map` because this demo has no existing travel domain records. Rebuild the derived index at any time with:

```bash
npm run search:reindex
```

Demo queries:

```bash
curl "http://localhost:3000/api/v1/search?q=stokholm"
curl "http://localhost:3000/api/v1/search/suggestions?q=sto"
curl "http://localhost:3000/api/v1/search?q=stockholm&entityType=place&country=sweden&category=culture"
curl "http://localhost:3000/health/elasticsearch"
```

For Elastic Cloud, remove `ELASTICSEARCH_NODE` and set `ELASTIC_CLOUD_ID` plus `ELASTIC_API_KEY` in `.env`; the application code and commands stay the same. Do not commit `.env` or API keys.

Stop Elasticsearch:

```bash
docker compose down
```

Destructively remove the local Elasticsearch data volume:

```bash
docker compose down -v
```

Run the normal tests without Docker:

```bash
npm test
```

Run the opt-in integration test against a running service. PowerShell:

```powershell
$env:RUN_ELASTICSEARCH_INTEGRATION="1"; npm run test:integration
```

The integration test covers reindexing, `stokholm` fuzzy matching, `sto` autocomplete, and entity/country/category filters.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/todos` | List todos |
| `GET` | `/api/v1/todos/:todoId` | Get one todo |
| `POST` | `/api/v1/todos` | Create a todo |
| `PATCH` | `/api/v1/todos/:todoId` | Update a todo |
| `DELETE` | `/api/v1/todos/:todoId` | Delete a todo |

Filter the list with `GET /api/v1/todos?completed=true` or `completed=false`.

Create a todo:

```bash
curl -X POST http://localhost:3000/api/v1/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn layered architecture"}'
```

## Test it

```bash
npm test
```

The tests import the Express app without opening a network port. Each test can create a fresh app and in-memory repository.

## Add a feature

Create another self-contained folder under `src/features`, such as:

```text
src/features/projects/
  project.routes.ts
  project.controller.ts
  project.service.ts
  project.repository.ts
  project.schemas.ts
  project.module.ts
```

Then construct the module and mount its router in `src/app.ts`.

For production, replace the in-memory repository with a database-backed adapter that implements the same methods. Data in this demo is erased whenever the process restarts.
