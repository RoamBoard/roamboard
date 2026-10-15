export interface SearchDocument {
    id: string;
    entityType: "itinerary";
    title: string;
    description: string;
    city: string;
    country: string;
    tags: string[];
    categories: string[];
    location: { lat: number; lon: number };
    popularity: number;
    isPublic: true;
    updatedAt: string;
}
export interface SearchInput {
    q: string;
    entityType?: "itinerary";
    country?: string;
    category?: string;
    page: number;
    limit: number;
}
export interface SearchRepository {
    listPublicIds(): Promise<string[]>;
    listPublic(boardIds?: string[]): Promise<SearchDocument[]>;
}
export interface SearchProvider {
    search(
        input: SearchInput,
        publicIds: string[]
    ): Promise<{ hits: Array<{ id: string; score: number }>; total: number }>;
    suggestions(query: string, limit: number, publicIds: string[]): Promise<string[]>;
    replace(documents: SearchDocument[]): Promise<void>;
    update(boardId: number, document: SearchDocument | null): Promise<void>;
}
