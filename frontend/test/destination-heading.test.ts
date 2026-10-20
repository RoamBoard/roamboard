import assert from "node:assert/strict";
import test from "node:test";
import { fitDestinationHeading } from "../src/lib/destination-heading";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const graphemes = (value: string) => [...segmenter.segment(value)].map((part) => part.segment);
// Deterministic font metrics stand in for the browser's final uppercase font at 100px,
// including its tracking. Real font metrics and the curved mask are checked in Chrome.
function measure(text: string) {
    return graphemes(text).reduce((width, glyph) => {
        if (/^\s$/u.test(glyph)) return width + 26;
        if (glyph === "W") return width + 90;
        if (glyph === "I") return width + 22;
        if (/\p{Script=Han}/u.test(glyph)) return width + 100;
        if (/\p{Extended_Pictographic}/u.test(glyph)) return width + 95;
        return width + 60;
    }, 0);
}

function fitted(name: string, width: number, height: number) {
    const result = fitDestinationHeading(name, width, height, measure);
    assert.ok(Number.isFinite(result.fontSize) && result.fontSize > 0);
    assert.ok(result.fontSize <= 96);
    assert.ok(result.lines.length >= 1 && result.lines.length <= 3);
    for (const line of result.lines) {
        assert.ok(
            (measure(line) * result.fontSize) / 100 <= width + 0.1,
            `Line escapes ${width}px safe width: ${line}`
        );
    }
    assert.ok(
        result.lines.length * result.fontSize * 0.9 <= height + 0.1,
        "The composed title must fit its vertical budget"
    );
    const actual = result.lines.flatMap(graphemes).filter((glyph) => !/^\s+$/u.test(glyph));
    const expected = graphemes(name.toUpperCase()).filter((glyph) => !/^\s+$/u.test(glyph));
    assert.deepEqual(actual, expected, "Every original grapheme must remain intact, in order, after composition");
    return result;
}

test("Stockholm remains a whole word while Kyoto stays expressive and equal-length glyphs use actual font widths", () => {
    const stockholm = fitted("Stockholm", 150, 110);
    assert.deepEqual(stockholm.lines, ["STOCKHOLM"]);
    const kyoto = fitted("Kyoto", 150, 110);
    assert.deepEqual(kyoto.lines, ["KYOTO"]);
    assert.ok(kyoto.fontSize > stockholm.fontSize);
    const wide = fitted("WWWWWWWW", 220, 120);
    const narrow = fitted("IIIIIIII", 220, 120);
    assert.ok(narrow.fontSize > wide.fontSize, "Character count alone cannot decide these titles' sizes");
});

test("multiword destination names compose on word boundaries and retain diacritics", () => {
    for (const name of ["San Sebastián", "Buenos Aires", "São Tomé", "  San   Sebastián  "]) {
        const result = fitted(name, 140, 120);
        const words = name.trim().toUpperCase().split(/\s+/u);
        for (const word of words)
            assert.ok(
                result.lines.some((line) => line.split(/\s+/u).includes(word)),
                `Keep ${word} intact`
            );
    }
    assert.ok(fitted("San Sebastián", 140, 120).lines.length > 1);
    assert.ok(fitted("Buenos Aires", 140, 120).lines.length > 1);
});

test("long names use a bounded readable composition without an isolated trailing character", () => {
    for (const name of ["Llanfairpwllgwyngyll", "Worcestershirebridge", "San Fernando del Valle de Catamarca"]) {
        const result = fitted(name, 160, 125);
        assert.ok(result.fontSize >= 22, "These fixtures have enough space for a readable multi-line composition");
        assert.ok(result.lines.length > 1);
        for (const line of result.lines)
            assert.ok(graphemes(line.trim()).length > 1, "Avoid orphaned single-glyph lines");
    }
});

test("a long single word uses an expressive two-line desktop lockup unless it already fits at the display maximum", () => {
    const name = "Llanfairpwllgwyngyll";
    const desktop = fitted(name, 360, 220);
    const wholeWordSize = Math.min(96, (360 * 100) / measure(name.toUpperCase()), 220 / 0.9);
    assert.equal(desktop.lines.length, 2);
    assert.ok(
        desktop.fontSize > wholeWordSize * 1.4,
        "The long title must remain expressive instead of becoming a quiet single line"
    );
    const wide = fitted(name, 2000, 220);
    assert.deepEqual(wide.lines, [name.toUpperCase()]);
    assert.equal(wide.fontSize, 96);
});

test("constrained multiword names retain whole words even when their best fit is below the emergency-size threshold", () => {
    for (const name of [
        "San Cristóbal de las Casas",
        "San Fernando del Valle de Catamarca",
        "Santiago de los Caballeros"
    ]) {
        const result = fitted(name, 110, 80);
        assert.ok(result.fontSize < 22, "This fixture must exercise the constrained multiword policy");
        assert.deepEqual(
            result.lines.flatMap((line) => line.split(/\s+/u)),
            name.toUpperCase().split(/\s+/u)
        );
    }
});

test("multiword titles keep connectors with their phrase instead of orphaning them on display lines", () => {
    const connectors = new Set(["AND", "OF", "DE", "DEL", "DA", "DO", "DOS", "DAS"]);
    for (const name of ["São Tomé and Príncipe", "Santiago de Compostela"]) {
        const result = fitted(name, 150, 140);
        assert.deepEqual(
            result.lines.flatMap((line) => line.split(/\s+/u)),
            name.toUpperCase().split(/\s+/u)
        );
        result.lines.forEach((line, index) => {
            const words = line.split(/\s+/u);
            assert.ok(words.length > 1 || !connectors.has(words[0]), "A connector must not occupy its own line");
            if (index < result.lines.length - 1)
                assert.ok(!connectors.has(words.at(-1)!), "A connector must not dangle at a line break");
        });
    }
    assert.deepEqual(fitted("AND", 150, 140).lines, ["AND"], "A complete single-word name must remain valid");
});

test("combining marks, non-Latin text and joined emoji remain whole graphemes across fitting and resizing", () => {
    for (const name of ["Łódź", "San Sebastia\u0301n", "東京", "東京都千代田区丸の内", "เมืองเชียงใหม่", "👨‍👩‍👧‍👦 Bay"]) {
        for (const [width, height] of [
            [150, 105],
            [320, 190],
            [130, 90]
        ])
            fitted(name, width, height);
    }
});

test("safe-frame width and height both constrain fitting as the sidebar and short hero resize", () => {
    const roomy = fitted("Stockholm", 360, 220);
    const sidebar = fitted("Stockholm", 240, 220);
    const short = fitted("Stockholm", 360, 35);
    assert.ok(sidebar.fontSize < roomy.fontSize);
    assert.ok(short.fontSize < roomy.fontSize);
    assert.deepEqual(sidebar.lines, ["STOCKHOLM"]);
    assert.deepEqual(short.lines, ["STOCKHOLM"]);
});

test("unavailable frame dimensions or invalid font metrics cannot produce NaN or infinite sizing", () => {
    for (const [width, height] of [
        [0, 100],
        [100, 0],
        [-1, 100],
        [Number.NaN, 100],
        [100, Number.POSITIVE_INFINITY]
    ]) {
        const result = fitDestinationHeading("Stockholm", width, height, () => {
            assert.fail("Unavailable frames must not trigger font measurements");
        });
        assert.deepEqual(result, { fontSize: 0, lines: ["STOCKHOLM"] });
    }
    assert.deepEqual(fitDestinationHeading("  ", 200, 100, measure), { fontSize: 0, lines: [] });
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
        const result = fitDestinationHeading("Stockholm", 200, 100, () => invalid);
        assert.equal(result.fontSize, 0);
        assert.deepEqual(result.lines, ["STOCKHOLM"]);
    }
});
