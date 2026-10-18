import { randomUUID } from "node:crypto";

import type { ImageProvider, ImagesRepository, UploadIntent } from "../images/images.types.js";
import type { GooglePhotoImporter } from "./auth.types.js";

// Only verified Google claims reach this adapter; still restrict downloads and reject redirects.
export function createGooglePhotoImporter(
    provider: Pick<ImageProvider, "authorizeUpload" | "inspect">,
    images: Pick<ImagesRepository, "createIntent" | "completeIntent">
): GooglePhotoImporter {
    return async (input, previousStorageKey, userId) => {
        const url = new URL(input);
        if (
            url.protocol !== "https:" ||
            !/^lh\d+\.googleusercontent\.com$/.test(url.hostname) ||
            url.username ||
            url.password ||
            (url.port && url.port !== "443")
        )
            throw new Error("Unsupported Google photo URL");

        if (previousStorageKey) {
            if (previousStorageKey.startsWith("roamboard/google-profile/")) return null;
            const previous = await provider.inspect(previousStorageKey);
            if (previous?.originalFilename !== "google-profile") return null;
        }
        // Request a large source instead of saving Google's sign-in thumbnail.
        // https://developers.google.com/people/image-sizing
        if (/(?:=|\/|-)s\d+(?=-|\/|$)/.test(url.pathname)) {
            url.pathname = url.pathname.replace(/(=|\/|-)s\d+(?=-|\/|$)/g, "$1s1024");
        } else if (!url.searchParams.has("sz")) {
            url.pathname += "=s1024";
        }
        if (url.searchParams.has("sz")) url.searchParams.set("sz", "1024");
        const storageKey = `roamboard/google-profile/${randomUUID()}`;
        const authorization = provider.authorizeUpload(storageKey);
        const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10000) });
        const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
        if (!response.ok || !response.body || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
            await response.body?.cancel();
            throw new Error("Google photo unavailable");
        }
        const chunks: Uint8Array[] = [];
        let size = 0;
        const reader = response.body.getReader();
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.byteLength;
                if (size > 10_000_000) throw new Error("Google photo exceeds 10 MB");
                chunks.push(value);
            }
        } finally {
            await reader.cancel();
        }
        if (!size) throw new Error("Google photo is empty");

        const form = new FormData();
        for (const [key, value] of Object.entries(authorization.formFields)) form.set(key, value);
        form.set("file", new Blob(chunks as BlobPart[], { type: contentType }), "google-profile");
        const createdAt = new Date();
        const intent: UploadIntent = {
            uploadId: randomUUID(),
            userId,
            storageKey,
            fileName: "google-profile",
            contentType,
            sizeBytes: size,
            createdAt,
            expiresAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
            imageId: null
        };
        // Commit cleanup tracking before the provider can receive any bytes.
        await images.createIntent(intent);
        const uploaded = await fetch(authorization.uploadUrl, {
            method: authorization.method,
            headers: authorization.headers,
            body: form,
            redirect: "error",
            signal: AbortSignal.timeout(15000)
        });
        if (!uploaded.ok) throw new Error("Google photo could not be saved");
        const asset = (await uploaded.json()) as {
            public_id?: string;
            bytes?: number;
            format?: string;
            created_at?: string;
        };
        if (asset.public_id !== storageKey || !asset.bytes || !asset.format || !asset.created_at) {
            throw new Error("Invalid saved Google photo");
        }
        const saved = {
            storageKey,
            byteSize: asset.bytes,
            format: asset.format,
            createdAt: new Date(asset.created_at),
            capturedAt: null,
            latitude: null,
            longitude: null
        };
        await images.completeIntent(intent, saved);
        return saved;
    };
}
