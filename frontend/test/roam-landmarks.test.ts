import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { roamLandmarks } from "../src/lib/roam-landmarks";
import { loadLandmark } from "../src/components/features/destinations/landmarks/collection";
import { Drawing } from "../src/components/features/destinations/landmarks/Drawing";

const requestedCollection = {
    Paris: "Eiffel Tower",
    Kyoto: "Yasaka Pagoda",
    Tokyo: "Tokyo Tower",
    Rome: "Colosseum",
    London: "Tower Bridge",
    "New York": "Chrysler Building",
    Barcelona: "Sagrada Família",
    Amsterdam: "Canal houses",
    Copenhagen: "Nyhavn waterfront houses",
    Istanbul: "Hagia Sophia",
    Bangkok: "Wat Arun",
    Singapore: "Marina Bay Sands",
    Dubai: "Burj Khalifa",
    Sydney: "Sydney Opera House",
    "Hong Kong": "Bank of China Tower",
    Seoul: "Gyeongbokgung Palace",
    Florence: "Florence Cathedral",
    Venice: "Rialto Bridge",
    Prague: "Charles Bridge",
    Vienna: "Schönbrunn Palace",
    Budapest: "Hungarian Parliament Building",
    Lisbon: "Belém Tower",
    Berlin: "Brandenburg Gate",
    Athens: "Parthenon",
    Marrakech: "Koutoubia Mosque",
    Cairo: "Pyramids of Giza",
    "Rio de Janeiro": "Christ the Redeemer",
    "Buenos Aires": "Obelisco",
    "Mexico City": "Palacio de Bellas Artes",
    Stockholm: "Stockholm City Hall"
};

test("the editorial collection contains all thirty requested city and landmark pairings exactly once", () => {
    assert.equal(roamLandmarks.length, 30);
    assert.equal(new Set(roamLandmarks.map(({ id }) => id)).size, 30);
    assert.equal(new Set(roamLandmarks.map(({ city }) => city)).size, 30);
    assert.deepEqual(
        Object.fromEntries(roamLandmarks.map(({ city, landmark }) => [city, landmark])),
        requestedCollection
    );
    roamLandmarks.forEach(({ id }) => assert.ok(id.trim().length > 0));
});

test("the collection offers distinct architectural silhouettes for the curator to alternate", () => {
    const silhouettes = new Set(["tower", "dome", "horizontal", "bridge", "sculpture"]);
    roamLandmarks.forEach(({ silhouette }) => assert.ok(silhouettes.has(silhouette)));
    assert.deepEqual(new Set(roamLandmarks.map(({ silhouette }) => silhouette)), silhouettes);
});

test("every lazy illustration loads and renders distinct decorative line art without visible typography", async () => {
    const studies = await Promise.all(
        roamLandmarks.map(async (landmark) => ({ landmark, study: await loadLandmark(landmark.id) }))
    );
    const geometries = new Set<string>();
    studies.forEach(({ landmark, study }) => {
        const html = renderToStaticMarkup(createElement(Drawing, { study, drawSeconds: 4 }));
        assert.match(html, /^<svg\b/, `${landmark.city} must render its real SVG`);
        assert.match(html, /aria-hidden="true"/, "ambient art must stay outside the accessibility tree");
        assert.match(html, /fill="none"/, "the drawing preserves its thin-line treatment");
        assert.doesNotMatch(
            html,
            /<(?:text|tspan|foreignObject)\b/i,
            `${landmark.city} should have no visible city lettering`
        );
        const paths = Array.from(html.matchAll(/\sd="([^"]+)"/g), ([, path]) => path);
        assert.ok(paths.length > 0, `${landmark.landmark} must contain actual architectural paths`);
        paths.forEach((path) => assert.doesNotMatch(path, /\b(?:NaN|Infinity|undefined)\b/));
        geometries.add(paths.join("|"));
        study.strokes.forEach((stroke) => {
            assert.ok(Number.isFinite(stroke.phase ?? 0) && (stroke.phase ?? 0) >= 0);
            assert.ok(Number.isFinite(stroke.duration ?? 0.7) && (stroke.duration ?? 0.7) > 0);
        });
    });
    assert.equal(geometries.size, 30, "each destination needs its own drawing rather than sharing a generic icon");
});
