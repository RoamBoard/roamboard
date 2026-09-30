import type { Client } from "@elastic/elasticsearch";

import { ensureSearchIndex, SEARCH_INDEX } from "./search.index.js";
import { buildSearchQuery, buildSuggestionQuery } from "./search.query.js";
import type {
  SearchDocument,
  SearchInput,
  SearchResult,
  SearchSourceRepository,
} from "./search.types.js";

export interface SearchService {
  ensureIndex(): Promise<void>;
  reindex(): Promise<number>;
  search(input: SearchInput): Promise<SearchResult>;
  suggestions(query: string, limit: number): Promise<string[]>;
  isReady(): Promise<boolean>;
}

export function createSearchService(
  client: Client,
  sourceRepository: SearchSourceRepository,
): SearchService {
  async function ensureIndex(): Promise<void> {
    await ensureSearchIndex(client);
  }

  async function reindex(): Promise<number> {
    const documents = (await sourceRepository.findAll()).filter((document) => document.isPublic);
    if (await client.indices.exists({ index: SEARCH_INDEX })) {
      await client.indices.delete({ index: SEARCH_INDEX });
    }
    await ensureIndex();

    if (documents.length === 0) {
      return 0;
    }

    const operations = documents.flatMap((document) => [
      { index: { _index: SEARCH_INDEX, _id: document.id } },
      document,
    ]);
    const response = await client.bulk({ operations, refresh: "wait_for" });

    if (response.errors) {
      throw new Error("Elasticsearch bulk reindex failed");
    }

    return documents.length;
  }

  async function search(input: SearchInput): Promise<SearchResult> {
    const response = await client.search<SearchDocument>({
      index: SEARCH_INDEX,
      query: buildSearchQuery(input),
      from: (input.page - 1) * input.limit,
      size: input.limit,
      track_total_hits: true,
    });
    const total = typeof response.hits.total === "number"
      ? response.hits.total
      : response.hits.total?.value ?? 0;

    return {
      hits: response.hits.hits.flatMap((hit) =>
        hit._source
          ? [{ document: hit._source, score: hit._score ?? 0 }]
          : [],
      ),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async function suggestions(query: string, limit: number): Promise<string[]> {
    const response = await client.search<SearchDocument>({
      index: SEARCH_INDEX,
      query: buildSuggestionQuery(query),
      size: limit,
      _source: ["title"],
    });

    return response.hits.hits.flatMap((hit) =>
      hit._source?.title ? [hit._source.title] : [],
    );
  }

  async function isReady(): Promise<boolean> {
    try {
      await client.cluster.health();
      return true;
    } catch {
      return false;
    }
  }

  return { ensureIndex, reindex, search, suggestions, isReady };
}
