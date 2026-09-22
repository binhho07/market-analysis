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
    const { competitors, searchAddress } = body as {
      competitors: CompetitorExport[];
      searchAddress?: string;
    };

    if (!competitors || !Array.isArray(competitors)) {
      return errorResponse("Invalid competitors data", 400);
    }

    // Calculate summary stats
    const avgRating = (competitors.reduce((sum, c) => sum + (c.rating || 0), 0) / competitors.length).toFixed(1);
    const avgGelPrice = (competitors.reduce((sum, c) => sum + (c.samplePrices?.gel || 0), 0) / competitors.length).toFixed(2);
    const avgPedicurePrice = (competitors.reduce((sum, c) => sum + (c.samplePrices?.pedicure || 0), 0) / competitors.length).toFixed(2);
    const avgAcrylicPrice = (competitors.reduce((sum, c) => sum + (c.samplePrices?.acrylic || 0), 0) / competitors.length).toFixed(2);
    const topCompetitor = competitors.sort((a, b) => (b.competitiveScore || 0) - (a.competitiveScore || 0))[0];

    // Generate professional HTML report
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nail Spa Competitor Analysis Report</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      margin: 40px; 
      background: #f5f5f5;
      color: #333;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 3px solid #9467BD;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 { 
      color: #9467BD;
      margin: 0 0 10px 0;
      font-size: 32px;
    }
    .subtitle {
      color: #666;
      font-size: 16px;
    }
    .meta { 
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .meta-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
    }
    .meta-label {
      font-size: 12px;
      text-transform: uppercase;
      opacity: 0.9;
    }
    .meta-value {
      font-size: 24px;
      font-weight: bold;
      margin-top: 5px;
    }
    .summary {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 30px 0;
      border-left: 4px solid #E6863B;
    }
    .summary h2 {
      margin-top: 0;
      color: #E6863B;
      font-size: 20px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 12px; 
      text-align: left;
      font-size: 14px;
    }
    th { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.5px;
    }
    tr:nth-child(even) { 
      background-color: #f9f9f9; 
    }
    tr:hover {
      background-color: #f0f0f0;
    }
    .rating {
      color: #FFB800;
      font-weight: bold;
    }
    .threat-high {
      background: #ff4444;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
    }
    .threat-medium {
      background: #ffa500;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
    }
    .threat-low {
      background: #2CA02C;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
    }
    .footer { 
      margin-top: 50px; 
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
      color: #999; 
      font-size: 12px;
      text-align: center;
    }
    .print-btn {
      background: #9467BD;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      margin-bottom: 20px;
    }
    .print-btn:hover {
      background: #764ba2;
    }
  </style>
</head>
<body>
  <div class="container">
    <button onclick="window.print()" class="print-btn no-print">🖨️ Print to PDF</button>
    
    <div class="header">
      <h1>🏪 Nail Spa Competitor Analysis Report</h1>
      <div class="subtitle">Comprehensive Market Intelligence & Competitive Insights</div>
    </div>
    
    <div class="meta">
      <div class="meta-card">
        <div class="meta-label">Search Location</div>
        <div class="meta-value">${searchAddress || "N/A"}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Report Date</div>
        <div class="meta-value">${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Competitors Analyzed</div>
        <div class="meta-value">${competitors.length}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Average Rating</div>
        <div class="meta-value">${avgRating} ⭐</div>
      </div>
    </div>
    
    <div class="summary">
      <h2>📊 Market Summary</h2>
      <p><strong>Top Threat:</strong> ${topCompetitor?.name || "N/A"} (Threat Score: ${topCompetitor?.competitiveScore || "N/A"})</p>
      <p><strong>Average Pricing:</strong></p>
      <ul>
        <li>Gel Manicure: $${avgGelPrice}</li>
        <li>Pedicure: $${avgPedicurePrice}</li>
        <li>Acrylic Set: $${avgAcrylicPrice}</li>
      </ul>
    </div>
    
    <h2 style="margin-top: 40px; color: #333;">Detailed Competitor Analysis</h2>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Rating</th>
          <th>Reviews</th>
          <th>Price Range</th>
          <th>Gel ($)</th>
          <th>Pedicure ($)</th>
          <th>Acrylic ($)</th>
          <th>Distance (mi)</th>
          <th>Threat Level</th>
        </tr>
      </thead>
      <tbody>
        ${competitors
          .map(
            (c) => {
              const score = c.competitiveScore || 0;
              const threatClass = score >= 70 ? "threat-high" : score >= 40 ? "threat-medium" : "threat-low";
              const threatLabel = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
              return `
        <tr>
          <td><strong>${c.name}</strong><br><small style="color: #666;">${c.address}</small></td>
          <td class="rating">${c.rating || "N/A"} ⭐</td>
          <td>${c.reviewCount || 0}</td>
          <td>${c.priceRange || "N/A"}</td>
          <td>$${c.samplePrices?.gel || "N/A"}</td>
          <td>$${c.samplePrices?.pedicure || "N/A"}</td>
          <td>$${c.samplePrices?.acrylic || "N/A"}</td>
          <td>${c.distanceMiles?.toFixed(2) || "N/A"}</td>
          <td><span class="${threatClass}">${score} - ${threatLabel}</span></td>
        </tr>
      `;
            }
          )
          .join("")}
      </tbody>
    </table>
    
    <div class="footer">
      <p><strong>Generated by Nail Spa Atlas</strong> - Professional Competitor Analysis Tool</p>
      <p>For more insights and real-time market data, visit your dashboard</p>
      <p style="margin-top: 10px; font-size: 10px;">© ${new Date().getFullYear()} Nail Spa Atlas. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Return HTML (users can print to PDF from browser)
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="nail-spa-report-${Date.now()}.html"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return errorResponse(
      "Failed to export PDF",
      500,
      "INTERNAL_ERROR"
    );
  }
}



