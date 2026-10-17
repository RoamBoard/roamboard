export interface LibraryAsset {
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
}

export interface LibraryImage {
    assetKey: string;
    revision: number;
    asset: LibraryAsset;
    aliases: string[];
    usages: string[];
}

export interface LibraryRepository {
    list(keys?: string[]): Promise<LibraryImage[]>;
    find(key: string): Promise<LibraryImage | null>;
    save(
        key: string,
        expectedRevision: number,
        asset: LibraryAsset,
        aliases?: string[],
        usages?: string[]
    ): Promise<LibraryImage>;
}

export interface LibraryInput {
    assetKey: string;
    expectedRevision: number;
    alt: string;
    credit: string;
    sourceUrl: string;
}

export interface LibraryProvider {
    upload(file: Buffer, input: LibraryInput): Promise<LibraryAsset>;
    unsplash(photoId: string): Promise<LibraryAsset>;
}
