const STORAGE_KEY = "spa-atlas-watchlist";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getWatchlist() {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isWatched(id) {
  return getWatchlist().some((item) => item.id === id);
}

export function toggleWatchlist(competitor) {
  if (!canUseStorage() || !competitor?.id) return getWatchlist();

  const current = getWatchlist();
  const exists = current.some((item) => item.id === competitor.id);
  const next = exists
    ? current.filter((item) => item.id !== competitor.id)
    : [
        {
          id: competitor.id,
          name: competitor.name,
          rating: competitor.rating,
          distanceMiles: competitor.distanceMiles,
        },
        ...current,
      ].slice(0, 30);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
