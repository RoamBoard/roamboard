import { AppError } from "../../shared/app-error.js";
import type { SearchInput, SearchProvider } from "./search.types.js";

export const SEARCH_INDEX = "roamboard-boards-v1";

export function createSearchProvider(): SearchProvider {
    async function request(
        path: string,
        method: string,
        body?: unknown,
        ndjson = false
    ): Promise<Record<string, unknown>> {
        const node = process.env.ELASTICSEARCH_NODE;
        if (!node) throw new AppError(503, "Elasticsearch is not configured", "SEARCH_UNAVAILABLE");
        try {
            const response = await fetch(`${node.replace(/\/$/, "")}/${path}`, {
                method,
                headers: {
                    "Content-Type": ndjson ? "application/x-ndjson" : "application/json",
                    ...(process.env.ELASTIC_API_KEY ? { Authorization: `ApiKey ${process.env.ELASTIC_API_KEY}` } : {})
                },
                body: body === undefined ? undefined : ndjson ? String(body) : JSON.stringify(body),
                signal: AbortSignal.timeout(8000)
            });
            if (response.status === 404 && method === "DELETE") return {};
            const data = (await response.json()) as Record<string, unknown>;
            if (!response.ok || data.errors) throw new Error("Search provider rejected request");
            return data;
        } catch {
            throw new AppError(502, "Elasticsearch could not complete the request", "SEARCH_FAILED");
        }
    }
    const publicFilter = (ids: string[]) => [
        { term: { isPublic: true } },
        { term: { entityType: "itinerary" } },
        { terms: { id: ids } }
    ];
    async function ensureIndex() {
        const node = process.env.ELASTICSEARCH_NODE;
        if (!node) throw new AppError(503, "Elasticsearch is not configured", "SEARCH_UNAVAILABLE");
        // HEAD does not return JSON. Index creation remains explicit and idempotent.
        const response = await fetch(`${node.replace(/\/$/, "")}/${SEARCH_INDEX}`, {
            method: "HEAD",
            signal: AbortSignal.timeout(8000),
            headers: process.env.ELASTIC_API_KEY ? { Authorization: `ApiKey ${process.env.ELASTIC_API_KEY}` } : {}
        }).catch(() => {
            throw new AppError(502, "Elasticsearch is unavailable", "SEARCH_FAILED");
        });
        if (response.ok) return;
        if (response.status !== 404) throw new AppError(502, "Elasticsearch is unavailable", "SEARCH_FAILED");
        await request(SEARCH_INDEX, "PUT", {
            mappings: {
                properties: {
                    id: { type: "keyword" },
                    entityType: { type: "keyword" },
                    title: { type: "text" },
                    titleSuggest: { type: "search_as_you_type" },
                    description: { type: "text" },
                    city: { type: "text" },
                    country: { type: "text" },
                    tags: { type: "keyword" },
                    categories: { type: "keyword" },
                    isPublic: { type: "boolean" },
                    location: { type: "geo_point" },
                    popularity: { type: "float" },
                    updatedAt: { type: "date" }
                }
            }
        });
    }
    return {
        async search(input: SearchInput, publicIds) {
            const filter: unknown[] = publicFilter(publicIds);
            if (input.country) filter.push({ match_phrase: { country: input.country } });
            if (input.category) filter.push({ term: { categories: input.category.toLowerCase() } });
            const result = await request(`${SEARCH_INDEX}/_search`, "POST", {
                from: (input.page - 1) * input.limit,
                size: input.limit,
                track_total_hits: true,
                _source: false,
                query: {
                    bool: {
                        must: {
                            multi_match: {
                                query: input.q,
                                fields: ["title^5", "city^3", "country^2", "tags", "description"],
                                fuzziness: "AUTO"
                            }
                        },
                        filter
                    }
                }
            });
            const hits = result.hits as { hits: Array<{ _id: string; _score: number }>; total: { value: number } };
            return { hits: hits.hits.map((hit) => ({ id: hit._id, score: hit._score })), total: hits.total.value };
        },
        async suggestions(query, limit, publicIds) {
            const result = await request(`${SEARCH_INDEX}/_search`, "POST", {
                size: limit,
                _source: false,
                query: {
                    bool: {
                        must: {
                            multi_match: {
                                query,
                                type: "bool_prefix",
                                fields: ["titleSuggest", "titleSuggest._2gram", "titleSuggest._3gram"]
                            }
                        },
                        filter: publicFilter(publicIds)
                    }
                }
            });
            const hits = result.hits as { hits: Array<{ _id: string }> };
            return [...new Set(hits.hits.map((hit) => hit._id))];
        },
        async replace(documents) {
            await ensureIndex();
            if (documents.length) {
                const body =
                    documents
                        .flatMap((document) => [
                            JSON.stringify({ index: { _index: SEARCH_INDEX, _id: document.id } }),
                            JSON.stringify({ ...document, titleSuggest: document.title })
                        ])
                        .join("\n") + "\n";
                await request("_bulk?refresh=true", "POST", body, true);
            }
            await request(`${SEARCH_INDEX}/_delete_by_query?refresh=true`, "POST", {
                query: { bool: { must_not: { terms: { id: documents.map((document) => document.id) } } } }
            });
        },
        async update(boardId, document) {
            if (!process.env.ELASTICSEARCH_NODE) return;
            if (document) {
                await ensureIndex();
                await request(`${SEARCH_INDEX}/_doc/${boardId}?refresh=true`, "PUT", {
                    ...document,
                    titleSuggest: document.title
                });
            } else await request(`${SEARCH_INDEX}/_doc/${boardId}?refresh=true`, "DELETE");
        }
    };
}
