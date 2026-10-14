import assert from "node:assert/strict";
import test from "node:test";
import { countries, findCountry, suggestCountries } from "../src/lib/countries";

test("the country list contains 249 unique ISO alpha-3 codes", () => {
    assert.equal(countries.length, 249);
    assert.equal(new Set(countries.map((country) => country.code)).size, 249);
    assert.ok(countries.every((country) => /^[A-Z]{3}$/.test(country.code)));
    assert.equal(
        countries.some((country) => country.code === "XKX"),
        false
    );
});

test("country names and alpha-3 inputs resolve to correct ISO codes", () => {
    for (const [name, code] of [
        ["Sweden", "SWE"],
        ["Norway", "NOR"],
        ["Japan", "JPN"],
        ["France", "FRA"],
        ["United Kingdom", "GBR"],
        ["United States", "USA"],
        ["Switzerland", "CHE"],
        ["South Korea", "KOR"]
    ] as const) {
        assert.equal(findCountry(name)?.code, code);
        assert.equal(findCountry(` ${code.toLowerCase()} `)?.code, code);
    }
});

test("existing aliases and fuzzy suggestions continue returning canonical country codes", () => {
    for (const alias of ["Britain", "England", "great britain", "UK"]) {
        assert.equal(findCountry(alias)?.code, "GBR");
    }
    for (const alias of ["America", "United States of America", "USA"]) {
        assert.equal(findCountry(alias)?.code, "USA");
    }
    assert.equal(suggestCountries("Swedn")[0]?.code, "SWE");
    assert.equal(suggestCountries("Switzerlnd")[0]?.code, "CHE");
    assert.deepEqual(suggestCountries(""), []);
    assert.equal(findCountry("not a country"), undefined);
    assert.ok(suggestCountries("united", 2).length <= 2);
});
