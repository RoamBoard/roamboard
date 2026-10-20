import { AppError } from "../../shared/app-error.js";
import type { BoardRepository } from "../boards/boards.types.js";
import { canReadBoard } from "../boards/boards.types.js";
import { featuredBoards, rankSearch } from "./discovery.ranking.js";
import type {
    CollectionContext,
    CollectionQuery,
    DiscoveryCandidate,
    DiscoveryCard,
    DiscoveryQuery,
    DiscoveryRepository
} from "./discovery.types.js";

export function publicCard(board: DiscoveryCandidate): DiscoveryCard {
    return {
        boardId: board.boardId,
        title: board.title,
        description: board.description,
        status: board.status,
        visibility: board.visibility,
        owner: board.owner,
        destination: board.destination,
        coverImageUrl: board.coverImageUrl,
        tags: board.tags,
        durationDays: board.durationDays,
        activityCount: board.activityCount,
        savedCount: board.savedCount,
        savedByMe: board.savedByMe,
        firstPublishedAt: board.firstPublishedAt,
        updatedAt: board.updatedAt,
        permissions: board.permissions,
        ...(board.savedAt ? { savedAt: board.savedAt } : {})
    };
}
const pageOf = (items: DiscoveryCandidate[], page: number, limit: number) => ({
    items: items.slice((page - 1) * limit, page * limit).map(publicCard),
    page,
    limit,
    total: items.length,
    hasMore: page * limit < items.length
});

export function createDiscoveryService(repository: DiscoveryRepository, boards: BoardRepository) {
    return {
        async collection(userId: string | null, context: CollectionContext, input: CollectionQuery) {
            const invalid = (message: string): never => {
                throw new AppError(400, message, "INVALID_REQUEST");
            };
            if (["mine", "saved", "friends"].includes(context) && !userId)
                throw new AppError(401, "Not signed in", "UNAUTHENTICATED");
            if (["profile", "profile-saved"].includes(context) && !input.handle)
                invalid("A profile handle is required");
            if (context === "map" && !input.handle && !userId)
                throw new AppError(401, "Not signed in", "UNAUTHENTICATED");
            if (input.handle && !["profile", "profile-saved", "map"].includes(context))
                invalid("Handle is not valid for this collection");
            if (input.handle && repository.profileExists && !(await repository.profileExists(input.handle)))
                throw new AppError(404, "Profile not found", "NOT_FOUND");
            if (
                context === "map" &&
                input.handle &&
                ["saved", "both"].includes(input.collection ?? "published") &&
                repository.canReadSavedMap &&
                !(await repository.canReadSavedMap(userId, input.handle))
            )
                throw new AppError(404, "Collection not found", "NOT_FOUND");
            if ((context === "category") !== Boolean(input.tag))
                invalid("Category requires a tag; other collections do not accept it");
            if (input.period && context !== "featured") invalid("Period is only valid for Featured");
            if (
                context !== "map" &&
                [input.country, input.longitude, input.latitude, input.collection].some((value) => value !== undefined)
            )
                invalid("Location parameters are only valid for map collections");
            if (context === "map" && Boolean(input.country) === (input.longitude !== undefined))
                invalid("Choose a country or a map point");
            if ((input.longitude === undefined) !== (input.latitude === undefined))
                invalid("Map points require both coordinates");
            if (input.status && context !== "mine") invalid("Status is only valid for My Boards");
            const saved = context === "saved" || context === "profile-saved";
            const sort =
                input.sort ??
                (input.q
                    ? "relevance"
                    : saved
                      ? "saved-at-desc"
                      : context === "mine"
                        ? "updated-desc"
                        : "published-desc");
            if (sort === "relevance" && !input.q) invalid("Relevance requires a search");
            if (sort === "saved-at-desc" && !saved) invalid("Recently saved requires a saved collection");
            const scope = context === "mine" ? "mine" : context === "saved" ? "saved" : "discovery";
            const candidates = await repository.candidates(
                userId,
                scope,
                context === "featured" ? (input.period === "week" ? 7 : 30) : undefined,
                { ...input, context }
            );
            const source = context === "featured" ? featuredBoards(candidates) : candidates;
            const items = input.q
                ? rankSearch(source, { q: input.q, location: "off", page: 1, limit: 20 }).boards
                : source;
            if (sort !== "relevance")
                items.sort((a, b) => {
                    const comparison =
                        sort === "title-asc"
                            ? a.title.localeCompare(b.title, "en", { sensitivity: "base" })
                            : sort === "title-desc"
                              ? b.title.localeCompare(a.title, "en", { sensitivity: "base" })
                              : sort === "saved-count-desc"
                                ? b.savedCount - a.savedCount
                                : sort === "saved-at-desc"
                                  ? (b.savedAt ?? "").localeCompare(a.savedAt ?? "")
                                  : sort === "updated-desc"
                                    ? b.updatedAt.localeCompare(a.updatedAt)
                                    : (b.firstPublishedAt ?? "").localeCompare(a.firstPublishedAt ?? "");
                    return comparison || b.boardId - a.boardId;
                });
            const result = pageOf(items, input.page, 20);
            if (!saved)
                result.items.forEach((item) => {
                    delete item.savedAt;
                });
            return { ...result, sort };
        },
        async search(userId: string | null, input: DiscoveryQuery) {
            const [candidates, catalog] = await Promise.all([
                repository.candidates(userId, "discovery"),
                repository.placeCatalog?.() ?? Promise.resolve([])
            ]);
            const result = rankSearch(candidates, input, catalog);
            return { ...pageOf(result.boards, input.page, input.limit), location: result.location };
        },
        async list(userId: string | null, scope: "discovery" | "mine" | "saved", page: number, limit: number) {
            if (scope !== "discovery" && !userId) throw new AppError(401, "Not signed in", "UNAUTHENTICATED");
            const items = await repository.candidates(userId, scope);
            items.sort(
                (a, b) =>
                    (scope === "saved"
                        ? (b.savedAt ?? "").localeCompare(a.savedAt ?? "")
                        : scope === "mine"
                          ? b.updatedAt.localeCompare(a.updatedAt)
                          : (b.firstPublishedAt ?? "").localeCompare(a.firstPublishedAt ?? "")) || b.boardId - a.boardId
            );
            return pageOf(items, page, limit);
        },
        async featured(userId: string | null, period: "week" | "month") {
            return {
                items: featuredBoards(await repository.candidates(userId, "discovery", period === "week" ? 7 : 30)).map(
                    publicCard
                ),
                period
            };
        },
        async view(boardId: number, userId: string | null, browserId: string, token?: string) {
            const access = await boards.getAccess(boardId, userId);
            if (!access || access.status !== "published" || !canReadBoard(access, userId))
                throw new AppError(404, "Board not found", "NOT_FOUND");
            if (access.ownerUserId === userId) return { counted: false, token: null };
            const viewerKey = userId ? `u:${userId}` : `g:${browserId}`;
            if (!token) return { counted: false, token: await repository.startView(boardId, viewerKey) };
            return { counted: await repository.finishView(boardId, viewerKey, token, userId), token: null };
        }
    };
}
