import { AppError } from "../../shared/app-error.js";
import { object, text, photoResult } from "./provider.activity-photo.js";

type RequestPhoto = (path: string) => Promise<unknown>;
export async function searchManualPhotos(query: string, page: number, request: RequestPhoto) {
    const result = object(
        await request(
            "/search/photos?" + new URLSearchParams({ query, page: String(page), per_page: "12", order_by: "relevant" })
        )
    );
    const photos = (Array.isArray(result.results) ? result.results : []).flatMap((raw) => {
        const photo = photoResult(object(raw));
        return photo && photo.width > 0 && photo.height > 0 ? [photo] : [];
    });
    return {
        query,
        page,
        pageSize: 12,
        total: Number(result.total) || 0,
        totalPages: Number(result.total_pages) || 0,
        photos
    };
}
export async function selectManualPhoto(photoId: string, request: RequestPhoto) {
    const raw = object(await request("/photos/" + encodeURIComponent(photoId)));
    const photo = photoResult(raw);
    if (!photo || text(raw.id) !== photoId || photo.width <= 0 || photo.height <= 0)
        throw new AppError(404, "This photo is unavailable", "PHOTO_NOT_FOUND");
    const download = new URL(text(object(raw.links).download_location));
    if (
        download.protocol !== "https:" ||
        download.hostname !== "api.unsplash.com" ||
        download.username ||
        download.password ||
        download.port ||
        download.pathname !== `/photos/${photoId}/download`
    )
        throw new Error("Invalid provider download link");
    await request(download.pathname + download.search);
    return { ...photo, context: null };
}
