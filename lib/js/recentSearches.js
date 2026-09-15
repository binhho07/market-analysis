const STORAGE_KEY = "spa-atlas-recent-searches";
const MAX_ITEMS = 5;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getRecentSearches() {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(entry) {
  if (!canUseStorage() || !entry?.address) return getRecentSearches();

  const next = [
    {
      address: String(entry.address).trim(),
      radius: Number(entry.radius) || 5,
      competitorCount: Number(entry.competitorCount) || 10,
      savedAt: Date.now(),
    },
    ...getRecentSearches().filter(
      (item) => item.address.toLowerCase() !== String(entry.address).trim().toLowerCase()
    ),
  ].slice(0, MAX_ITEMS);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
