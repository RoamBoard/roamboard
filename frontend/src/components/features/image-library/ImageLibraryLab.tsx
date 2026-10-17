"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LibraryImg } from "@/components/images/LibraryImage";
import { libraryRequest, type LibraryImage } from "@/lib/image-library";
import { searchUnsplashProvider, type ProviderPhoto } from "@/lib/providers";

const field = "border-line bg-background text-foreground w-full rounded border px-3 py-2";
const button =
    "border-line rounded border px-4 py-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4";

export default function ImageLibraryLab() {
    const [images, setImages] = useState<LibraryImage[]>([]);
    const [selected, setSelected] = useState<LibraryImage | null>(null);
    const [filter, setFilter] = useState("");
    const [key, setKey] = useState("");
    const [alt, setAlt] = useState("");
    const [credit, setCredit] = useState("");
    const [sourceUrl, setSourceUrl] = useState("");
    const [query, setQuery] = useState("");
    const [photos, setPhotos] = useState<ProviderPhoto[]>([]);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    async function refresh() {
        const records = await libraryRequest<LibraryImage[]>();
        setImages(records);
        window.dispatchEvent(new Event("image-library-updated"));
        return records;
    }
    useEffect(() => {
        const controller = new AbortController();
        void libraryRequest<LibraryImage[]>("", { signal: controller.signal })
            .then(setImages)
            .catch((cause: unknown) => {
                if (!controller.signal.aborted)
                    setError(cause instanceof Error ? cause.message : "Could not load images");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, []);

    function choose(image: LibraryImage | null) {
        setSelected(image);
        setKey(image?.assetKey ?? "");
        setAlt(image?.asset.alt ?? "");
        setCredit(image?.asset.credit ?? "");
        setSourceUrl(image?.asset.sourceUrl ?? "");
        setMessage("");
        setError("");
    }
    async function action(work: () => Promise<void>) {
        setBusy(true);
        setError("");
        setMessage("");
        try {
            await work();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Image operation failed");
        } finally {
            setBusy(false);
        }
    }
    async function saved(image: LibraryImage) {
        choose(image);
        setMessage(
            `Saved ${image.assetKey}, revision ${image.revision}. Copy its reference below. Website pages load the current catalog when opened.`
        );
        await refresh();
    }
    function upload(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const file = form.get("file");
        if (!(file instanceof File) || !file.size) {
            setError("Choose an image file.");
            return;
        }
        const body = new FormData();
        body.set("file", file);
        const params = new URLSearchParams({
            assetKey: key,
            expectedRevision: String(selected?.revision ?? 0),
            alt,
            credit,
            sourceUrl
        });
        void action(async () =>
            saved(await libraryRequest<LibraryImage>(`/upload?${params}`, { method: "POST", body }))
        );
    }
    function selectUnsplash(photo: ProviderPhoto) {
        if (!key) {
            setError("Enter a reusable image key first.");
            return;
        }
        void action(async () =>
            saved(
                await libraryRequest<LibraryImage>("/unsplash", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        assetKey: key,
                        expectedRevision: selected?.revision ?? 0,
                        photoId: photo.id
                    })
                })
            )
        );
    }
    const visible = images.filter((image) =>
        `${image.assetKey} ${image.asset.alt} ${image.asset.credit}`.toLowerCase().includes(filter.toLowerCase())
    );
    return (
        <section className="text-foreground w-full max-w-6xl px-6 py-14 sm:px-10 lg:px-20">
            <p className="text-graphite text-sm font-bold uppercase">Developer lab</p>
            <h1 className="font-display mt-5 text-5xl font-bold">Image library</h1>
            <p className="text-muted-foreground mt-5 max-w-2xl">
                Website photography stored in the database. Upload your own file or select an attributed Unsplash photo.
                This development page is removed before deployment.
            </p>
            {error && (
                <p role="alert" className="border-foreground mt-5 border-l-2 pl-3">
                    {error}
                </p>
            )}
            {message && (
                <p role="status" className="mt-5">
                    {message}
                </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
                <button className={button} disabled={busy} onClick={() => choose(null)}>
                    Add new image
                </button>
                <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                        void action(async () => {
                            await refresh();
                            setLoading(false);
                        })
                    }
                >
                    Reload library
                </button>
            </div>
            <div className="mt-8 grid gap-10 lg:grid-cols-2">
                <div>
                    <label className="block">
                        Search library
                        <input
                            className={`${field} mt-2`}
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                        />
                    </label>
                    {loading ? (
                        <p role="status" className="mt-4">
                            Loading images…
                        </p>
                    ) : visible.length === 0 ? (
                        <p className="mt-4">No images found. Add one or run the frontend image import.</p>
                    ) : null}
                    <div className="mt-5 grid max-h-[70vh] grid-cols-2 gap-4 overflow-auto">
                        {visible.map((image) => (
                            <button
                                key={image.assetKey}
                                className="border-line overflow-hidden rounded border text-left focus-visible:outline-2"
                                onClick={() => choose(image)}
                                disabled={busy}
                                aria-pressed={selected?.assetKey === image.assetKey}
                            >
                                <LibraryImg
                                    src={image.asset.thumbnailUrl}
                                    alt={image.asset.alt}
                                    loading="lazy"
                                    className="aspect-video w-full object-cover"
                                />
                                <span className="block p-3 text-sm break-all">
                                    {image.assetKey}
                                    <span className="text-muted-foreground block">
                                        {image.asset.provider} · revision {image.revision}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <h2 className="font-display text-2xl font-bold">
                        {selected ? "Replace shared image" : "Add image"}
                    </h2>
                    {selected && (
                        <div className="border-line mt-4 space-y-3 border-y py-4">
                            <p>
                                Replacement updates every catalog usage of this reference. The previous file and
                                database revision are retained.
                            </p>
                            <code className="block break-all">library:{selected.assetKey}</code>
                            <button
                                className={button}
                                onClick={() =>
                                    void action(async () => {
                                        await navigator.clipboard.writeText(`library:${selected.assetKey}`);
                                        setMessage("Image reference copied.");
                                    })
                                }
                            >
                                Copy reference
                            </button>
                            <p className="text-sm break-all">
                                Cloudinary ID: {selected.asset.cloudinaryPublicId ?? "External Unsplash image"}
                            </p>
                            <p className="text-sm">Credit: {selected.asset.credit}</p>
                            {selected.asset.sourceUrl && (
                                <a
                                    href={selected.asset.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                >
                                    Original source
                                </a>
                            )}
                            <details>
                                <summary>Imported usages ({selected.usages.length})</summary>
                                <p className="text-muted-foreground text-sm">
                                    Inventory references, including shared data files. New usages added after import are
                                    not automatically scanned.
                                </p>
                                <ul className="mt-2 space-y-1 text-sm break-all">
                                    {selected.usages.map((usage) => (
                                        <li key={usage}>{usage}</li>
                                    ))}
                                </ul>
                                {selected.usages.length === 0 && (
                                    <p>No imported usages recorded. Search the repository for the copied reference.</p>
                                )}
                            </details>
                        </div>
                    )}
                    <label className="mt-4 block">
                        Reusable key
                        <input
                            className={`${field} mt-2`}
                            value={key}
                            disabled={!!selected || busy}
                            pattern="[a-z0-9][a-z0-9._-]{0,159}"
                            onChange={(event) => setKey(event.target.value)}
                            placeholder="destinations.kyoto.cover"
                        />
                    </label>
                    <form onSubmit={upload} className="mt-5 space-y-4">
                        <label className="block">
                            Image description
                            <input
                                required
                                maxLength={500}
                                className={`${field} mt-2`}
                                value={alt}
                                onChange={(event) => setAlt(event.target.value)}
                            />
                        </label>
                        <label className="block">
                            Photographer / owner
                            <input
                                required
                                maxLength={300}
                                className={`${field} mt-2`}
                                value={credit}
                                onChange={(event) => setCredit(event.target.value)}
                            />
                        </label>
                        <label className="block">
                            Original source URL (optional)
                            <input
                                type="url"
                                className={`${field} mt-2`}
                                value={sourceUrl}
                                onChange={(event) => setSourceUrl(event.target.value)}
                            />
                        </label>
                        <label className="block">
                            Your image file (up to 10 MB)
                            <input
                                required
                                name="file"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                                className="mt-2 block w-full"
                            />
                        </label>
                        <p className="text-muted-foreground text-sm">
                            Only upload files you have permission to use publicly. Unsplash API images should be
                            selected below.
                        </p>
                        <button type="submit" className={button} disabled={busy || !key}>
                            {busy ? "Working…" : selected ? "Upload replacement everywhere" : "Upload and save"}
                        </button>
                    </form>
                    <form
                        className="border-line mt-8 border-t pt-6"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void action(async () => setPhotos(await searchUnsplashProvider(query, 10)));
                        }}
                    >
                        <h3 className="font-display text-xl font-bold">Or choose from Unsplash</h3>
                        <label className="mt-3 block">
                            Search Unsplash
                            <input
                                required
                                minLength={2}
                                maxLength={100}
                                className={`${field} mt-2`}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                        </label>
                        <button type="submit" disabled={busy} className={`${button} mt-3`}>
                            Search photos
                        </button>
                    </form>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                        {photos.map((photo) => (
                            <div key={photo.id} className="border-line rounded border p-2">
                                <LibraryImg
                                    src={photo.thumbnailUrl}
                                    alt={photo.alt}
                                    className="aspect-video w-full object-cover"
                                />
                                <p className="mt-2 text-sm">
                                    Photo by{" "}
                                    <a
                                        href={photo.photographerUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="underline"
                                    >
                                        {photo.photographer}
                                    </a>{" "}
                                    on{" "}
                                    <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                                        Unsplash
                                    </a>
                                </p>
                                <button
                                    className={`${button} mt-2`}
                                    disabled={busy || !key}
                                    onClick={() => selectUnsplash(photo)}
                                >
                                    {selected ? "Use as replacement" : "Save photo"}
                                </button>
                            </div>
                        ))}
                    </div>
                    {busy && (
                        <p role="status" className="mt-4">
                            Working…
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
