"use client";

import { FormEvent, useEffect, useState } from "react";

interface SearchDocument {
  id: string;
  entityType: string;
  title: string;
  description: string;
  city: string;
  country: string;
  categories: string[];
}

interface SearchResponse {
  data: {
    hits: Array<{ document: SearchDocument; score: number }>;
    total: number;
  };
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

export default function Home() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmedQuery = query.trim();
    const controller = new AbortController();

    if (trimmedQuery.length < 2) {
      return () => controller.abort();
    }

    fetch(`${apiBaseUrl}/search/suggestions?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Suggestions are unavailable");
        return response.json() as Promise<{ data: string[] }>;
      })
      .then((response) => setSuggestions(response.data))
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setSuggestions([]);
      });

    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    if (!submittedQuery) return;

    const controller = new AbortController();

    fetch(`${apiBaseUrl}/search?q=${encodeURIComponent(submittedQuery)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Search is unavailable");
        return response.json() as Promise<SearchResponse>;
      })
      .then((response) => setResults(response.data))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setResults(null);
        setError(requestError instanceof Error ? requestError.message : "Search is unavailable");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [submittedQuery]);

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSubmittedQuery(query.trim());
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Roamboard search</p>
        <h1 className="mt-4 max-w-2xl text-5xl font-semibold tracking-tight text-white">Find the next place worth building a trip around.</h1>
        <form className="relative mt-10" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="search-query">Search destinations, places, and itineraries</label>
          <div className="flex gap-3">
            <input id="search-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Stockholm or stokholm" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-5 py-4 text-lg text-white outline-none ring-cyan-300 placeholder:text-slate-500 focus:ring-2" />
            <button className="rounded-lg bg-cyan-300 px-6 font-semibold text-slate-950 hover:bg-cyan-200" type="submit">Search</button>
          </div>
          {query.trim().length >= 2 && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-2 w-full max-w-[calc(100%-7rem)] rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-2xl">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-slate-800" type="button" onClick={() => { setQuery(suggestion); setSubmittedQuery(suggestion); setSuggestions([]); }}>{suggestion}</button>
                </li>
              ))}
            </ul>
          )}
        </form>
        <section className="mt-16" aria-live="polite">
          {loading && <p className="text-slate-400">Searching...</p>}
          {error && <p className="text-rose-300">{error}</p>}
          {!loading && !error && results && results.total === 0 && <p className="text-slate-400">No public travel records matched that search.</p>}
          {!loading && !error && results && results.total > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {results.hits.map(({ document }) => (
                <article className="rounded-lg border border-slate-800 bg-slate-900 p-5" key={document.id}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{document.entityType}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{document.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{document.city}, {document.country}</p>
                  <p className="mt-4 leading-7 text-slate-300">{document.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">{document.categories.map((category) => <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400" key={category}>{category}</span>)}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
