export const ANALYSIS_STAGES = ["places", "websites", "prices", "insights"] as const;

export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];

export type StageStatus = "pending" | "running" | "done" | "failed";

export interface StageProgress {
  status: StageStatus;
  current: number;
  total: number;
  label: string;
}

export interface AnalysisProgress {
  places: StageProgress;
  websites: StageProgress;
  prices: StageProgress;
  insights: StageProgress;
}

export interface AnalysisJobPayload {
  jobId: string;
  address: string;
  lat: number;
  lng: number;
  radius: number;
  competitorCount: number;
}

export interface AnalysisJobPublic {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: string;
  progress: AnalysisProgress;
  result?: {
    competitors: unknown[];
    searchLocation: { lat: number; lng: number };
    insights?: unknown;
  } | null;
  error?: string | null;
}

export function emptyProgress(): AnalysisProgress {
  return {
    places: { status: "pending", current: 0, total: 0, label: "Searching competitors" },
    websites: { status: "pending", current: 0, total: 0, label: "Discovering websites" },
    prices: { status: "pending", current: 0, total: 0, label: "Extracting prices" },
    insights: { status: "pending", current: 0, total: 1, label: "Generating insights" },
  };
}
