/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useState } from "react";

type JsonObject = Record<string, unknown>;
type Photo = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographerUrl: string;
  avgColor: string;
  alt: string;
  src: {
    tiny: string;
    medium: string;
    large: string;
    large2x: string;
    landscape: string;
    portrait: string;
    original: string;
  };
};
type Video = {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  creator: string;
  creatorUrl: string;
  file: string;
};
type Quota = { limit: string | null; remaining: string | null; reset: string | null };

const presets = [
  "Stockholm Sweden travel",
  "Copenhagen Denmark travel",
  "Bali tropical beach",
  "Tokyo Japan night",
];

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parsePhoto(value: unknown): Photo | null {
  if (!isObject(value) || !isObject(value.src)) return null;
  const id = Number(value.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    width: Number(value.width),
    height: Number(value.height),
    url: text(value.url),
    photographer: text(value.photographer, "Unknown photographer"),
    photographerUrl: text(value.photographer_url),
    avgColor: text(value.avg_color, "#334155"),
    alt: text(value.alt, "Travel photograph"),
    src: {
      tiny: text(value.src.tiny),
      medium: text(value.src.medium),
      large: text(value.src.large),
      large2x: text(value.src.large2x),
      landscape: text(value.src.landscape),
      portrait: text(value.src.portrait),
      original: text(value.src.original),
    },
  };
}

function parseVideo(value: unknown): Video | null {
  if (!isObject(value)) return null;
  const id = Number(value.id);
  const user = isObject(value.user) ? value.user : {};
  const files = Array.isArray(value.video_files) ? value.video_files.filter(isObject) : [];
  const mp4 =
    files
      .filter((file) => text(file.file_type).includes("mp4") && text(file.link))
      .sort((a, b) => Number(a.width) - Number(b.width))
      .find((file) => Number(file.width) >= 720) ?? files[0];
  if (!Number.isFinite(id) || !mp4) return null;
  return {
    id,
    width: Number(value.width),
    height: Number(value.height),
    url: text(value.url),
    image: text(value.image),
    duration: Number(value.duration),
    creator: text(user.name, "Unknown creator"),
    creatorUrl: text(user.url),
    file: text(mp4.link),
  };
}

export function PexelsPlayground() {
  const [mode, setMode] = useState("search");
  const [query, setQuery] = useState("Stockholm Sweden travel");
  const [orientation, setOrientation] = useState("landscape");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [page, setPage] = useState(1);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("Run a search to inspect the Pexels response.");

  const run = async (requestedPage = 1) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      mode,
      query,
      orientation,
      size,
      color,
      page: String(requestedPage),
      perPage: "12",
    });
    const url = `/api/pexels?${params.toString()}`;

    try {
      const response = await fetch(url);
      const body: unknown = await response.json();
      setRaw(JSON.stringify({ status: response.status, url, body }, null, 2));
      if (!response.ok || !isObject(body)) {
        throw new Error(
          isObject(body) ? text(body.error, "Pexels request failed") : "Pexels request failed",
        );
      }

      const data = isObject(body.data) ? body.data : {};
      setQuota(isObject(body.quota) ? (body.quota as Quota) : null);
      setTotal(Number(data.total_results ?? 0));
      setPage(requestedPage);

      if (mode === "videos") {
        const parsed = Array.isArray(data.videos)
          ? data.videos.map(parseVideo).filter((item): item is Video => item !== null)
          : [];
        setVideos(parsed);
        setPhotos([]);
        setSelected(null);
      } else {
        const parsed = Array.isArray(data.photos)
          ? data.photos.map(parsePhoto).filter((item): item is Photo => item !== null)
          : [];
        setPhotos(parsed);
        setVideos([]);
        setSelected(parsed[0] ?? null);
      }
    } catch (caught) {
      setError(String(caught));
      setPhotos([]);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(1);
  };

  return (
    <div>
      <section className="card">
        <div className="toolbar" aria-label="Pexels endpoint">
          {[
            ["search", "Photo search"],
            ["curated", "Curated photos"],
            ["videos", "Video search"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={mode === id ? "button" : "button secondary"}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="tier-note">
          <strong>Mapbox → Pexels handoff</strong>
          <span>
            Take the destination name selected in Mapbox and turn it into a descriptive image query,
            such as “Stockholm Sweden travel”.
          </span>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Destination or visual query
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={mode === "curated"}
                required={mode !== "curated"}
              />
            </label>
            <label>
              Orientation
              <select value={orientation} onChange={(event) => setOrientation(event.target.value)}>
                <option value="">Any</option>
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
                <option value="square">Square</option>
              </select>
            </label>
            <label>
              Minimum size
              <select value={size} onChange={(event) => setSize(event.target.value)}>
                <option value="">Any</option>
                <option value="large">Large</option>
                <option value="medium">Medium</option>
                <option value="small">Small</option>
              </select>
            </label>
            <label>
              Photo color
              <select
                value={color}
                onChange={(event) => setColor(event.target.value)}
                disabled={mode !== "search"}
              >
                <option value="">Any</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="orange">Orange</option>
                <option value="yellow">Yellow</option>
                <option value="red">Red</option>
                <option value="black">Black</option>
                <option value="white">White</option>
              </select>
            </label>
          </div>

          <div className="toolbar">
            {presets.map((preset) => (
              <button
                className="button secondary"
                type="button"
                key={preset}
                onClick={() => setQuery(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          <button type="submit" disabled={loading}>
            {loading
              ? "Searching Pexels…"
              : mode === "curated"
                ? "Load curated media"
                : "Search Pexels"}
          </button>
        </form>

        <div className="metric-row">
          <span>
            <strong>{total.toLocaleString()}</strong> matching results
          </span>
          <span>
            <strong>{quota?.remaining ?? "—"}</strong> requests remaining
          </span>
          <a href="https://www.pexels.com" target="_blank" rel="noreferrer">
            Photos provided by Pexels ↗
          </a>
        </div>
        {error && <p className="muted">{error}</p>}
      </section>

      {selected && (
        <section className="endpoint-card">
          <div className="endpoint-heading">
            <div>
              <span className="method">PREVIEW</span>
            </div>
            <h2>{query || "Curated destination inspiration"}</h2>
            <p>Roamboard destination cover preview using the selected Pexels image.</p>
          </div>
          <div className="fsq-photo-grid">
            <figure>
              <img
                src={selected.src.landscape || selected.src.large2x}
                alt={selected.alt}
                style={{ backgroundColor: selected.avgColor }}
              />
              <figcaption>
                Photo by{" "}
                <a href={selected.photographerUrl} target="_blank" rel="noreferrer">
                  {selected.photographer}
                </a>{" "}
                on{" "}
                <a href={selected.url} target="_blank" rel="noreferrer">
                  Pexels
                </a>
              </figcaption>
            </figure>
          </div>
          <p className="muted">
            This is where Mapbox location data, itinerary counts and weather summaries could be
            layered over a destination image.
          </p>
        </section>
      )}

      {photos.length > 0 && (
        <section className="endpoint-card">
          <div className="endpoint-heading">
            <div>
              <span className="method">GET</span>
            </div>
            <h2>Photo results</h2>
            <p>Select a photo to test it as the destination cover. Page {page}.</p>
          </div>
          <div className="fsq-photo-grid">
            {photos.map((photo) => (
              <figure key={photo.id}>
                <img
                  src={photo.src.medium}
                  alt={photo.alt}
                  loading="lazy"
                  style={{ backgroundColor: photo.avgColor }}
                />
                <figcaption>
                  <strong>{photo.alt}</strong>
                  <br />
                  {photo.width} × {photo.height}
                  <br />
                  Photo by{" "}
                  <a href={photo.photographerUrl} target="_blank" rel="noreferrer">
                    {photo.photographer}
                  </a>{" "}
                  on{" "}
                  <a href={photo.url} target="_blank" rel="noreferrer">
                    Pexels
                  </a>
                  <div className="photo-load-row">
                    <button type="button" onClick={() => setSelected(photo)}>
                      {selected?.id === photo.id ? "Selected cover" : "Use as cover"}
                    </button>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section className="endpoint-card">
          <div className="endpoint-heading">
            <div>
              <span className="method">GET</span>
            </div>
            <h2>Video results</h2>
            <p>Potential moving hero backgrounds for destination boards. Page {page}.</p>
          </div>
          <div className="fsq-photo-grid">
            {videos.map((video) => (
              <figure key={video.id}>
                <video
                  controls
                  muted
                  playsInline
                  poster={video.image}
                  preload="metadata"
                  style={{ display: "block", width: "100%" }}
                >
                  <source src={video.file} type="video/mp4" />
                </video>
                <figcaption>
                  <strong>
                    {video.duration}s · {video.width} × {video.height}
                  </strong>
                  <br />
                  Video by{" "}
                  <a href={video.creatorUrl} target="_blank" rel="noreferrer">
                    {video.creator}
                  </a>{" "}
                  on{" "}
                  <a href={video.url} target="_blank" rel="noreferrer">
                    Pexels
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {(photos.length > 0 || videos.length > 0) && (
        <div className="toolbar">
          <button
            type="button"
            className="button secondary"
            disabled={page <= 1 || loading}
            onClick={() => void run(page - 1)}
          >
            ← Previous
          </button>
          <button type="button" disabled={loading} onClick={() => void run(page + 1)}>
            Next page →
          </button>
        </div>
      )}

      <details className="raw-response">
        <summary>Raw JSON and request</summary>
        <pre>{raw}</pre>
      </details>
    </div>
  );
}
