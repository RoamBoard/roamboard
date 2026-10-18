import assert from "node:assert/strict";
import test from "node:test";
import { destinationSearchHref } from "../src/lib/destination-search";
import type { Destination } from "../src/lib/destinations";

function destinationPath(destination: Destination) {
    return new URL(destinationSearchHref(destination), "https://roamboard.test").pathname;
}

function city(name: string, countryCode: string | null = "PRT"): Destination {
    return {
        id: "mapbox-city-id",
        name,
        address: name,
        latitude: name === "København" ? 55.6761 : name === "Paris" ? 48.8566 : name === "Kyoto" ? 35.0116 : 38.72,
        longitude: name === "København" ? 12.5683 : name === "Paris" ? 2.3522 : name === "Kyoto" ? 135.7681 : -9.14,
        placeType: "place",
        context: [],
        country: null,
        countryCode,
        city: name
    };
}

test("destination search preserves the existing editorial guide routes", () => {
    assert.equal(destinationPath(city("Paris", "FRA")), "/discover/destinations/paris");
    assert.equal(destinationPath(city("Kyoto", "JPN")), "/discover/destinations/kyoto");
    assert.equal(destinationPath(city("København", "DNK")), "/discover/destinations/copenhagen");
});

test("unseen Mapbox cities produce destination URLs without a curated catalog", () => {
    assert.equal(destinationPath(city("Lisbon")), "/discover/destinations/lisbon");
    assert.equal(destinationPath(city("Tórshavn", "FRO")), "/discover/destinations/torshavn");
    assert.equal(destinationPath(city("São José dos Campos", "BRA")), "/discover/destinations/sao-jose-dos-campos");
    assert.equal(
        destinationPath(city("  Saint John's / Newfoundland  ", "CAN")),
        "/discover/destinations/saint-john-s-newfoundland"
    );
});

test("non-Latin city names retain their letters and are encoded into a single destination path segment", () => {
    assert.equal(destinationPath(city("東京", "JPN")), "/discover/destinations/%E6%9D%B1%E4%BA%AC");
    assert.equal(destinationPath(city("Москва", "RUS")), "/discover/destinations/%D0%BC%D0%BE%D1%81%D0%BA%D0%B2%D0%B0");
    const href = destinationPath(city("A/B?C#D", "USA"));
    assert.equal(href, "/discover/destinations/a-b-c-d");
    assert.equal(href.split("/").length, 4);
});

test("guide aliases only use an editorial route when their country and place identity match", () => {
    assert.equal(destinationPath(city("København", "USA")), "/discover/destinations/k%C3%B8benhavn");
    assert.equal(
        destinationPath({ ...city("København", "DNK"), placeType: "poi" }),
        "/discover/destinations/k%C3%B8benhavn"
    );
});
