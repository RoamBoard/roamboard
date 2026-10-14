import "dotenv/config";

import { closeDatabase } from "../db.js";
import { createBoardsRepository } from "../features/boards/boards.repository.js";
import { createCloudinaryProvider } from "../features/images/images.cloudinary.js";
import { createImagesRepository } from "../features/images/images.repository.js";
import { createImagesService } from "../features/images/images.service.js";

const service = createImagesService(createImagesRepository(), createCloudinaryProvider(), createBoardsRepository());

try {
    let total = 0;
    for (;;) {
        const { removed } = await service.cleanupUnused();
        total += removed;
        if (removed < 100) break;
    }
    process.stdout.write(`Removed ${total} unused image assets\n`);
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Image cleanup failed: ${message}\n`);
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
