import { AppError } from "../../shared/app-error.js";
import type { BoardRepository } from "../boards/boards.types.js";
import { canReadBoard } from "../boards/boards.types.js";
import { featuredBoards, rankSearch } from "./discovery.ranking.js";
import type { DiscoveryCandidate, DiscoveryCard, DiscoveryQuery, DiscoveryRepository } from "./discovery.types.js";

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
