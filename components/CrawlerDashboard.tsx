"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Square, RefreshCw, BarChart3, Users, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface CrawlerStatus {
  "daily-crawl": boolean;
  "weekly-deep-crawl": boolean;
  "hourly-monitor": boolean;
}

interface CrawlLog {
  id: string;
  crawlType: string;
  startTime: string;
  endTime: string;
  status: string;
  competitorsFound: number;
  competitorsProcessed: number;
  errorsCount: number;
  notes?: string;
}

interface CrawlStats {
  overview: {
    totalCrawls: number;
    successRate: number;
    successCount: number;
    failureCount: number;
  };
  timePeriods: {
    last24Hours: any;
    last7Days: any;
    last30Days: any;
    allTime: any;
  };
  crawlTypes: Array<{
    type: string;
    count: number;
  }>;
}

interface Competitor {
  id: string;
  name: string;
  address: string;
  googleRating?: number;
  googleReviewCount?: number;
  website?: string;
  lastCrawled?: string;
  crawlStatus?: string;
  crawlErrors?: string[];
}

export default function CrawlerDashboard() {
  const [status, setStatus] = useState<CrawlerStatus>({
    "daily-crawl": false,
    "weekly-deep-crawl": false,
    "hourly-monitor": false
  });
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const [stats, setStats] = useState<CrawlStats | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statusRes, logsRes, statsRes, competitorsRes] = await Promise.all([
        fetch("/api/crawler/start"),
        fetch("/api/crawler/logs"),
        fetch("/api/crawler/logs", { method: "POST" }),
        fetch("/api/competitors")
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData.status || {});
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.data?.logs || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data || null);
      }

      if (competitorsRes.ok) {
        const competitorsData = await competitorsRes.json();
        setCompetitors(competitorsData.data?.competitors || []);
      }

    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCrawler = async (crawlType: string = "daily") => {
    try {
      setActionLoading("start");
      const response = await fetch("/api/crawler/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crawlType })
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
        await fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error("Failed to start crawler:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopCrawler = async () => {
    try {
      setActionLoading("stop");
      const response = await fetch("/api/crawler/stop", {
        method: "POST"
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
      }
    } catch (error) {
      console.error("Failed to stop crawler:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualCrawl = async () => {
    try {
      setActionLoading("manual");
      const response = await fetch("/api/crawler/manual-crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Aventus Nail Spa",
          address: "94 Meadow Park Ave, Lewis Center, OH, United States",
          lat: 40.1584,
          lng: -83.0075,
          radius: 5000,
          deepCrawl: true,
          takeScreenshots: true
        })
      });

      if (response.ok) {
        await fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error("Failed to trigger manual crawl:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "running":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCrawlerStatusBadge = (isRunning: boolean) => {
    return isRunning ? 
      <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Running</Badge> :
      <Badge variant="secondary"><Square className="w-3 h-3 mr-1" />Stopped</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Competitor Crawler Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage automated competitor data collection</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleManualCrawl()}
            disabled={actionLoading === "manual"}
            variant="outline"
          >
            {actionLoading === "manual" ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Manual Crawl
          </Button>
          <Button
            onClick={() => handleStartCrawler()}
            disabled={actionLoading === "start"}
            variant="default"
          >
            {actionLoading === "start" ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Start Crawler
          </Button>
          <Button
            onClick={handleStopCrawler}
            disabled={actionLoading === "stop"}
            variant="destructive"
          >
            {actionLoading === "stop" ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Square className="w-4 h-4 mr-2" />
            )}
            Stop Crawler
          </Button>
        </div>
      </div>

      {/* Crawler Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Daily Crawl
            </CardTitle>
            <CardDescription>Runs at 2:00 AM daily</CardDescription>
          </CardHeader>
          <CardContent>
            {getCrawlerStatusBadge(status["daily-crawl"])}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Weekly Deep Crawl
            </CardTitle>
            <CardDescription>Runs at 3:00 AM on Sundays</CardDescription>
          </CardHeader>
          <CardContent>
            {getCrawlerStatusBadge(status["weekly-deep-crawl"])}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Hourly Monitor
            </CardTitle>
            <CardDescription>Lightweight monitoring every hour</CardDescription>
          </CardHeader>
          <CardContent>
            {getCrawlerStatusBadge(status["hourly-monitor"])}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Crawl Logs</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Crawls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.overview.totalCrawls}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.overview.successRate.toFixed(1)}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Competitors Found</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.timePeriods.last7Days.competitorsFound}</div>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">{stats.timePeriods.last7Days.errors}</div>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Crawl Logs</CardTitle>
              <CardDescription>Latest automated crawl activities</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Competitors</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.slice(0, 10).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.crawlType}</TableCell>
                      <TableCell>{new Date(log.startTime).toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>{log.competitorsFound}</TableCell>
                      <TableCell>{log.errorsCount}</TableCell>
                      <TableCell className="max-w-xs truncate">{log.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Discovered Competitors</CardTitle>
              <CardDescription>Nail spas found within 5km of Aventus Nail Spa</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Last Crawled</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitors.map((competitor) => (
                    <TableRow key={competitor.id}>
                      <TableCell className="font-medium">{competitor.name}</TableCell>
                      <TableCell className="max-w-xs truncate">{competitor.address}</TableCell>
                      <TableCell>
                        {competitor.googleRating ? (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{competitor.googleRating}</span>
                            <span className="text-sm text-muted-foreground">({competitor.googleReviewCount})</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {competitor.website ? (
                          <a href={competitor.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Visit
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {competitor.lastCrawled ? new Date(competitor.lastCrawled).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        {competitor.crawlStatus ? getStatusBadge(competitor.crawlStatus) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance by Time Period</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(stats.timePeriods).map(([period, data]) => (
                    <div key={period} className="flex justify-between items-center">
                      <span className="capitalize font-medium">{period.replace(/([A-Z])/g, ' $1')}</span>
                      <div className="text-right">
                        <div className="font-bold">{data.crawls} crawls</div>
                        <div className="text-sm text-muted-foreground">
                          {data.competitorsFound} competitors found
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Crawl Types Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.crawlTypes.map((type) => (
                      <div key={type.type} className="flex justify-between items-center">
                        <span className="capitalize">{type.type}</span>
                        <Badge variant="outline">{type.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
