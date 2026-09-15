import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Get all search history with snapshots
    const history = await prisma.searchHistory.findMany({
      include: {
        snapshots: true,
      },
      orderBy: {
        searchDate: "desc",
      },
    });

    if (history.length === 0) {
      return new NextResponse("No historical data available", { status: 404 });
    }

    // Build CSV content
    let csv = "Search History Export\n\n";
    
    // Search-level summary
    csv += "SEARCH SUMMARY\n";
    csv += "Date,Location,Latitude,Longitude,Radius (mi),Competitors Found,Avg Rating,Avg Gel Price,Avg Pedicure Price,Avg Acrylic Price\n";
    
    history.forEach((search) => {
      const date = new Date(search.searchDate).toLocaleString();
      csv += `"${date}","${search.searchAddress}",${search.latitude},${search.longitude},${search.radiusMiles},${search.competitorCount},${search.avgRating || "N/A"},${search.avgGelPrice || "N/A"},${search.avgPedicurePrice || "N/A"},${search.avgAcrylicPrice || "N/A"}\n`;
    });

    // Detailed competitor snapshots
    csv += "\n\nDETAILED COMPETITOR SNAPSHOTS\n";
    csv += "Search Date,Search Location,Competitor Name,Address,Place ID,Rating,Review Count,Price Range,Gel Price,Pedicure Price,Acrylic Price,Distance (mi),Competitive Score\n";
    
    history.forEach((search) => {
      const searchDate = new Date(search.searchDate).toLocaleString();
      search.snapshots.forEach((snapshot) => {
        const name = (snapshot.name || "").replace(/"/g, '""'); // Escape quotes
        const address = (snapshot.address || "").replace(/"/g, '""');
        csv += `"${searchDate}","${search.searchAddress}","${name}","${address}",${snapshot.placeId},${snapshot.rating || "N/A"},${snapshot.reviewCount || 0},"${snapshot.priceRange || "N/A"}",${snapshot.gelPrice || "N/A"},${snapshot.pedicurePrice || "N/A"},${snapshot.acrylicPrice || "N/A"},${snapshot.distanceMiles || "N/A"},${snapshot.competitiveScore || "N/A"}\n`;
      });
    });

    // Add summary statistics
    csv += "\n\nSUMMARY STATISTICS\n";
    csv += `Total Searches,${history.length}\n`;
    csv += `Total Competitor Snapshots,${history.reduce((sum, h) => sum + h.snapshots.length, 0)}\n`;
    csv += `Date Range,"${new Date(history[history.length - 1].searchDate).toLocaleDateString()} to ${new Date(history[0].searchDate).toLocaleDateString()}"\n`;
    
    // Unique locations
    const uniqueLocations = [...new Set(history.map(h => h.searchAddress))];
    csv += `Unique Locations Analyzed,${uniqueLocations.length}\n`;
    csv += `Locations,"${uniqueLocations.join(", ")}"\n`;

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="spa-atlas-history-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting historical data:", error);
    return new NextResponse("Failed to export historical data", { status: 500 });
  }
}

