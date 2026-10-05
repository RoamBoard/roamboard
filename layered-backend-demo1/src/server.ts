import debug from "debug";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createSearchClient } from "./features/search/search.client.js";
import { sampleSearchDocuments } from "./features/search/search.documents.js";
import { createSearchModule } from "./features/search/search.module.js";
import {
  createPostgresSearchSourceRepository,
  seedSearchDocuments,
} from "./features/search/search.postgres-repository.js";
import { createPostgresTodoRepository } from "./features/todos/todo.postgres-repository.js";
import { createPostgresQuotaRepository } from "./features/quotas/quota.postgres-repository.js";
import { createPostgresGooglePlaceReferenceRepository } from "./features/providers/provider.google-place-postgres-repository.js";
import { createPostgresPool, runMigrations } from "./infrastructure/postgres.js";
import { createPostgresUserRepository } from "./features/users/user.postgres-repository.js";

const log = debug("roamboard:http");

async function main(): Promise<void> {
  const pool = env.STORAGE === "postgres" && env.DATABASE_URL
    ? createPostgresPool(env.DATABASE_URL)
    : undefined;

  if (pool) {
    await runMigrations(pool);
    await seedSearchDocuments(pool, sampleSearchDocuments);
  }

  const searchClient = createSearchClient();
  const searchModule = createSearchModule({
    client: searchClient,
    sourceRepository: pool ? createPostgresSearchSourceRepository(pool) : undefined,
  });
  if (pool) await searchModule.service.reindex();

  const app = createApp({
    todoRepository: pool ? createPostgresTodoRepository(pool) : undefined,
    searchModule,
    quotaRepository: pool ? createPostgresQuotaRepository(pool) : undefined,
    googlePlaceReferenceRepository: pool ? createPostgresGooglePlaceReferenceRepository(pool) : undefined,
    userRepository: pool ? createPostgresUserRepository(pool) : undefined,
    boardSearchIndexer: searchModule.service,
  });
  const server = app.listen(env.PORT, () => {
    log("API listening on port %d with %s storage", env.PORT, env.STORAGE);
  });

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    log("%s received; closing server", signal);
    server.close(async () => {
      await searchClient.close();
      await pool?.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGINT", () => { void shutdown("SIGINT"); });
  process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
}

main().catch((error: unknown) => {
  process.stderr.write(`API startup failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exit(1);
});
