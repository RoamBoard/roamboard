import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { AuthRepository } from "../src/features/auth/auth.types.js";
import type { PlaceInput, SavedPlace, SavedPlacesRepository } from "../src/features/saved-places/saved-places.types.js";
import { sessionCookieName } from "../src/shared/session-cookie.js";

const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
const place: PlaceInput = {
    id: "geoapify:station/42",
    name: "Central station",
    address: "Centralplan 15",
    latitude: 59.33,
    longitude: 18.058,
    city: "Stockholm",
    country: "SWE"
};
const users = [
    { userId: "saved-owner-a", username: "traveller_a", displayName: "Traveller A" },
    { userId: "saved-owner-b", username: "traveller_b", displayName: "Traveller B" }
];
const cookie = (index: number) => `${sessionCookieName()}=saved-token-${index}`;

function setup(persistence?: SavedPlacesRepository) {
    const accounts = new Map<string, Map<string, SavedPlace>>();
    const saved: SavedPlacesRepository = persistence ?? {
        async list(userId) {
            return structuredClone([...(accounts.get(userId)?.values() ?? [])]);
        },
        async save(userId, input) {
            const rows = accounts.get(userId) ?? new Map<string, SavedPlace>();
            const result = { ...input, savedAt: rows.get(input.id)?.savedAt ?? new Date().toISOString() };
            rows.set(input.id, result);
            accounts.set(userId, rows);
            return structuredClone(result);
        },
        async remove(userId, id) {
            accounts.get(userId)?.delete(id);
        }
    };
    const auth: AuthRepository = {
        async findUserById(id) {
            return users.find((user) => user.userId === id) ?? null;
        },
        async findUserBySession(hash) {
            return (
                users.find(
                    (_user, index) => createHash("sha256").update(`saved-token-${index}`).digest("hex") === hash
                ) ?? null
            );
        },
        async createUser(user) {
            return user;
        },
        async createSession() {},
        async deleteSession() {}
    };
    return createApp({ repository: auth, savedPlacesRepository: saved });
}

test("saved-place reads and writes require a real session, including when an identity header is forged", async () => {
    const app = setup();
    for (const response of [
        await request(app).get("/api/v1/saved-places").set("x-demo-user-id", users[0]!.userId),
        await request(app).post("/api/v1/saved-places").set("Origin", origin).send(place),
        await request(app)
            .delete(`/api/v1/saved-places/${encodeURIComponent(place.id)}`)
            .set("Origin", origin),
        await request(app).get("/api/v1/saved-places").set("Cookie", `${sessionCookieName()}=unknown-token`)
    ]) {
        assert.equal(response.status, 401);
        assert.equal(response.body.error.code, "UNAUTHENTICATED");
    }
});

test("foreign and missing Origins cannot save or remove account places", async () => {
    const app = setup();
    await request(app)
        .post("/api/v1/saved-places")
        .set("Cookie", cookie(0))
        .set("Origin", origin)
        .send(place)
        .expect(200);
    for (const unapproved of [undefined, "https://unapproved.example"]) {
        const save = request(app)
            .post("/api/v1/saved-places")
            .set("Cookie", cookie(0))
            .send({ ...place, name: "Forged change" });
        const remove = request(app)
            .delete(`/api/v1/saved-places/${encodeURIComponent(place.id)}`)
            .set("Cookie", cookie(0));
        if (unapproved) {
            save.set("Origin", unapproved);
            remove.set("Origin", unapproved);
        }
        for (const response of [await save, await remove]) {
            assert.equal(response.status, 403);
            assert.equal(response.body.error.code, "ORIGIN_NOT_ALLOWED");
        }
    }
    const list = await request(app).get("/api/v1/saved-places").set("Cookie", cookie(0)).expect(200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].name, "Central station");
});

test("invalid coordinates, ISO countries, identifiers and unsupported owner fields are rejected before saving", async () => {
    const app = setup();
    const invalid = [
        { ...place, latitude: 90.01 },
        { ...place, latitude: -90.01 },
        { ...place, longitude: 180.01 },
        { ...place, longitude: -180.01 },
        { ...place, latitude: "59.33" },
        { ...place, latitude: null },
        { ...place, longitude: Number.NaN },
        { ...place, country: "SE" },
        { ...place, country: "ZZZ" },
        { ...place, country: "swe" },
        { ...place, id: " " },
        { ...place, id: "a".repeat(513) },
        { ...place, name: " " },
        { ...place, name: "a".repeat(201) },
        { ...place, address: "a".repeat(1001) },
        { ...place, city: " " },
        { ...place, city: "a".repeat(101) },
        { ...place, userId: users[1]!.userId },
        { ...place, savedAt: "2000-01-01T00:00:00.000Z" }
    ];
    for (const input of invalid) {
        const response = await request(app)
            .post("/api/v1/saved-places")
            .set("Cookie", cookie(0))
            .set("Origin", origin)
            .send(input)
            .expect(400);
        assert.equal(response.body.error.code, "INVALID_REQUEST");
    }
    const list = await request(app).get("/api/v1/saved-places").set("Cookie", cookie(0)).expect(200);
    assert.deepEqual(list.body.data, []);
});

test("invalid removal IDs return validation errors", async () => {
    const app = setup();
    for (const id of [" ", "a".repeat(513)]) {
        const response = await request(app)
            .delete(`/api/v1/saved-places/${encodeURIComponent(id)}`)
            .set("Cookie", cookie(0))
            .set("Origin", origin)
            .expect(400);
        assert.equal(response.body.error.code, "INVALID_REQUEST");
    }
});

test("save and removal use the same validated identifier normalization", async () => {
    const app = setup();
    const spacedId = `  ${place.id}  `;
    const saved = await request(app)
        .post("/api/v1/saved-places")
        .set("Cookie", cookie(0))
        .set("Origin", origin)
        .send({ ...place, id: spacedId })
        .expect(200);
    assert.equal(saved.body.data.id, place.id);
    await request(app)
        .delete(`/api/v1/saved-places/${encodeURIComponent(spacedId)}`)
        .set("Cookie", cookie(0))
        .set("Origin", origin)
        .expect(204);
    const remaining = await request(app).get("/api/v1/saved-places").set("Cookie", cookie(0)).expect(200);
    assert.deepEqual(remaining.body.data, []);
});

test("repeated saves update one row and both accounts retain independent copies of the same provider place", async () => {
    const app = setup();
    const save = (index: number, input: PlaceInput) =>
        request(app)
            .post("/api/v1/saved-places")
            .set("Cookie", cookie(index))
            .set("Origin", origin)
            .send(input)
            .expect(200);
    const first = await save(0, place);
    assert.deepEqual(first.body.data, { ...place, savedAt: first.body.data.savedAt });
    assert.match(first.body.data.savedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const updated = { ...place, name: "West entrance", address: "Updated address", latitude: 59.331 };
    await save(0, updated);
    await save(1, { ...place, name: "B's own copy" });
    const own = await request(app)
        .get("/api/v1/saved-places")
        .query({ userId: users[1]!.userId })
        .set("Cookie", cookie(0))
        .expect(200);
    assert.equal(own.body.data.length, 1);
    assert.equal(own.body.data[0].name, "West entrance");
    assert.equal(own.body.data[0].latitude, 59.331);
    const other = await request(app).get("/api/v1/saved-places").set("Cookie", cookie(1)).expect(200);
    assert.equal(other.body.data[0].name, "B's own copy");
    await request(app)
        .delete(`/api/v1/saved-places/${encodeURIComponent(place.id)}`)
        .query({ userId: users[1]!.userId })
        .set("Cookie", cookie(0))
        .set("Origin", origin)
        .expect(204);
    await request(app)
        .delete(`/api/v1/saved-places/${encodeURIComponent(place.id)}`)
        .set("Cookie", cookie(0))
        .set("Origin", origin)
        .expect(204);
    const empty = await request(app).get("/api/v1/saved-places").set("Cookie", cookie(0)).expect(200);
    assert.deepEqual(empty.body.data, []);
    const retained = await request(app).get("/api/v1/saved-places").set("Cookie", cookie(1)).expect(200);
    assert.equal(retained.body.data.length, 1);
    assert.equal(retained.body.data[0].name, "B's own copy");
});

test("persistence failures return a safe API failure instead of a saved-place confirmation", async () => {
    const app = setup({
        async list() {
            throw new Error("private SQL detail");
        },
        async save() {
            throw new Error("private SQL detail");
        },
        async remove() {
            throw new Error("private SQL detail");
        }
    });
    for (const response of [
        await request(app).get("/api/v1/saved-places").set("Cookie", cookie(0)),
        await request(app).post("/api/v1/saved-places").set("Cookie", cookie(0)).set("Origin", origin).send(place),
        await request(app)
            .delete(`/api/v1/saved-places/${encodeURIComponent(place.id)}`)
            .set("Cookie", cookie(0))
            .set("Origin", origin)
    ]) {
        assert.equal(response.status, 500);
        assert.doesNotMatch(JSON.stringify(response.body), /private SQL detail/);
    }
});
