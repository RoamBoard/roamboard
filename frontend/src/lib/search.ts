export type SearchDocument = {
    id: string;
    entityType: "destination" | "place" | "itinerary";
    title: string;
    description: string;
    city: string;
    country: string;
    tags: string[];
    categories: string[];
    location: { lat: number; lon: number };
    popularity: number;
    isPublic: boolean;
    updatedAt: string;
};

export type SearchResult = {
    hits: Array<{ document: SearchDocument; score: number }>;
    total: number;
    page: number;
    limit: number;
};

const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function read<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiOrigin}${path}`, init);
    const body = (await response.json()) as {
        data?: T;
        error?: { message?: string };
    };
    if (!response.ok || body.data === undefined) throw new Error(body.error?.message ?? "Search request failed.");
    return body.data;
}

export const searchIndex = (query: string, filters: { entityType: string; country: string; category: string }) => {
    const params = new URLSearchParams({ q: query, limit: "10" });
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.country) params.set("country", filters.country);
    if (filters.category) params.set("category", filters.category);
    return read<SearchResult>(`/api/v1/search?${params.toString()}`);
};

export const suggestIndex = (query: string, signal: AbortSignal) =>
    read<string[]>(`/api/v1/search/suggestions?q=${encodeURIComponent(query)}&limit=6`, { signal });

export const reindexSearch = () =>
    read<{ indexed: number; index: string }>("/api/v1/search/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
    });
