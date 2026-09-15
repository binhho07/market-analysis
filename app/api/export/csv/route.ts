import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api-response";

interface CompetitorExport {
  name: string;
  rating: number;
  reviewCount: number;
  priceRange: string;
  samplePrices: {
    gel: number;
    pedicure: number;
    acrylic: number;
  };
  distanceMiles: number;
  address: string;
  website?: string;
  competitiveScore?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { competitors } = body as { competitors: CompetitorExport[] };

    if (!competitors || !Array.isArray(competitors)) {
      return errorResponse("Invalid competitors data", 400);
    }

    // Generate CSV with comprehensive data
    const headers = [
      "Name",
      "Rating",
      "Reviews",
      "Price Range",
      "Gel Manicure ($)",
      "Pedicure ($)",
      "Acrylic ($)",
      "Distance (mi)",
      "Threat Score",
      "Address",
      "Website",
    ];

    const rows = competitors.map((c) => [
      c.name,
      c.rating || "N/A",
      c.reviewCount || 0,
      c.priceRange || "N/A",
      c.samplePrices?.gel || "N/A",
      c.samplePrices?.pedicure || "N/A",
      c.samplePrices?.acrylic || "N/A",
      c.distanceMiles?.toFixed(2) || "N/A",
      c.competitiveScore || "N/A",
      c.address || "N/A",
      c.website || "N/A",
    ]);

    // Properly escape CSV fields
    const escapeCsvField = (field: any): string => {
      const str = String(field);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCsvField).join(",")),
    ].join("\n");

    // Return CSV as downloadable file
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nail-spa-competitors-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return errorResponse(
      "Failed to export CSV",
      500,
      "INTERNAL_ERROR"
    );
  }
}



