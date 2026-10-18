import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { editorialFallback } from "../src/lib/image-library";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlaceDetail } from "../src/components/features/destinations/PlaceDetail";
import {
    destinationPageHref,
    destinationPages,
    findDestinationPage,
    getDestinationPage
} from "../src/data/destination-atlas";
import { findCountry } from "../src/lib/countries";
test("inactive editorial fixtures keep their original identities", () => {
    for (const slug of ["kyoto", "paris", "copenhagen"]) {
        const destination = getDestinationPage(slug);
        assert.ok(destination, `${slug} must have an editorial guide`);
        assert.equal(destination.slug, slug);
    }
    assert.equal(getDestinationPage("not-a-destination"), undefined);
    assert.equal(getDestinationPage(""), undefined);
    assert.equal(new Set(destinationPages.map((destination) => destination.slug)).size, destinationPages.length);
});

test("the inactive editorial lookup retains city and country matching", () => {
    assert.equal(findDestinationPage({ name: "Kyoto", city: "Kyoto", countryCode: "JPN" })?.slug, "kyoto");
    assert.equal(findDestinationPage({ name: "Paris", city: "Paris", countryCode: "FRA" })?.slug, "paris");
    assert.equal(
        findDestinationPage({ name: "Copenhagen", city: "Copenhagen", countryCode: "DNK" })?.slug,
        "copenhagen"
    );
    assert.equal(findDestinationPage({ name: "Paris", city: "Paris", countryCode: "USA" }), undefined);
    assert.equal(findDestinationPage({ name: "Tokyo", city: "Tokyo", countryCode: "JPN" }), undefined);
    assert.equal(findDestinationPage({ name: "Japan", city: null, countryCode: "JPN" }), undefined);
    assert.equal(findDestinationPage({ name: "Kyoto", city: "Osaka", countryCode: "JPN" }), undefined);
    assert.equal(findDestinationPage({ name: "Fushimi Inari", city: "Kyoto", countryCode: "JPN" }), undefined);
    assert.equal(findDestinationPage({ name: "Montmartre", city: "Paris", countryCode: "FRA" }), undefined);
    assert.equal(
        findDestinationPage({ name: "Kyoto", city: "Kyoto", countryCode: "JPN", placeType: "poi" }),
        undefined
    );
    assert.equal(findDestinationPage({ name: "", city: null, countryCode: null }), undefined);
});

test("the inactive editorial lookup retains alias normalization", () => {
    assert.equal(findDestinationPage({ name: "  KYŌTO  ", countryCode: " jpn " })?.slug, "kyoto");
    assert.equal(findDestinationPage({ name: "København", countryCode: "DNK" })?.slug, "copenhagen");
    assert.equal(findDestinationPage({ name: "Kobenhavn", countryCode: "DNK" })?.slug, "copenhagen");
    assert.equal(
        findDestinationPage({ name: "Copenhagen", city: "København", countryCode: "DNK", placeType: "place" })?.slug,
        "copenhagen"
    );
    assert.equal(findDestinationPage({ name: "Paris", countryCode: null }), undefined);
});

test("inactive atlas fixtures retain credited references and separate sample Boards", () => {
    const ids = destinationPages.flatMap((destination) => destination.places.map((place) => place.id));
    assert.equal(new Set(ids).size, ids.length, "Place selection identities must remain unique across guides");
    for (const destination of destinationPages) {
        assert.equal(findCountry(destination.countryCode)?.code, destination.countryCode);
        assert.equal(destinationPageHref(destination), `/discover/destinations/${destination.slug}`);
        assert.ok(destination.places.length >= 3);
        assert.ok(new Set(destination.places.map((place) => place.category)).size >= 3);
        for (const place of destination.places) {
            assert.ok(Number.isFinite(place.coordinates.latitude) && Math.abs(place.coordinates.latitude) <= 90);
            assert.ok(Number.isFinite(place.coordinates.longitude) && Math.abs(place.coordinates.longitude) <= 180);
            assert.ok(place.story && place.note && place.image.alt && place.image.credit);
            assert.equal(new URL(place.sourceUrl).protocol, "https:");
        }
        for (const image of [
            destination.hero,
            destination.closingImage,
            ...destination.places.map((place) => place.image)
        ]) {
            assert.ok(image.src.startsWith("library:"), `${image.src} must use a database reference`);
            const fallback = editorialFallback(image.src);
            assert.ok(
                fallback && existsSync(new URL(`../public${fallback}`, import.meta.url)),
                `${image.src} must retain its original fallback`
            );
            assert.equal(new URL(image.sourceUrl).protocol, "https:");
        }
        assert.ok(destination.relatedBoards.every((board) => !("href" in board) && !("savedCount" in board)));
    }
});

test("immersive details describe the selected place and provide its real visitor, map and photography references", () => {
    for (const destination of destinationPages) {
        for (const place of destination.places) {
            const markup = renderToStaticMarkup(
                createElement(PlaceDetail, { destination, place, onClose: () => {}, onNavigate: () => {} })
            );
            const headingId = markup.match(/<h2[^>]*id="([^"]+)"/)?.[1];
            assert.ok(headingId);
            assert.ok(markup.includes(`aria-labelledby="${headingId}"`));
            assert.match(markup, /<dialog\b/);
            assert.match(markup, /aria-label="Close place details"/);
            assert.ok(markup.includes(place.name));
            assert.ok(markup.includes(place.image.credit));
            assert.ok(markup.includes(`href="${place.sourceUrl}"`));
            assert.ok(markup.includes(`href="${place.image.sourceUrl}"`));
            assert.match(markup, /href="\/boards\/new"/);
            assert.match(markup, /Previous place/);
            assert.match(markup, /Next place/);
            const mapHref = markup.match(/href="(https:\/\/www\.openstreetmap\.org\/[^"]+)"/)?.[1];
            assert.ok(mapHref);
            const map = new URL(mapHref.replaceAll("&amp;", "&"));
            assert.equal(map.searchParams.get("mlat"), String(place.coordinates.latitude));
            assert.equal(map.searchParams.get("mlon"), String(place.coordinates.longitude));
        }
    }
});
