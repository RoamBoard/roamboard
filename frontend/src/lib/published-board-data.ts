import type { BoardDocument } from "./board-creator-api";
import { findCountry } from "./countries";
import type { BoardActivity, BoardImage } from "../types/board";
import type { PublishedBoardData } from "../types/published-board";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const imageUrl = (url: string) => new URL(url, apiOrigin).toString();

export function toPublishedBoardData(document: BoardDocument): PublishedBoardData {
    if (!document.author) throw new Error("Author details are unavailable. Restart the backend and try again.");
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
            dayNumbers: document.days.map((day) => day.dayNumber),
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
        highlights: [],
        tagLabels: document.tags.map((tag) => tag.name),
        canEditContent: document.permissions.canEditContent,
        isSample: false
    };
}
