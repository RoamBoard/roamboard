import editorialImages from "../../../shared/editorial-images.json";

export function editorialImage(source: string): string {
    if (source.startsWith("library:")) return source;
    const image = editorialImages.find((image) => image.aliases.includes(source));
    if (!image) throw new Error(`Editorial image is not registered: ${source}`);
    return `library:${image.assetKey}`;
}

export function editorialFallback(source: string): string | undefined {
    return source.startsWith("library:")
        ? editorialImages.find((image) => image.assetKey === source.slice(8))?.source
        : source;
}

export type LibraryAsset = {
    provider: "cloudinary" | "unsplash";
    url: string;
    thumbnailUrl: string;
    alt: string;
    credit: string;
    sourceUrl: string;
    photographerUrl: string;
    cloudinaryAssetId: string | null;
    cloudinaryPublicId: string | null;
    unsplashPhotoId: string | null;
    checksum: string | null;
    width: number;
    height: number;
};
export type LibraryImage = {
    assetKey: string;
    revision: number;
    asset: LibraryAsset;
    aliases: string[];
    usages: string[];
};
export const libraryOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function libraryRequest<T>(path = "", init?: RequestInit): Promise<T> {
    const response = await fetch(`${libraryOrigin}/api/v1/image-library${path}`, {
        ...init,
        credentials: "include",
        cache: "no-store"
    });
    const body = (await response.json()) as { data?: T; error?: { message?: string } };
    if (!response.ok || body.data === undefined)
        throw new Error(body.error?.message ?? "Image library is unavailable. Existing images are retained.");
    return body.data;
}

export const getLibraryImage = (assetKey: string) => libraryRequest<LibraryImage>(`/${encodeURIComponent(assetKey)}`);
export const getLibraryImages = (keys: string[]) =>
    keys.length
        ? libraryRequest<LibraryImage[]>(`?keys=${encodeURIComponent([...new Set(keys)].join(","))}`)
        : Promise.resolve<LibraryImage[]>([]);

export function sourceIdentity(source: string): string {
    if (
        source.startsWith("https://images.unsplash.com/") ||
        /^https:\/\/unsplash\.com\/photos\/[\w-]+\/download(?:\?|$)/.test(source)
    )
        return new URL(source).pathname;
    return source;
}

export function findLibraryImage(images: LibraryImage[], source: string): LibraryImage | undefined {
    if (source.startsWith("library:")) return images.find((image) => image.assetKey === source.slice(8));
    const identity = sourceIdentity(source);
    return images.find((image) => image.aliases.some((alias) => sourceIdentity(alias) === identity));
}

export function librarySource(image: LibraryImage | undefined, original: string, sourceWidth?: number): string {
    const resolved = resolveLibrarySource(image, original);
    if (sourceWidth === undefined || !resolved.startsWith("https://images.unsplash.com/")) return resolved;
    const url = new URL(resolved);
    url.searchParams.set("w", String(sourceWidth));
    return url.toString();
}

function resolveLibrarySource(image: LibraryImage | undefined, original: string): string {
    if (!image) return original;
    if (image.asset.provider !== "unsplash" || !/^https:\/\/(images\.unsplash\.com|unsplash\.com)\//.test(original))
        return image.asset.url;
    const url = new URL(image.asset.url);
    const previous = new URL(original);
    // Keep placement-specific sizes/crops, while retaining the selected photo's tracking parameters.
    for (const name of ["w", "h", "fit", "crop", "q", "auto"]) {
        const value = previous.searchParams.get(name);
        if (value !== null) url.searchParams.set(name, value);
    }
    return url.toString();
}
