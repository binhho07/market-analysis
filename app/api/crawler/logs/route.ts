import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Get crawl logs with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const crawlType = searchParams.get("crawlType");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (crawlType) {
      where.crawlType = crawlType;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (dateFrom || dateTo) {
      where.startTime = {};
      if (dateFrom) {
        where.startTime.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.startTime.lte = new Date(dateTo);
      }
    }

    // Get total count
    const total = await prisma.crawlLog.count({ where });

    // Get logs with pagination
    const logs = await prisma.crawlLog.findMany({
      where,
      orderBy: { startTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        crawlType: true,
        startTime: true,
        endTime: true,
        status: true,
        competitorsFound: true,
        competitorsProcessed: true,
        errorsCount: true,
        notes: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error("Failed to get crawl logs:", error);
    return NextResponse.json(
      { error: "Failed to get crawl logs" },
      { status: 500 }
    );
  }
}

/**
 * Get crawl statistics
 */
export async function POST() {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get statistics for different time periods
    const [
      last24HoursStats,
      last7DaysStats,
      last30DaysStats,
      totalStats
    ] = await Promise.all([
      // Last 24 hours
      prisma.crawlLog.aggregate({
        where: { startTime: { gte: last24Hours } },
        _count: { id: true },
        _sum: { 
          competitorsFound: true,
          competitorsProcessed: true,
          errorsCount: true
        },
        _avg: {
          competitorsFound: true,
          competitorsProcessed: true,
          errorsCount: true
        }
      }),

      // Last 7 days
      prisma.crawlLog.aggregate({
        where: { startTime: { gte: last7Days } },
        _count: { id: true },
        _sum: { 
          competitorsFound: true,
          competitorsProcessed: true,
          errorsCount: true
        },
        _avg: {
          competitorsFound: true,
          competitorsProcessed: true,
          errorsCount: true
        }
      }),

      // Last 30 days
      prisma.crawlLog.aggregate({
        where: { startTime: { gte: last30Days } },
        _count: { id: true },
        _sum: { 
          competitorsFound: true,
          competitorsProcessed: true,
          errorsCount: true
        },
        _avg: {
          competitorsFound: true,
          competitorsProcessed: true,
          errorsCount: true
        }
      }),

      // All time
      prisma.crawlLog.aggregate({
        _count: { id: true },
        _sum: { 
          competitorsFound: true,
          competitorsProcessed: true,
          errorsCount: true
        },
        _avg: {
          competitorsFound: true,
          competitorsProcessed: true,
          errorsCount: true
        }
      })
    ]);

    // Get success/failure rates
    const [successCount, failureCount] = await Promise.all([
      prisma.crawlLog.count({ where: { status: "completed" } }),
      prisma.crawlLog.count({ where: { status: "failed" } })
    ]);

    const totalCrawls = successCount + failureCount;
    const successRate = totalCrawls > 0 ? (successCount / totalCrawls) * 100 : 0;

    // Get recent crawl types distribution
    const crawlTypeStats = await prisma.crawlLog.groupBy({
      by: ["crawlType"],
      _count: { id: true },
      where: { startTime: { gte: last7Days } }
    });

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalCrawls,
          successRate: Math.round(successRate * 100) / 100,
          successCount,
          failureCount
        },
        timePeriods: {
          last24Hours: {
            crawls: last24HoursStats._count.id,
            competitorsFound: last24HoursStats._sum.competitorsFound || 0,
            competitorsProcessed: last24HoursStats._sum.competitorsProcessed || 0,
            errors: last24HoursStats._sum.errorsCount || 0,
            avgCompetitorsFound: Math.round((last24HoursStats._avg.competitorsFound || 0) * 100) / 100,
            avgCompetitorsProcessed: Math.round((last24HoursStats._avg.competitorsProcessed || 0) * 100) / 100
          },
          last7Days: {
            crawls: last7DaysStats._count.id,
            competitorsFound: last7DaysStats._sum.competitorsFound || 0,
            competitorsProcessed: last7DaysStats._sum.competitorsProcessed || 0,
            errors: last7DaysStats._sum.errorsCount || 0,
            avgCompetitorsFound: Math.round((last7DaysStats._avg.competitorsFound || 0) * 100) / 100,
            avgCompetitorsProcessed: Math.round((last7DaysStats._avg.competitorsProcessed || 0) * 100) / 100
          },
          last30Days: {
            crawls: last30DaysStats._count.id,
            competitorsFound: last30DaysStats._sum.competitorsFound || 0,
            competitorsProcessed: last30DaysStats._sum.competitorsProcessed || 0,
            errors: last30DaysStats._sum.errorsCount || 0,
            avgCompetitorsFound: Math.round((last30DaysStats._avg.competitorsFound || 0) * 100) / 100,
            avgCompetitorsProcessed: Math.round((last30DaysStats._avg.competitorsProcessed || 0) * 100) / 100
          },
          allTime: {
            crawls: totalStats._count.id,
            competitorsFound: totalStats._sum.competitorsFound || 0,
            competitorsProcessed: totalStats._sum.competitorsProcessed || 0,
            errors: totalStats._sum.errorsCount || 0,
            avgCompetitorsFound: Math.round((totalStats._avg.competitorsFound || 0) * 100) / 100,
            avgCompetitorsProcessed: Math.round((totalStats._avg.competitorsProcessed || 0) * 100) / 100
          }
        },
        crawlTypes: crawlTypeStats.map(stat => ({
          type: stat.crawlType,
          count: stat._count.id
        }))
      }
    });

  } catch (error) {
    console.error("Failed to get crawl statistics:", error);
    return NextResponse.json(
      { error: "Failed to get crawl statistics" },
      { status: 500 }
    );
  }
}

