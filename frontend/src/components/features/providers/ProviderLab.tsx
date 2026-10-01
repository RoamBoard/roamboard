/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { loadProviderConfig, searchGooglePlacesProvider, searchUnsplashProvider, type ProviderConfig, type ProviderPhoto, type ProviderPlace } from "@/lib/providers";
import CloudinaryPanel from "@/components/features/providers/CloudinaryPanel";
import MapboxPanel from "@/components/features/providers/MapboxPanel";
import SearchLab from "@/components/features/providers/SearchLab";

type ProviderId = "mapbox" | "unsplash" | "google" | "cloudinary" | "search";
const tabs: Array<{ id: ProviderId; label: string; description: string }> = [
  { id: "mapbox", label: "Mapbox", description: "Search places, save pinpoint locations, reverse-geocode, and route between stops." },
  { id: "unsplash", label: "Unsplash", description: "Search attributed destination imagery." },
  { id: "google", label: "Google Places", description: "Compare text search with an explicit billing warning." },
  { id: "cloudinary", label: "Cloudinary", description: "Upload images, inspect metadata, and hand GPS coordinates to Mapbox." },
  { id: "search", label: "Elasticsearch", description: "Explore fuzzy search, autocomplete, filters, scores, and reindexing." },
];

export default function ProviderLab() {
  const [active, setActive] = useState<ProviderId>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "mapbox" ? "mapbox" : "mapbox");
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [handoff] = useState<{ latitude: number; longitude: number; label: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const latitude = Number(params.get("latitude"));
    const longitude = Number(params.get("longitude"));
    return params.get("tab") === "mapbox" && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude, label: params.get("label")?.trim() || "Cloudinary photo location" }
      : null;
  });

  useEffect(() => {
    void loadProviderConfig().then(setConfig).catch((caught: unknown) => setConfigError(caught instanceof Error ? caught.message : "Provider configuration could not be loaded."));
  }, []);

  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];
  return (
    <section className="w-full max-w-6xl px-6 py-14 sm:px-10 lg:px-20" aria-labelledby="provider-lab-heading">
      <p className="text-10 font-bold uppercase tracking-label text-graphite">Developer lab</p>
      <h1 id="provider-lab-heading" className="mt-5 font-display text-48 font-bold leading-none text-foreground sm:text-60">Provider prototypes</h1>
      <p className="mt-5 max-w-2xl text-15 leading-7 text-graphite">Server-backed experiments for provider behavior. External results are previewed here and are not persisted as Board data.</p>
      {configError ? <p className="mt-6 border-l-2 border-foreground pl-3 text-14" role="alert">{configError}</p> : null}
      <nav className="mt-12 grid gap-2 border-y border-line py-2 sm:grid-cols-5" aria-label="Provider prototypes">
        {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActive(tab.id)} className={`px-3 py-4 text-left text-14 ${active === tab.id ? "bg-foreground text-background" : "text-foreground hover:bg-faint"}`} aria-current={active === tab.id}>{tab.label}<span className={`mt-1 block text-12 ${active === tab.id ? "text-background/70" : "text-graphite"}`}>{statusFor(tab.id, config) ? "configured" : "key missing"}</span></button>)}
      </nav>
      <div className="mt-10"><p className="text-14 text-graphite">{activeTab.description}</p>{active === "mapbox" ? <MapboxPanel token={config?.mapbox.publicToken} initialPoint={handoff} /> : null}{active === "unsplash" ? <UnsplashPanel configured={Boolean(config?.unsplash.configured)} /> : null}{active === "google" ? <GooglePanel configured={Boolean(config?.googlePlaces.configured)} /> : null}{active === "cloudinary" ? <CloudinaryPanel configured={Boolean(config?.cloudinary.configured)} /> : null}{active === "search" ? <SearchLab /> : null}</div>
    </section>
  );
}

function statusFor(id: ProviderId, config: ProviderConfig | null) {
  if (!config) return false;
  return id === "mapbox" ? config.mapbox.configured : id === "unsplash" ? config.unsplash.configured : id === "google" ? config.googlePlaces.configured : id === "cloudinary" ? config.cloudinary.configured : true;
}

function ProviderState({ configured, name, children }: { configured: boolean; name: string; children: React.ReactNode }) {
  return <div className="mt-8 border border-line p-6"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="font-display text-24 font-bold text-foreground">{name}</h2><span className="text-10 font-bold uppercase tracking-label text-graphite">{configured ? "configured" : "key missing"}</span></div>{configured ? children : <p className="mt-5 text-14 leading-6 text-graphite">Add this provider key to `layered-backend-demo1/.env`, restart the API container, and return here.</p>}</div>;
}

function SearchForm({ onSubmit, placeholder }: { onSubmit: (query: string) => Promise<void>; placeholder: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (query.trim().length < 2) { setError("Enter at least two characters."); return; } setLoading(true); setError(""); try { await onSubmit(query.trim()); } catch (caught) { setError(caught instanceof Error ? caught.message : "The request failed."); } finally { setLoading(false); } }
  return <form className="mt-6 flex flex-wrap items-end gap-4" onSubmit={submit}><label className="min-w-56 flex-1 text-12 text-graphite">Query<input className="mt-2 w-full border-b border-line bg-transparent py-3 text-15 text-foreground outline-none focus:border-foreground" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} /></label><button className="border border-foreground bg-foreground px-5 py-3 text-14 text-background disabled:opacity-50" disabled={loading}>{loading ? "Loading" : "Search"}</button>{error ? <p className="basis-full text-14" role="alert">{error}</p> : null}</form>;
}

function UnsplashPanel({ configured }: { configured: boolean }) {
  const [photos, setPhotos] = useState<ProviderPhoto[]>([]);
  return <ProviderState configured={configured} name="Unsplash"><SearchForm placeholder="Stockholm Sweden travel" onSubmit={async (query) => setPhotos(await searchUnsplashProvider(query))} /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{photos.map((photo) => <figure key={photo.id}><img className="aspect-video w-full object-cover" src={photo.thumbnailUrl} alt={photo.alt} /><figcaption className="mt-2 text-12 leading-5 text-graphite">{photo.width} x {photo.height} · Photo by <a className="underline" href={photo.photographerUrl} target="_blank" rel="noreferrer">{photo.photographer}</a> on <a className="underline" href={photo.sourceUrl} target="_blank" rel="noreferrer">Unsplash</a></figcaption></figure>)}</div></ProviderState>;
}

function GooglePanel({ configured }: { configured: boolean }) {
  const [places, setPlaces] = useState<ProviderPlace[]>([]);
  return <ProviderState configured={configured} name="Google Places"><p className="mt-5 border-l-2 border-foreground pl-3 text-14 leading-6">Google Places requires a billing-enabled Google Cloud project. This lab uses a narrow field mask and only runs when you submit a search.</p><SearchForm placeholder="Museums in Stockholm" onSubmit={async (query) => setPlaces(await searchGooglePlacesProvider(query))} /><div className="mt-8 grid gap-3 sm:grid-cols-2">{places.map((place) => <article key={place.id} className="border border-line p-4"><h3 className="font-display text-20 font-bold text-foreground">{place.name}</h3><p className="mt-2 text-14 text-graphite">{place.address}</p><p className="mt-3 text-12 text-graphite">{place.types.slice(0, 3).join(" · ")}</p></article>)}</div></ProviderState>;
}
