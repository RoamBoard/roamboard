import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { fetchWikipedia, fetchWikivoyageGuide } from "../src/features/destinations/destination.providers.js";

const destination = {
    name: "Paris",
    country: "United States",
    countryCode: "USA",
    latitude: 33.6609,
    longitude: -95.5555
};

function wikivoyage(t: TestContext, extract: string) {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
        Response.json({
            query: {
                pages: [
                    {
                        title: "Paris",
                        extract: "This is the wrong city.",
                        fullurl: "https://en.wikivoyage.org/wiki/Paris",
                        coordinates: [{ lat: 48.8566, lon: 2.3522, primary: true }]
                    },
                    {
                        title: "Paris, Texas",
                        extract,
                        fullurl: "https://en.wikivoyage.org/wiki/Paris,_Texas",
                        coordinates: [{ lat: 33.6609, lon: -95.5555, primary: true }]
                    }
                ]
            }
        });
    t.after(() => {
        globalThis.fetch = original;
    });
}

test("a guide excerpt keeps at most three source sentences from the relevant city and preserves its source", async (t) => {
    wikivoyage(
        t,
        "Paris is a city in Texas. It is in Lamar County. It is the county seat. A fourth sentence must stay in the linked article."
    );
    const article = await fetchWikivoyageGuide(destination);
    assert.ok(article);
    assert.equal(article.title, "Paris, Texas");
    assert.equal(article.url, "https://en.wikivoyage.org/wiki/Paris,_Texas");
    assert.match(
        article.description,
        /^Paris is a city in Texas\. It is in Lamar County\. It is the county seat\.(?:…|\.{3})?$/u
    );
});

test("an oversized first sentence is limited to eighty source words and marked with an ellipsis", async (t) => {
    const words = Array.from({ length: 90 }, (_, index) => `term${index + 1}`);
    wikivoyage(t, `${words.join(" ")}. Another sentence follows.`);
    const article = await fetchWikivoyageGuide(destination);
    assert.ok(article);
    assert.match(article.description, /(?:…|\.{3})$/u);
    assert.equal(article.description.replace(/(?:…|\.{3})$/u, "").trim(), words.slice(0, 80).join(" "));
});

test("the word limit keeps a complete opening sentence when a following sentence would overflow", async (t) => {
    const first = `${Array.from({ length: 60 }, (_, index) => `opening${index + 1}`).join(" ")}.`;
    const second = `${Array.from({ length: 30 }, (_, index) => `Following${index + 1}`).join(" ")}.`;
    wikivoyage(t, `${first} ${second}`);
    const article = await fetchWikivoyageGuide(destination);
    assert.ok(article);
    assert.ok(article.description.startsWith(first));
    assert.doesNotMatch(article.description, /Following1/);
    assert.match(article.description, /(?:…|\.{3})$/u);
    assert.ok(article.description.trim().split(/\s+/).length <= 80);
});

test("a short guide introduction remains unchanged", async (t) => {
    wikivoyage(t, "The original short lead.\nIts second paragraph stays factual.");
    const article = await fetchWikivoyageGuide(destination);
    assert.equal(article?.description, "The original short lead.\nIts second paragraph stays factual.");
});

test("Home context retains its complete Wikipedia lead instead of applying the guide-only limit", async (t) => {
    const lead =
        "The first source sentence. The second source sentence. The third source sentence. The fourth source sentence.";
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
        Response.json({
            query: { pages: [{ title: "Paris", extract: lead, fullurl: "https://en.wikipedia.org/wiki/Paris" }] }
        });
    t.after(() => {
        globalThis.fetch = original;
    });
    assert.equal((await fetchWikipedia("Paris"))?.description, lead);
});
