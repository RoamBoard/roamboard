import type { Client } from "@elastic/elasticsearch";

export const SEARCH_INDEX = "roamboard-search-v1";

export async function ensureSearchIndex(client: Client): Promise<void> {
    const exists = await client.indices.exists({ index: SEARCH_INDEX });

    if (exists) {
        return;
    }

    await client.indices.create({
        index: SEARCH_INDEX,
        settings: {
            analysis: {
                normalizer: {
                    lowercase_normalizer: {
                        type: "custom",
                        filter: ["lowercase"]
                    }
                }
            }
        },
        mappings: {
            dynamic: "strict",
            properties: {
                id: { type: "keyword" },
                entityType: { type: "keyword" },
                title: { type: "text", fields: { keyword: { type: "keyword" } } },
                titleSuggest: { type: "search_as_you_type" },
                description: { type: "text" },
                city: {
                    type: "text",
                    fields: { keyword: { type: "keyword", normalizer: "lowercase_normalizer" } }
                },
                country: {
                    type: "text",
                    fields: { keyword: { type: "keyword", normalizer: "lowercase_normalizer" } }
                },
                tags: { type: "keyword" },
                categories: { type: "keyword" },
                location: { type: "geo_point" },
                popularity: { type: "float" },
                isPublic: { type: "boolean" },
                updatedAt: { type: "date" }
            }
        }
    });
}
