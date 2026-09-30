import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import { createSearchClient } from "../src/features/search/search.client.js";
import { sampleSearchDocuments } from "../src/features/search/search.documents.js";
import { createSearchModule } from "../src/features/search/search.module.js";
import {
  createPostgresSearchSourceRepository,
  seedSearchDocuments,
} from "../src/features/search/search.postgres-repository.js";
import { createPostgresTodoRepository } from "../src/features/todos/todo.postgres-repository.js";
import { createPostgresPool, runMigrations } from "../src/infrastructure/postgres.js";

const runIntegration = process.env.RUN_POSTGRES_INTEGRATION === "1";

test("PostgreSQL persists API todos and supplies Elasticsearch search records", { skip: !runIntegration }, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, "Set TEST_DATABASE_URL for the PostgreSQL integration test");

  const pool = createPostgresPool(databaseUrl);
  const client = createSearchClient();
  const createdIds: string[] = [];
  const privateDocumentId = `private-integration-${randomUUID()}`;

  try {
    await runMigrations(pool);
    await seedSearchDocuments(pool, sampleSearchDocuments);
    const sample = sampleSearchDocuments[0];
    assert.ok(sample);
    await pool.query(
      "INSERT INTO search_documents (id, document) VALUES ($1, $2::jsonb)",
      [privateDocumentId, JSON.stringify({
        ...sample,
        id: privateDocumentId,
        title: "Private Alpine Hideout",
        titleSuggest: "Private Alpine Hideout",
        isPublic: false,
      })],
    );
    const sourceRepository = createPostgresSearchSourceRepository(pool);
    const searchModule = createSearchModule({ client, sourceRepository });
    assert.ok((await searchModule.service.reindex()) >= sampleSearchDocuments.length);

    const repository = createPostgresTodoRepository(pool);
    const app = createApp({ todoRepository: repository, searchModule });
    const created = await request(app)
      .post("/api/v1/todos")
      .send({ title: "PostgreSQL integration check" });
    assert.equal(created.status, 201);
    const todoId: string = created.body.data.id;
    createdIds.push(todoId);

    const secondApp = createApp({ todoRepository: createPostgresTodoRepository(pool), searchModule });
    const persisted = await request(secondApp).get(`/api/v1/todos/${todoId}`);
    assert.equal(persisted.status, 200);
    assert.equal(persisted.body.data.title, "PostgreSQL integration check");

    const search = await request(secondApp).get("/api/v1/search?q=stokholm");
    assert.equal(search.status, 200);
    assert.ok(search.body.data.hits.some(
      (hit: { document: { title: string } }) => hit.document.title === "Stockholm",
    ));

    const privateSearch = await request(secondApp).get("/api/v1/search?q=Private%20Alpine%20Hideout");
    assert.equal(privateSearch.status, 200);
    assert.equal(privateSearch.body.data.hits.length, 0);
  } finally {
    for (const id of createdIds) {
      await pool.query("DELETE FROM todos WHERE id = $1", [id]);
    }
    await pool.query("DELETE FROM search_documents WHERE id = $1", [privateDocumentId]);
    await client.close();
    await pool.end();
  }
});
