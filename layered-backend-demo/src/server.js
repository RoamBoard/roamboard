import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

const server = app.listen(env.PORT, (error) => {
  if (error) {
    console.error("Could not start server", error);
    process.exit(1);
  }

  console.log(`API listening on http://localhost:${env.PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received; closing server`);

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

