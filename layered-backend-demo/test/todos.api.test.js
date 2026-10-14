import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";

test("creates, reads, updates, filters, and deletes a todo", async () => {
    const app = createApp();

    const createResponse = await request(app).post("/api/v1/todos").send({ title: "Learn layered architecture" });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.data.title, "Learn layered architecture");
    assert.equal(createResponse.body.data.completed, false);

    const todoId = createResponse.body.data.id;

    const getResponse = await request(app).get(`/api/v1/todos/${todoId}`);
    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.data.id, todoId);

    const updateResponse = await request(app).patch(`/api/v1/todos/${todoId}`).send({ completed: true });
    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.data.completed, true);

    const listResponse = await request(app).get("/api/v1/todos?completed=true");
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.data.length, 1);

    const deleteResponse = await request(app).delete(`/api/v1/todos/${todoId}`);
    assert.equal(deleteResponse.status, 204);

    const missingResponse = await request(app).get(`/api/v1/todos/${todoId}`);
    assert.equal(missingResponse.status, 404);
});

test("rejects invalid request bodies", async () => {
    const app = createApp();

    const response = await request(app).post("/api/v1/todos").send({ title: "" });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.message, "Invalid request");
});

test("returns 404 for unknown routes", async () => {
    const app = createApp();
    const response = await request(app).get("/does-not-exist");

    assert.equal(response.status, 404);
    assert.match(response.body.error.message, /not found/);
});
