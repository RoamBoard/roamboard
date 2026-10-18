import { BoardApiError, loadBoardDocument, type BoardDocument } from "./board-creator-api";
import { findCountry } from "./countries";
import type { BoardActivity, BoardImage } from "../types/board";
import type { PublishedBoardData, PublishedBoardState } from "../types/published-board";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const imageUrl = (url: string) => new URL(url, apiOrigin).toString();

export async function loadPublishedBoard(boardId: string): Promise<PublishedBoardState> {
    const id = Number(boardId);
    // Board IDs are positive PostgreSQL integers; reject other route values before requesting them.
    if (!/^[1-9]\d*$/.test(boardId) || !Number.isSafeInteger(id) || id > 2147483647) {
        return { status: "not-found", data: null };
    }
    try {
        const document = await loadBoardDocument(id);
        // Owners can read their drafts through the API, but drafts belong in the editor.
        if (document.status !== "published") return { status: "not-found", data: null };
        return { status: "ready", data: toPublishedBoardData(document) };
    } catch (error) {
        const status = error instanceof BoardApiError ? error.status : undefined;
        if (status === 401) return { status: "unauthenticated", data: null };
        if (status === 403) return { status: "forbidden", data: null };
        if (status === 404) return { status: "not-found", data: null };
        return { status: "error", data: null };
    }
}

// Adapt saved content to the existing design without adding fictional author details or activities.
export function toPublishedBoardData(document: BoardDocument): PublishedBoardData {
    const images = new Map<number, BoardImage>(
        document.images.map((image) => [
            image.imageId,
            {
                id: String(image.imageId),
                url: imageUrl(image.url),
                alt: `Photo from ${document.title}`,
                source: "upload"
            }
        ])
    );
    const items: BoardActivity[] = document.days.flatMap((day) =>
        day.activities.map((activity) => {
            const uploaded = activity.uploadedImageIds.flatMap((id) => (images.has(id) ? [images.get(id)!] : []));
            const external = activity.externalImage;
            const externalImages: BoardImage[] = external
                ? [
                      {
                          id: `unsplash-${external.providerImageId}`,
                          url: external.url,
                          alt: activity.title,
                          source: "application",
                          photographer: external.photographer,
                          photographerUrl: external.photographerUrl ?? undefined,
                          sourceUrl: external.sourceUrl ?? undefined
                      }
                  ]
                : [];
            const cover = uploaded.find((image) => image.id === String(activity.coverImageId));
            // Put the chosen activity cover first and preserve the order of its remaining photos.
            const photos = cover
                ? [cover, ...uploaded.filter((image) => image !== cover), ...externalImages]
                : [...externalImages, ...uploaded];
            const location = activity.location;
            return {
                id: String(activity.activityId),
                type: "activity",
                title: activity.title,
                description: activity.note ?? "",
                dayNumber: day.dayNumber,
                date: day.date ?? undefined,
                time: activity.activityTime ?? undefined,
                images: photos,
                location: location
                    ? {
                          // Repeated locations share an identity when the viewer counts places.
                          id: JSON.stringify([location.name, location.latitude, location.longitude]),
                          source: "manual",
                          name: location.name,
                          latitude: location.latitude,
                          longitude: location.longitude,
                          address: location.address ?? undefined,
                          city: location.city ?? undefined,
                          countryCode: location.country ? findCountry(location.country)?.code : undefined
                      }
                    : undefined
            };
        })
    );
    const countries = new Map<string, { country: string; countryCode: string; cities: string[] }>();
    if (document.destination) {
        const country = findCountry(document.destination.country);
        if (country)
            countries.set(country.code, {
                country: country.name,
                countryCode: country.code,
                cities: document.destination.kind === "country" ? [] : [document.destination.name]
            });
    }
    for (const activity of document.days.flatMap((day) => day.activities)) {
        const location = activity.location;
        const country = location?.country ? findCountry(location.country) : undefined;
        if (!country) continue;
        const destination = countries.get(country.code) ?? {
            country: country.name,
            countryCode: country.code,
            cities: []
        };
        if (location?.city && !destination.cities.includes(location.city)) destination.cities.push(location.city);
        countries.set(country.code, destination);
    }
    const dates = document.days.flatMap((day) => (day.date ? [day.date] : [])).sort();
    return {
        board: {
            id: String(document.boardId),
            ownerId: document.author.username,
            title: document.title,
            description: document.description ?? "",
            visibility: document.visibility,
            isCompleted: document.isCompleted ?? false,
            tags: document.tags.map((tag) => String(tag.tagId)),
            destinations: [...countries.values()],
            durationDays: document.days.length,
            // Keep empty saved days too, rather than reconstructing days only from activities.
            dayNumbers: document.days.map((day) => day.dayNumber),
            dayDates: Object.fromEntries(document.days.flatMap((day) => (day.date ? [[day.dayNumber, day.date]] : []))),
            startDate: dates[0],
            endDate: dates.at(-1),
            coverImage: document.coverImageId === null ? undefined : images.get(document.coverImageId),
            items,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt
        },
        author: {
            id: document.author.username,
            name: document.author.username,
            bio: document.author.bio,
            photo: document.author.photo
                ? {
                      id: String(document.author.photo.imageId),
                      url: imageUrl(document.author.photo.url),
                      alt: document.author.username,
                      source: "upload"
                  }
                : undefined
        },
        tagLabels: document.tags.map((tag) => tag.name),
        canEditContent: document.permissions.canEditContent,
        canManageBoard: document.permissions.canManageBoard,
        savedByMe: Boolean(document.savedByMe)
    };
}
