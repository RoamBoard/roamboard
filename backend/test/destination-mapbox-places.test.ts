import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import request from "supertest";
import { matchMapboxSight } from "../src/features/destinations/destination.sights.js";
import { createDestinationModule } from "../src/features/destinations/destination.module.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { AppError } from "../src/shared/app-error.js";

const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
const selected = { name: "Musee d'Orsay", city: "Paris", country: "FRA", latitude: 48.8566, longitude: 2.3522 };
const coordinates = { latitude: 48.8576, longitude: 2.3522 };
function serviceApp(t: TestContext) {
    for (const [name, value] of Object.entries({
        MAPBOX_ACCESS_TOKEN: "mapbox-test-secret"
    })) {
        const previous = process.env[name];
        process.env[name] = value;
        t.after(() => {
            if (previous === undefined) delete process.env[name];
            else process.env[name] = previous;
        });
    }
    const state = { mode: "match", calls: 0, blocked: false };
    const reservations: string[] = [];
    const module = createDestinationModule(
        {
            async reserve() {},
            async run(id, operation) {
                reservations.push(id);
                if (state.blocked) throw new AppError(429, "Provider allowance reached", "PROVIDER_QUOTA_EXHAUSTED");
                return operation();
            }
        },
        {
            providers: {
                async cityTip() {
                    return null;
                },
                async placeDetails() {
                    throw new Error("Map matching must not read selected-sight details");
                },
                async article() {
                    return null;
                },
                async images() {
                    return [];
                },
                async places() {
                    return [];
                },
                async matchPlace(input, token) {
                    assert.deepEqual(input, selected);
                    assert.equal(token, "mapbox-test-secret");
                    state.calls += 1;
                    if (state.mode === "fail") throw new Error("Private upstream detail");
                    return state.mode === "empty" ? null : coordinates;
                }
            },
            repository: {
                async listPublic() {
                    throw new Error("Place lookups must not access Board persistence");
                }
            }
        }
    );
    const server = express();
    server.use(express.json());
    server.use("/api/v1/destinations", module.router);
    server.use(errorHandler);
    return { server, state, reservations };
}

test("anonymous match-place requests validate Origin and identity before returning only uncached marker coordinates", async (t) => {
    const { server, state, reservations } = serviceApp(t);
    for (const badOrigin of [undefined, "https://unapproved.example"]) {
        const call = request(server).post("/api/v1/destinations/match-place").send(selected);
        if (badOrigin) call.set("Origin", badOrigin);
        const response = await call.expect(403);
        assert.equal(response.body.error.code, "ORIGIN_NOT_ALLOWED");
    }
    for (const input of [
        { ...selected, country: "FR" },
        { ...selected, country: "ZZZ" },
        { ...selected, latitude: 91 },
        { ...selected, longitude: -181 },
        { ...selected, latitude: "48.85" },
        { ...selected, name: " " },
        { ...selected, city: " " },
        { ...selected, id: "wikivoyage:42:museum" }
    ]) {
        const response = await request(server)
            .post("/api/v1/destinations/match-place")
            .set("Origin", origin)
            .send(input)
            .expect(400);
        assert.equal(response.body.error.code, "INVALID_REQUEST");
    }
    assert.equal(state.calls, 0);
    for (const attempt of [1, 2]) {
        const response = await request(server)
            .post("/api/v1/destinations/match-place")
            .set("Origin", origin)
            .send(selected)
            .expect(200);
        assert.deepEqual(response.body.data, coordinates);
        assert.equal(state.calls, attempt);
        assert.equal(response.headers["cache-control"], "no-store");
    }
    assert.deepEqual(reservations, ["mapbox.search_box", "mapbox.search_box"]);
});

test("matching without configuration or candidates returns null and provider failures use safe 502 or 429 states", async (t) => {
    const { server, state } = serviceApp(t);
    const read = () => request(server).post("/api/v1/destinations/match-place").set("Origin", origin).send(selected);
    delete process.env.MAPBOX_ACCESS_TOKEN;
    assert.equal((await read().expect(200)).body.data, null);
    assert.equal(state.calls, 0);
    process.env.MAPBOX_ACCESS_TOKEN = "mapbox-test-secret";
    state.mode = "empty";
    assert.equal((await read().expect(200)).body.data, null);
    state.mode = "fail";
    const failed = await read().expect(502);
    assert.equal(failed.body.error.code, "PROVIDER_FAILED");
    assert.doesNotMatch(JSON.stringify(failed.body), /Private upstream|secret/);
    state.blocked = true;
    const exhausted = await read().expect(429);
    assert.equal(exhausted.body.error.code, "PROVIDER_QUOTA_EXHAUSTED");
    assert.equal(state.calls, 2);
});

const mapboxFeature = (name: string, latitude: number, country = "fr") => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [2.3522, latitude] },
    properties: {
        name,
        full_address: "Temporary address",
        mapbox_id: "temporary-id",
        context: { country: { country_code: country } }
    }
});

test("the retired permanent-location confirmation endpoint is no longer exposed", async (t) => {
    const { server, state, reservations } = serviceApp(t);
    await request(server).post("/api/v1/destinations/resolve-place").set("Origin", origin).send(selected).expect(404);
    assert.equal(state.calls, 0);
    assert.deepEqual(reservations, []);
});

test("Mapbox marker matching requires normalized name, same country and valid coordinates within 500m", async (t) => {
    const calls: URL[] = [];
    const feedback: number[] = [];
    const state = {
        features: [
            mapboxFeature("Musée d’Orsay cafe", 48.8567),
            mapboxFeature("Musée d’Orsay", 48.8567, "de"),
            mapboxFeature("Musée d’Orsay", 48.8612),
            mapboxFeature("Musée d’Orsay", 91),
            mapboxFeature("Musée d’Orsay", 48.861),
            mapboxFeature("Musée d’Orsay", 48.8576)
        ]
    };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        calls.push(new URL(String(input)));
        return Response.json({ features: state.features });
    });
    assert.deepEqual(
        await matchMapboxSight(selected, "mapbox-test-secret", async ({ status }) => {
            feedback.push(status);
        }),
        coordinates
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.pathname, "/search/searchbox/v1/forward");
    assert.equal(calls[0]?.searchParams.get("q"), "Musee d'Orsay, Paris");
    assert.equal(calls[0]?.searchParams.get("country"), "fr");
    assert.equal(calls[0]?.searchParams.get("proximity"), "2.3522,48.8566");
    assert.deepEqual(feedback, [200]);
    state.features = [mapboxFeature("Musée d’Orsay cafe", 48.8567), mapboxFeature("Musée d’Orsay", 48.8612)];
    assert.equal(await matchMapboxSight(selected, "mapbox-test-secret"), null);
});
