export type Place = { name: string; city: string | null; country: string | null; address: string | null };
export type DiscoveryCard = {
    boardId: number;
    title: string;
    description: string;
    status: "draft" | "published";
    visibility: "public" | "friends" | "collaborators";
    owner: { username: string; displayName: string; photoUrl: string | null };
    destination: Place | null;
    coverImageUrl: string | null;
    tags: string[];
    durationDays: number;
    activityCount: number;
    savedCount: number;
    savedByMe: boolean;
    firstPublishedAt: string | null;
    updatedAt: string;
    savedAt?: string;
    permissions: { canEditContent: boolean; canManageBoard: boolean };
};
// Internal search fields are never sent to clients.
export type DiscoveryCandidate = DiscoveryCard & {
    owned: boolean;
    locations: Place[];
    activityText: string;
    viewers: number;
    guests: number;
    savers: number;
    commenters: number;
};
export type GeographicSelections = { countries?: string[]; continents?: string[] };
export type DiscoveryQuery = GeographicSelections & {
    q: string;
    page: number;
    limit: number;
    location: "auto" | "off";
};
export type DiscoveryPage = { items: DiscoveryCard[]; page: number; limit: number; total: number; hasMore: boolean };
export type LocationInterpretation = { label: string; term: string } | null;
export interface DiscoveryRepository {
    candidates(
        userId: string | null,
        scope: "discovery" | "mine" | "saved",
        days?: number,
        context?: CollectionQuery & { context: CollectionContext }
    ): Promise<DiscoveryCandidate[]>;
    canReadSavedMap?(viewerId: string | null, handle: string): Promise<boolean>;
    profileExists?(handle: string): Promise<boolean>;
    placeCatalog?(): Promise<Place[]>;
    browser(browserId: string | null, userId: string | null): Promise<string>;
    mergeBrowser(browserId: string, userId: string): Promise<void>;
    startView(boardId: number, viewerKey: string): Promise<string>;
    finishView(boardId: number, viewerKey: string, token: string, userId: string | null): Promise<boolean>;
}

export type CollectionContext =
    | "mine"
    | "saved"
    | "friends"
    | "profile"
    | "profile-saved"
    | "map"
    | "category"
    | "destination"
    | "recent"
    | "featured";
export type CollectionQuery = GeographicSelections & {
    q?: string;
    sort?:
        | "relevance"
        | "title-asc"
        | "title-desc"
        | "published-desc"
        | "updated-desc"
        | "saved-count-desc"
        | "saved-at-desc";
    page: number;
    limit: number;
    handle?: string;
    tag?: string;
    tags?: string[];
    period?: "week" | "month";
    country?: string;
    longitude?: number;
    latitude?: number;
    collection?: "published" | "saved" | "both";
    status?: "draft" | "published";
};
