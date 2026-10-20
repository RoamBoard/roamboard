import { AppError } from "../../shared/app-error.js";
import type { ImageCleanup } from "../images/images.cleanup.js";
import type { BoardWrite } from "./boards.schemas.js";
import type { BoardRepository, BoardsService, CopyBoardImage } from "./boards.types.js";

export { canReadBoard } from "./boards.types.js";

function invalid(): never {
    throw new AppError(400, "Invalid Board request", "INVALID_REQUEST");
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
                locationConfirmed: activity.source === "photo" && activity.location ? true : activity.locationConfirmed,
                note: activity.note?.trim() || null
            }))
        }))
    };
}

async function validateDocument(repository: BoardRepository, input: BoardWrite): Promise<BoardWrite> {
    if (input.days.length > 31) invalid();
    const normalized = normalize(input);
    if (new Set(input.tagIds).size !== input.tagIds.length) invalid();
    if (new Set(input.imageIds).size !== input.imageIds.length) invalid();
    if (input.coverImageId !== undefined && input.coverImageId !== null && !input.imageIds.includes(input.coverImageId))
        invalid();

    const [tags, categories] = await Promise.all([repository.listTags(), repository.listCategories()]);
    const allowedTags = new Set(tags.map((tag) => tag.tagId));
    const allowedCategories = new Set(categories);
    if (input.tagIds.some((tagId) => !allowedTags.has(tagId))) invalid();

    const dayIds = new Set<number>();
    const activityIds = new Set<number>();
    const usedImages = new Set<number>();
    let hasConfirmedLocation = false;

    normalized.days.forEach((day, dayIndex) => {
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
            if (
                activity.coverImageId !== undefined &&
                activity.coverImageId !== null &&
                !activity.uploadedImageIds.includes(activity.coverImageId)
            )
                invalid();
        });
    });

    if (input.status === "published") {
        if (!input.destination || !input.title.trim() || !hasConfirmedLocation) {
            throw new AppError(422, "Board is not ready to publish", "PUBLISH_REQUIREMENTS_NOT_MET");
        }
    }
    return normalized;
}

export function createBoardsService(
    repository: BoardRepository,
    copyImage?: CopyBoardImage,
    cleanupImages?: ImageCleanup
): BoardsService {
    return {
        async prepareRemix(userId, boardId) {
            const source = await repository.getBoard(boardId, userId);
            if (!source || source.status !== "published" || !source.savedByMe)
                throw new AppError(404, "Saved Board not found", "NOT_FOUND");
            const ids = new Map<number, number>();
            for (const image of source.images) {
                if (!copyImage) throw new AppError(503, "Photo copying is unavailable", "PROVIDER_UNAVAILABLE");
                ids.set(image.imageId, await copyImage(userId, boardId, image.imageId, source));
            }
            const remap = (id: number | null | undefined) =>
                id === null || id === undefined ? null : (ids.get(id) ?? null);
            return {
                title: source.title,
                description: source.description,
                destination: source.destination,
                tags: source.tags,
                coverImageId: remap(source.coverImageId),
                images: source.images.map((image) => ({
                    ...image,
                    capturedAt: null,
                    imageId: ids.get(image.imageId)!,
                    url: `/api/v1/images/${ids.get(image.imageId)!}/content?variant=display`,
                    thumbnailUrl: `/api/v1/images/${ids.get(image.imageId)!}/content?variant=thumbnail`
                })),
                days: source.days.map((day) => ({
                    dayNumber: day.dayNumber,
                    date: null,
                    activities: day.activities.map((activity) => ({
                        position: activity.position,
                        title: activity.title,
                        activityTime: activity.activityTime,
                        category: activity.category,
                        note: activity.note,
                        source: activity.source,
                        location: activity.location,
                        locationConfirmed: activity.locationConfirmed,
                        externalImage: activity.externalImage,
                        uploadedImageIds: activity.uploadedImageIds.map((id) => ids.get(id)!),
                        coverImageId: remap(activity.coverImageId)
                    }))
                }))
            };
        },
        listTags: () => repository.listTags(),
        listCategories: () => repository.listCategories(),
        async create(userId, input) {
            if (
                input.days.some(
                    (day) =>
                        day.dayId !== undefined || day.activities.some((activity) => activity.activityId !== undefined)
                )
            )
                invalid();
            const validated = await validateDocument(repository, input);
            return repository.saveBoard(userId, null, null, validated);
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
            const destination =
                input.destination === undefined && input.status === "published"
                    ? (await repository.getBoard(boardId, userId))?.destination
                    : input.destination;
            const validated = await validateDocument(repository, { ...input, destination });
            if (!owner && input.isCompleted !== undefined) {
                const current = await repository.getBoard(boardId, userId);
                if (current?.isCompleted !== input.isCompleted)
                    throw new AppError(403, "Only the owner can change completion", "FORBIDDEN");
            }
            const saved = await repository.saveBoard(userId, boardId, revision, validated);
            await cleanupImages?.();
            return saved;
        },
        async read(boardId, userId) {
            const board = await repository.getBoard(boardId, userId);
            if (!board) throw new AppError(404, "Board not found", "NOT_FOUND");
            return board;
        },
        listDrafts: (userId, page, limit) => repository.listDrafts(userId, page, limit),
        listPublished: (userId, page, limit) => repository.listPublished(userId, page, limit),
        listAccessible: (userId, page, limit) => repository.listAccessible(userId, page, limit),
        async delete(boardId, userId) {
            const access = await repository.getAccess(boardId, userId);
            if (!access) throw new AppError(404, "Board not found", "NOT_FOUND");
            if (access.ownerUserId !== userId) {
                throw new AppError(403, "Cannot delete this Board", "FORBIDDEN");
            }
            if (!(await repository.deleteBoard(boardId, userId))) {
                throw new AppError(404, "Board not found", "NOT_FOUND");
            }
            await cleanupImages?.();
        }
    };
}
