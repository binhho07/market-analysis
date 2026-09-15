"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Competitor } from "@/lib/mockData";
import { Star, ExternalLink, MapPin, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface CompetitorTableProps {
  competitors: Competitor[];
}

export function CompetitorTable({ competitors }: CompetitorTableProps) {
  // Calculate competitive score for each competitor
  const calculateCompetitiveScore = (competitor: Competitor): number => {
    // Formula: (Rating × log(Reviews + 1)) / Distance × 10
    // Higher score = bigger threat
    const reviewWeight = Math.log(competitor.reviewCount + 1);
    const score = (competitor.rating * reviewWeight) / (competitor.distanceMiles || 1);
    return Math.min(Math.round(score * 10), 100); // Cap at 100
  };

  const getScoreBadgeColor = (score: number): string => {
    if (score >= 70) return "bg-red-500 text-white hover:bg-red-600";
    if (score >= 40) return "bg-yellow-500 text-white hover:bg-yellow-600";
    return "bg-green-500 text-white hover:bg-green-600";
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 70) return "High Threat";
    if (score >= 40) return "Medium";
    return "Low Threat";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-full rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Competitor Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="font-bold">Name</TableHead>
                  <TableHead className="font-bold">Threat Level</TableHead>
                  <TableHead className="font-bold">Rating</TableHead>
                  <TableHead className="font-bold">Reviews</TableHead>
                  <TableHead className="font-bold">Price</TableHead>
                  <TableHead className="font-bold">Gel</TableHead>
                  <TableHead className="font-bold">Pedicure</TableHead>
                  <TableHead className="font-bold">Acrylic</TableHead>
                  <TableHead className="font-bold">Staff</TableHead>
                  <TableHead className="font-bold">Hours/wk</TableHead>
                  <TableHead className="font-bold">Amenities</TableHead>
                  <TableHead className="font-bold">Distance</TableHead>
                  <TableHead className="font-bold">Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((competitor) => {
                  const competitiveScore = calculateCompetitiveScore(competitor);
                  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(competitor.name + ' ' + competitor.address)}`;
                  const hasValidWebsite = competitor.website && competitor.website !== "#" && competitor.website !== "";
                  const websiteUrl = hasValidWebsite ? competitor.website : `https://www.google.com/search?q=${encodeURIComponent(competitor.name + ' ' + competitor.address)}`;
                  
                  return (
                    <TableRow
                      key={competitor.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-medium">
                        <a
                          href={websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                          title={hasValidWebsite ? "Visit website" : "Search on Google"}
                        >
                          {competitor.name}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge className={`${getScoreBadgeColor(competitiveScore)} font-bold`}>
                            {competitiveScore}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {getScoreLabel(competitiveScore)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold">{competitor.rating}</span>
                        </div>
                      </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {competitor.reviewCount}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{competitor.priceRange}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {competitor.samplePrices.gel ? `$${competitor.samplePrices.gel}` : '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {competitor.samplePrices.pedicure ? `$${competitor.samplePrices.pedicure}` : '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {competitor.samplePrices.acrylic ? `$${competitor.samplePrices.acrylic}` : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {competitor.staffBand}
                    </TableCell>
                    <TableCell className="text-sm">
                      {competitor.hoursPerWeek}h
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {competitor.amenities.map((amenity, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {amenity}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {competitor.distanceMiles} mi
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                        onClick={() => window.open(googleMapsUrl, '_blank')}
                      >
                        <MapPin className="h-3 w-3" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

