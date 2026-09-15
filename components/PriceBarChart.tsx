"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

interface Competitor {
  name: string;
  samplePrices: {
    gel: number;
    pedicure: number;
    acrylic: number;
  };
}

interface PriceBarChartProps {
  competitors: Competitor[];
}

export function PriceBarChart({ competitors }: PriceBarChartProps) {
  const data = competitors.map(comp => ({
    name: comp.name.split(' ').slice(0, 2).join(' '), // Shortened name
    gel: comp.samplePrices.gel,
    pedicure: comp.samplePrices.pedicure,
    acrylic: comp.samplePrices.acrylic
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="w-full rounded-2xl shadow-lg border-2">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">Service Pricing Comparison</CardTitle>
          <CardDescription className="text-gray-600">
            Compare prices for key services across all competitors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                formatter={(value) => `$${value}`}
                contentStyle={{ borderRadius: '8px' }}
              />
              <Legend />
              <Bar dataKey="gel" fill="#E6863B" name="Gel Manicure" radius={[8, 8, 0, 0]} />
              <Bar dataKey="pedicure" fill="#2CA02C" name="Pedicure" radius={[8, 8, 0, 0]} />
              <Bar dataKey="acrylic" fill="#9467BD" name="Acrylic" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}

