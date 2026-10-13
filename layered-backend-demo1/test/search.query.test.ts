import assert from "node:assert/strict";
import test from "node:test";

import { buildSearchQuery, buildSuggestionQuery } from "../src/features/search/search.query.js";

test("builds fuzzy search with boosts, public visibility, filters, and popularity scoring", () => {
  const query = buildSearchQuery({
    query: "stokholm",
    entityType: "destination",
    country: "sweden",
    category: "culture",
    page: 1,
    limit: 10,
  });
  const serialized = JSON.stringify(query);

  assert.match(serialized, /multi_match/);
  assert.match(serialized, /AUTO/);
  assert.match(serialized, /title\^5/);
  assert.match(serialized, /city\^3/);
  assert.match(serialized, /country\^2/);
  assert.match(serialized, /categories/);
  assert.match(serialized, /isPublic/);
  assert.match(serialized, /field_value_factor/);
  assert.match(serialized, /log1p/);
});

test("builds search-as-you-type bool_prefix autocomplete", () => {
  const query = buildSuggestionQuery("sto");
  const serialized = JSON.stringify(query);

  assert.match(serialized, /bool_prefix/);
  assert.match(serialized, /titleSuggest/);
  assert.match(serialized, /isPublic/);
});