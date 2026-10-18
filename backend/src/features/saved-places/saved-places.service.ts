import type { PlaceInput, SavedPlacesRepository } from "./saved-places.types.js";

// Session middleware supplies the owner; the request body never chooses an account.
export function createSavedPlacesService(repository: SavedPlacesRepository) {
    return {
        list: (userId: string) => repository.list(userId),
        save: (userId: string, place: PlaceInput) => repository.save(userId, place),
        remove: (userId: string, placeId: string) => repository.remove(userId, placeId)
    };
}
