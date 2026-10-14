import type { GooglePlaceReferenceRepository, SavedGooglePlaceReference } from "./provider.types.js";

export function createMemoryGooglePlaceReferenceRepository(): GooglePlaceReferenceRepository {
    const references = new Map<string, SavedGooglePlaceReference>();
    return {
        save: async (placeId) => {
            const existing = references.get(placeId);
            if (existing) return existing;
            const reference = { placeId, savedAt: new Date().toISOString() };
            references.set(placeId, reference);
            return reference;
        },
        list: async () => [...references.values()].sort((left, right) => right.savedAt.localeCompare(left.savedAt)),
        delete: async (placeId) => references.delete(placeId)
    };
}
