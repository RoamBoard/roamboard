import { resolveActivityPhotos, photoKey } from "./boards.photos.js";
import { prepareFillerPool } from "./boards.fillers.js";
import { AppError } from "../../shared/app-error.js";
import { boardImageIds, type ImageCleanup } from "../images/images.cleanup.js";
import type { BoardWrite } from "./boards.schemas.js";
import type { BoardRepository, BoardsService, CopyBoardImage, FillerProvider } from "./boards.types.js";

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
                ...resolveActivityPhotos(activity),
                locationConfirmed: activity.source === "photo" && activity.location ? true : activity.locationConfirmed,
                note: activity.note?.trim() || null
            }))
        }))
    };
}

async function validateDocument(repository: BoardRepository, input: BoardWrite): Promise<BoardWrite> {
    if (input.days.length > 31) invalid();
    for (const activity of input.days.flatMap((day) => day.activities)) {
        if (
            activity.coverImageId !== undefined &&
            activity.coverImageId !== null &&
            !activity.uploadedImageIds.includes(activity.coverImageId)
        )
            invalid();
        if (
            activity.coverPhoto &&
            activity.photos &&
            !activity.photos.some((photo) => photoKey(photo) === photoKey(activity.coverPhoto!))
        )
            invalid();
    }
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
            if (
                activity.coverPhoto &&
                !activity.photos?.some((photo) => photoKey(photo) === photoKey(activity.coverPhoto!))
            )
                invalid();
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
    cleanupImages?: ImageCleanup,
    fillerProvider?: FillerProvider
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
                    thumbnailUrl: `/api/v1/images/${ids.get(image.imageId)!}/content?variant=thumbnail`,
                    largeUrl: `/api/v1/images/${ids.get(image.imageId)!}/content?variant=large`
                })),
                days: source.days.map((day) => ({
                    dayNumber: day.dayNumber,
                    color: day.color ?? null,
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
                        photos: activity.photos?.map((photo) =>
                            photo.source === "upload" ? { ...photo, imageId: ids.get(photo.imageId)! } : photo
                        ),
                        coverPhoto:
                            activity.coverPhoto?.source === "upload"
                                ? { ...activity.coverPhoto, imageId: ids.get(activity.coverPhoto.imageId)! }
                                : activity.coverPhoto,
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
            return repository.saveBoard(
                userId,
                null,
                null,
                validated,
                await prepareFillerPool(validated, null, fillerProvider)
            );
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
            const current = await repository.getBoard(boardId, userId);
            const destination =
                input.destination === undefined && input.status === "published"
                    ? current?.destination
                    : input.destination;
            if (access.revision !== revision)
                throw new AppError(409, "Board changed in another session", "STALE_BOARD_REVISION");
            const validated = await validateDocument(repository, {
                ...input,
                destination,
                fillerImagesEnabled: input.fillerImagesEnabled ?? current?.fillerImagesEnabled ?? false,
                days: input.days.map((day) => ({
                    ...day,
                    color:
                        day.color === undefined
                            ? (current?.days.find((previous) => previous.dayId === day.dayId && day.dayId !== undefined)
                                  ?.color ?? null)
                            : day.color,
                    activities: day.activities.map((activity) => {
                        const previous = current?.days
                            .flatMap((item) => item.activities)
                            .find(
                                (item) => item.activityId === activity.activityId && activity.activityId !== undefined
                            );
                        return resolveActivityPhotos(activity, previous);
                    })
                }))
            });
            if (!owner && input.isCompleted !== undefined) {
                if (current?.isCompleted !== input.isCompleted)
                    throw new AppError(403, "Only the owner can change completion", "FORBIDDEN");
            }
            const existingPool =
                validated.fillerImagesEnabled && validated.status === "published"
                    ? await repository.getFillerPool(boardId)
                    : null;
            const pool = await prepareFillerPool(validated, existingPool, fillerProvider);
            const saved = await repository.saveBoard(userId, boardId, revision, validated, pool);
            const retainedImages = new Set(boardImageIds(saved));
            await cleanupImages?.(boardImageIds(current).filter((id) => !retainedImages.has(id)));
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
            const imageIds = cleanupImages ? boardImageIds(await repository.getBoard(boardId, userId)) : [];
            if (!(await repository.deleteBoard(boardId, userId))) {
                throw new AppError(404, "Board not found", "NOT_FOUND");
            }
            await cleanupImages?.(imageIds);
        }
    };
}
