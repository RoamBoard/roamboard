import "dotenv/config";

import createDebug from "debug";

import { createApp } from "./app.js";

const log = createDebug("roamboard:server");
const port = Number(process.env.PORT ?? 3000);
const app = createApp();

const server = app.listen(port, () => {
  log(`API listening on http://localhost:${port}`);
});

server.on("error", (error) => {
  log("Could not start API server: %O", error);
  process.exitCode = 1;
});
