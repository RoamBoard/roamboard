import { env } from "../../config/env.js";
import { createPostgresPool, runMigrations } from "../../infrastructure/postgres.js";
import { sampleSearchDocuments } from "./search.documents.js";
import { createSearchModule } from "./search.module.js";
import { createPostgresSearchSourceRepository, seedSearchDocuments } from "./search.postgres-repository.js";

async function main(): Promise<void> {
    const command = process.argv[2] ?? "reindex";
    if (!["setup", "seed", "reindex"].includes(command)) {
        throw new Error(`Unknown search command: ${command}`);
    }

    const pool = env.STORAGE === "postgres" && env.DATABASE_URL ? createPostgresPool(env.DATABASE_URL) : undefined;

    try {
        if (pool) {
            await runMigrations(pool);
            await seedSearchDocuments(pool, sampleSearchDocuments);
        }
        const module = createSearchModule({
            sourceRepository: pool ? createPostgresSearchSourceRepository(pool) : undefined
        });
        if (command === "setup") {
            await module.service.ensureIndex();
            process.stdout.write("PostgreSQL search source ready\n");
        } else {
            const count = await module.service.reindex();
            process.stdout.write(`Read ${count} public PostgreSQL search documents\n`);
        }
    } finally {
        await pool?.end();
    }
}

main().catch((error: unknown) => {
    process.stderr.write(`Search command failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
});
