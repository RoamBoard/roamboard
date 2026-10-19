import type {
    BoardCreatorPayload,
    BoardDayDraft,
    BoardImageDraft,
    BoardPinDraft,
    BoardDestinationDraft
} from "@/types/board-creator";
import { findCountry } from "@/lib/countries";

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

type ApiError = { error?: { code?: string; message?: string } };

// Preserve the HTTP status so pages can distinguish sign-in, permission and missing-Board messages.
export class BoardApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code?: string
    ) {
        super(message);
        this.name = "BoardApiError";
    }
}

async function requestEnvelope<T>(
    path: string,
    init: RequestInit = {}
): Promise<{ data: T; meta?: { hasMore?: boolean } }> {
    const response = await fetch(`${apiOrigin}${path}`, {
        ...init,
        credentials: "include",
        cache: "no-store",
        headers: {
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...init.headers
        }
    }).catch(() => {
        throw new Error(`The Board API is unavailable at ${apiOrigin}. Start the backend and try again.`);
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(`The Board API returned ${response.status} instead of JSON. Check the API URL (${apiOrigin}).`);
    }
    const body = (await response.json()) as {
        data?: T;
        meta?: { hasMore?: boolean };
    } & ApiError;
    if (!response.ok || body.data === undefined) {
        throw new BoardApiError(
            body.error?.message ?? `Board request failed (${response.status}).`,
            response.status,
            body.error?.code
        );
    }
    return { data: body.data, meta: body.meta };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return (await requestEnvelope<T>(path, init)).data;
}

export type BoardWriteRequest = {
    destination?: {
        name: string;
        address: string | null;
        city: string | null;
        country: string;
        externalPlaceId: string;
        latitude: number;
        longitude: number;
        kind: "city" | "region" | "country";
    } | null;
    isCompleted?: boolean;
    status: "draft" | "published";
    title: string;
    description: string | null;
    visibility: "collaborators" | "friends" | "public";
    tagIds: number[];
    imageIds: number[];
    coverImageId: number | null;
    days: Array<{
        dayId?: number;
        dayNumber: number;
        date: string | null;
        activities: Array<{
            activityId?: number;
            position: number;
            title: string;
            activityTime: string | null;
            category: string;
            note: string | null;
            source: BoardPinDraft["source"];
            location: {
                name: string;
                latitude: number;
                longitude: number;
                address: string | null;
                city: string | null;
                country: string | null;
                externalPlaceId: string | null;
            } | null;
            locationConfirmed: boolean;
            uploadedImageIds: number[];
            coverImageId: number | null;
            externalImage: {
                provider: "unsplash";
                providerImageId: string;
                url: string;
                photographer: string;
                photographerUrl: string | null;
                sourceUrl: string | null;
            } | null;
        }>;
    }>;
};

export type BoardDocument = Omit<BoardWriteRequest, "days"> & {
    author: {
        username: string;
        bio: string;
        photo: { imageId: number; url: string } | null;
    };
    boardId: number;
    savedByMe?: boolean;
    savedCount?: number;
    revision: number;
    permissions: { canEditContent: boolean; canManageBoard: boolean };
    coverImageId: number | null;
    tags: Array<{ tagId: number; name: string }>;
    images: Array<{
        imageId: number;
        url: string;
        thumbnailUrl: string;
        capturedAt: string | null;
        position: number;
    }>;
    days: Array<
        Omit<BoardWriteRequest["days"][number], "dayId" | "activities"> & {
            dayId: number;
            activities: Array<
                Omit<BoardWriteRequest["days"][number]["activities"][number], "activityId"> & { activityId: number }
            >;
        }
    >;
    createdAt: string;
    updatedAt: string;
};

export type DraftSummary = {
    boardId: number;
    title: string;
    updatedAt: string;
    coverImageUrl: string | null;
};

export type PublishedSummary = DraftSummary & {
    status: "published";
    visibility: BoardWriteRequest["visibility"];
};

export const listBoardTags = () => request<Array<{ tagId: number; name: string }>>("/api/v1/tags");
export async function listBoardDrafts(page = 1): Promise<{
    items: DraftSummary[];
    hasMore: boolean;
}> {
    const response = await requestEnvelope<DraftSummary[]>(`/api/v1/boards?scope=drafts&page=${page}`);
    return { items: response.data, hasMore: response.meta?.hasMore ?? false };
}
export async function listPublishedBoards(page = 1): Promise<{
    items: PublishedSummary[];
    hasMore: boolean;
}> {
    const response = await requestEnvelope<PublishedSummary[]>(`/api/v1/boards?scope=published&page=${page}`);
    return {
        items: response.data.map((item) => ({
            ...item,
            coverImageUrl: item.coverImageUrl ? new URL(item.coverImageUrl, apiOrigin).toString() : null
        })),
        hasMore: response.meta?.hasMore ?? false
    };
}
export const loadBoardDocument = (boardId: number, signal?: AbortSignal) =>
    request<BoardDocument>(`/api/v1/boards/${boardId}`, { signal });

export type PreparedBoardCopy = Pick<
    BoardDocument,
    "title" | "description" | "destination" | "tags" | "images" | "coverImageId"
> & {
    days: BoardWriteRequest["days"];
};

export const prepareBoardRemix = (boardId: number) =>
    request<PreparedBoardCopy>(`/api/v1/boards/${boardId}/remix-content`, { method: "POST" });

export function saveBoardDocument(input: BoardWriteRequest, board?: BoardDocument | null): Promise<BoardDocument> {
    return board
        ? request<BoardDocument>(`/api/v1/boards/${board.boardId}`, {
              method: "PUT",
              body: JSON.stringify({ ...input, revision: board.revision })
          })
        : request<BoardDocument>("/api/v1/boards", {
              method: "POST",
              body: JSON.stringify(input)
          });
}

export function toBoardWrite(
    draft: BoardCreatorPayload,
    tags: Array<{ tagId: number; name: string }>
): BoardWriteRequest {
    const tagIds = draft.tags.map((name) => tags.find((tag) => tag.name === name)?.tagId);
    if (tagIds.some((id) => id === undefined)) throw new Error("Select tags from the allowed list.");
    const uploaded = draft.images.filter((image) => image.source === "upload");
    if (uploaded.some((image) => image.uploadedImageId === undefined)) {
        throw new Error("An image has not finished uploading. Try again.");
    }
    return {
        destination: draft.destination
            ? {
                  name: draft.destination.name,
                  address: draft.destination.address || null,
                  city: draft.destination.city,
                  country: draft.destination.countryCode!,
                  externalPlaceId: draft.destination.mapboxId!,
                  latitude: draft.destination.latitude,
                  longitude: draft.destination.longitude,
                  kind: draft.destination.kind
              }
            : null,
        status: draft.status,
        title: draft.title,
        description: draft.description.trim() || null,
        visibility: draft.visibility,
        tagIds: tagIds as number[],
        imageIds: uploaded.map((image) => image.uploadedImageId!),
        coverImageId: draft.coverImageId,
        days: draft.days.map((day) => ({
            ...(day.serverDayId ? { dayId: day.serverDayId } : {}),
            dayNumber: day.dayNumber,
            date: day.date,
            activities: day.pins.map((pin, position) => {
                const pinImages = uploaded
                    .filter((image) => image.pinId === pin.id)
                    .sort(
                        (first, second) => (first.activityOrder ?? first.order) - (second.activityOrder ?? second.order)
                    );
                const external = draft.images.find((image) => image.pinId === pin.id && image.source === "unsplash");
                return {
                    ...(pin.serverActivityId ? { activityId: pin.serverActivityId } : {}),
                    position,
                    title: pin.title,
                    activityTime: pin.time || null,
                    category: pin.category,
                    note: pin.description.trim() || null,
                    source: pin.source,
                    location: pin.location
                        ? {
                              name: pin.location.name,
                              latitude: pin.location.latitude,
                              longitude: pin.location.longitude,
                              address: pin.location.address || null,
                              city: pin.location.city,
                              country: pin.location.country,
                              externalPlaceId: pin.location.mapboxId
                          }
                        : null,
                    locationConfirmed: pin.location !== null,
                    uploadedImageIds: pinImages.map((image) => image.uploadedImageId!),
                    coverImageId:
                        pin.coverImageId === undefined
                            ? (pinImages[0]?.uploadedImageId ?? null)
                            : pin.coverImageId !== null &&
                                pinImages.some((image) => image.uploadedImageId === pin.coverImageId)
                              ? pin.coverImageId
                              : null,
                    externalImage: external
                        ? {
                              provider: "unsplash" as const,
                              providerImageId: external.publicId,
                              url: external.url,
                              photographer: external.credit ?? "Unknown",
                              photographerUrl: external.creditUrl,
                              sourceUrl: external.sourceUrl
                          }
                        : null
                };
            })
        }))
    };
}

export function fromBoardDocument(board: PreparedBoardCopy): {
    destination: BoardDestinationDraft | null;
    days: BoardDayDraft[];
    images: BoardImageDraft[];
} {
    const pinIds = new Map<object, string>();
    const days: BoardDayDraft[] = board.days.map((day) => ({
        id: crypto.randomUUID(),
        serverDayId: day.dayId,
        dayNumber: day.dayNumber,
        date: day.date,
        pins: day.activities.map((activity) => {
            const id = crypto.randomUUID();
            pinIds.set(activity, id);
            return {
                id,
                serverActivityId: activity.activityId,
                coverImageId: activity.coverImageId,
                order: activity.position,
                time: activity.activityTime ?? "",
                title: activity.title,
                description: activity.note ?? "",
                category: activity.category as BoardPinDraft["category"],
                source: activity.source,
                location: activity.location
                    ? {
                          name: activity.location.name,
                          address: activity.location.address ?? "",
                          latitude: activity.location.latitude,
                          longitude: activity.location.longitude,
                          city: activity.location.city,
                          country: activity.location.country,
                          countryCode: findCountry(activity.location.country ?? "")?.code ?? null,
                          mapboxId: activity.location.externalPlaceId
                      }
                    : null
            };
        })
    }));
    const ownerByImage = new Map<number, { pinId: string; order: number }>();
    for (const day of board.days)
        for (const activity of day.activities) {
            activity.uploadedImageIds.forEach((imageId, order) =>
                ownerByImage.set(imageId, {
                    pinId: pinIds.get(activity)!,
                    order
                })
            );
        }
    const images: BoardImageDraft[] = board.images.map((image) => ({
        id: crypto.randomUUID(),
        uploadedImageId: image.imageId,
        pinId: ownerByImage.get(image.imageId)?.pinId ?? null,
        activityOrder: ownerByImage.get(image.imageId)?.order,
        publicId: String(image.imageId),
        source: "upload",
        url: new URL(image.url, apiOrigin).toString(),
        thumbnailUrl: new URL(image.thumbnailUrl, apiOrigin).toString(),
        width: 0,
        height: 0,
        capturedAt: image.capturedAt,
        latitude: null,
        longitude: null,
        order: image.position,
        credit: null,
        creditUrl: null,
        sourceUrl: null
    }));
    for (const day of board.days)
        for (const activity of day.activities) {
            if (!activity.externalImage) continue;
            images.push({
                id: crypto.randomUUID(),
                pinId: pinIds.get(activity)!,
                publicId: activity.externalImage.providerImageId,
                source: "unsplash",
                url: activity.externalImage.url,
                thumbnailUrl: activity.externalImage.url,
                width: 0,
                height: 0,
                capturedAt: null,
                latitude: null,
                longitude: null,
                order: images.length,
                credit: activity.externalImage.photographer,
                creditUrl: activity.externalImage.photographerUrl,
                sourceUrl: activity.externalImage.sourceUrl
            });
        }
    const destination: BoardDestinationDraft | null = board.destination
        ? {
              name: board.destination.name,
              address: board.destination.address ?? "",
              latitude: board.destination.latitude,
              longitude: board.destination.longitude,
              city: board.destination.city,
              country: findCountry(board.destination.country)?.name ?? null,
              countryCode: board.destination.country,
              mapboxId: board.destination.externalPlaceId,
              kind: board.destination.kind
          }
        : null;
    return { destination, days, images };
}

function contentType(file: File): string {
    if (file.type) return file.type;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "heic" || extension === "heif") return `image/${extension}`;
    throw new Error("Choose a JPEG, PNG, WebP, HEIC, or HEIF image.");
}

export async function uploadBoardImage(file: File): Promise<{
    imageId: number;
    url: string;
    thumbnailUrl: string;
    capturedAt: string | null;
    latitude: number | null;
    longitude: number | null;
}> {
    const intent = await request<{
        uploadId: string;
        uploadUrl: string;
        method: "POST";
        formFields: Record<string, string>;
    }>("/api/v1/images/upload-intents", {
        method: "POST",
        body: JSON.stringify({
            fileName: file.name,
            contentType: contentType(file),
            sizeBytes: file.size
        })
    });
    const form = new FormData();
    for (const [key, value] of Object.entries(intent.formFields)) form.append(key, value);
    form.append("file", file, file.name);
    const upload = await fetch(intent.uploadUrl, {
        method: intent.method,
        body: form
    });
    if (!upload.ok) throw new Error(`Image storage rejected the upload (${upload.status}).`);
    const image = await request<{
        imageId: number;
        url: string;
        thumbnailUrl: string;
        capturedAt: string | null;
        latitude: number | null;
        longitude: number | null;
    }>("/api/v1/images/complete", {
        method: "POST",
        body: JSON.stringify({ uploadId: intent.uploadId })
    });
    return {
        ...image,
        url: new URL(image.url, apiOrigin).toString(),
        thumbnailUrl: new URL(image.thumbnailUrl, apiOrigin).toString()
    };
}

export function mergeServerIds(
    currentDays: BoardDayDraft[],
    sentDays: BoardDayDraft[],
    savedBoard: BoardDocument
): BoardDayDraft[] {
    const serverDayIdByLocalDayId = new Map<string, number>();
    const serverActivityIdByLocalPinId = new Map<string, number>();
    const serverCoverImageByLocalPinId = new Map<string, number | null>();

    sentDays.forEach((sentDay, dayIndex) => {
        const serverDay = savedBoard.days[dayIndex];
        if (serverDay) {
            serverDayIdByLocalDayId.set(sentDay.id, serverDay.dayId);
            sentDay.pins.forEach((sentPin, pinIndex) => {
                const serverAct = serverDay.activities[pinIndex];
                if (serverAct) {
                    serverActivityIdByLocalPinId.set(sentPin.id, serverAct.activityId);
                    serverCoverImageByLocalPinId.set(sentPin.id, serverAct.coverImageId);
                }
            });
        }
    });

    return currentDays.map((day) => {
        const serverDayId = serverDayIdByLocalDayId.get(day.id) ?? day.serverDayId;
        return {
            ...day,
            serverDayId,
            pins: day.pins.map((pin) => {
                const serverActivityId = serverActivityIdByLocalPinId.get(pin.id) ?? pin.serverActivityId;
                const coverImageId = serverCoverImageByLocalPinId.has(pin.id)
                    ? (serverCoverImageByLocalPinId.get(pin.id) ?? null)
                    : pin.coverImageId;
                return {
                    ...pin,
                    serverActivityId,
                    coverImageId
                };
            })
        };
    });
}

export function mergeServerImages(currentImages: BoardImageDraft[], savedBoard: BoardDocument): BoardImageDraft[] {
    const serverImageById = new Map(savedBoard.images.map((img) => [img.imageId, img]));
    return currentImages.map((img) => {
        if (img.uploadedImageId && serverImageById.has(img.uploadedImageId)) {
            const serverImg = serverImageById.get(img.uploadedImageId)!;
            return {
                ...img,
                url: new URL(serverImg.url, apiOrigin).toString(),
                thumbnailUrl: new URL(serverImg.thumbnailUrl, apiOrigin).toString(),
                order: serverImg.position
            };
        }
        return img;
    });
}

export type SmartPhotoSuggestion = {
    imageId: number;
    location: {
        id: string;
        label: string;
        detail: string;
        address: string;
        type: string;
        latitude: number;
        longitude: number;
        country: string | null;
        countryCode: string | null;
        city: string | null;
    } | null;
    category: BoardPinDraft["category"];
    warning: string | null;
};
export async function suggestBoardPhotos(imageIds: number[]): Promise<SmartPhotoSuggestion[]> {
    const result = await request<{ photos: SmartPhotoSuggestion[] }>("/api/v1/images/smart-create", {
        method: "POST",
        body: JSON.stringify({ imageIds })
    });
    return result.photos;
}

export function refreshBoardPhotoLocation(
    imageId: number
): Promise<SmartPhotoSuggestion & { capturedAt: string | null; latitude: number | null; longitude: number | null }> {
    return request("/api/v1/images/" + imageId + "/refresh-location", { method: "POST" });
}

export async function suggestMainDestination(
    points: Array<{ latitude: number; longitude: number; city?: string | null; country?: string | null }>,
    signal?: AbortSignal
): Promise<BoardDestinationDraft | null> {
    const place = await request<import("./destinations").Destination | null>(
        "/api/v1/providers/locations/suggest-area",
        { method: "POST", body: JSON.stringify({ points }), signal }
    );
    return place?.countryCode
        ? {
              name: place.name,
              address: place.address,
              latitude: place.latitude,
              longitude: place.longitude,
              country: place.country,
              countryCode: place.countryCode,
              city: place.city,
              mapboxId: place.id,
              kind: ["state", "county", "region"].includes(place.placeType) ? "region" : "city"
          }
        : null;
}
