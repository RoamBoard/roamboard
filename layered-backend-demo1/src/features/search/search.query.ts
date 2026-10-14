import type { estypes } from "@elastic/elasticsearch";

import type { SearchInput } from "./search.types.js";

export function buildSearchQuery(input: SearchInput): estypes.QueryDslQueryContainer {
    const filters: estypes.QueryDslQueryContainer[] = [{ term: { isPublic: true } }];

    if (input.entityType) {
        filters.push({ term: { entityType: input.entityType } });
    }

    if (input.country) {
        filters.push({ term: { "country.keyword": input.country.toLowerCase() } });
    }

    if (input.category) {
        filters.push({ term: { categories: input.category.toLowerCase() } });
    }

    return {
        function_score: {
            query: {
                bool: {
                    must: {
                        multi_match: {
                            query: input.query,
                            fields: ["title^5", "city^3", "country^2", "tags^1.5", "description"],
                            fuzziness: "AUTO"
                        }
                    },
                    filter: filters
                }
            },
            functions: [
                {
                    field_value_factor: {
                        field: "popularity",
                        modifier: "log1p",
                        factor: 0.1,
                        missing: 0
                    }
                }
            ],
            boost_mode: "sum"
        }
    };
}

export function buildSuggestionQuery(query: string): estypes.QueryDslQueryContainer {
    return {
        bool: {
            must: {
                multi_match: {
                    query,
                    type: "bool_prefix",
                    fields: ["titleSuggest", "titleSuggest._2gram", "titleSuggest._3gram"]
                }
            },
            filter: [{ term: { isPublic: true } }]
        }
    };
}
