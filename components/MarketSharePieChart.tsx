"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { PieChartIcon } from "lucide-react";

interface Competitor {
  priceRange: string;
  name: string;
}

interface MarketSharePieChartProps {
  competitors: Competitor[];
}

const COLORS = {
  '$': '#2CA02C',      // Green - Budget
  '$$': '#E6863B',     // Orange - Mid-range
  '$$$': '#9467BD',    // Purple - Premium
  '$$$$': '#6B4C94',   // Dark Purple - Luxury
};

const LABELS = {
  '$': 'Budget ($)',
  '$$': 'Mid-Range ($$)',
  '$$$': 'Premium ($$$)',
  '$$$$': 'Luxury ($$$$)',
};

export function MarketSharePieChart({ competitors }: MarketSharePieChartProps) {
  // Count competitors by price range
  const priceRangeCounts: Record<string, number> = {};
  
  competitors.forEach((comp) => {
    const range = comp.priceRange || '$$';
    priceRangeCounts[range] = (priceRangeCounts[range] || 0) + 1;
  });

  // Prepare data for pie chart
  const data = Object.entries(priceRangeCounts).map(([range, count]) => ({
    name: LABELS[range as keyof typeof LABELS] || range,
    value: count,
    percentage: Math.round((count / competitors.length) * 100),
    color: COLORS[range as keyof typeof COLORS] || '#6b7280',
  }));

  // Sort by value descending
  data.sort((a, b) => b.value - a.value);

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percentage < 5) return null; // Don't show label for small slices

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="14"
        fontWeight="bold"
      >
        {`${percentage}%`}
      </text>
    );
  };

  return (
    <Card className="w-full rounded-2xl shadow-lg border-2">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <PieChartIcon className="h-5 w-5 text-gray-700" />
          Market Distribution
        </CardTitle>
        <p className="text-sm text-gray-600">Price segment breakdown in your competitive area</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={CustomLabel}
              outerRadius={90}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px'
              }}
              formatter={(value: any, name: any, props: any) => [
                `${value} salons (${props.payload.percentage}%)`,
                name
              ]}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Summary stats */}
        <div className="mt-4 pt-4 border-t border-gray-300">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-700">
              <span className="font-semibold text-gray-900">Total Competitors:</span> {competitors.length}
            </div>
            <div className="text-gray-700">
              <span className="font-semibold text-gray-900">Dominant Segment:</span> {data[0]?.name}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

