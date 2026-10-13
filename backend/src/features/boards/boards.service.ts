import { AppError } from "../../shared/app-error.js";
import type { BoardWrite } from "./boards.schemas.js";
import type { BoardAccess, BoardDocument, BoardRepository, BoardsService } from "./boards.types.js";

function invalid(): never {
    throw new AppError(400, "Invalid Board request", "INVALID_REQUEST");
}

export function canReadBoard(access: BoardAccess, userId: string | null): boolean {
    if (access.ownerUserId === userId) return true;
    if (access.status === "draft") return false;
    if (access.visibility === "public") return true;
    if (userId !== null && access.memberRole) return true;
    return userId !== null && access.visibility === "friends" && access.isFriend;
}

function withPermissions(board: BoardDocument, access: BoardAccess, userId: string | null): BoardDocument {
    const owner = access.ownerUserId === userId;
    return {
        ...board,
        permissions: {
            canEditContent: owner || (access.status === "published" && access.memberRole === "editor"),
            canManageBoard: owner
        }
    };
}

function normalize(input: BoardWrite): BoardWrite {
    return {
        ...input,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        days: input.days.map((day) => ({
            ...day,
            activities: day.activities.map((activity) => ({
                ...activity,
                note: activity.note?.trim() || null
            }))
        }))
    };
}

async function validateDocument(repository: BoardRepository, input: BoardWrite): Promise<BoardWrite> {
    const normalized = normalize(input);
    if (new Set(input.tagIds).size !== input.tagIds.length) invalid();
    if (new Set(input.imageIds).size !== input.imageIds.length) invalid();
    if (input.coverImageId !== undefined && input.coverImageId !== null &&
        !input.imageIds.includes(input.coverImageId)) invalid();

    const [tags, categories] = await Promise.all([
        repository.listTags(),
        repository.listCategories()
    ]);
    const allowedTags = new Set(tags.map((tag) => tag.tagId));
    const allowedCategories = new Set(categories);
    if (input.tagIds.some((tagId) => !allowedTags.has(tagId))) invalid();

    const dayIds = new Set<number>();
    const activityIds = new Set<number>();
    const usedImages = new Set<number>();
    let hasConfirmedLocation = false;

    input.days.forEach((day, dayIndex) => {
        if (day.dayNumber !== dayIndex + 1) invalid();
        if (day.dayId !== undefined) {
            if (dayIds.has(day.dayId)) invalid();
            dayIds.add(day.dayId);
        }
        day.activities.forEach((activity, position) => {
            if (activity.position !== position) invalid();
            if (!allowedCategories.has(activity.category)) invalid();
            if (activity.activityId !== undefined) {
                if (activityIds.has(activity.activityId)) invalid();
                activityIds.add(activity.activityId);
            }
            if (activity.locationConfirmed && !activity.location) invalid();
            if (activity.source !== "photo" && activity.location && !activity.locationConfirmed) invalid();
            if (activity.location && activity.locationConfirmed) hasConfirmedLocation = true;
            for (const imageId of activity.uploadedImageIds) {
                if (!input.imageIds.includes(imageId) || usedImages.has(imageId)) invalid();
                usedImages.add(imageId);
            }
            if (activity.coverImageId !== undefined && activity.coverImageId !== null &&
                !activity.uploadedImageIds.includes(activity.coverImageId)) invalid();
        });
    });

    if (input.status === "published") {
        if (!input.title.trim() || !hasConfirmedLocation ||
            input.days.some((day) => day.activities.some((activity) =>
                activity.source === "photo" && !activity.locationConfirmed))) {
            throw new AppError(422, "Board is not ready to publish", "PUBLISH_REQUIREMENTS_NOT_MET");
        }
    }
    return normalized;
}

export function createBoardsService(repository: BoardRepository): BoardsService {
    return {
        listTags: () => repository.listTags(),
        listCategories: () => repository.listCategories(),
        async create(userId, input) {
            if (input.days.some((day) => day.dayId !== undefined ||
                day.activities.some((activity) => activity.activityId !== undefined))) invalid();
            const validated = await validateDocument(repository, input);
            const boardId = await repository.saveBoard(userId, null, null, validated);
            const board = await repository.getBoard(boardId);
            const access = await repository.getAccess(boardId, userId);
            if (!board || !access) throw new Error("Created Board could not be read");
            return withPermissions(board, access, userId);
        },
        async replace(userId, boardId, revision, input) {
            const access = await repository.getAccess(boardId, userId);
            if (!access) throw new AppError(404, "Board not found", "NOT_FOUND");
            const owner = access.ownerUserId === userId;
            if (!owner && (access.status !== "published" || access.memberRole !== "editor")) {
                throw new AppError(403, "Cannot edit this Board", "FORBIDDEN");
            }
            if (access.status === "published" && input.status !== "published") {
                throw new AppError(400, "A published Board cannot become a draft", "INVALID_REQUEST");
            }
            if (!owner && input.visibility !== access.visibility) {
                throw new AppError(403, "Only the owner can change visibility", "FORBIDDEN");
            }
            const validated = await validateDocument(repository, input);
            await repository.saveBoard(userId, boardId, revision, validated);
            const board = await repository.getBoard(boardId);
            const currentAccess = await repository.getAccess(boardId, userId);
            if (!board || !currentAccess) throw new Error("Updated Board could not be read");
            return withPermissions(board, currentAccess, userId);
        },
        async read(boardId, userId) {
            const access = await repository.getAccess(boardId, userId);
            if (!access || !canReadBoard(access, userId)) {
                throw new AppError(404, "Board not found", "NOT_FOUND");
            }
            const board = await repository.getBoard(boardId);
            if (!board) throw new AppError(404, "Board not found", "NOT_FOUND");
            return withPermissions(board, access, userId);
        },
        listDrafts: (userId, page, limit) => repository.listDrafts(userId, page, limit),
        listPublished: (userId, page, limit) => repository.listPublished(userId, page, limit),
        async delete(boardId, userId) {
            const access = await repository.getAccess(boardId, userId);
            if (!access) throw new AppError(404, "Board not found", "NOT_FOUND");
            if (access.ownerUserId !== userId) {
                throw new AppError(403, "Cannot delete this Board", "FORBIDDEN");
            }
            if (!await repository.deleteBoard(boardId, userId)) {
                throw new AppError(404, "Board not found", "NOT_FOUND");
            }
        }
    };
}
