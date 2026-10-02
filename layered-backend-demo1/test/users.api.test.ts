import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";
import { DEMO_USER_ID } from "../src/features/users/user.types.js";

test("reads and updates the seeded prototype profile without allowing username changes", async () => {
  const app = createApp();

  const initial = await request(app).get("/api/v1/users/me");
  assert.equal(initial.status, 200);
  assert.equal(initial.body.data.username, "roam_demo");

  const updated = await request(app)
    .patch("/api/v1/users/me")
    .send({
      displayName: "Changed in the UI",
      description: "This value should persist.",
      location: "Gothenburg, Sweden",
      interests: ["architecture", "coffee"],
      settings: { mapStyle: "satellite" },
    });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.displayName, "Changed in the UI");
  assert.equal(updated.body.data.settings.mapStyle, "satellite");
  assert.equal(updated.body.data.settings.emailUpdates, false);

  const reread = await request(app).get("/api/v1/users/me");
  assert.equal(reread.body.data.description, "This value should persist.");
  assert.equal(reread.body.data.username, "roam_demo");

  const usernameChange = await request(app)
    .patch("/api/v1/users/me")
    .send({ username: "not_allowed" });
  assert.equal(usernameChange.status, 400);
  assert.equal(usernameChange.body.error.code, "REQUEST_FAILED");
});

test("creates a user and selects it through the prototype auth header", async () => {
  const app = createApp();

  const created = await request(app)
    .post("/api/v1/users")
    .send({ username: "new_traveller", displayName: "New Traveller" });
  assert.equal(created.status, 201);

  const selected = await request(app)
    .get("/api/v1/users/me")
    .set("x-demo-user-id", created.body.data.id);
  assert.equal(selected.status, 200);
  assert.equal(selected.body.data.username, "new_traveller");

  const duplicate = await request(app)
    .post("/api/v1/users")
    .send({ username: "NEW_TRAVELLER", displayName: "Duplicate" });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, "USERNAME_TAKEN");
});

test("sets and deletes a profile picture", async () => {
  const app = createApp();
  const setPicture = await request(app)
    .put("/api/v1/users/me/profile-picture")
    .send({ url: "https://images.example/profile.jpg", storageKey: "profiles/demo" });
  assert.equal(setPicture.status, 200);
  assert.equal(setPicture.body.data.profilePicture.storageKey, "profiles/demo");

  const deleted = await request(app).delete("/api/v1/users/me/profile-picture");
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.data.profilePicture, null);
});

test("creates a multi-country Board and updates profile statistics and map destinations", async () => {
  const app = createApp();
  const before = await request(app).get("/api/v1/users/me/stats");

  const created = await request(app)
    .post("/api/v1/users/me/boards")
    .send({
      title: "Lisbon journal",
      visibility: "private",
      isCompleted: true,
      destinations: [{
        country: "Portugal",
        countryCode: "pt",
        city: "Lisbon",
        latitude: 38.7223,
        longitude: -9.1393,
      }, {
        country: "Spain",
        countryCode: "ES",
        city: "Seville",
        latitude: 37.3891,
        longitude: -5.9845,
      }],
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.ownerId, DEMO_USER_ID);
  assert.equal(created.body.data.destinations[0].countryCode, "PT");
  assert.equal(created.body.data.destinations[1].countryCode, "ES");

  const ownBoards = await request(app).get("/api/v1/users/me/boards?limit=10");
  assert.equal(ownBoards.status, 200);
  assert.ok(ownBoards.body.data.some((board: { id: string }) => board.id === created.body.data.id));

  const after = await request(app).get("/api/v1/users/me/stats");
  assert.equal(after.body.data.boardsCreated, before.body.data.boardsCreated + 1);
  assert.equal(after.body.data.countriesVisited, before.body.data.countriesVisited + 2);

  const map = await request(app).get("/api/v1/users/me/map-destinations");
  assert.ok(map.body.data.some((destination: { countryCode: string }) => destination.countryCode === "PT"));
  assert.ok(map.body.data.some((destination: { countryCode: string }) => destination.countryCode === "ES"));
});

test("records accessible Board visits and supports idempotent saving", async () => {
  const app = createApp();
  const publicBoardId = "10000000-0000-4000-8000-000000000003";

  const board = await request(app).get(`/api/v1/boards/${publicBoardId}`);
  assert.equal(board.status, 200);

  const recent = await request(app).get("/api/v1/users/me/recent-boards");
  assert.equal(recent.status, 200);
  assert.equal(recent.body.data[0].id, publicBoardId);

  const before = await request(app).get("/api/v1/users/me/stats");
  await request(app).put(`/api/v1/users/me/saved-boards/${publicBoardId}`).expect(204);
  await request(app).put(`/api/v1/users/me/saved-boards/${publicBoardId}`).expect(204);
  const after = await request(app).get("/api/v1/users/me/stats");
  assert.equal(after.body.data.boardsSaved, before.body.data.boardsSaved);

  await request(app).delete(`/api/v1/users/me/saved-boards/${publicBoardId}`).expect(204);
  const unsaved = await request(app).get("/api/v1/users/me/stats");
  assert.equal(unsaved.body.data.boardsSaved, before.body.data.boardsSaved - 1);
});

test("rejects malformed prototype identities and Boards without complete destinations", async () => {
  const app = createApp();
  const badIdentity = await request(app).get("/api/v1/users/me").set("x-demo-user-id", "nope");
  assert.equal(badIdentity.status, 401);
  assert.equal(badIdentity.body.error.code, "INVALID_PROTOTYPE_USER");

  const badBoard = await request(app)
    .post("/api/v1/users/me/boards")
    .send({ title: "Bad coordinates", destinations: [{ country: "Sweden", countryCode: "SE", latitude: 59 }] });
  assert.equal(badBoard.status, 400);

  const missingDestination = await request(app)
    .post("/api/v1/users/me/boards")
    .send({ title: "Nowhere", destinations: [] });
  assert.equal(missingDestination.status, 400);

  const missingCity = await request(app)
    .post("/api/v1/users/me/boards")
    .send({ title: "No city", destinations: [{ country: "Sweden", countryCode: "SE", latitude: 59.3293, longitude: 18.0686 }] });
  assert.equal(missingCity.status, 400);

  const inventedCountry = await request(app)
    .post("/api/v1/users/me/boards")
    .send({ title: "Fantasy trip", destinations: [{ country: "Narnia", countryCode: "ZZ", city: "Cair Paravel", latitude: 1, longitude: 1 }] });
  assert.equal(inventedCountry.status, 400);
});
