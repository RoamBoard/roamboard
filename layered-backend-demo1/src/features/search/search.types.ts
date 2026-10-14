export const entityTypes = ["destination", "place", "itinerary"] as const;

export type EntityType = (typeof entityTypes)[number];

export interface SearchLocation {
    lat: number;
    lon: number;
}

export interface SearchDocument {
    id: string;
    entityType: EntityType;
    title: string;
    titleSuggest: string;
    description: string;
    city: string;
    country: string;
    tags: string[];
    categories: string[];
    location: SearchLocation;
    popularity: number;
    isPublic: boolean;
    updatedAt: string;
}

export interface SearchFilters {
    entityType?: EntityType;
    country?: string;
    category?: string;
    page: number;
    limit: number;
}

export interface SearchInput extends SearchFilters {
    query: string;
}

export interface SearchHit {
    document: SearchDocument;
    score: number;
}

export interface SearchResult {
    hits: SearchHit[];
    total: number;
    page: number;
    limit: number;
}

export interface SearchSourceRepository {
    findAll(): Promise<SearchDocument[]>;
}
