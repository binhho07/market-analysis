"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface Competitor {
  name: string;
  samplePrices: {
    gel: number;
    pedicure: number;
    acrylic: number;
  };
  distanceMiles: number;
}

interface PriceTrendLineChartProps {
  competitors: Competitor[];
}

export function PriceTrendLineChart({ competitors }: PriceTrendLineChartProps) {
  // Sort by distance and prepare data
  const sortedCompetitors = [...competitors].sort((a, b) => a.distanceMiles - b.distanceMiles);
  
  const data = sortedCompetitors.map((comp) => ({
    name: comp.name.split(' ').slice(0, 2).join(' '), // Shortened name
    distance: `${comp.distanceMiles}mi`,
    Gel: comp.samplePrices.gel,
    Pedicure: comp.samplePrices.pedicure,
    Acrylic: comp.samplePrices.acrylic,
  }));

  return (
    <Card className="w-full rounded-2xl shadow-lg border-2">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <TrendingUp className="h-5 w-5 text-gray-700" />
          Price Trends by Distance
        </CardTitle>
        <p className="text-sm text-gray-600">How prices change as you go further from your location</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              angle={-15}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px'
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="line"
            />
            <Line 
              type="monotone" 
              dataKey="Gel" 
              stroke="#E6863B" 
              strokeWidth={2.5}
              dot={{ fill: '#E6863B', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="Pedicure" 
              stroke="#2CA02C" 
              strokeWidth={2.5}
              dot={{ fill: '#2CA02C', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="Acrylic" 
              stroke="#9467BD" 
              strokeWidth={2.5}
              dot={{ fill: '#9467BD', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

