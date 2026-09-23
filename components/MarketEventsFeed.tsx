"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { eventMark } from "@/lib/monitoring/diff";

interface MarketEvent {
  id: string;
  title: string;
  severity: string;
  kind: string;
  competitorName: string;
  detectedAt: string;
  readAt?: string | null;
  watchTarget?: { label: string };
}

export function MarketEventsFeed() {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const ready = useRef(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/events");
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(payload.error?.message || "Market events are unavailable until the database schema is updated.");
      setLoading(false);
      return;
    }
    setError(null);
    const next = (payload.data?.events || []) as MarketEvent[];
    if (ready.current) {
      const fresh = next.filter((event) => !seen.current.has(event.id) && !event.readAt);
      if (fresh.length && typeof Notification !== "undefined" && Notification.permission === "granted") {
        fresh.slice(0, 3).forEach((event) => {
          new Notification(`${eventMark(event.severity)} ${event.title}`);
        });
      }
      if (fresh.length) {
        toast.message(fresh.length === 1 ? fresh[0].title : `${fresh.length} new market events`);
      }
    }
    next.forEach((event) => seen.current.add(event.id));
    ready.current = true;
    setEvents(next);
    setUnread(payload.data?.unread || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const markRead = async () => {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setUnread(0);
    setEvents((current) => current.map((event) => ({ ...event, readAt: event.readAt || new Date().toISOString() })));
  };

  return (
    <Card className="rounded-xl border border-gray-200 bg-white shadow-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-2xl font-bold text-black">Market events</CardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Changes since the last snapshot of a watched market.
            {unread ? ` ${unread} unread.` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (typeof Notification === "undefined") return;
              const permission = await Notification.requestPermission();
              if (permission === "granted") toast.success("Notifications on");
            }}
          >
            Enable notifications
          </Button>
          <Button variant="outline" size="sm" onClick={markRead} disabled={!unread}>
            Mark read
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p className="text-sm text-gray-600">Loading events…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && events.length === 0 ? (
          <p className="text-sm text-gray-600">
            No changes yet. Monitor a market, then the next crawl compares it with the previous snapshot.
          </p>
        ) : null}
        {events.map((event) => (
          <div
            key={event.id}
            className={`rounded-lg border px-3 py-2 ${event.readAt ? "border-gray-100 bg-white" : "border-gray-200 bg-gray-50"}`}
          >
            <p className="text-sm text-gray-900">
              {eventMark(event.severity)} {event.title}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {event.watchTarget?.label || event.competitorName} · {new Date(event.detectedAt).toLocaleString()}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
