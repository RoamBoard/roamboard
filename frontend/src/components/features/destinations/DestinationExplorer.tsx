/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { loadDestinationContext, searchDestinations, type Destination, type DestinationContext } from "@/lib/destinations";

const inputClasses = "w-full border-b border-line bg-transparent px-0 py-3 text-16 text-foreground outline-none placeholder:text-graphite focus:border-foreground";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

export default function DestinationExplorer() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Destination[]>([]);
  const [selected, setSelected] = useState<DestinationContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError("Enter at least two characters to search for a destination.");
      return;
    }
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      setResults(await searchDestinations(trimmed));
    } catch (caught) {
      setResults([]);
      setError(caught instanceof Error ? caught.message : "Destination search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function chooseDestination(destination: Destination) {
    setContextLoading(true);
    setError("");
    try {
      setSelected(await loadDestinationContext(destination));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This destination could not be loaded.");
    } finally {
      setContextLoading(false);
    }
  }

  return (
    <section className="w-full max-w-5xl px-6 py-16 sm:px-10 lg:px-20" aria-labelledby="destination-heading">
      <div className="max-w-2xl">
        <p className="font-body text-10 font-bold uppercase tracking-label text-graphite">Destination discovery</p>
        <h1 id="destination-heading" className="mt-5 font-display text-48 font-bold leading-[0.95] text-foreground sm:text-72">Where will you wander?</h1>
        <p className="mt-6 max-w-xl text-15 leading-7 text-graphite">Search a place, then open its compact travel brief with location, a short description, imagery, and a five-day forecast.</p>
        <form className="mt-10 flex items-end gap-4" onSubmit={handleSearch}>
          <label className="min-w-0 flex-1" htmlFor="destination-search">
            <span className="sr-only">Destination or place</span>
            <input id="destination-search" className={inputClasses} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Kyoto, Lisbon, or a neighborhood" autoComplete="off" />
          </label>
          <button type="submit" disabled={loading} className="shrink-0 border border-foreground bg-foreground px-5 py-3 text-14 text-background transition-opacity hover:opacity-75 disabled:cursor-wait disabled:opacity-50">
            {loading ? "Searching" : "Search"}
          </button>
        </form>
        {error ? <p className="mt-5 border-l-2 border-foreground pl-3 text-14 text-foreground" role="alert">{error}</p> : null}
      </div>

      {results.length > 0 ? (
        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Destination results">
          {results.map((destination) => (
            <button key={destination.id} type="button" onClick={() => void chooseDestination(destination)} className="border border-line p-5 text-left transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
              <span className="text-10 font-bold uppercase tracking-label text-graphite">{destination.placeType}</span>
              <strong className="mt-4 block font-display text-24 leading-tight text-foreground">{destination.name}</strong>
              <span className="mt-2 block text-14 leading-6 text-graphite">{destination.address}</span>
              <span className="mt-5 block text-12 text-foreground">{contextLoading ? "Loading brief..." : "Open destination brief ->"}</span>
            </button>
          ))}
        </div>
      ) : null}

      {!loading && query.trim().length >= 2 && results.length === 0 && !error ? <p className="mt-14 text-14 text-graphite">No destinations found. Try a city, landmark, or neighborhood.</p> : null}

      {selected ? <DestinationBrief context={selected} /> : null}
    </section>
  );
}

function DestinationBrief({ context }: { context: DestinationContext }) {
  const { destination, weather, article, image, unavailable } = context;
  return (
    <article className="mt-16 border-t border-foreground pt-8" aria-labelledby="brief-heading">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-10 font-bold uppercase tracking-label text-graphite">Selected destination</p>
          <h2 id="brief-heading" className="mt-4 font-display text-36 font-bold leading-none text-foreground">{destination.name}</h2>
          <p className="mt-4 text-15 leading-7 text-graphite">{destination.address}</p>
          <p className="mt-2 text-12 text-graphite">{destination.latitude.toFixed(4)}, {destination.longitude.toFixed(4)}</p>
          {article ? <div className="mt-10"><h3 className="font-display text-22 font-bold text-foreground">A little context</h3><p className="mt-3 text-15 leading-7 text-graphite">{article.description}</p><a className="mt-4 inline-block text-12 text-foreground underline underline-offset-4" href={article.url} target="_blank" rel="noreferrer">Read {article.title} on Wikipedia</a></div> : null}
        </div>
        <div>
          {image ? <figure><img className="aspect-video w-full object-cover" src={image.url} alt={image.alt} /><figcaption className="mt-2 text-12 text-graphite">Photo by <a className="underline underline-offset-4" href={image.photographerUrl} target="_blank" rel="noreferrer">{image.photographer}</a> on <a className="underline underline-offset-4" href={image.sourceUrl} target="_blank" rel="noreferrer">Unsplash</a></figcaption></figure> : <div className="grid aspect-video place-items-center bg-faint px-6 text-center text-14 text-graphite">Add an Unsplash key to show destination imagery.</div>}
          {weather ? <section className="mt-10" aria-labelledby="weather-heading"><div className="flex items-baseline justify-between gap-4"><h3 id="weather-heading" className="font-display text-22 font-bold text-foreground">Five-day weather</h3><span className="text-12 text-graphite">{weather.timezone}</span></div><div className="mt-4 grid grid-cols-5 gap-2 border-y border-line py-4">{weather.dates.map((date, index) => <div key={date} className="min-w-0"><p className="text-10 font-bold uppercase tracking-label text-graphite">{formatDate(date)}</p><p className="mt-3 font-display text-20 text-foreground">{Math.round(weather.maximums[index] ?? 0)}°</p><p className="text-12 text-graphite">{Math.round(weather.minimums[index] ?? 0)}° / {weather.precipitation[index] ?? 0}% rain</p></div>)}</div></section> : <p className="mt-10 text-14 text-graphite">Weather is temporarily unavailable.</p>}
        </div>
      </div>
      {unavailable.length > 0 ? <p className="mt-8 text-12 text-graphite">Some optional details are unavailable right now: {unavailable.join(", ")}.</p> : null}
    </article>
  );
}