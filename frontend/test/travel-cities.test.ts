import assert from "node:assert/strict";
import test from "node:test";
import { destinationSearchHref } from "../src/lib/destination-search";
import type { Destination } from "../src/lib/destinations";

function city(name: string, countryCode: string | null = "PRT"): Destination {
    return {
        id: "mapbox-city-id",
        name,
        address: name,
        latitude: 38.72,
        longitude: -9.14,
        placeType: "place",
        context: [],
        country: null,
        countryCode,
        city: name
    };
}

test("destination search preserves the existing editorial guide routes", () => {
    assert.equal(destinationSearchHref(city("Paris", "FRA")), "/discover/destinations/paris");
    assert.equal(destinationSearchHref(city("Kyoto", "JPN")), "/discover/destinations/kyoto");
    assert.equal(destinationSearchHref(city("København", "DNK")), "/discover/destinations/copenhagen");
});

test("unseen Mapbox cities produce destination URLs without a curated catalog", () => {
    assert.equal(destinationSearchHref(city("Lisbon")), "/discover/destinations/lisbon");
    assert.equal(destinationSearchHref(city("Tórshavn", "FRO")), "/discover/destinations/torshavn");
    assert.equal(
        destinationSearchHref(city("São José dos Campos", "BRA")),
        "/discover/destinations/sao-jose-dos-campos"
    );
    assert.equal(
        destinationSearchHref(city("  Saint John's / Newfoundland  ", "CAN")),
        "/discover/destinations/saint-john-s-newfoundland"
    );
});

test("non-Latin city names retain their letters and are encoded into a single destination path segment", () => {
    assert.equal(destinationSearchHref(city("東京", "JPN")), "/discover/destinations/%E6%9D%B1%E4%BA%AC");
    assert.equal(
        destinationSearchHref(city("Москва", "RUS")),
        "/discover/destinations/%D0%BC%D0%BE%D1%81%D0%BA%D0%B2%D0%B0"
    );
    const href = destinationSearchHref(city("A/B?C#D", "USA"));
    assert.equal(href, "/discover/destinations/a-b-c-d");
    assert.equal(href.split("/").length, 4);
});

test("guide aliases only use an editorial route when their country and place identity match", () => {
    assert.equal(destinationSearchHref(city("København", "USA")), "/discover/destinations/k%C3%B8benhavn");
    assert.equal(
        destinationSearchHref({ ...city("København", "DNK"), placeType: "poi" }),
        "/discover/destinations/k%C3%B8benhavn"
    );
});
