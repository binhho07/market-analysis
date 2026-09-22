"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Competitor } from "@/lib/mockData";
import { Star, ExternalLink, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { competitiveScore, dataConfidence, scoreBadgeClass, scoreLabel } from "@/lib/js/competitorScore.js";
import { ObservedCell, PriceCell } from "@/components/ProvenanceNote";
import { readValue } from "@/lib/provenance";
import { getWatchlist, toggleWatchlist } from "@/lib/js/watchlist.js";

interface CompetitorTableProps {
  competitors: Competitor[];
}

export function CompetitorTable({ competitors }: CompetitorTableProps) {
  const [watchedIds, setWatchedIds] = useState<string[]>([]);

  useEffect(() => {
    setWatchedIds(getWatchlist().map((item: { id: string }) => item.id));
  }, []);

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
                  <TableHead className="font-bold">Watch</TableHead>
                  <TableHead className="font-bold">Name</TableHead>
                  <TableHead className="font-bold">Threat Level</TableHead>
                  <TableHead className="font-bold">Rating</TableHead>
                  <TableHead className="font-bold">Reviews</TableHead>
                  <TableHead className="font-bold">Price</TableHead>
                  <TableHead className="font-bold">Gel</TableHead>
                  <TableHead className="font-bold">Pedicure</TableHead>
                  <TableHead className="font-bold">Acrylic</TableHead>
                  <TableHead className="font-bold">Staff (inferred)</TableHead>
                  <TableHead className="font-bold">Hours/wk</TableHead>
                  <TableHead className="font-bold">Amenities</TableHead>
                  <TableHead className="font-bold">Distance</TableHead>
                  <TableHead className="font-bold">Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((competitor) => {
                  const threatScore = competitiveScore(competitor);
                  const confidence = dataConfidence(competitor);
                  const amenities = readValue(competitor.amenities);
                  const amenityList = Array.isArray(amenities) ? amenities : [];
                  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(competitor.name + ' ' + (competitor.address || ''))}`;
                  const hasValidWebsite = competitor.website && competitor.website !== "#" && competitor.website !== "";
                  const websiteUrl = hasValidWebsite ? competitor.website : `https://www.google.com/search?q=${encodeURIComponent(competitor.name + ' ' + (competitor.address || ''))}`;
                  const watched = watchedIds.includes(competitor.id);
                  
                  return (
                    <TableRow
                      key={competitor.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
                          onClick={() => {
                            const next = toggleWatchlist(competitor);
                            setWatchedIds(next.map((item: { id: string }) => item.id));
                          }}
                        >
                          <Star className={`h-4 w-4 ${watched ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                        </Button>
                      </TableCell>
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
                          <Badge className={`${scoreBadgeClass(threatScore)} font-bold`}>
                            {threatScore}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {scoreLabel(threatScore)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {Math.round(confidence * 100)}% data confidence
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
                    <TableCell>
                      <PriceCell field={competitor.samplePrices?.gel} />
                    </TableCell>
                    <TableCell>
                      <PriceCell field={competitor.samplePrices?.pedicure} />
                    </TableCell>
                    <TableCell>
                      <PriceCell field={competitor.samplePrices?.acrylic} />
                    </TableCell>
                    <TableCell>
                      <ObservedCell field={competitor.staffBand} />
                    </TableCell>
                    <TableCell>
                      <ObservedCell field={competitor.hoursPerWeek} suffix="h" />
                    </TableCell>
                    <TableCell>
                      {amenityList.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {amenityList.map((amenity, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <ObservedCell field={competitor.amenities} />
                      )}
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

