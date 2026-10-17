import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { closeDatabase, getPool } from "../src/db.js";
import {
    createLibraryRepository,
    recordLibrarySources
} from "../src/features/image-library/image-library.repository.js";
import type { LibraryAsset } from "../src/features/image-library/image-library.types.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

test(
    "editorial SQL serializes competing replacements and retains history and imported aliases",
    { skip: databaseUrl ? undefined : "Database URL required" },
    async () => {
        const schema = `rb_image_test_${randomBytes(6).toString("hex")}`;
        const admin = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
        const previousUrl = process.env.DATABASE_URL;
        await admin.connect();
        try {
            await admin.query(`CREATE SCHEMA ${schema}`);
            const url = new URL(databaseUrl!);
            url.searchParams.set("options", `-csearch_path=${schema}`);
            process.env.DATABASE_URL = url.toString();
            await getPool().query(
                await readFile(new URL("../db/migrations/005_image_library.sql", import.meta.url), "utf8")
            );
            const repository = createLibraryRepository();
            const asset: LibraryAsset = {
                provider: "cloudinary",
                url: "https://res.cloudinary.com/test/one.jpg",
                thumbnailUrl: "https://res.cloudinary.com/test/one.jpg",
                alt: "Original",
                credit: "Owner",
                sourceUrl: "",
                photographerUrl: "",
                cloudinaryAssetId: "one",
                cloudinaryPublicId: "editorial/one",
                unsplashPhotoId: null,
                checksum: "original",
                width: 800,
                height: 600
            };
            await repository.save("kyoto.cover", 0, asset, ["/images/old.jpg"], ["frontend/src/data/example.ts"]);
            const attempts = await Promise.allSettled([
                repository.save("kyoto.cover", 1, { ...asset, alt: "First replacement" }),
                repository.save("kyoto.cover", 1, { ...asset, alt: "Second replacement" })
            ]);
            assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
            const failure = attempts.find((attempt) => attempt.status === "rejected");
            assert.equal(failure?.status === "rejected" && failure.reason.code, "IMAGE_REVISION_CONFLICT");
            await recordLibrarySources(
                "kyoto.cover",
                ["/images/old.jpg", "/images/alias.jpg"],
                ["frontend/src/data/another.ts"]
            );
            const saved = await repository.find("kyoto.cover");
            assert.equal(saved?.revision, 2);
            assert.deepEqual(saved?.aliases.sort(), ["/images/alias.jpg", "/images/old.jpg"]);
            assert.equal(saved?.usages.length, 2);
            const history = await getPool().query(
                "SELECT revision, asset FROM editorial_image_revision ORDER BY revision"
            );
            assert.equal(history.rowCount, 2);
            assert.equal(history.rows[0].asset.alt, "Original");
            assert.equal((await repository.list()).length, 1);
            assert.equal((await repository.list(["kyoto.cover", "missing"])).length, 1);
            assert.equal((await repository.list(["missing"])).length, 0);
            const command = await promisify(execFile)(
                process.execPath,
                [
                    "--import",
                    "tsx",
                    "src/jobs/register-image.ts",
                    "--key",
                    "agent.cover",
                    "--url",
                    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200",
                    "--alt",
                    "Tokyo",
                    "--credit",
                    "Supplied photographer"
                ],
                { cwd: fileURLToPath(new URL("../", import.meta.url)), env: process.env }
            );
            const registered = JSON.parse(command.stdout) as { reference: string };
            assert.equal(registered.reference, "library:agent.cover");
            assert.equal((await repository.find("agent.cover"))?.asset.provider, "unsplash");
        } finally {
            await closeDatabase();
            if (previousUrl === undefined) delete process.env.DATABASE_URL;
            else process.env.DATABASE_URL = previousUrl;
            await admin.query(`DROP SCHEMA ${schema} CASCADE`);
            await admin.end();
        }
    }
);
