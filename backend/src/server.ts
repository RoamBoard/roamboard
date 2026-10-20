import "dotenv/config";

import { createApp } from "./app.js";
import { createImageCleanup, startImageCleanupWorker } from "./features/images/images.cleanup.js";
import { createImagesRepository } from "./features/images/images.repository.js";
import { createCloudinaryProvider } from "./features/images/images.cloudinary.js";

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

const server = app.listen(port, () => {
    process.stdout.write(`API listening on http://localhost:${port}\n`);
});

const cleanup = createImageCleanup(createImagesRepository(), createCloudinaryProvider());
const stopCleanup = startImageCleanupWorker(cleanup.cleanupUnused);
server.once("close", stopCleanup);

server.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Could not start API server: ${message}\n`);
    process.exitCode = 1;
});
