import assert from "node:assert/strict";
import test from "node:test";

test("API-backed feature boundaries use the configured backend and signed-in session", async (t) => {
    const originalOrigin = process.env.NEXT_PUBLIC_API_URL;
    const originalFetch = globalThis.fetch;
    process.env.NEXT_PUBLIC_API_URL = "https://api.roamboard.test";
    const providers = await import("../src/lib/providers");
    const destinations = await import("../src/lib/destinations");
    const search = await import("../src/lib/search");
    const boards = await import("../src/lib/boards");
    const profile = await import("../src/lib/profile");
    const calls: Array<{ url: URL; init?: RequestInit }> = [];
    const response = { data: {} as unknown, status: 200 };
    globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        calls.push({ url, init });
        assert.equal(url.origin, "https://api.roamboard.test");
        assert.equal(init?.credentials, "include");
        assert.equal(new Headers(init?.headers).has("x-user-id"), false);
        return response.status === 204
            ? new Response(null, { status: 204 })
            : Response.json(response.data, { status: response.status });
    };
    try {
        await t.test("provider searches preserve special characters and unwrap results", async () => {
            const places = [{ id: "city-1", name: "Paris" }];
            response.data = { data: places };
            assert.deepEqual(await providers.searchBoardLocationProvider("café & museum"), places);
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/providers/locations/search");
            assert.equal(calls.at(-1)?.url.searchParams.get("q"), "café & museum");
            await providers.loadMapboxMapSession();
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/providers/mapbox/map-session");
            assert.equal(calls.at(-1)?.init?.method, "POST");
        });

        await t.test("Home destination search and context forward cancellation and coordinates", async () => {
            const controller = new AbortController();
            response.data = { data: [] };
            assert.deepEqual(await destinations.searchDestinations("New York", controller.signal), []);
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/destinations/search");
            assert.equal(calls.at(-1)?.url.searchParams.get("q"), "New York");
            assert.equal(calls.at(-1)?.init?.signal, controller.signal);
            const destination = {
                id: "nyc",
                name: "New York",
                address: "NY, US",
                latitude: 40.71,
                longitude: -74,
                placeType: "city",
                context: [],
                country: "United States",
                countryCode: "USA",
                city: "New York"
            };
            response.data = { data: { destination, unavailable: ["weather"] } };
            const result = await destinations.loadDestinationContext(destination, controller.signal);
            assert.deepEqual(result.unavailable, ["weather"]);
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/destinations/context");
            assert.equal(calls.at(-1)?.url.searchParams.get("longitude"), "-74");
        });

        await t.test("search preserves filters and suggestions cancellation", async () => {
            const result = { hits: [], total: 0, page: 1, limit: 10 };
            response.data = { data: result };
            assert.deepEqual(
                await search.searchIndex("art & food", {
                    entityType: "itinerary",
                    country: "Sweden",
                    category: "museum"
                }),
                result
            );
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/search");
            assert.equal(calls.at(-1)?.url.searchParams.get("q"), "art & food");
            assert.equal(calls.at(-1)?.url.searchParams.get("country"), "Sweden");
            assert.equal(calls.at(-1)?.url.searchParams.get("category"), "museum");
            const controller = new AbortController();
            response.data = { data: ["Stockholm"] };
            assert.deepEqual(await search.suggestIndex("Sto", controller.signal), ["Stockholm"]);
            assert.equal(calls.at(-1)?.init?.signal, controller.signal);
        });

        await t.test("developer Board browsing retains numeric IDs and pagination", async () => {
            const page = { data: [{ boardId: 42, title: "Trip" }], meta: { page: 2, limit: 20, hasMore: true } };
            response.data = page;
            assert.deepEqual(await boards.listBoards(2), page);
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/dev/boards");
            assert.equal(calls.at(-1)?.url.searchParams.get("page"), "2");
            response.status = 204;
            await boards.deleteBoard(42);
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/boards/42");
            assert.equal(calls.at(-1)?.init?.method, "DELETE");
            response.status = 200;
        });

        await t.test("profile picture references an uploaded image ID without arbitrary URLs", async () => {
            response.data = { data: { profilePicture: { imageId: 17 } } };
            await profile.setProfilePicture(17);
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/users/me/profile-picture");
            assert.equal(calls.at(-1)?.init?.method, "PUT");
            assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { imageId: 17 });
        });

        await t.test("profile save, language choices and saved Boards use the contract endpoints", async () => {
            const changes = {
                revision: 4,
                username: "traveler",
                displayName: "Traveler",
                description: "Hello",
                location: null,
                occupation: null,
                languages: ["Swedish"],
                interests: [],
                defaultBoardVisibility: "friends" as const
            };
            response.data = { data: { ...changes, revision: 5, profilePicture: null } };
            await profile.updateProfile(changes);
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/users/me");
            assert.equal(calls.at(-1)?.init?.method, "PATCH");
            assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), changes);
            response.data = { data: ["Swedish", "English"] };
            assert.deepEqual(await profile.loadLanguages(), ["Swedish", "English"]);
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/languages");
            response.data = { data: [{ boardId: 42 }], meta: { page: 1, limit: 3, hasMore: false } };
            assert.equal((await profile.loadSavedBoardsPage(1, 3)).meta?.hasMore, false);
            assert.equal(calls.at(-1)?.url.searchParams.get("limit"), "3");
            response.data = { data: { boardId: 42, saved: true } };
            await profile.saveBoardBookmark(42);
            assert.equal(calls.at(-1)?.init?.method, "PUT");
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/boards/42/save");
            response.status = 204;
            await profile.unsaveBoardBookmark(42);
            assert.equal(calls.at(-1)?.init?.method, "DELETE");
            response.status = 200;
        });

        await t.test("profile Board creation persists a canonical published Board with city activities", async () => {
            response.data = { data: { boardId: 53 } };
            await profile.createBoard({
                title: "Nordic trip",
                isCompleted: true,
                destinations: [
                    { country: "Sweden", countryCode: "SWE", city: "Stockholm", latitude: 59.33, longitude: 18.07 },
                    { country: "Norway", countryCode: "NOR", city: "Oslo", latitude: 59.91, longitude: 10.75 }
                ]
            });
            assert.equal(calls.at(-1)?.url.pathname, "/api/v1/boards");
            assert.equal(calls.at(-1)?.init?.method, "POST");
            const document = JSON.parse(String(calls.at(-1)?.init?.body));
            assert.equal(document.title, "Nordic trip");
            assert.equal(document.status, "published");
            assert.equal(document.visibility, "collaborators");
            assert.equal(document.isCompleted, true);
            assert.deepEqual(document.imageIds, []);
            assert.equal(document.days[0].dayNumber, 1);
            assert.deepEqual(
                document.days[0].activities.map((activity: { location: { city: string }; position: number }) => [
                    activity.location.city,
                    activity.position
                ]),
                [
                    ["Stockholm", 0],
                    ["Oslo", 1]
                ]
            );
            assert.equal(document.days[0].activities[0].location.latitude, 59.33);
            assert.equal(document.days[0].activities[0].locationConfirmed, true);
            assert.equal(document.days[0].activities[0].source, "geoapify");
            assert.equal("destinations" in document, false);
        });

        await t.test("authorization, quota and provider failures reject instead of reporting success", async () => {
            for (const status of [401, 403, 429, 503]) {
                response.status = status;
                response.data = { error: { code: "UNAVAILABLE", message: `Request denied (${status})` } };
                await assert.rejects(providers.loadProviderConfig(), new RegExp(`Request denied \\(${status}\\)`));
                await assert.rejects(destinations.searchDestinations("Paris"), /Request denied/);
                await assert.rejects(
                    search.searchIndex("Paris", { entityType: "", country: "", category: "" }),
                    /Request denied/
                );
                await assert.rejects(profile.setProfilePicture(17), /Request denied/);
            }
        });
    } finally {
        globalThis.fetch = originalFetch;
        if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_API_URL;
        else process.env.NEXT_PUBLIC_API_URL = originalOrigin;
    }
});
