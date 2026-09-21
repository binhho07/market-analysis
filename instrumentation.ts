export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { startAnalysisWorker } = await import("./lib/queue/analysis-queue");
    await startAnalysisWorker();
  } catch (error) {
    console.warn("Analysis worker did not start:", error);
  }
}
