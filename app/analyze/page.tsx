"use client";

import { useEffect, useRef, useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { CompetitorTable } from "@/components/CompetitorTable";
import { PriceBarChart } from "@/components/PriceBarChart";
import { PriceTrendLineChart } from "@/components/PriceTrendLineChart";
import { MarketSharePieChart } from "@/components/MarketSharePieChart";
import { AIInsights } from "@/components/AIInsights";
import { MapView } from "@/components/MapView";
import { HeatMapView } from "@/components/HeatMapView";
import { HistoricalTrackingDashboard } from "@/components/HistoricalTrackingDashboard";
import { ExportButtons } from "@/components/ExportButtons";
import { MarketSnapshot } from "@/components/MarketSnapshot";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { Card, CardContent } from "@/components/ui/card";
import { SearchFormData } from "@/lib/validations";
import { emptyProgress, type AnalysisJobPublic } from "@/lib/analysis/types";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AnalyzePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [searchData, setSearchData] = useState<SearchFormData | null>(null);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<AnalysisJobPublic | null>(null);
  const pollRef = useRef<number | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const stopListening = () => {
    sourceRef.current?.close();
    sourceRef.current = null;
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopListening(), []);

  const applyJob = (next: AnalysisJobPublic) => {
    setJob({
      ...next,
      progress: { ...emptyProgress(), ...next.progress },
    });

    if (next.status === "completed") {
      const competitorsData = next.result?.competitors || [];
      const location = next.result?.searchLocation || null;
      setCompetitors(competitorsData as any[]);
      setSearchLocation(location);
      setHasSearched(true);
      setIsLoading(false);
      stopListening();
      toast.success(`Found ${competitorsData.length} competitors`);
    }

    if (next.status === "failed") {
      setError(next.error || "Analysis failed");
      setIsLoading(false);
      stopListening();
      toast.error(next.error || "Analysis failed");
    }
  };

  const listenToJob = (jobId: string) => {
    stopListening();

    const poll = async () => {
      const response = await apiClient.getAnalysisJob(jobId);
      if (response.success && response.data) {
        applyJob(response.data as AnalysisJobPublic);
      }
    };

    const source = new EventSource(`/api/analyze/${jobId}/events`);
    sourceRef.current = source;

    source.onmessage = (event) => {
      try {
        applyJob(JSON.parse(event.data) as AnalysisJobPublic);
      } catch {
        // ignore malformed chunks
      }
    };

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
      if (!pollRef.current) {
        void poll();
        pollRef.current = window.setInterval(() => {
          void poll();
        }, 1000);
      }
    };
  };

  const handleAnalyze = async (data: SearchFormData) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(false);
    setSearchData(data);
    setJob(null);
    setCompetitors([]);

    try {
      const queued = await apiClient.startAnalysis({
        address: data.address,
        radius: data.radius,
        competitorCount: data.competitorCount,
        lat: data.lat,
        lng: data.lng,
      });

      if (!queued.success || !queued.data?.jobId) {
        throw new Error(queued.error?.message || "Failed to queue analysis");
      }

      toast.success("Analysis queued");
      listenToJob(queued.data.jobId);
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis");
      toast.error(err.message || "Failed to analyze competitors");
      setIsLoading(false);
    }
  };

  const handleExport = async (format: "csv" | "pdf") => {
    if (competitors.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      if (format === "csv") {
        await apiClient.exportCSV(competitors);
        toast.success("CSV exported successfully!");
      } else {
        await apiClient.exportPDF(competitors, searchData?.address);
        toast.success("PDF exported successfully!");
      }
    } catch (err: any) {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-700 hover:text-black transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-semibold">Back to Home</span>
          </Link>
          <h1 className="text-2xl font-bold text-black">
            Competitor Analysis
          </h1>
          <div className="w-[120px]"></div> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <SearchForm onAnalyze={handleAnalyze} isLoading={isLoading} />
        </motion.div>

        {/* Pipeline progress */}
        {isLoading && job && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <AnalysisProgress job={job} />
          </motion.div>
        )}

        {isLoading && !job && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <AnalysisProgress
              job={{
                id: "queued",
                status: "queued",
                stage: "queued",
                progress: emptyProgress(),
              }}
            />
          </motion.div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="border-red-300 bg-white rounded-xl shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Analysis Error</h3>
                    <p className="text-gray-700 text-sm">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Results */}
        {hasSearched && !isLoading && competitors.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            {/* Export Buttons */}
            <div className="flex justify-end">
              <ExportButtons onExport={handleExport} />
            </div>

            <MarketSnapshot competitors={competitors} address={searchData?.address} />

            {/* Competitor Table */}
            <CompetitorTable competitors={competitors} />

            {/* Charts Section */}
            <div className="space-y-6">
              {/* Bar Chart - Full Width */}
              <PriceBarChart competitors={competitors} />
              
              {/* Line Graph & Pie Chart - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PriceTrendLineChart competitors={competitors} />
                <MarketSharePieChart competitors={competitors} />
              </div>
            </div>

            {/* AI Insights */}
            <AIInsights competitors={competitors} />

            {/* Historical Tracking Dashboard */}
            <HistoricalTrackingDashboard currentSearchLocation={searchLocation || undefined} />

            {/* Map Views - Side by Side */}
            {searchLocation && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MapView 
                  competitors={competitors} 
                  center={searchLocation}
                />
                <HeatMapView 
                  competitors={competitors} 
                  searchLocation={searchLocation}
                />
              </div>
            )}
          </motion.div>
        )}

        {/* Empty State */}
        {hasSearched && !isLoading && competitors.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="rounded-xl shadow-lg border border-gray-200">
              <CardContent className="pt-12 pb-12 text-center">
                <div className="space-y-3">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="h-8 w-8 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-black">No Competitors Found</h3>
                  <p className="text-gray-600">
                    No nail salons were found in the specified area. Try expanding your search radius.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Initial State - Show helper text */}
        {!hasSearched && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="rounded-xl shadow-lg bg-white border border-gray-200">
              <CardContent className="pt-12 pb-12 text-center">
                <div className="space-y-3">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-3xl">🔍</span>
                  </div>
                  <h3 className="text-xl font-semibold text-black">Ready to Analyze</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Enter your salon's address above to discover and analyze nearby competitors. 
                    We'll provide detailed insights on pricing, ratings, and more.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  );
}


