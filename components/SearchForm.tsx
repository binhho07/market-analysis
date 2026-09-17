"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2 } from "lucide-react";
import { searchFormSchema, type SearchFormData } from "@/lib/validations";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { saveRecentSearch } from "@/lib/js/recentSearches.js";
import { toast } from "sonner";

interface SearchFormProps {
  onAnalyze: (data: SearchFormData) => void;
  isLoading?: boolean;
}

export function SearchForm({ onAnalyze, isLoading = false }: SearchFormProps) {
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(5);
  const [competitorCount, setCompetitorCount] = useState(10);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = searchFormSchema.safeParse({
      address,
      radius,
      competitorCount,
      lat: selectedLocation?.lat,
      lng: selectedLocation?.lng,
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(newErrors);
      toast.error("Please fix the errors in the form");
      return;
    }

    saveRecentSearch(result.data);
    toast.success("Analyzing competitors...");
    onAnalyze(result.data);
  };

  return (
    <Card className="w-full rounded-xl shadow-lg border border-gray-200 bg-white overflow-visible">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-black">Search Competitors</CardTitle>
        <CardDescription className="text-gray-600">
          Enter your salon location to find and analyze nearby competitors
        </CardDescription>
      </CardHeader>
        <CardContent className="overflow-visible">
        <form onSubmit={handleSubmit} className="space-y-4 overflow-visible">
          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium">
              Salon Address or Name <span className="text-red-500">*</span>
            </label>
            <AddressAutocomplete
              id="address"
              value={address}
              disabled={isLoading}
              error={errors.address}
              placeholder="Start typing a salon name or address"
              onChange={(next) => {
                setAddress(next);
                setSelectedLocation(null);
                if (errors.address) {
                  setErrors((current) => ({ ...current, address: "" }));
                }
              }}
              onSelect={(next, lat, lng) => {
                setAddress(next);
                setSelectedLocation(
                  typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null
                );
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="radius" className="text-sm font-medium">
                Search Radius (miles) <span className="text-red-500">*</span>
              </label>
              <Input
                id="radius"
                type="number"
                min="1"
                max="50"
                value={radius}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setRadius(Number.isFinite(next) ? next : 0);
                }}
                className={errors.radius ? "border-red-500" : ""}
                disabled={isLoading}
                aria-label="Search radius in miles"
                aria-invalid={!!errors.radius}
                aria-describedby={errors.radius ? "radius-error" : undefined}
              />
              {errors.radius && (
                <p id="radius-error" className="text-sm text-red-500" role="alert">
                  {errors.radius}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="competitors" className="text-sm font-medium">
                Number of Competitors <span className="text-red-500">*</span>
              </label>
              <Input
                id="competitors"
                type="number"
                min="1"
                max="50"
                value={competitorCount}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setCompetitorCount(Number.isFinite(next) ? next : 0);
                }}
                className={errors.competitorCount ? "border-red-500" : ""}
                disabled={isLoading}
                aria-label="Number of competitors to analyze"
                aria-invalid={!!errors.competitorCount}
                aria-describedby={errors.competitorCount ? "competitors-error" : undefined}
              />
              {errors.competitorCount && (
                <p id="competitors-error" className="text-sm text-red-500" role="alert">
                  {errors.competitorCount}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full md:w-auto bg-black hover:bg-gray-800 text-white"
            size="lg"
            disabled={isLoading}
            aria-label="Analyze competitors"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Analyze Competitors
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
