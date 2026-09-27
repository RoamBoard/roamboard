/* eslint-disable @next/next/no-img-element */
"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";

type Variant = {
  id: string;
  label: string;
  width: number;
  height: number;
  url: string;
};

type UploadedAsset = {
  publicId: string;
  url: string;
  thumbnailUrl?: string;
  version: number;
  cloudName: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  createdAt: string;
  variants: Variant[];
  metadata?: PhotoMetadata;
};

type PhotoMetadata = {
  capturedAt: string | null;
  camera: string | null;
  orientation: string | null;
  latitude: number | null;
  longitude: number | null;
  hasGps: boolean;
  raw: Record<string, unknown>;
};

const STORAGE_KEY = "roamboard-cloudinary-assets";

function readFakeDatabase(): UploadedAsset[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as UploadedAsset[] : [];
  } catch {
    return [];
  }
}

function saveToFakeDatabase(records: UploadedAsset[]) {
  const existing = readFakeDatabase();
  const merged = [
    ...records,
    ...existing.filter((item) => !records.some((record) => record.publicId === item.publicId)),
  ];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export function CloudinaryPlayground() {
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [selected, setSelected] = useState<UploadedAsset | null>(null);
  const [source, setSource] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("Upload an image or load saved images to inspect the response.");

  const showAssets = (next: UploadedAsset[], nextSource: string) => {
    setAssets(next);
    setSelected(next[0] ?? null);
    setSource(nextSource);
  };

  const selectAsset = async (asset: UploadedAsset) => {
    setSelected(asset);
    setError("");
    if (asset.metadata) return;

    setLoadingMetadata(true);
    try {
      const response = await fetch(`/api/cloudinary/metadata?publicId=${encodeURIComponent(asset.publicId)}`);
      const body = (await response.json()) as { metadata?: PhotoMetadata; error?: string };
      setRaw(JSON.stringify({ status: response.status, body }, null, 2));
      if (!response.ok || !body.metadata) throw new Error(body.error ?? "Could not extract image metadata");
      const enriched = { ...asset, metadata: body.metadata };
      setSelected(enriched);
      setAssets((current) => current.map((item) => item.publicId === asset.publicId ? enriched : item));
      saveToFakeDatabase([enriched]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not extract image metadata");
    } finally {
      setLoadingMetadata(false);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/cloudinary/upload", { method: "POST", body: form });
        const body = (await response.json()) as UploadedAsset & { error?: string };
        if (!response.ok) throw new Error(body.error ?? `Could not upload ${file.name}`);
        return body;
      }));
      saveToFakeDatabase(uploaded);
      showAssets(uploaded, "Fresh upload (also saved to fake DB)");
      setRaw(JSON.stringify({ uploaded }, null, 2));
      event.target.value = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cloudinary upload failed");
    } finally {
      setUploading(false);
    }
  };

  const loadFakeDatabase = () => {
    setError("");
    const saved = readFakeDatabase();
    showAssets(saved, "Fake database (localStorage)");
    setRaw(JSON.stringify({ assets: saved }, null, 2));
    if (saved.length === 0) setError("The fake database is empty. Upload an image first.");
  };

  const loadCloudinary = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloudinary/assets");
      const body = (await response.json()) as { assets?: UploadedAsset[]; error?: string };
      setRaw(JSON.stringify({ status: response.status, body }, null, 2));
      if (!response.ok) throw new Error(body.error ?? "Could not load Cloudinary assets");
      const cloudAssets = body.assets ?? [];
      showAssets(cloudAssets, "Cloudinary");
      if (cloudAssets.length === 0) setError("No tagged Roamboard uploads were found in Cloudinary.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Cloudinary assets");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <section className="card">
        <div className="endpoint-heading">
          <div><span className="method post">POST</span></div>
          <h2>1. Upload and save automatically</h2>
          <p>Select one or more user images. Each original is immediately uploaded to Cloudinary and its metadata is written to the browser-based fake database.</p>
        </div>
        <label>
          Choose JPG, PNG, WebP or HEIC images
          <input type="file" accept="image/*" multiple onChange={upload} disabled={uploading} />
        </label>
        <div className="toolbar">
          <button type="button" className="button secondary" onClick={loadFakeDatabase}>Load from fake database</button>
          <button type="button" className="button secondary" onClick={() => void loadCloudinary()} disabled={loading}>
            {loading ? "Loading Cloudinary…" : "Load from Cloudinary"}
          </button>
        </div>
        {uploading && <p className="muted">Uploading and preparing automatic crops…</p>}
        {error && <p className="muted">{error}</p>}
      </section>

      {assets.length > 0 && (
        <section className="endpoint-card">
          <div className="endpoint-heading">
            <div><span className="method">{source}</span></div>
            <h2>2. Choose an uploaded image</h2>
            <p>The source image stays untouched. Selecting it shows automatically focused delivery variants below.</p>
          </div>
          <div className="fsq-photo-grid">
            {assets.map((item) => (
              <figure key={item.publicId} style={selected?.publicId === item.publicId ? { outline: "3px solid #2563eb" } : undefined}>
                <img src={item.thumbnailUrl ?? item.variants[1]?.url ?? item.url} alt="User-uploaded Roamboard image" loading="lazy" />
                <figcaption>
                  <strong>{item.publicId.split("/").at(-1)}</strong><br />
                  {item.width} × {item.height} · {item.format.toUpperCase()}<br />
                  {(item.bytes / 1024).toFixed(0)} KB
                  <div className="photo-load-row"><button type="button" onClick={() => void selectAsset(item)}>Inspect image</button></div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {selected && (
        <section className="endpoint-card">
          <div className="endpoint-heading">
            <div><span className="method">EXIF / XMP / GPS</span></div>
            <h2>3. Extracted photo metadata</h2>
            <p>Cloudinary reads metadata embedded in the original file. Selecting a previously uploaded image requests its metadata from Cloudinary.</p>
          </div>
          {loadingMetadata ? <p className="muted">Extracting metadata from the original image…</p> : selected.metadata ? (
            <div className="result-grid">
              <article className="place-result">
                <h3>Capture information</h3>
                <p><strong>Taken:</strong> {selected.metadata.capturedAt ?? "Not embedded"}</p>
                <p><strong>Camera:</strong> {selected.metadata.camera ?? "Not embedded"}</p>
                <p><strong>Orientation:</strong> {selected.metadata.orientation ?? "Not embedded"}</p>
              </article>
              <article className="place-result">
                <h3>GPS location</h3>
                {selected.metadata.hasGps ? <>
                  <p>{selected.metadata.latitude?.toFixed(6)}, {selected.metadata.longitude?.toFixed(6)}</p>
                  <Link className="button" href={`/mapbox?latitude=${selected.metadata.latitude}&longitude=${selected.metadata.longitude}&photo=${encodeURIComponent(selected.publicId.split("/").at(-1) ?? "Uploaded photo")}`}>
                    Find this photo on Mapbox
                  </Link>
                </> : <p>No GPS coordinates were embedded in this file.</p>}
              </article>
            </div>
          ) : <p className="muted">Select an image above to extract its metadata.</p>}
          {selected.metadata && <details className="raw-response"><summary>Raw embedded metadata</summary><pre>{JSON.stringify(selected.metadata.raw, null, 2)}</pre></details>}
        </section>
      )}

      {selected && (
        <section className="endpoint-card">
          <div className="endpoint-heading">
            <div><span className="method experimental">AUTO FOCUS</span></div>
            <h2>4. Ready-to-use image variants</h2>
            <p>Cloudinary chooses the visually important region, crops to each forced ratio and automatically optimizes quality and file format for the requesting browser.</p>
          </div>
          <div className="fsq-photo-grid">
            {selected.variants.map((variant) => (
              <figure key={variant.id}>
                <img src={variant.url} alt={`${variant.label} automatic Cloudinary crop`} loading="lazy" />
                <figcaption>
                  <strong>{variant.label}</strong><br />
                  {variant.width} × {variant.height}<br />
                  <a href={variant.url} target="_blank" rel="noreferrer">Open optimized image ↗</a>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="tier-note">
            <strong>No manual crop data</strong>
            <span>Your future PostgreSQL record only needs the Cloudinary public ID, ownership and image metadata. The standard variants are reproducible from that ID.</span>
          </div>
        </section>
      )}

      <details className="raw-response"><summary>Raw JSON and request result</summary><pre>{raw}</pre></details>
    </div>
  );
}
