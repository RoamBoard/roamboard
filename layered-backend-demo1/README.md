# Layered backend demo

This Express 5 prototype has a todo API and a small travel search API. PostgreSQL stores the todos and the sample travel records. Elasticsearch is a derived search index, rebuilt by the backend from PostgreSQL. The frontend is not yet connected to these APIs, and the travel records are demo fixtures rather than real Boards.

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

The API is at `http://localhost:3001`. PostgreSQL is available to local tools at `localhost:5433`, and Elasticsearch at `localhost:9200`; all published ports are bound to the host's loopback address. Elasticsearch security is disabled for local development, so this Compose file is not a production deployment. Compose waits for the database and search service health checks before starting the API. The API applies `migrations/001_demo_tables.sql`, seeds missing sample travel records in PostgreSQL, and rebuilds Elasticsearch before it listens.

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

This is still a prototype: it has no Board persistence, accounts, authorization, live travel-record writes, PostGIS, or frontend integration.
