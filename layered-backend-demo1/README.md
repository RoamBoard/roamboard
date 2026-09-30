# Layered Express backend demo

A small, runnable todo API demonstrating feature-first organization with layers inside each feature.

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

## Run it

```bash
npm install
npm run dev
```

The API runs at `http://localhost:3000` by default. Copy `.env.example` to `.env` to override its configuration.

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
