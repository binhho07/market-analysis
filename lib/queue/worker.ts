import { startAnalysisWorker } from "./analysis-queue";

async function main() {
  const worker = await startAnalysisWorker();
  if (!worker) {
    console.log("No Redis connection. Set REDIS_URL or use `npm run dev` for in-process jobs.");
    process.exit(0);
  }
  console.log("Waiting for analysis jobs...");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
