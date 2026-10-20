import type { DiscoveryCard } from "../../src/lib/boards-discovery";

export function discoveryCard(boardId: number, changes: Partial<DiscoveryCard> = {}): DiscoveryCard {
    return {
        boardId,
        title: `Published Board ${boardId}`,
        description: "Notes from the author.",
        status: "published",
        visibility: "public",
        owner: { username: "actual_author", displayName: "Actual Author", photoUrl: null },
        destination: { name: "Kyoto", city: "Kyoto", country: "JPN", address: "Kyoto, Japan" },
        coverImageUrl: "/api/v1/images/81/content?variant=display",
        tags: ["Foodie", "Architecture"],
        durationDays: 2,
        activityCount: 3,
        savedCount: 0,
        savedByMe: false,
        firstPublishedAt: "2026-10-20T10:00:00Z",
        updatedAt: "2026-10-20T10:00:00Z",
        permissions: { canEditContent: false, canManageBoard: false },
        ...changes
    };
}
