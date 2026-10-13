"use client";

import { useEffect, useState } from "react";
import { searchIndex, suggestIndex, type SearchResult } from "@/lib/search";

export default function SearchLab() {
    const [query, setQuery] = useState("stokholm");
    const [filters, setFilters] = useState({
        entityType: "",
        country: "",
        category: ""
    });
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [result, setResult] = useState<SearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            void suggestIndex(trimmed, controller.signal)
                .then(setSuggestions)
                .catch((caught: unknown) => {
                    if (!(
                        caught instanceof DOMException &&
                        caught.name === "AbortError"
                    ))
                        setSuggestions([]);
                });
        }, 300);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (query.trim().length < 2) return;
        setLoading(true);
        setError("");
        try {
            setResult(await searchIndex(query.trim(), filters));
            setSuggestions([]);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Elasticsearch search failed."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="border-line mt-8 border p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-24 text-foreground font-bold">
                    Elasticsearch discovery index
                </h2>
                <span className="text-10 tracking-label text-graphite font-bold uppercase">
                    fuzzy + autocomplete
                </span>
            </div>
            <p className="text-14 text-graphite mt-3 max-w-2xl leading-6">
                Try misspellings such as “stokholm”. Suggestions use
                search-as-you-type; results use fuzzy matching, field boosts,
                public visibility, filters, and popularity scoring.
            </p>
            <form className="mt-6" onSubmit={(event) => void submit(event)}>
                <label className="text-12 text-graphite">
                    Search index
                    <input
                        className="border-line text-15 text-foreground focus:border-foreground mt-2 w-full border-b bg-transparent py-3 outline-none"
                        value={query}
                        onChange={(event) => {
                            const nextQuery = event.target.value;
                            setQuery(nextQuery);
                            if (nextQuery.trim().length < 2) setSuggestions([]);
                        }}
                        placeholder="best food weekend in Tokyo"
                    />
                </label>
                {suggestions.length > 0 ? (
                    <div
                        className="border-line bg-background mt-2 border"
                        role="listbox"
                        aria-label="Search suggestions"
                    >
                        {suggestions.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                className="text-14 text-foreground hover:bg-faint block w-full px-3 py-2 text-left"
                                onClick={() => {
                                    setQuery(suggestion);
                                    setSuggestions([]);
                                }}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                ) : null}
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <label className="text-12 text-graphite">
                        Entity
                        <select
                            className="border-line text-14 text-foreground mt-2 w-full border-b bg-transparent py-2 outline-none"
                            value={filters.entityType}
                            onChange={(event) =>
                                setFilters({
                                    ...filters,
                                    entityType: event.target.value
                                })
                            }
                        >
                            <option value="">All types</option>
                            <option value="destination">Destination</option>
                            <option value="place">Place</option>
                            <option value="itinerary">Itinerary</option>
                        </select>
                    </label>
                    <label className="text-12 text-graphite">
                        Country
                        <input
                            className="border-line text-14 text-foreground mt-2 w-full border-b bg-transparent py-2 outline-none"
                            value={filters.country}
                            onChange={(event) =>
                                setFilters({
                                    ...filters,
                                    country: event.target.value
                                })
                            }
                            placeholder="Sweden"
                        />
                    </label>
                    <label className="text-12 text-graphite">
                        Category
                        <input
                            className="border-line text-14 text-foreground mt-2 w-full border-b bg-transparent py-2 outline-none"
                            value={filters.category}
                            onChange={(event) =>
                                setFilters({
                                    ...filters,
                                    category: event.target.value
                                })
                            }
                            placeholder="culture"
                        />
                    </label>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        className="border-foreground bg-foreground text-14 text-background border px-5 py-3 disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? "Searching" : "Search index"}
                    </button>
                </div>
            </form>
            <p className="text-12 text-graphite mt-5">
                Reindex the demo safely from the API container with{" "}
                <code>npm run search:reindex:container</code>. The HTTP reindex
                route stays protected in Docker.
            </p>
            {error ? (
                <p className="text-14 mt-5" role="alert">
                    {error}
                </p>
            ) : null}
            {result ? (
                <div className="border-line mt-8 border-t pt-6">
                    <p className="text-12 text-graphite">
                        {result.total} matches · page {result.page}
                    </p>
                    <div className="mt-4 grid gap-3">
                        {result.hits.map((hit) => (
                            <article
                                key={hit.document.id}
                                className="border-line border p-4"
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <h3 className="font-display text-20 text-foreground font-bold">
                                        {hit.document.title}
                                    </h3>
                                    <span className="text-12 text-graphite">
                                        score {hit.score.toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-14 text-graphite mt-2 leading-6">
                                    {hit.document.description}
                                </p>
                                <p className="text-12 text-graphite mt-3">
                                    {hit.document.city}, {hit.document.country}{" "}
                                    · {hit.document.categories.join(" · ")}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
