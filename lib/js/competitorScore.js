import { confidenceWeightedScore, inputConfidence } from "../provenance";

/**
 * Threat score discounted by how trustworthy the inputs are.
 * Estimated menu prices pull the score down. Missing fields do not count as observed.
 */

export function competitiveScore(competitor) {
  return confidenceWeightedScore(competitor);
}

export function dataConfidence(competitor) {
  return inputConfidence(competitor);
}

export function scoreLabel(score) {
  if (score >= 70) return "High Threat";
  if (score >= 40) return "Medium";
  return "Low Threat";
}

export function scoreBadgeClass(score) {
  if (score >= 70) return "bg-red-500 text-white hover:bg-red-600";
  if (score >= 40) return "bg-yellow-500 text-white hover:bg-yellow-600";
  return "bg-green-500 text-white hover:bg-green-600";
}
