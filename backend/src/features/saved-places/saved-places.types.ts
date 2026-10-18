// Saved suggestions belong to an account, not to a Board or a provider search session.
export type PlaceInput = {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    city: string;
    country: string;
};
export type SavedPlace = PlaceInput & { savedAt: string };
export interface SavedPlacesRepository {
    list(userId: string): Promise<SavedPlace[]>;
    save(userId: string, place: PlaceInput): Promise<SavedPlace>;
    remove(userId: string, placeId: string): Promise<void>;
}
