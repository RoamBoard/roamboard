import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import ProfileHero from "../src/components/features/profile/ProfileHero";
import ProfileIdentityText from "../src/components/features/profile/ProfileIdentityText";
import { VisitorProfileContent } from "../src/components/features/profile/HandleProfileContent";
import type { PublicProfile, PublicProfileView } from "../src/lib/profile";

type Props = { children?: ReactNode; className?: string; [key: string]: unknown };

function nodes(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(nodes)];
}

function textContent(node: ReactNode): string {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(textContent).join("");
    if (!isValidElement<Props>(node)) return "";
    if (node.type === ProfileIdentityText) return textContent(ProfileIdentityText({ text: String(node.props.text) }));
    return textContent(node.props.children);
}

function profile(displayName: string, username = "traveler"): PublicProfile {
    return {
        displayName,
        username,
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture: null
    };
}

const stylesheet = new URL("../src/app/globals.css", import.meta.url);
const require = createRequire(import.meta.url);

async function generatedUtility(candidate: string) {
    const compiler = await compile(await readFile(stylesheet, "utf8"), {
        base: dirname(stylesheet.pathname),
        loadStylesheet: async (id, base) => {
            const path = id === "tailwindcss" ? require.resolve("tailwindcss/index.css") : resolve(base, id);
            return { path, base: dirname(path), content: await readFile(path, "utf8") };
        }
    });
    const baseline = compiler.build([]);
    const generated = compiler.build([candidate]);
    const fontSizes = (css: string) => [...css.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1]);
    const baselineSizes = fontSizes(baseline);
    return fontSizes(generated).filter((size, index) => index >= baselineSizes.length);
}

// Compile the utilities emitted by the real component against the actual stylesheet.
// This catches a missing design token rather than prescribing a particular class name.
test("all display-name length boundaries emit real display-size CSS and retain the complete identity", async () => {
    const names = [
        "Adam",
        ...[10, 11, 16, 17, 24, 25].map((length) => "W".repeat(length)),
        "Élodie García",
        "旅人世界旅行記",
        "a_name_with_underscores",
        "E\u0301lodie García 👩🏽‍💻",
        "Alexandra María de la Cruz"
    ];
    for (const displayName of names) {
        for (const isOwner of [false, true]) {
            const captured: { tree: ReactNode } = { tree: null };
            function Probe() {
                captured.tree = ProfileHero({ profile: profile(displayName), stats: null, isOwner });
                return captured.tree;
            }
            renderToStaticMarkup(createElement(Probe));
            const heading = nodes(captured.tree).find((node) => node.type === "h2");
            assert.ok(heading);
            assert.equal(textContent(heading.props.children), displayName);
            assert.equal(heading.props["aria-hidden"], undefined);
            assert.equal(heading.props["aria-label"] ?? textContent(heading.props.children), displayName);
            const sizes = heading.props.className?.split(/\s+/).filter((token) => /(?:^|:)text-(?:\d|\[)/.test(token));
            assert.ok(sizes?.length, `${displayName} needs an explicit display font size`);
            for (const candidate of sizes) {
                const declarations = await generatedUtility(candidate);
                assert.ok(declarations.length > 0, `${displayName}: ${candidate} must generate font-size CSS`);
                for (const declaration of declarations) {
                    const remMinimum = declaration.match(/^(?:clamp\()?([\d.]+)rem/);
                    assert.ok(remMinimum, `${displayName}: emitted size must retain an explicit display-scale minimum`);
                    assert.ok(
                        Number(remMinimum[1]) >= 1.75,
                        `${displayName} must not fall back to ordinary body-size type`
                    );
                }
            }
        }
    }
});

test("identity wrap opportunities preserve complete Unicode graphemes without leaving a one-glyph final chunk", () => {
    const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const identity of ["W".repeat(11), "W".repeat(25), "E\u0301".repeat(11), "👩🏽‍💻".repeat(13)]) {
        const rendered = renderToStaticMarkup(createElement(ProfileIdentityText, { text: identity }));
        const chunks = rendered.split(/<wbr\s*\/>/);
        assert.ok(chunks.length > 1, "A long unbroken identity needs ordinary wrapping opportunities");
        assert.equal(chunks.join(""), identity, "Soft breaks must not change the visible identity");
        const originalGlyphs = Array.from(graphemes.segment(identity), ({ segment }) => segment);
        const chunkGlyphs = chunks.map((chunk) => Array.from(graphemes.segment(chunk), ({ segment }) => segment));
        assert.deepEqual(chunkGlyphs.flat(), originalGlyphs, "No break may split a combining accent or emoji sequence");
        assert.ok(
            chunkGlyphs.every((chunk) => chunk.length >= 2),
            "Long identity runs must not introduce singleton chunks"
        );
    }
});

test("identity wrapping prefers existing word and handle separators without inserting visible punctuation", () => {
    const identity = "Élodie García_rowan.mercer-traveler";
    const rendered = renderToStaticMarkup(createElement(ProfileIdentityText, { text: identity }));
    assert.deepEqual(rendered.split(/<wbr\s*\/>/), ["Élodie ", "García_", "rowan.", "mercer-", "traveler"]);
});

test("separator accents stay attached to their complete grapheme at wrap boundaries", () => {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const separator of [".", "_", "-", " "]) {
        const identity = `Alex${separator}\u0301Rowan`;
        const rendered = renderToStaticMarkup(createElement(ProfileIdentityText, { text: identity }));
        const chunks = rendered.split(/<wbr\s*\/>/);
        assert.deepEqual(chunks, [`Alex${separator}\u0301`, "Rowan"]);
        const graphemes = (value: string) => Array.from(segmenter.segment(value), ({ segment }) => segment);
        assert.deepEqual(chunks.flatMap(graphemes), graphemes(identity));
        assert.equal(chunks.join(""), identity);
    }
});

test("public handle heading retains the complete identifier without restoring removed profile labels", () => {
    for (const username of ["ada", "rowan.mercer", "a_long_handle_with_underscores_123", "W".repeat(64)]) {
        const view: PublicProfileView = {
            profile: profile("Ada Lovelace", username),
            isOwner: false,
            stats: {
                countriesVisited: 0,
                citiesExplored: 0,
                continentsCovered: 0,
                photosUploaded: 0,
                activitiesDone: 0,
                boardsCreated: 0,
                friends: 0,
                activitiesSaved: 0,
                boardsSaved: 0
            },
            boards: [],
            destinations: []
        };
        const tree = VisitorProfileContent({ view });
        const headings = nodes(tree).filter((node) => node.type === "h1");
        assert.equal(headings.length, 1);
        assert.equal(textContent(headings[0].props.children), `@${username}`);
        assert.equal(headings[0].props["aria-hidden"], undefined);
        assert.equal(headings[0].props["aria-label"] ?? textContent(headings[0].props.children), `@${username}`);
        const hero = renderToStaticMarkup(
            createElement(ProfileHero, { profile: view.profile, stats: null, isOwner: false })
        );
        assert.doesNotMatch(hero, />based in<|>PROFILE<|>ACCOUNT</);
    }
});
