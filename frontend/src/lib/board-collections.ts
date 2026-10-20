export type CollectionContext =
    "mine" | "saved" | "friends" | "profile" | "profile-saved" | "map" | "category" | "recent" | "featured" | "samples";
export type CollectionSource = { context: CollectionContext; params?: Record<string, string> };
export const collectionTitles: Record<CollectionContext, string> = {
    mine: "My Boards",
    saved: "Saved Boards",
    friends: "Friends’ boards",
    profile: "Profile Boards",
    "profile-saved": "Currently inspired by",
    map: "Boards in this destination",
    category: "Category Boards",
    recent: "Recently published",
    featured: "Featured Boards",
    samples: "Discover samples"
};
export function collectionHref(context: CollectionContext, params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return `/boards/collections/${context}${query ? `?${query}` : ""}`;
}
export function collectionDefaultSort(context: CollectionContext, searching = false) {
    return searching
        ? "relevance"
        : context === "saved" || context === "profile-saved"
          ? "saved-at-desc"
          : context === "mine"
            ? "updated-desc"
            : context === "samples"
              ? "title-asc"
              : "published-desc";
}
