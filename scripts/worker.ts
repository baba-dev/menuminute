import { startWorker } from "../src/modules/jobs/worker";
import { logger } from "../src/lib/logger";
import { startPushDispatcher } from "../src/modules/pwa/push-worker";
const databaseUrl = process.env["WORKER_DATABASE_URL"];
const queueUrl = process.env["REDIS_QUEUE_URL"];
if (!databaseUrl || !queueUrl)
  throw new Error("Explicit worker database and queue configuration required");
const runtime = await startWorker(databaseUrl, queueUrl);
const push = startPushDispatcher(runtime.pool);
logger.info("MenuMinute worker started", { event: "worker.started" });
let closing = false;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => {
      logger.fatal("Worker drain deadline exceeded", new Error("shutdown timeout"), {
        event: "worker.shutdown.timeout",
      });
      process.exit(1);
    }, 30000);
    deadline.unref();
    push
      .close()
      .then(() => runtime.close())
      .then(() => {
        clearTimeout(deadline);
        logger.info("MenuMinute worker stopped", { event: "worker.stopped" });
        process.exit(0);
      })
      .catch((error) => {
        logger.error("Worker shutdown failed", error, { event: "worker.shutdown.failed" });
        process.exit(1);
      });
  });
}
