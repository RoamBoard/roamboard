import { getPool } from "../../db.js";
import { AppError } from "../../shared/app-error.js";
import type { LibraryAsset, LibraryImage, LibraryRepository } from "./image-library.types.js";

const columns = 'asset_key AS "assetKey", revision, asset, aliases, usages';

export async function recordLibrarySources(key: string, aliases: string[], usages: string[]): Promise<void> {
    await getPool().query(
        `UPDATE editorial_image SET
        aliases = ARRAY(SELECT DISTINCT unnest(aliases || $2::text[])),
        usages = ARRAY(SELECT DISTINCT unnest(usages || $3::text[])) WHERE asset_key = $1`,
        [key, aliases, usages]
    );
}

export function createLibraryRepository(): LibraryRepository {
    return {
        async list(keys) {
            return (
                await getPool().query<LibraryImage>(
                    `SELECT ${columns} FROM editorial_image WHERE ($1::text[] IS NULL OR asset_key = ANY($1)) ORDER BY asset_key`,
                    [keys ?? null]
                )
            ).rows;
        },
        async find(key) {
            return (
                (
                    await getPool().query<LibraryImage>(`SELECT ${columns} FROM editorial_image WHERE asset_key = $1`, [
                        key
                    ])
                ).rows[0] ?? null
            );
        },
        async save(key, expectedRevision, asset: LibraryAsset, aliases = [], usages = []) {
            const client = await getPool().connect();
            try {
                await client.query("BEGIN");
                // Serialize creation too, when there is no row to lock yet.
                await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`editorial:${key}`]);
                const current = (
                    await client.query<LibraryImage>(
                        `SELECT ${columns} FROM editorial_image WHERE asset_key = $1 FOR UPDATE`,
                        [key]
                    )
                ).rows[0];
                if ((current?.revision ?? 0) !== expectedRevision) {
                    throw new AppError(
                        409,
                        "This image changed. Reload before replacing it.",
                        "IMAGE_REVISION_CONFLICT"
                    );
                }
                const revision = expectedRevision + 1;
                const result = await client.query<LibraryImage>(
                    `INSERT INTO editorial_image (asset_key, revision, asset, aliases, usages) VALUES ($1,$2,$3,$4,$5)
                     ON CONFLICT (asset_key) DO UPDATE SET revision = EXCLUDED.revision, asset = EXCLUDED.asset,
                     aliases = EXCLUDED.aliases, usages = EXCLUDED.usages, updated_at = NOW() RETURNING ${columns}`,
                    [
                        key,
                        revision,
                        JSON.stringify(asset),
                        [...new Set([...(current?.aliases ?? []), ...aliases])],
                        [...new Set([...(current?.usages ?? []), ...usages])]
                    ]
                );
                await client.query(
                    "INSERT INTO editorial_image_revision (asset_key, revision, asset) VALUES ($1,$2,$3)",
                    [key, revision, JSON.stringify(asset)]
                );
                await client.query("COMMIT");
                return result.rows[0]!;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        }
    };
}
