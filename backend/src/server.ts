import "dotenv/config";

import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

const server = app.listen(port, () => {
    process.stdout.write(`API listening on http://localhost:${port}\n`);
});

server.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Could not start API server: ${message}\n`);
    process.exitCode = 1;
});
