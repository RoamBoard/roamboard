/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useMemo, useState } from "react";

type Photo = {
  rank: number;
  id: string;
  width: number;
  height: number;
  color: string;
  blurHash: string | null;
  alt: string;
  urls: { raw: string; regular: string; small: string; thumb: string };
  photographer: { name: string; username: string; profileUrl: string };
  unsplashUrl: string;
};

type SearchResponse = {
  destination: string;
  searchQuery: string;
  total: number;
  photos: Photo[];
  quota: { limit: string | null; remaining: string | null };
  error?: string;
};

type ImageFormat = { id: string; label: string; width: number; height: number };

const presets = ["Stockholm Sweden", "Copenhagen Denmark", "Tokyo Japan", "Bali Indonesia"];

const formats: ImageFormat[] = [
  { id: "hero", label: "Hero 16:9", width: 1200, height: 675 },
  { id: "card", label: "Card 4:3", width: 800, height: 600 },
  { id: "square", label: "Square 1:1", width: 800, height: 800 },
  { id: "portrait", label: "Portrait 3:4", width: 600, height: 800 },
];

const cropModes = [
  { id: "entropy", label: "Travel detail (recommended)", note: "Focus on the most visually informative part of a city or landscape" },
  { id: "edges", label: "Architecture and skyline", note: "Prioritize strong structural edges such as buildings and horizons" },
  { id: "", label: "Centre", note: "Use a conventional centre crop" },
  { id: "faces", label: "People and portraits", note: "Keep detected faces inside the crop when people are the subject" },
];

function transformedUrl(rawUrl: string, width: number, height: number, crop: string, quality: number) {
  const url = new URL(rawUrl);
  url.searchParams.set("w", String(width));
  url.searchParams.set("h", String(height));
  url.searchParams.set("fit", "crop");
  if (crop) url.searchParams.set("crop", crop);
  else url.searchParams.delete("crop");
  url.searchParams.set("auto", "format");
  url.searchParams.set("q", String(quality));
  return url.toString();
}

export function UnsplashPlayground() {
  const [query, setQuery] = useState("Stockholm Sweden");
  const [searchedFor, setSearchedFor] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [formatId, setFormatId] = useState("hero");
  const [cropMode, setCropMode] = useState("entropy");
  const [quality, setQuality] = useState(75);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(() => new Set());
  const [quota, setQuota] = useState<SearchResponse["quota"] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState("");
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [raw, setRaw] = useState("Search for a destination to inspect the normalized Unsplash response.");

  const activeFormat = formats.find((format) => format.id === formatId) ?? formats[0];
  const optimizedUrl = useMemo(
    () => selected ? transformedUrl(selected.urls.raw, activeFormat.width, activeFormat.height, cropMode, quality) : "",
    [selected, activeFormat, cropMode, quality],
  );
  const responsiveSrcSet = useMemo(() => {
    if (!selected) return "";
    const ratio = activeFormat.height / activeFormat.width;
    return [400, 800, 1200, 1600]
      .map((width) => `${transformedUrl(selected.urls.raw, width, Math.round(width * ratio), cropMode, quality)} ${width}w`)
      .join(", ");
  }, [selected, activeFormat, cropMode, quality]);

  const search = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setSavedMessage("");
    const url = `/api/unsplash?query=${encodeURIComponent(query.trim())}`;
    try {
      const response = await fetch(url);
      const body = (await response.json()) as SearchResponse;
      setRaw(JSON.stringify({ status: response.status, url, body }, null, 2));
      if (!response.ok) throw new Error(body.error ?? "Unsplash search failed");
      setPhotos(body.photos);
      setSelected(body.photos[0] ?? null);
      setSearchedFor(body.destination);
      setQuota(body.quota);
      setTotal(body.total);
    } catch (caught) {
      setPhotos([]);
      setSelected(null);
      setError(caught instanceof Error ? caught.message : "Unsplash search failed");
    } finally {
      setLoading(false);
    }
  };

  const trackSelection = async (photo: Photo) => {
    if (trackedIds.has(photo.id)) return;
    const response = await fetch("/api/unsplash/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id }),
    });
    const body = (await response.json()) as { tracked?: boolean; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not register this selection");
    setTrackedIds((current) => new Set(current).add(photo.id));
  };

  const chooseCover = async (photo: Photo) => {
    setSelecting(photo.id);
    setError("");
    setSavedMessage("");
    try {
      await trackSelection(photo);
      setSelected(photo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not select this cover");
    } finally {
      setSelecting("");
    }
  };

  const saveRecipe = async () => {
    if (!selected) return;
    setSelecting(selected.id);
    setError("");
    try {
      await trackSelection(selected);
      const record = {
        photoId: selected.id,
        destination: searchedFor,
        rawHotlinkedUrl: selected.urls.raw,
        photographer: selected.photographer,
        unsplashUrl: selected.unsplashUrl,
        format: activeFormat,
        cropMode: cropMode || "center",
        quality,
        deliveryUrl: optimizedUrl,
        savedAt: new Date().toISOString(),
      };
      const key = "roamboard-unsplash-covers";
      const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]") as Array<{ photoId: string }>;
      const next = [record, ...existing.filter((item) => item.photoId !== selected.id)];
      window.localStorage.setItem(key, JSON.stringify(next));
      setSavedMessage("Saved the hotlinked cover recipe locally. This is the row PostgreSQL would store later.");
      setRaw(JSON.stringify(record, null, 2));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this cover recipe");
    } finally {
      setSelecting("");
    }
  };

  return (
    <div>
      <section className="card">
        <div className="endpoint-heading">
          <div><span className="method">GET</span></div>
          <h2>Destination image shortlist</h2>
          <p>Unsplash ranks the search by relevance and returns the five strongest landscape candidates. The first result becomes the automatic suggestion, but the user can override it.</p>
        </div>
        <form onSubmit={search}>
          <div className="form-grid"><label>Destination<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Stockholm Sweden" required /></label></div>
          <div className="toolbar">{presets.map((preset) => <button className="button secondary" type="button" key={preset} onClick={() => setQuery(preset)}>{preset}</button>)}</div>
          <button type="submit" disabled={loading}>{loading ? "Finding the best five…" : "Find 5 destination images"}</button>
        </form>
        <div className="metric-row">
          <span><strong>{photos.length}</strong> shortlisted</span>
          <span><strong>{total.toLocaleString()}</strong> matching photos</span>
          <span><strong>{quota?.remaining ?? "—"}</strong> / {quota?.limit ?? "—"} API requests left</span>
        </div>
        {error && <p className="muted">{error}</p>}
      </section>

      {selected && (
        <section className="endpoint-card">
          <div className="endpoint-heading">
            <div><span className="method experimental">IMAGE PIPELINE</span></div>
            <h2>Automatic crop and delivery optimization</h2>
            <p>Compare subject-aware crop modes and output formats without copying the image or making another Unsplash API request.</p>
          </div>
          <div className="form-grid">
            <label>Crop strategy<select value={cropMode} onChange={(event) => setCropMode(event.target.value)}>{cropModes.map((mode) => <option key={mode.label} value={mode.id}>{mode.label}</option>)}</select><small className="muted">{cropModes.find((mode) => mode.id === cropMode)?.note}</small></label>
            <label>Output use<select value={formatId} onChange={(event) => setFormatId(event.target.value)}>{formats.map((format) => <option key={format.id} value={format.id}>{format.label} · {format.width}×{format.height}</option>)}</select></label>
            <label>Quality<select value={quality} onChange={(event) => setQuality(Number(event.target.value))}><option value="60">60 · smallest</option><option value="70">70 · efficient</option><option value="75">75 · balanced</option><option value="85">85 · high quality</option></select></label>
          </div>
          <div className="fsq-photo-grid">
            <figure>
              <img src={optimizedUrl} srcSet={responsiveSrcSet} sizes="(max-width: 700px) 100vw, 900px" alt={selected.alt} style={{ backgroundColor: selected.color }} />
              <figcaption>
                <strong>{searchedFor} · {activeFormat.label}</strong><br />
                Browser-selected responsive width · automatic format · quality {quality}<br />
                Photo by <a href={selected.photographer.profileUrl} target="_blank" rel="noreferrer">{selected.photographer.name}</a> on <a href="https://unsplash.com/?utm_source=roamboard&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>
              </figcaption>
            </figure>
          </div>
          <div className="metric-row">
            <span><strong>{activeFormat.width}×{activeFormat.height}</strong> target</span>
            <span><strong>{cropMode || "center"}</strong> crop</span>
            <span><strong>auto=format</strong> browser format</span>
          </div>
          <button type="button" disabled={selecting === selected.id} onClick={() => void saveRecipe()}>{selecting === selected.id ? "Saving…" : "Save this cover recipe"}</button>
          {savedMessage && <p className="muted">{savedMessage}</p>}
          <div className="tier-note"><strong>No Cloudinary copy</strong><span>Save the Unsplash photo ID, raw hotlinked URL, attribution and transformation recipe. Rebuild the delivery URL whenever this card renders.</span></div>
        </section>
      )}

      {photos.length > 0 && (
        <section className="endpoint-card">
          <div className="endpoint-heading"><div><span className="method">TOP 5</span></div><h2>Ranked image candidates</h2><p>Choose another source image, then tune its automatic crop above.</p></div>
          <div className="fsq-photo-grid">
            {photos.map((photo) => {
              const thumbUrl = transformedUrl(photo.urls.raw, 600, 400, "entropy", 70);
              return (
                <figure key={photo.id} style={selected?.id === photo.id ? { outline: "3px solid #2563eb" } : undefined}>
                  <img src={thumbUrl} alt={photo.alt} loading="lazy" style={{ backgroundColor: photo.color }} />
                  <figcaption>
                    <strong>#{photo.rank} · {photo.alt}</strong><br />Source: {photo.width} × {photo.height}<br />
                    Photo by <a href={photo.photographer.profileUrl} target="_blank" rel="noreferrer">{photo.photographer.name}</a> on <a href="https://unsplash.com/?utm_source=roamboard&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>
                    <div className="photo-load-row">
                      <button type="button" disabled={selecting === photo.id} onClick={() => void chooseCover(photo)}>{selected?.id === photo.id && trackedIds.has(photo.id) ? "Cover chosen" : selecting === photo.id ? "Selecting…" : "Use as cover"}</button>
                      <a href={photo.unsplashUrl} target="_blank" rel="noreferrer">View source ↗</a>
                    </div>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      )}

      <details className="raw-response"><summary>Raw JSON, saved recipe and request</summary><pre>{raw}</pre></details>
    </div>
  );
}
