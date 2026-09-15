"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton() {
  return (
    <Card className="w-full rounded-2xl shadow-lg">
      <CardHeader>
        <Skeleton className="h-8 w-64" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 flex-1" />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {Array.from({ length: 8 }).map((_, j) => (
                <Skeleton key={j} className="h-12 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card className="w-full rounded-2xl shadow-lg">
      <CardHeader>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[400px] w-full" />
      </CardContent>
    </Card>
  );
}

export function MapSkeleton() {
  return (
    <Card className="w-full h-full rounded-2xl shadow-lg">
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}

export function SummarySkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <Skeleton className="h-8 w-48 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center border-b pb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <TableSkeleton />
      <ChartSkeleton />
      <MapSkeleton />
    </div>
  );
}

