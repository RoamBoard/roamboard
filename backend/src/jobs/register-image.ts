import "dotenv/config";
import { parseArgs } from "node:util";
import { readFile, stat } from "node:fs/promises";
import { closeDatabase } from "../db.js";
import { createLibraryRepository } from "../features/image-library/image-library.repository.js";
import { createLibraryProvider } from "../features/image-library/image-library.provider.js";
import { createLibraryService } from "../features/image-library/image-library.service.js";
import {
    libraryKey,
    libraryWriteSchema,
    unsplashReferenceId
} from "../features/image-library/image-library.schemas.js";
import { downloadLibraryImage } from "../features/image-library/image-library.download.js";
import { createQuotaService } from "../features/quotas/quota.service.js";
import { createPostgresQuotaRepository } from "../features/quotas/quota.postgres-repository.js";
import { createQuotaPolicies } from "../features/quotas/quota.policies.js";

try {
    const { values } = parseArgs({
        options: {
            key: { type: "string" },
            file: { type: "string" },
            unsplash: { type: "string" },
            url: { type: "string" },
            alt: { type: "string" },
            credit: { type: "string" },
            "source-url": { type: "string" },
            "expected-revision": { type: "string" }
        }
    });
    const assetKey = libraryKey.parse(values.key);
    if ([values.file, values.unsplash, values.url].filter(Boolean).length !== 1)
        throw new Error("Supply exactly one of --file, --unsplash, or --url");
    const revision = values["expected-revision"] ?? "0";
    if (!/^\d+$/.test(revision)) throw new Error("Expected revision must be a nonnegative integer");
    const expectedRevision = Number(revision);
    const repository = createLibraryRepository();
    if ((await repository.find(assetKey))?.revision !== undefined && expectedRevision === 0) {
        throw new Error(
            "Key already exists. Reuse its library reference, or supply the current --expected-revision for an authorized replacement"
        );
    }
    const provider = createLibraryProvider(createQuotaService(createPostgresQuotaRepository(), createQuotaPolicies()));
    const service = createLibraryService(repository, provider);
    const unsplash =
        values.unsplash ??
        (values.url && /^https:\/\/(?:www\.)?unsplash\.com\/photos\//.test(values.url) ? values.url : undefined);
    const result = await (async () => {
        if (unsplash) {
            return service.unsplash({ assetKey, expectedRevision, photoId: unsplashReferenceId(unsplash) });
        }
        const input = libraryWriteSchema.parse({
            assetKey,
            expectedRevision,
            alt: values.alt,
            credit: values.credit,
            sourceUrl: values["source-url"] ?? values.url ?? ""
        });
        if (values.url && new URL(values.url).hostname === "images.unsplash.com") {
            return service.externalUnsplash(values.url, input);
        }
        if (values.url && /(?:^|\.)unsplash\.com$/.test(new URL(values.url).hostname))
            throw new Error("Use an Unsplash photo page or images.unsplash.com link; do not rehost Unsplash images");
        if (values.file) {
            const file = await stat(values.file);
            if (!file.isFile() || file.size === 0 || file.size > 10000000)
                throw new Error("Choose an image file up to 10 MB");
        }
        const bytes = values.file ? await readFile(values.file) : await downloadLibraryImage(values.url!);
        if (!bytes.length || bytes.length > 10000000) throw new Error("Choose a nonempty image up to 10 MB");
        return service.upload(bytes, input);
    })();
    process.stdout.write(`${JSON.stringify({ reference: `library:${result.assetKey}`, image: result }, null, 4)}\n`);
} catch (error) {
    process.stderr.write(`Image registration failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
