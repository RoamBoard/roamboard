import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { closeDatabase, getPool } from "../db.js";
import { createLibraryRepository, recordLibrarySources } from "../features/image-library/image-library.repository.js";
import { createLibraryProvider } from "../features/image-library/image-library.provider.js";
import type { LibraryAsset } from "../features/image-library/image-library.types.js";
import { createQuotaService } from "../features/quotas/quota.service.js";
import { createPostgresQuotaRepository } from "../features/quotas/quota.postgres-repository.js";
import { createQuotaPolicies } from "../features/quotas/quota.policies.js";

interface Entry {
    assetKey: string;
    source: string;
    aliases: string[];
    usages: string[];
    alt: string;
    credit: string;
    sourceUrl: string;
    photographerUrl: string;
    photoId: string | null;
}

const root = path.resolve(process.cwd(), "..");
const frontend = path.join(root, "frontend");
const manifestPath = path.join(process.cwd(), "db", "frontend-image-inventory.json");
const fallbackPath = path.join(root, "shared", "editorial-images.json");
const fallbackImages = JSON.parse(await readFile(fallbackPath, "utf8")) as Array<{
    assetKey: string;
    source: string;
    aliases: string[];
}>;
const args = new Set(process.argv.slice(2));
const supported = new Set(["--apply", "--apply-schema", "--inventory"]);
if ([...args].some((arg) => !supported.has(arg)))
    throw new Error("Supported options: --inventory, --apply-schema, --apply");

async function files(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((entry) =>
            entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]
        )
    );
    return nested.flat();
}

async function inventory(): Promise<Entry[]> {
    const entries = new Map<string, Entry>();
    const sourceFiles = await files(path.join(frontend, "src"));
    const sources = await Promise.all(
        sourceFiles
            .filter((file) => /\.(tsx?|css)$/.test(file))
            .map(async (file) => ({
                file: path.relative(root, file).replaceAll("\\", "/"),
                text: await readFile(file, "utf8")
            }))
    );
    function add(source: string, usage?: string, meta?: Record<string, unknown>) {
        if (source.startsWith("library:")) {
            const original = fallbackImages.find((image) => image.assetKey === source.slice(8));
            // Newly registered catalog keys have no migration source to inventory or import.
            if (!original) return;
            source = original.source;
        }
        const remote =
            source.startsWith("https://images.unsplash.com/") ||
            /^https:\/\/unsplash\.com\/photos\/[\w-]+\/download(?:\?|$)/.test(source);
        if (!remote && !/^\/.*\.(png|jpe?g|webp|gif|avif)$/i.test(source)) return;
        if (source.includes("${")) return;
        if (
            source.startsWith("https://images.unsplash.com/") &&
            !/^\/(?:photo|premium_photo)-\d+-[a-zA-Z0-9]+$/.test(new URL(source).pathname)
        )
            return;
        const identity = remote ? new URL(source).pathname : source;
        const hash = createHash("sha256").update(identity).digest("hex").slice(0, 16);
        const key = remote
            ? `frontend.unsplash.${hash}`
            : `frontend.${source
                  .slice(1)
                  .replace(/\.[^.]+$/, "")
                  .replace(/[^a-z0-9]+/gi, ".")
                  .toLowerCase()}`;
        const entry = entries.get(identity) ?? {
            assetKey: key,
            source,
            aliases: [],
            usages: [],
            alt: path.basename(identity).replace(/[-_.]/g, " "),
            credit: "Existing Roamboard frontend asset — see source documentation",
            sourceUrl: "",
            photographerUrl: "",
            photoId: null
        };
        if (!entry.aliases.includes(source)) entry.aliases.push(source);
        if (usage && !entry.usages.includes(usage)) entry.usages.push(usage);
        if (meta) {
            if (typeof meta.alt === "string") entry.alt = meta.alt;
            if (typeof meta.credit === "string") entry.credit = meta.credit;
            if (typeof meta.photographer === "string") entry.credit = meta.photographer;
            if (typeof meta.sourceUrl === "string") {
                entry.sourceUrl = meta.sourceUrl;
                entry.photoId = /unsplash\.com\/photos\/([\w-]+)/.exec(meta.sourceUrl)?.[1] ?? null;
            }
            if (typeof meta.photographerUrl === "string") entry.photographerUrl = meta.photographerUrl;
        }
        entries.set(identity, entry);
    }
    const previousInventory = JSON.parse(await readFile(manifestPath, "utf8").catch(() => "[]")) as Entry[];
    for (const image of fallbackImages) {
        const previous = previousInventory.find((entry) => entry.assetKey === image.assetKey);
        for (const alias of image.aliases)
            add(alias, undefined, previous ? { ...previous, photographer: previous.credit } : undefined);
    }
    const tagCatalog = JSON.parse(await readFile(path.join(root, "shared/roamboard-tags.json"), "utf8")) as {
        tags: Array<{ gridImage: Record<string, unknown> & { url: string } }>;
    };
    for (const tag of tagCatalog.tags) add(tag.gridImage.url, "shared/roamboard-tags.json", tag.gridImage);
    for (const file of await files(path.join(frontend, "public"))) {
        if (/\.(png|jpe?g|webp|gif|avif)$/i.test(file))
            add(`/${path.relative(path.join(frontend, "public"), file).replaceAll("\\", "/")}`);
    }
    for (const source of sources) {
        for (const match of source.text.matchAll(/https:\/\/images\.unsplash\.com\/[^\s"'`<>)}]+/g))
            add(match[0], source.file);
    }
    // Evaluate the two pure data modules whose helpers construct image paths/URLs.
    for (const name of ["discover-preview", "destination-atlas"]) {
        const file = path.join(frontend, "src", "data", `${name}.ts`);
        const module: unknown = await import(pathToFileURL(file).href);
        const seen = new Set<object>();
        function visit(value: unknown) {
            if (!value || typeof value !== "object" || seen.has(value)) return;
            seen.add(value);
            const record = value as Record<string, unknown>;
            if (typeof record.src === "string") add(record.src, `frontend/src/data/${name}.ts`, record);
            for (const child of Object.values(record)) visit(child);
        }
        visit(module);
    }
    for (const entry of entries.values()) {
        const filename = path.basename(entry.source);
        for (const source of sources) {
            if (
                source.text.includes(`library:${entry.assetKey}`) ||
                (!entry.source.startsWith("https:") &&
                    (source.text.includes(entry.source) ||
                        source.text.includes(filename) ||
                        source.text.includes(path.posix.dirname(entry.source))))
            ) {
                if (!entry.usages.includes(source.file)) entry.usages.push(source.file);
            }
        }
    }
    return [...entries.values()].sort((a, b) => a.assetKey.localeCompare(b.assetKey));
}

try {
    const entries =
        args.has("--apply") && !args.has("--inventory")
            ? (JSON.parse(await readFile(manifestPath, "utf8")) as Entry[])
            : await inventory();
    const keys = entries.map((entry) => entry.assetKey);
    if (new Set(keys).size !== keys.length)
        throw new Error("Duplicate asset keys in inventory; choose distinct keys before importing");
    if (!args.has("--apply") || args.has("--inventory")) {
        await writeFile(manifestPath, `${JSON.stringify(entries, null, 4)}\n`);
        await writeFile(
            fallbackPath,
            `${JSON.stringify(
                entries.map(({ assetKey, source, aliases }) => ({ assetKey, source, aliases })),
                null,
                4
            )}\n`
        );
        process.stdout.write(
            `Inventory: ${entries.length} images (${entries.filter((entry) => entry.source.startsWith("/")).length} local files). Review backend/db/frontend-image-inventory.json. SVG/interface artwork stays local.\n`
        );
    }
    if (args.has("--apply-schema")) {
        const client = await getPool().connect();
        try {
            await client.query("BEGIN");
            await client.query("SELECT pg_advisory_xact_lock(hashtextextended('editorial-schema', 0))");
            const existing = await client.query("SELECT to_regclass('editorial_image') AS present");
            if (!existing.rows[0]?.present) {
                await client.query(
                    await readFile(path.join(process.cwd(), "db/migrations/005_image_library.sql"), "utf8")
                );
                process.stdout.write("Applied new migration 005; existing tables were not modified.\n");
            } else {
                await client.query("SELECT asset_key, revision, asset, aliases, usages FROM editorial_image LIMIT 0");
                await client.query("SELECT asset_key, revision, asset FROM editorial_image_revision LIMIT 0");
                process.stdout.write("Migration 005 tables already exist; skipped.\n");
            }
            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }
    if (args.has("--apply")) {
        const repository = createLibraryRepository();
        const provider = createLibraryProvider(
            createQuotaService(createPostgresQuotaRepository(), createQuotaPolicies())
        );
        for (const entry of entries) {
            // Imported aliases are durable: reruns never replace a teammate's later revision.
            if (await repository.find(entry.assetKey)) {
                await recordLibrarySources(entry.assetKey, entry.aliases, entry.usages);
                process.stdout.write(`Retained ${entry.assetKey}\n`);
                continue;
            }
            let asset: LibraryAsset;
            if (entry.source.startsWith("/")) {
                const publicRoot = path.join(frontend, "public");
                const file = path.resolve(publicRoot, `.${entry.source}`);
                if (!file.startsWith(`${publicRoot}${path.sep}`)) throw new Error("Image path escapes frontend/public");
                const relative = path.relative(await realpath(publicRoot), await realpath(file));
                if (relative.startsWith("..") || path.isAbsolute(relative))
                    throw new Error("Image symlink escapes frontend/public");
                let bytes: Buffer = await readFile(file);
                if (bytes.length > 10000000) {
                    // Use the existing Next dependency for this migration only; leave original artwork untouched.
                    const frontendRequire = createRequire(path.join(frontend, "package.json"));
                    const nextRequire = createRequire(frontendRequire.resolve("next/package.json"));
                    const sharp = nextRequire("sharp") as (buffer: Buffer) => {
                        rotate(): {
                            resize(options: {
                                width: number;
                                height: number;
                                fit: string;
                                withoutEnlargement: boolean;
                            }): {
                                jpeg(options: { quality: number }): { toBuffer(): Promise<Buffer> };
                            };
                        };
                    };
                    bytes = await sharp(bytes)
                        .rotate()
                        .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
                        .jpeg({ quality: 92 })
                        .toBuffer();
                    if (bytes.length > 10000000) throw new Error(`Image still exceeds 10 MB: ${entry.assetKey}`);
                    process.stdout.write(`Optimized migration copy of ${entry.assetKey}; original file retained.\n`);
                }
                asset = await provider.upload(bytes, { ...entry, expectedRevision: 0 });
            } else {
                const url = new URL(entry.source);
                const allowed =
                    url.hostname === "images.unsplash.com" ||
                    (url.hostname === "unsplash.com" && /^\/photos\/[\w-]+\/download$/.test(url.pathname));
                if (url.protocol !== "https:" || !allowed || url.username || url.password)
                    throw new Error("Unsupported external image source");
                // Preserve existing curated references without downloading or rehosting API photographs.
                asset = {
                    provider: "unsplash",
                    url: entry.source,
                    thumbnailUrl: entry.source,
                    alt: entry.alt,
                    credit: entry.credit,
                    sourceUrl: entry.sourceUrl,
                    photographerUrl: entry.photographerUrl,
                    unsplashPhotoId: entry.photoId,
                    cloudinaryAssetId: null,
                    cloudinaryPublicId: null,
                    checksum: null,
                    width: 0,
                    height: 0
                };
            }
            await repository.save(entry.assetKey, 0, asset, entry.aliases, entry.usages);
            process.stdout.write(`Imported ${entry.assetKey}\n`);
        }
        process.stdout.write("Import complete. Original frontend files and URLs remain available for rollback.\n");
    }
} catch (error) {
    process.stderr.write(
        `Image import stopped: ${error instanceof Error ? error.message : "Unknown failure"}. Rerun to resume; original sources are unchanged.\n`
    );
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
