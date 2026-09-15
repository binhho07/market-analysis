/**
 * Threat scoring for nearby competitors.
 * Higher score = stronger nearby threat.
 */

export function competitiveScore(competitor) {
  const rating = Number(competitor?.rating) || 0;
  const reviews = Number(competitor?.reviewCount) || 0;
  const distance = Math.max(Number(competitor?.distanceMiles) || 1, 0.1);
  const reviewWeight = Math.log(reviews + 1);
  const score = (rating * reviewWeight) / distance;
  return Math.min(Math.round(score * 10), 100);
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
