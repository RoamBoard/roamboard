import assert from "node:assert/strict";
import test from "node:test";
import { suggestActivityArea } from "../src/features/providers/provider.area-suggestion.js";
test("a clear group of Bali activities suggests a region while scattered trips stay undecided", async () => {
    const bali = [
        { latitude: -8.82, longitude: 115.09, city: "Uluwatu", country: "IDN" },
        { latitude: -8.77, longitude: 115.17, city: "Jimbaran", country: "IDN" },
        { latitude: -8.65, longitude: 115.13, city: "Canggu", country: "IDN" }
    ];
    const calls: Array<string> = [];
    const result = await suggestActivityArea(
        { points: [...bali, { latitude: 48.85, longitude: 2.29, city: "Paris", country: "FRA" }] },
        async (point, type) => {
            calls.push(type);
            assert.equal(point.country, "IDN");
            return {
                id: "geoapify:bali",
                name: "Bali",
                address: "Bali, Indonesia",
                latitude: -8.4,
                longitude: 115.2,
                placeType: "state",
                context: ["Indonesia"],
                country: "Indonesia",
                countryCode: "IDN",
                city: null
            };
        }
    );
    assert.equal(result?.name, "Bali");
    assert.deepEqual(calls, ["state"]);
    const none = await suggestActivityArea(
        { points: [bali[0]!, { latitude: 48.85, longitude: 2.29 }, { latitude: 59.33, longitude: 18.06 }] },
        async () => {
            throw new Error("No provider call for ambiguous trips");
        }
    );
    assert.equal(none, null);
});
