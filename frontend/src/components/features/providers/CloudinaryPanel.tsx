/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

import {
    buildCloudinaryDelivery,
    loadCloudinaryProviderAssets,
    loadCloudinaryProviderMetadata,
    uploadCloudinaryProvider,
    type CloudinaryAsset
} from "@/lib/providers";

type Props = { configured: boolean };

export default function CloudinaryPanel({ configured }: Props) {
    const [assets, setAssets] = useState<CloudinaryAsset[]>([]);
    const [selected, setSelected] = useState<CloudinaryAsset | null>(null);
    const [deliveryUrl, setDeliveryUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingMetadata, setLoadingMetadata] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    async function upload(event: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        if (files.length === 0) return;
        setLoading(true);
        setError("");
        setMessage("");
        try {
            const uploaded = await Promise.all(files.map((file) => uploadCloudinaryProvider(file)));
            setAssets((current) => [
                ...uploaded,
                ...current.filter((item) => !uploaded.some((next) => next.publicId === item.publicId))
            ]);
            setSelected(uploaded[0] ?? null);
            setDeliveryUrl("");
            setMessage(
                `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded. Select an image to inspect its Cloudinary metadata and delivery options.`
            );
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Cloudinary upload failed.");
        } finally {
            setLoading(false);
            event.target.value = "";
        }
    }

    async function inspect(asset: CloudinaryAsset) {
        setSelected(asset);
        setDeliveryUrl("");
        setError("");
        if (asset.metadata) return;
        setLoadingMetadata(true);
        try {
            const result = await loadCloudinaryProviderMetadata(asset.publicId);
            const enriched = { ...asset, metadata: result.metadata };
            setSelected(enriched);
            setAssets((current) => current.map((item) => (item.publicId === asset.publicId ? enriched : item)));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not extract image metadata.");
        } finally {
            setLoadingMetadata(false);
        }
    }

    async function loadAssets() {
        setLoading(true);
        setError("");
        setMessage("");
        try {
            const loaded = await loadCloudinaryProviderAssets();
            setAssets(loaded);
            setSelected(null);
            setDeliveryUrl("");
            setMessage(
                loaded.length
                    ? `${loaded.length} Cloudinary image${loaded.length === 1 ? "" : "s"} loaded. Metadata is read from the original asset when you select it.`
                    : "No Roamboard-tagged uploads found in Cloudinary."
            );
            if (loaded[0]) await inspect(loaded[0]);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not load Cloudinary assets.");
        } finally {
            setLoading(false);
        }
    }

    async function buildDelivery() {
        if (!selected) return;
        setError("");
        try {
            const result = await buildCloudinaryDelivery(selected.publicId, "1200", "675", "fill");
            setDeliveryUrl(result.url);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not build the delivery URL.");
        }
    }

    if (!configured) {
        return (
            <div className="border-line mt-8 border p-6">
                <h2 className="font-display text-24 text-foreground font-bold">Cloudinary</h2>
                <p className="text-14 text-graphite mt-5 leading-6">
                    Add Cloudinary cloud name, API key, and API secret to upload images and inspect their metadata.
                </p>
            </div>
        );
    }

    return (
        <div className="border-line mt-8 border p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-24 text-foreground font-bold">Upload and inspect images</h2>
                <span className="text-10 tracking-label text-graphite font-bold uppercase">configured</span>
            </div>
            <p className="text-14 text-graphite mt-3 max-w-2xl leading-6">
                Upload JPG, PNG, WebP, HEIC, or another image type supported by Cloudinary. The backend keeps the key
                private, uploads the original, reads metadata, and can hand GPS coordinates to Mapbox.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
                <label className="border-foreground bg-foreground text-14 text-background cursor-pointer border px-5 py-3">
                    {loading ? "Working..." : "Upload image(s)"}
                    <input
                        className="sr-only"
                        type="file"
                        accept="image/*,.heic,.heif"
                        multiple
                        disabled={loading}
                        onChange={(event) => void upload(event)}
                    />
                </label>
                <button
                    type="button"
                    className="border-foreground text-14 border px-5 py-3"
                    disabled={loading}
                    onClick={() => void loadAssets()}
                >
                    Load from Cloudinary
                </button>
            </div>
            {message ? (
                <p className="text-14 text-foreground mt-4" role="status">
                    {message}
                </p>
            ) : null}
            {error ? (
                <p className="text-14 mt-4" role="alert">
                    {error}
                </p>
            ) : null}

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {assets.map((asset) => (
                    <figure
                        key={asset.publicId}
                        className={
                            selected?.publicId === asset.publicId
                                ? "border-foreground border-2 p-2"
                                : "border-line border p-2"
                        }
                    >
                        <button type="button" className="block w-full text-left" onClick={() => void inspect(asset)}>
                            <img
                                className="aspect-video w-full object-cover"
                                src={asset.thumbnailUrl}
                                alt={`Cloudinary asset ${asset.publicId.split("/").at(-1) ?? "image"}`}
                            />
                            <figcaption className="text-12 text-graphite mt-3 leading-5">
                                <strong className="text-foreground block">{asset.publicId.split("/").at(-1)}</strong>
                                {asset.width} × {asset.height} · {asset.format.toUpperCase()} ·{" "}
                                {(asset.bytes / 1024).toFixed(0)} KB
                            </figcaption>
                        </button>
                    </figure>
                ))}
            </div>

            {selected ? (
                <section className="border-line mt-10 border-t pt-6" aria-labelledby="cloudinary-metadata-heading">
                    <h3 id="cloudinary-metadata-heading" className="font-display text-22 text-foreground font-bold">
                        Extracted metadata
                    </h3>
                    {loadingMetadata ? (
                        <p className="text-14 text-graphite mt-4">
                            Reading EXIF, XMP, and GPS metadata from Cloudinary...
                        </p>
                    ) : null}
                    {!loadingMetadata && selected.metadata ? (
                        <>
                            <div className="text-14 text-graphite mt-4 grid gap-3 sm:grid-cols-2">
                                <p>Captured: {selected.metadata.capturedAt ?? "Not embedded"}</p>
                                <p>Camera: {selected.metadata.camera ?? "Not embedded"}</p>
                                <p>Orientation: {selected.metadata.orientation ?? "Not embedded"}</p>
                                <p>
                                    GPS:{" "}
                                    {selected.metadata.hasGps
                                        ? `${selected.metadata.latitude?.toFixed(6)}, ${selected.metadata.longitude?.toFixed(6)}`
                                        : "Not embedded"}
                                </p>
                            </div>
                            <details className="border-line text-12 text-graphite mt-5 border p-4">
                                <summary className="text-foreground cursor-pointer font-bold">
                                    Raw embedded metadata ({Object.keys(selected.metadata.raw).length} fields)
                                </summary>
                                <pre className="mt-4 max-h-80 overflow-auto break-words whitespace-pre-wrap">
                                    {JSON.stringify(selected.metadata.raw, null, 2)}
                                </pre>
                            </details>
                        </>
                    ) : null}
                    {!loadingMetadata && !selected.metadata ? (
                        <p className="text-14 text-graphite mt-4">Select an image to ask Cloudinary for metadata.</p>
                    ) : null}
                    {selected.metadata?.hasGps ? (
                        <a
                            className="border-foreground text-14 mt-5 inline-block border px-4 py-3"
                            href={`/dev/providers?tab=mapbox&latitude=${selected.metadata.latitude}&longitude=${selected.metadata.longitude}`}
                        >
                            Open GPS pin in Mapbox
                        </a>
                    ) : null}
                    <button
                        type="button"
                        className="border-foreground bg-foreground text-14 text-background mt-5 ml-3 border px-4 py-3"
                        disabled={!selected.metadata || loadingMetadata}
                        onClick={() => void buildDelivery()}
                    >
                        Preview responsive delivery
                    </button>
                    {deliveryUrl ? (
                        <img
                            className="mt-6 aspect-video max-w-2xl object-cover"
                            src={deliveryUrl}
                            alt="Cloudinary delivery preview"
                        />
                    ) : null}
                </section>
            ) : null}
        </div>
    );
}
