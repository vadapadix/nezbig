import { app } from "./presentation/http/app.js";
import { redis } from "./infrastructure/persistence/redisClient.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const server = app.listen(port, host, () => {
  console.log(`Nezbig API listening on http://${host}:${port}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(async () => {
    if (redis) await redis.quit();
    process.exit(0);
  });
});
