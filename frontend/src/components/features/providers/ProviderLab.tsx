/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import {
    deleteSavedGooglePlace,
    loadGooglePlaceDetails,
    loadProviderConfig,
    loadSavedGooglePlaces,
    saveGooglePlace,
    searchGooglePlacesProvider,
    searchUnsplashProvider,
    type GooglePlaceDetails,
    type ProviderConfig,
    type ProviderPhoto,
    type ProviderPlace,
    type SavedGooglePlaceReference
} from "@/lib/providers";
import CloudinaryPanel from "@/components/features/providers/CloudinaryPanel";
import MapboxPanel from "@/components/features/providers/MapboxPanel";
import SearchLab from "@/components/features/providers/SearchLab";

type ProviderId = "mapbox" | "unsplash" | "google" | "cloudinary" | "search";
const tabs: Array<{ id: ProviderId; label: string; description: string }> = [
    {
        id: "mapbox",
        label: "Mapbox",
        description: "Search places, save pinpoint locations, reverse-geocode, and route between stops."
    },
    {
        id: "unsplash",
        label: "Unsplash",
        description: "Search attributed destination imagery."
    },
    {
        id: "google",
        label: "Google Places",
        description: "Search POIs, persist stable Place IDs, fetch live details, and open exact places in Google Maps."
    },
    {
        id: "cloudinary",
        label: "Cloudinary",
        description: "Upload images, inspect metadata, and hand GPS coordinates to Mapbox."
    },
    {
        id: "search",
        label: "Elasticsearch",
        description: "Explore fuzzy search, autocomplete, filters, scores, and reindexing."
    }
];

export default function ProviderLab() {
    const [active, setActive] = useState<ProviderId>(() =>
        typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "mapbox"
            ? "mapbox"
            : "mapbox"
    );
    const [config, setConfig] = useState<ProviderConfig | null>(null);
    const [configError, setConfigError] = useState("");
    const [handoff] = useState<{ latitude: number; longitude: number } | null>(() => {
        if (typeof window === "undefined") return null;
        const params = new URLSearchParams(window.location.search);
        const latitude = Number(params.get("latitude"));
        const longitude = Number(params.get("longitude"));
        return params.get("tab") === "mapbox" && Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { latitude, longitude }
            : null;
    });

    useEffect(() => {
        void loadProviderConfig()
            .then(setConfig)
            .catch((caught: unknown) =>
                setConfigError(caught instanceof Error ? caught.message : "Provider configuration could not be loaded.")
            );
    }, []);

    const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];
    return (
        <section className="w-full max-w-6xl px-6 py-14 sm:px-10 lg:px-20" aria-labelledby="provider-lab-heading">
            <p className="text-10 tracking-label text-graphite font-bold uppercase">Developer lab</p>
            <h1
                id="provider-lab-heading"
                className="font-display text-48 text-foreground sm:text-60 mt-5 leading-none font-bold"
            >
                Provider prototypes
            </h1>
            <p className="text-15 text-graphite mt-5 max-w-2xl leading-7">
                Server-backed experiments for provider behavior. External results are previewed here and are not
                persisted as Board data.
            </p>
            {configError ? (
                <p className="border-foreground text-14 mt-6 border-l-2 pl-3" role="alert">
                    {configError}
                </p>
            ) : null}
            <nav className="border-line mt-12 grid gap-2 border-y py-2 sm:grid-cols-5" aria-label="Provider prototypes">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActive(tab.id)}
                        className={`text-14 px-3 py-4 text-left ${active === tab.id ? "bg-foreground text-background" : "text-foreground hover:bg-faint"}`}
                        aria-current={active === tab.id}
                    >
                        {tab.label}
                        <span
                            className={`text-12 mt-1 block ${active === tab.id ? "text-background/70" : "text-graphite"}`}
                        >
                            {statusFor(tab.id, config) ? "configured" : "key missing"}
                        </span>
                    </button>
                ))}
            </nav>
            <div className="mt-10">
                <p className="text-14 text-graphite">{activeTab.description}</p>
                {active === "mapbox" ? (
                    <MapboxPanel configured={Boolean(config?.mapbox.configured)} initialPoint={handoff} />
                ) : null}
                {active === "unsplash" ? <UnsplashPanel configured={Boolean(config?.unsplash.configured)} /> : null}
                {active === "google" ? (
                    <GooglePlacesPanel configured={Boolean(config?.googlePlaces.configured)} />
                ) : null}
                {active === "cloudinary" ? (
                    <CloudinaryPanel configured={Boolean(config?.cloudinary.configured)} />
                ) : null}
                {active === "search" ? <SearchLab /> : null}
            </div>
        </section>
    );
}

function statusFor(id: ProviderId, config: ProviderConfig | null) {
    if (!config) return false;
    return id === "mapbox"
        ? config.mapbox.configured
        : id === "unsplash"
          ? config.unsplash.configured
          : id === "google"
            ? config.googlePlaces.configured
            : id === "cloudinary"
              ? config.cloudinary.configured
              : true;
}

function ProviderState({
    configured,
    name,
    children
}: {
    configured: boolean;
    name: string;
    children: React.ReactNode;
}) {
    return (
        <div className="border-line mt-8 border p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-24 text-foreground font-bold">{name}</h2>
                <span className="text-10 tracking-label text-graphite font-bold uppercase">
                    {configured ? "configured" : "key missing"}
                </span>
            </div>
            {configured ? (
                children
            ) : (
                <p className="text-14 text-graphite mt-5 leading-6">
                    Add this provider key to `layered-backend-demo1/.env`, restart the API container, and return here.
                </p>
            )}
        </div>
    );
}

function SearchForm({ onSubmit, placeholder }: { onSubmit: (query: string) => Promise<void>; placeholder: string }) {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (query.trim().length < 2) {
            setError("Enter at least two characters.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await onSubmit(query.trim());
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The request failed.");
        } finally {
            setLoading(false);
        }
    }
    return (
        <form className="mt-6 flex flex-wrap items-end gap-4" onSubmit={submit}>
            <label className="text-12 text-graphite min-w-56 flex-1">
                Query
                <input
                    className="border-line text-15 text-foreground focus:border-foreground mt-2 w-full border-b bg-transparent py-3 outline-none"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={placeholder}
                />
            </label>
            <button
                className="border-foreground bg-foreground text-14 text-background border px-5 py-3 disabled:opacity-50"
                disabled={loading}
            >
                {loading ? "Loading" : "Search"}
            </button>
            {error ? (
                <p className="text-14 basis-full" role="alert">
                    {error}
                </p>
            ) : null}
        </form>
    );
}

function UnsplashPanel({ configured }: { configured: boolean }) {
    const [photos, setPhotos] = useState<ProviderPhoto[]>([]);
    return (
        <ProviderState configured={configured} name="Unsplash">
            <SearchForm
                placeholder="Stockholm Sweden travel"
                onSubmit={async (query) => setPhotos(await searchUnsplashProvider(query))}
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {photos.map((photo) => (
                    <figure key={photo.id}>
                        <img className="aspect-video w-full object-cover" src={photo.thumbnailUrl} alt={photo.alt} />
                        <figcaption className="text-12 text-graphite mt-2 leading-5">
                            {photo.width} x {photo.height} · Photo by{" "}
                            <a className="underline" href={photo.photographerUrl} target="_blank" rel="noreferrer">
                                {photo.photographer}
                            </a>{" "}
                            on{" "}
                            <a className="underline" href={photo.sourceUrl} target="_blank" rel="noreferrer">
                                Unsplash
                            </a>
                        </figcaption>
                    </figure>
                ))}
            </div>
        </ProviderState>
    );
}

function GooglePlacesPanel({ configured }: { configured: boolean }) {
    const [places, setPlaces] = useState<ProviderPlace[]>([]);
    const [saved, setSaved] = useState<SavedGooglePlaceReference[]>([]);
    const [details, setDetails] = useState<Record<string, GooglePlaceDetails>>({});
    const [error, setError] = useState("");

    useEffect(() => {
        if (!configured) return;
        void loadSavedGooglePlaces()
            .then(setSaved)
            .catch((caught: unknown) =>
                setError(caught instanceof Error ? caught.message : "Saved Place IDs could not be loaded.")
            );
    }, [configured]);

    async function save(placeId: string) {
        try {
            const reference = await saveGooglePlace(placeId);
            setSaved((current) =>
                current.some((item) => item.placeId === placeId) ? current : [reference, ...current]
            );
            setError("");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The Place ID could not be saved.");
        }
    }

    async function fetchDetails(placeId: string) {
        try {
            const place = await loadGooglePlaceDetails(placeId);
            setDetails((current) => ({ ...current, [placeId]: place }));
            setError("");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Place details could not be loaded.");
        }
    }

    async function remove(placeId: string) {
        try {
            await deleteSavedGooglePlace(placeId);
            setSaved((current) => current.filter((item) => item.placeId !== placeId));
            setError("");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The Place ID could not be deleted.");
        }
    }

    return (
        <ProviderState configured={configured} name="Google Places">
            <p className="border-foreground text-14 mt-5 border-l-2 pl-3 leading-6">
                Google Places requires a billing-enabled project. The backend enforces separate hard caps for POI search
                and live details. Only stable Place IDs are persisted.
            </p>
            <SearchForm
                placeholder="Museums in Stockholm"
                onSubmit={async (query) => setPlaces(await searchGooglePlacesProvider(query))}
            />
            {error ? (
                <p className="text-14 mt-4" role="alert">
                    {error}
                </p>
            ) : null}
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {places.map((place) => (
                    <article key={place.id} className="border-line border p-4">
                        <h3 className="font-display text-20 text-foreground font-bold">{place.name}</h3>
                        <p className="text-14 text-graphite mt-2">{place.address}</p>
                        <p className="text-11 text-graphite mt-3 break-all">{place.id}</p>
                        <div className="text-12 mt-4 flex gap-4">
                            <button type="button" className="underline" onClick={() => void save(place.id)}>
                                Save Place ID
                            </button>
                            <a className="underline" href={place.googleMapsUrl} target="_blank" rel="noreferrer">
                                Open in Google Maps
                            </a>
                        </div>
                    </article>
                ))}
            </div>
            <h3 className="font-display text-20 text-foreground mt-10 font-bold">Saved Place IDs</h3>
            {saved.length === 0 ? (
                <p className="text-14 text-graphite mt-3">No Google Place IDs saved yet.</p>
            ) : (
                <div className="mt-4 space-y-3">
                    {saved.map((reference) => {
                        const place = details[reference.placeId];
                        return (
                            <article key={reference.placeId} className="border-line border p-4">
                                <p className="text-12 text-graphite break-all">{reference.placeId}</p>
                                {place ? (
                                    <>
                                        <p className="text-14 text-foreground mt-2">{place.address}</p>
                                        <a
                                            className="text-12 mt-2 inline-block underline"
                                            href={place.googleMapsUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Open exact place in Google Maps
                                        </a>
                                    </>
                                ) : null}
                                <div className="text-12 mt-3 flex gap-4">
                                    <button
                                        type="button"
                                        className="underline"
                                        onClick={() => void fetchDetails(reference.placeId)}
                                    >
                                        Fetch live details
                                    </button>
                                    <button
                                        type="button"
                                        className="underline"
                                        onClick={() => void remove(reference.placeId)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </ProviderState>
    );
}
