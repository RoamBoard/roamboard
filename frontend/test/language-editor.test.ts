import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LanguageEditor, { rankLanguageChoices } from "@/components/features/settings/LanguageEditor";

test("LanguageEditor renders heading, selected languages, and counter", () => {
    const html = renderToStaticMarkup(
        createElement(LanguageEditor, {
            languages: ["English", "Spanish"],
            onChangeLanguages: () => {},
            choices: ["English", "Spanish", "French", "German"],
            maxLanguages: 10
        })
    );

    assert.ok(html.includes("Languages Spoken"));
    assert.ok(html.includes("(2/10)"));
    assert.ok(html.includes("English"));
    assert.ok(html.includes("Spanish"));
    assert.ok(html.includes("Remove English"));
    assert.ok(html.includes("Remove Spanish"));
});

test("LanguageEditor renders search input with accessible combobox role", () => {
    const html = renderToStaticMarkup(
        createElement(LanguageEditor, {
            languages: ["English"],
            onChangeLanguages: () => {},
            choices: ["English", "Spanish", "French"],
            maxLanguages: 10
        })
    );

    assert.ok(html.includes('role="combobox"'));
    assert.ok(html.includes('placeholder="Search language to add…"'));
    assert.ok(html.includes('aria-label="Open suggestions"'));
});

test("LanguageEditor disables input when maximum languages limit is reached", () => {
    const html = renderToStaticMarkup(
        createElement(LanguageEditor, {
            languages: ["English", "Spanish"],
            onChangeLanguages: () => {},
            choices: ["English", "Spanish", "French", "German"],
            maxLanguages: 2
        })
    );

    assert.ok(html.includes("(2/2)"));
    assert.ok(html.includes("Maximum of 2 languages reached."));
    assert.ok(html.includes("Limit reached (2 max)"));
    assert.ok(html.includes("disabled"));
});

test("rankLanguageChoices prioritizes prefix matches over substring matches", () => {
    const choices = ["Esperanto", "Filipino", "Japanese", "Pashto", "Persian", "Polish", "Portuguese"];
    const ranked = rankLanguageChoices(choices, "p");

    assert.equal(ranked[0], "Pashto");
    assert.equal(ranked[1], "Persian");
    assert.equal(ranked[2], "Polish");
    assert.equal(ranked[3], "Portuguese");
    assert.ok(ranked.indexOf("Portuguese") < ranked.indexOf("Japanese"));
    assert.ok(ranked.indexOf("Polish") < ranked.indexOf("Japanese"));
});

test("rankLanguageChoices excludes already selected languages and matches word starts", () => {
    const choices = ["English", "Mandarin Chinese", "Cantonese"];
    const ranked = rankLanguageChoices(choices, "chi", ["English"]);

    assert.ok(!ranked.includes("English"));
    assert.equal(ranked[0], "Mandarin Chinese");
});
