import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DestinationRoute, { generateMetadata } from "../src/app/discover/destinations/[slug]/page";
import { DestinationPage } from "../src/components/features/destinations/DestinationPage";
import { PlaceDetail } from "../src/components/features/destinations/PlaceDetail";
import {
    destinationPageHref,
    destinationPages,
    findDestinationPage,
    getDestinationPage
} from "../src/data/destination-atlas";
import { findCountry } from "../src/lib/countries";

test("the approved destination guides resolve directly and unsupported slugs stay unsupported", () => {
    for (const slug of ["kyoto", "paris", "copenhagen"]) {
        const destination = getDestinationPage(slug);
        assert.ok(destination, `${slug} must have an editorial guide`);
        assert.equal(destination.slug, slug);
    }
    assert.equal(getDestinationPage("not-a-destination"), undefined);
    assert.equal(getDestinationPage(""), undefined);
    assert.equal(new Set(destinationPages.map((destination) => destination.slug)).size, destinationPages.length);
});

test("provider search links guides by city and country without redirecting unrelated destinations", () => {
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

test("provider identities support missing city fields, accents, local names and harmless whitespace", () => {
    assert.equal(findDestinationPage({ name: "  KYŌTO  ", countryCode: " jpn " })?.slug, "kyoto");
    assert.equal(findDestinationPage({ name: "København", countryCode: "DNK" })?.slug, "copenhagen");
    assert.equal(findDestinationPage({ name: "Kobenhavn", countryCode: "DNK" })?.slug, "copenhagen");
    assert.equal(
        findDestinationPage({ name: "Copenhagen", city: "København", countryCode: "DNK", placeType: "place" })?.slug,
        "copenhagen"
    );
    assert.equal(findDestinationPage({ name: "Paris", countryCode: null }), undefined);
});

test("guides carry usable, credited place references without pretending their sample Boards are persisted", () => {
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
            assert.ok(existsSync(new URL(`../public${image.src}`, import.meta.url)), `${image.src} must be shipped`);
            assert.equal(new URL(image.sourceUrl).protocol, "https:");
        }
        assert.ok(destination.relatedBoards.every((board) => !("href" in board) && !("savedCount" in board)));
    }
});

function routeDestination(node: ReactNode): { slug: string } | undefined {
    if (!isValidElement<{ destination?: { slug: string }; children?: ReactNode }>(node)) return;
    if (node.props.destination) return node.props.destination;
    return Children.toArray(node.props.children).map(routeDestination).find(Boolean);
}

test("the real destination route mounts each guide and generates matching metadata", async () => {
    for (const slug of ["kyoto", "paris", "copenhagen"]) {
        const params = Promise.resolve({ slug });
        const page = await DestinationRoute({ params });
        assert.equal(routeDestination(page)?.slug, slug);
        const metadata = await generateMetadata({ params });
        assert.match(String(metadata.title), new RegExp(getDestinationPage(slug)!.name, "i"));
        assert.ok(metadata.description);
    }
    assert.match(String((await generateMetadata({ params: Promise.resolve({ slug: "japan" }) })).title), /Japan/);
});

test("unknown destination routes return not-found rather than silently showing another city", async () => {
    await assert.rejects(DestinationRoute({ params: Promise.resolve({ slug: "not-a-destination" }) }), /404/);
    await assert.rejects(generateMetadata({ params: Promise.resolve({ slug: "not-a-destination" }) }), /404/);
});

test("Kyoto's opening preserves the approved about copy, editorial paragraphs and tags", () => {
    const markup = renderToStaticMarkup(createElement(DestinationPage, { destination: getDestinationPage("kyoto")! }));
    const opening = markup.match(/<header\b[^>]*id="guide"[^>]*>([\s\S]*?)<\/header>/)?.[1];
    assert.ok(opening, "Kyoto must retain its opening chapter");
    assert.match(opening, />about</);
    assert.match(opening, />tags</);
    const paragraphs = [
        "Once Japan’s imperial capital, Kyoto is a city where centuries-old temples, peaceful gardens, traditional wooden streets, and vibrant local culture come together. From the historic lanes of Gion to hidden cafés, seasonal landscapes, and renowned cuisine, Kyoto offers a slower, more atmospheric side of Japan while still feeling lively and deeply connected to the present.",
        "Kyoto’s food culture reflects the city itself: thoughtful, seasonal, and deeply rooted in tradition. Meals often celebrate simplicity, allowing a few carefully chosen ingredients to speak for themselves. From refined kaiseki dinners and delicate wagashi sweets to steaming bowls of ramen, tiny izakayas, tofu restaurants and bustling market stalls, eating here can feel as much like discovering the city as visiting its temples.",
        "Tea is woven into everyday life, with matcha appearing everywhere from centuries-old teahouses to contemporary cafés. Around Nishiki Market, narrow passages are filled with pickles, spices, sweets and local specialties, while after dark, lantern-lit streets around Gion and Pontocho reveal intimate restaurants and bars tucked behind wooden façades.",
        "There’s a quietness to Kyoto’s atmosphere that rewards taking your time. Wake early for nearly empty temple grounds, wander residential streets without a destination, stop somewhere small for tea, and let the city unfold between the places you planned to see. Kyoto is often at its most memorable in these slower moments — somewhere between tradition, everyday life and the changing seasons."
    ];
    const renderedParagraphs = Array.from(opening.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g), (match) => match[1]);
    const positions = paragraphs.map((paragraph) => {
        const expected = renderToStaticMarkup(createElement("p", null, paragraph)).slice(3, -4);
        assert.equal(
            renderedParagraphs.filter((actual) => actual === expected).length,
            1,
            `The opening must render this complete approved paragraph exactly once: ${paragraph}`
        );
        return renderedParagraphs.indexOf(expected);
    });
    assert.deepEqual(
        positions,
        [...positions].sort((left, right) => left - right),
        "Editorial copy must keep its reading order"
    );
    for (const tag of ["ancient capital", "autumn colors", "walkable", "slow travel", "food"]) {
        assert.match(opening, new RegExp(`<li[^>]*>${tag}</li>`), `${tag} must remain an opening tag`);
    }
});

test("each guide renders its places and links to the established Board creator", () => {
    for (const destination of destinationPages) {
        const markup = renderToStaticMarkup(createElement(DestinationPage, { destination }));
        assert.match(markup, new RegExp(destination.name, "i"));
        assert.match(markup, /href="\/boards\/new"/);
        for (const place of destination.places) {
            assert.ok(markup.includes(place.name), `${destination.slug} must expose ${place.name} for discovery`);
        }
        assert.doesNotMatch(markup, /saved to your (?:account|board)|added to your board/i);
    }
});

test("each horizontal guide has a keyboard-focusable scroll region and working chapter targets", () => {
    for (const destination of destinationPages) {
        const markup = renderToStaticMarkup(createElement(DestinationPage, { destination }));
        const rail = markup.match(
            new RegExp(`<[^>]+aria-label="${destination.name} horizontal destination guide"[^>]*>`)
        )?.[0];
        assert.ok(rail, "The horizontal browsing region must have an accessible destination-specific name");
        assert.match(rail, /tabindex="0"/);
        for (const chapter of ["guide", "destination-boards", "atlas", "destination-create"]) {
            assert.equal(
                markup.match(new RegExp(`id="${chapter}"`, "g"))?.length,
                1,
                `${destination.slug} must have exactly one ${chapter} target`
            );
            assert.ok(markup.includes(`href="#${chapter}"`), `The ${chapter} chapter must be reachable directly`);
            const target = markup.match(new RegExp(`<[^>]+id="${chapter}"[^>]*>`))?.[0];
            assert.ok(target);
            assert.match(target, /tabindex="-1"/, `${chapter} must accept focus after chapter navigation`);
        }
    }
});

test("each horizontal guide keeps one native position control in its footer", () => {
    for (const destination of destinationPages) {
        const markup = renderToStaticMarkup(createElement(DestinationPage, { destination }));
        const footer = markup.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1];
        assert.ok(footer, `${destination.slug} must retain its guide navigation footer`);
        for (const label of ["Scroll guide left", "Scroll guide right"]) {
            const button = footer.match(new RegExp(`<button[^>]+aria-label="${label}"[^>]*>`))?.[0];
            assert.ok(button, `${label} must be a real button`);
            assert.match(button, /type="button"/);
        }
        const ranges = markup.match(/<input\b[^>]*type="range"[^>]*>/g) ?? [];
        assert.equal(ranges.length, 1, `${destination.slug} must offer exactly one native position slider`);
        const range = ranges[0];
        assert.ok(footer.includes(range), "The position slider must remain in the guide footer");
        assert.match(range, /aria-label="Position in destination guide"/);
        const minimum = Number(range.match(/\bmin="([^"]+)"/)?.[1]);
        const maximum = Number(range.match(/\bmax="([^"]+)"/)?.[1]);
        const position = Number(range.match(/\bvalue="([^"]+)"/)?.[1]);
        assert.ok(Number.isFinite(minimum) && Number.isFinite(maximum) && maximum > minimum);
        assert.ok(position >= minimum && position <= maximum);
    }
});

test("each guide showcases every sample Board with gallery controls and retains its Atlas and creator", () => {
    for (const destination of destinationPages) {
        const markup = renderToStaticMarkup(createElement(DestinationPage, { destination }));
        const boards = markup.match(/<section\b[^>]*id="destination-boards"[^>]*>([\s\S]*?)<\/section>/)?.[1];
        assert.ok(boards);
        assert.ok(boards.includes(`aria-label="${destination.name} sample Boards"`));
        assert.match(boards, /aria-roledescription="carousel"/);
        assert.equal((boards.match(/aria-roledescription="slide"/g) ?? []).length, destination.relatedBoards.length);
        assert.match(boards, /aria-label="Previous slide"/);
        assert.match(boards, /aria-label="Next slide"/);
        assert.match(boards, /Sample Boards/i);
        const slides = boards.match(/<[^>]+aria-roledescription="slide"[^>]*>/g) ?? [];
        assert.ok(
            slides.every((slide) => /role="group"/.test(slide)),
            "Every Board must be an accessible gallery slide"
        );
        assert.doesNotMatch(
            boards,
            /href="\/boards\/(?!new(?:["?#]))/,
            "Sample Boards must not link to invented saved Boards"
        );
        assert.match(markup, /id="atlas"/);
        const creator = markup.match(/<section\b[^>]*id="destination-create"[^>]*>([\s\S]*?)<\/section>/)?.[1];
        assert.ok(creator);
        assert.match(creator, /href="\/boards\/new"/);
        assert.match(creator, /ENTER BOARD CREATOR/);
    }
});

test("focused Board galleries expose an initial selection, direct selection buttons and an announcement", () => {
    for (const destination of destinationPages) {
        const markup = renderToStaticMarkup(createElement(DestinationPage, { destination }));
        const boards = markup.match(/<section\b[^>]*id="destination-boards"[^>]*>([\s\S]*?)<\/section>/)?.[1];
        assert.ok(boards);
        const gallery = boards.match(new RegExp(`<[^>]+aria-label="${destination.name} sample Boards"[^>]*>`))?.[0];
        assert.ok(gallery);
        assert.match(
            gallery,
            /tabindex="0"/,
            "The spatial gallery must accept keyboard focus independently of the rail"
        );
        const buttons = boards.match(/<button\b[^>]*>/g) ?? [];
        const selectionButtons = buttons.filter((button) => /aria-label="Select /.test(button));
        assert.equal(selectionButtons.length, destination.relatedBoards.length);
        assert.equal(selectionButtons.filter((button) => /aria-pressed="true"/.test(button)).length, 1);
        for (const [index, board] of destination.relatedBoards.entries()) {
            const title = renderToStaticMarkup(createElement("span", null, board.title)).slice(6, -7);
            const selection = selectionButtons.find((button) => button.includes(`aria-label="Select ${title}"`));
            assert.ok(selection, `Travelers must be able to choose ${board.title} directly`);
            assert.match(selection, /type="button"/);
            assert.match(selection, new RegExp(`aria-pressed="${index === 0}"`));
        }
        const announcements = Array.from(boards.matchAll(/<[^>]+aria-live="polite"[^>]*>([^<]*)<\/[^>]+>/g));
        const firstTitle = renderToStaticMarkup(createElement("span", null, destination.relatedBoards[0].title)).slice(
            6,
            -7
        );
        assert.ok(
            announcements.some((announcement) => announcement[1].includes(firstTitle)),
            "The selected Board must be announced without requiring users to interpret its spatial position"
        );
    }
});

test("editorial seasons stay separate from the Board gallery and expose their live note", () => {
    for (const destination of destinationPages) {
        const markup = renderToStaticMarkup(createElement(DestinationPage, { destination }));
        const boards = markup.match(/<section\b[^>]*id="destination-boards"[^>]*>([\s\S]*?)<\/section>/)?.[1];
        assert.ok(boards);
        assert.equal(
            /Explore destination seasons|id="destination-season-note"/.test(boards),
            false,
            "Seasonal information must have room outside the Board gallery"
        );
        assert.equal((markup.match(/id="destination-season-note"/g) ?? []).length, 1);
        const note = markup.match(/<p\b[^>]*id="destination-season-note"[^>]*>([\s\S]*?)<\/p>/);
        assert.ok(note, "A seasonal note must remain available alongside the selector");
        assert.match(note[0], /aria-live="polite"/);
        assert.ok(markup.indexOf('id="destination-season-note"') < markup.indexOf('id="atlas"'));
        for (const season of destination.seasons) {
            const label = renderToStaticMarkup(createElement("span", null, season.months)).slice(6, -7);
            const control = Array.from(markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)).find((match) =>
                match[2].replace(/<[^>]*>/g, "").includes(label)
            );
            assert.ok(control, `${season.months} must remain a native button`);
            assert.match(control[1], /aria-controls="destination-season-note"/);
            assert.match(control[1], new RegExp(`aria-pressed="${season === destination.seasons[0]}"`));
        }
        assert.ok(note[1].includes(destination.seasons[0].description));
    }
});

test("destination chapters omit numbered editorial labels", () => {
    for (const destination of destinationPages) {
        const markup = renderToStaticMarkup(createElement(DestinationPage, { destination }));
        assert.equal(
            />\s*0[1-4]\s*\/\s*(?:A sense of place|Other ways to wander|The destination Atlas|Make it yours)\s*</i.test(
                markup
            ),
            false,
            "Editorial sections must flow without the former numbered chapter labels"
        );
    }
});

test("each Atlas exposes destination-specific category filters and accessible place-detail triggers", () => {
    for (const destination of destinationPages) {
        const markup = renderToStaticMarkup(createElement(DestinationPage, { destination }));
        const atlas = markup.match(/<section\b[^>]*id="atlas"[^>]*>([\s\S]*?)<\/section>/)?.[1];
        assert.ok(atlas);
        assert.match(atlas, /aria-label="Filter trending destinations"/);
        const buttons = Array.from(atlas.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g));
        for (const category of ["All discoveries", ...new Set(destination.places.map((place) => place.category))]) {
            const filter = buttons.find((button) =>
                button[2]
                    .replace(/<[^>]*>/g, "")
                    .trim()
                    .startsWith(category)
            );
            assert.ok(filter, `${destination.slug} must expose its ${category} filter as a button`);
            assert.match(filter[1], new RegExp(`aria-pressed="${category === "All discoveries"}"`));
        }
        for (const place of destination.places) {
            const trigger = buttons.find((button) => button[1].includes(`aria-label="Explore ${place.name}"`));
            assert.ok(trigger, `${place.name} must remain discoverable by touch and keyboard`);
            assert.match(trigger[1], /aria-haspopup="dialog"/);
            assert.ok(trigger[2].includes(place.name), "Place names must remain present without hover");
            assert.ok(trigger[2].includes(`alt="${place.image.alt}"`), "Discovery photos need useful alternative text");
        }
    }
});

test("other destination links and photography credits remain in compact guide navigation", () => {
    for (const destination of destinationPages) {
        const markup = renderToStaticMarkup(createElement(DestinationPage, { destination }));
        assert.equal(
            markup.includes('aria-label="More destinations and guide credits"'),
            false,
            "The guide must end after its creator chapter rather than adding a full-screen credits panel"
        );
        const navigation = (markup.match(/<(?:nav|footer)\b[^>]*>[\s\S]*?<\/(?:nav|footer)>/g) ?? []).join("");
        for (const other of destinationPages.filter((item) => item.slug !== destination.slug)) {
            assert.ok(
                navigation.includes(`href="/discover/destinations/${other.slug}"`),
                `${destination.slug} must keep ${other.name} reachable from guide navigation`
            );
        }
        for (const photo of [
            destination.hero,
            destination.closingImage,
            ...destination.places.map((place) => place.image)
        ]) {
            assert.ok(navigation.includes(photo.credit), `${photo.credit} must remain credited`);
            assert.ok(
                navigation.includes(`href="${photo.sourceUrl.replaceAll("&", "&amp;")}"`),
                `${photo.credit} must retain its photography source link`
            );
        }
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
