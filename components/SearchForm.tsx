"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2 } from "lucide-react";
import { searchFormSchema, type SearchFormData } from "@/lib/validations";
import { toast } from "sonner";

interface SearchFormProps {
  onAnalyze: (data: SearchFormData) => void;
  isLoading?: boolean;
}

export function SearchForm({ onAnalyze, isLoading = false }: SearchFormProps) {
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(5);
  const [competitorCount, setCompetitorCount] = useState(10); // Default to 10 competitors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate with Zod
    const result = searchFormSchema.safeParse({
      address,
      radius,
      competitorCount,
    });

    if (!result.success) {
      // Extract errors
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

    // Success
    toast.success("Analyzing competitors...");
    onAnalyze(result.data);
  };

  return (
    <Card className="w-full rounded-xl shadow-lg border border-gray-200 bg-white">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-black">Search Competitors</CardTitle>
        <CardDescription className="text-gray-600">
          Enter your salon location to find and analyze nearby competitors
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium">
              Salon Address or Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="address"
              type="text"
              placeholder="e.g. 123 Main St, Los Angeles, CA"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={`w-full ${errors.address ? "border-red-500" : ""}`}
              disabled={isLoading}
              aria-label="Salon address or name"
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? "address-error" : undefined}
            />
            {errors.address && (
              <p id="address-error" className="text-sm text-red-500" role="alert">
                {errors.address}
              </p>
            )}
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
                onChange={(e) => setRadius(Number(e.target.value))}
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
                onChange={(e) => setCompetitorCount(Number(e.target.value))}
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