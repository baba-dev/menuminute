import { startWorker } from "../src/modules/jobs/worker";
const databaseUrl = process.env["WORKER_DATABASE_URL"];
const queueUrl = process.env["REDIS_QUEUE_URL"];
if (!databaseUrl || !queueUrl)
  throw new Error("Explicit worker database and queue configuration required");
const runtime = await startWorker(databaseUrl, queueUrl);
let closing = false;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => {
      console.error("Worker drain deadline exceeded; leases will recover");
      process.exit(1);
    }, 30000);
    deadline.unref();
    runtime
      .close()
      .then(() => {
        clearTimeout(deadline);
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });
}
