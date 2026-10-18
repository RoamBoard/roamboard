export type PhotoEdit = {
    x: number;
    y: number;
    width: number;
    height: number;
    outputWidth: number;
    outputHeight: number;
};
export const fullCrop = { x: 0, y: 0, width: 1, height: 1 };
export function cropAspect(crop: typeof fullCrop, sourceAspect: number, aspect: number) {
    const relativeAspect = aspect / sourceAspect;
    const width = Math.min(
            1,
            relativeAspect,
            Math.max(Math.max(0.01, 0.01 * relativeAspect), Math.min(crop.width, crop.height * relativeAspect))
        ),
        height = (width * sourceAspect) / aspect;
    return {
        x: Math.max(0, Math.min(1 - width, crop.x + (crop.width - width) / 2)),
        y: Math.max(0, Math.min(1 - height, crop.y + (crop.height - height) / 2)),
        width,
        height
    };
}
export function outputSize(width: number, aspect: number) {
    const w = Math.max(32, Math.min(4096, 4096 * aspect, Number.isFinite(width) ? width : 1600));
    return { outputWidth: Math.round(w), outputHeight: Math.max(32, Math.min(4096, Math.round(w / aspect))) };
}
const api = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
async function request<T>(id: number, init?: RequestInit): Promise<T> {
    const response = await fetch(`${api}/api/v1/images/${id}/presentation`, {
        ...init,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        cache: "no-store"
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Photo edits could not be saved.");
    return body.data;
}
export const readPhotoEdit = (id: number, signal?: AbortSignal) =>
    request<{ edit: PhotoEdit | null; revision: number }>(id, { signal });
export const savePhotoEdit = (id: number, revision: number, edit: PhotoEdit | null) =>
    request<{ edit: PhotoEdit | null; revision: number }>(id, {
        method: "PUT",
        body: JSON.stringify({ revision, edit })
    });
export const originalPhotoUrl = (id: number) => `${api}/api/v1/images/${id}/content?variant=original`;
export async function readOriginalPhoto(id: number, signal?: AbortSignal): Promise<Blob> {
    const response = await fetch(originalPhotoUrl(id), { credentials: "include", signal });
    if (!response.ok) throw new Error("The original photo could not load.");
    return response.blob();
}
