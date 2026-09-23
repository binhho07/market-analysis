import cron from "node-cron";
import { prisma } from "../prisma";
import { monitorWatchlist } from "../monitoring/run";

/**
 * Cron job manager for automated competitor crawling
 */
export class CronManager {
  private static instance: CronManager;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {}

  public static getInstance(): CronManager {
    if (!CronManager.instance) {
      CronManager.instance = new CronManager();
    }
    return CronManager.instance;
  }

  /**
   * Start all configured cron jobs
   */
  public startAll(): void {
    console.log("🕐 Starting cron jobs for competitor crawling...");
    
    // Daily crawl at 2 AM
    this.startJob("daily-crawl", "0 2 * * *", async () => {
      console.log("🌅 Starting daily competitor crawl...");
      await this.runCrawl("daily");
    });

    // Weekly deep crawl at 3 AM on Sundays
    this.startJob("weekly-deep-crawl", "0 3 * * 0", async () => {
      console.log("📊 Starting weekly deep competitor crawl...");
      await this.runCrawl("weekly");
    });

    // Hourly monitoring crawl (lightweight)
    this.startJob("hourly-monitor", "0 * * * *", async () => {
      console.log("👀 Starting hourly competitor monitoring...");
      await this.runCrawl("hourly");
    });

    console.log("✅ All cron jobs started successfully");
  }

  /**
   * Start a specific cron job
   */
  private startJob(name: string, schedule: string, task: () => Promise<void>): void {
    const job = cron.schedule(schedule, async () => {
      try {
        await task();
      } catch (error) {
        console.error(`❌ Cron job ${name} failed:`, error);
        await this.logCrawlError(name, error as Error);
      }
    }, {
      scheduled: false,
      timezone: "UTC",
    });

    job.start();
    this.jobs.set(name, job);
    console.log(`✅ Started cron job: ${name} (${schedule})`);
  }

  /**
   * Run the actual crawl process
   */
  private async runCrawl(type: "daily" | "weekly" | "hourly"): Promise<void> {
    const startTime = new Date();
    const depth = type === "hourly" ? "places" : "prices";

    try {
      console.log(`🚀 Monitoring watchlist (${type}, ${depth})`);
      const results = await monitorWatchlist(depth);
      await this.logCrawlCompletion(type, startTime, results);
      console.log(`✅ ${type} monitor finished. ${results.watches} watches, ${results.events} events.`);
    } catch (error) {
      console.error(`❌ ${type} monitor failed:`, error);
      await this.logCrawlError(type, error as Error);
      throw error;
    }
  }

  /**
   * Log successful crawl completion
   */
  private async logCrawlCompletion(
    type: string, 
    startTime: Date, 
    results: { watches: number; events: number; errors?: string[]; note?: string }
  ): Promise<void> {
    try {
      await prisma.crawlLog.create({
        data: {
          crawlType: type,
          startTime,
          endTime: new Date(),
          status: results.errors?.length ? "completed" : "completed",
          competitorsFound: results.watches,
          competitorsProcessed: results.events,
          errorsCount: results.errors?.length || 0,
          notes: results.note || `Watchlist ${type}: ${results.events} market events`,
        }
      });
    } catch (error) {
      console.error("Failed to log crawl completion:", error);
    }
  }

  /**
   * Log crawl error
   */
  private async logCrawlError(type: string, error: Error): Promise<void> {
    try {
      await prisma.crawlLog.create({
        data: {
          crawlType: type,
          startTime: new Date(),
          endTime: new Date(),
          status: "failed",
          competitorsFound: 0,
          competitorsProcessed: 0,
          errorsCount: 1,
          notes: `Error: ${error.message}`
        }
      });
    } catch (logError) {
      console.error("Failed to log crawl error:", logError);
    }
  }

  /**
   * Stop all cron jobs
   */
  public stopAll(): void {
    console.log("🛑 Stopping all cron jobs...");
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️ Stopped cron job: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Get status of all cron jobs
   */
  public getStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};
    this.jobs.forEach((job, name) => {
      status[name] = job.running;
    });
    return status;
  }

  /**
   * Manually trigger a crawl
   */
  public async triggerManualCrawl(type: "daily" | "weekly" | "hourly" = "daily"): Promise<void> {
    console.log(`🔧 Manually triggering ${type} crawl...`);
    await this.runCrawl(type);
  }
}

// Export singleton instance
export const cronManager = CronManager.getInstance();

