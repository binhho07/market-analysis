export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { startAnalysisWorker } = await import("./lib/queue/analysis-queue");
    await startAnalysisWorker();
    if (process.env.MONITOR_CRON !== "false") {
      const { cronManager } = await import("./lib/crawler/cron-manager");
      cronManager.startAll();
    }
  } catch (error) {
    console.warn("Analysis worker did not start:", error);
  }
}
