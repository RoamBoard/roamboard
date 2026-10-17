import { z } from "zod";

export const libraryKey = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,159}$/);
export const libraryReadSchema = z
    .object({
        keys: z
            .string()
            .transform((value) => value.split(","))
            .pipe(z.array(libraryKey).min(1).max(50))
            .optional()
    })
    .strict();
export const libraryKeySchema = z.object({ assetKey: libraryKey }).strict();
export function unsplashReferenceId(input: string): string {
    if (!input.startsWith("https:")) {
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(input)) throw new Error("Invalid Unsplash photo ID");
        return input;
    }
    const url = new URL(input);
    if (
        !["unsplash.com", "www.unsplash.com"].includes(url.hostname) ||
        url.username ||
        url.password ||
        !/^\/photos\/[\w-]+\/?$/.test(url.pathname)
    ) {
        throw new Error("Supply an Unsplash photo page or photo ID");
    }
    const slug = url.pathname.split("/")[2]!;
    return slug.length > 11 ? slug.slice(-11) : slug;
}
const source = z.union([z.literal(""), z.url().refine((url) => new URL(url).protocol === "https:")]);
export const libraryWriteSchema = z
    .object({
        assetKey: libraryKey,
        expectedRevision: z.coerce.number().int().min(0).default(0),
        alt: z.string().trim().min(1).max(500),
        credit: z.string().trim().min(1).max(300),
        sourceUrl: source.default("")
    })
    .strict();
export const libraryUnsplashSchema = z
    .object({
        assetKey: libraryKey,
        expectedRevision: z.number().int().min(0).default(0),
        photoId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)
    })
    .strict();
