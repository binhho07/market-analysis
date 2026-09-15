"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BarChart3, MapPin, TrendingUp, Users, Target, Zap, Clock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const stats = [
    { label: "Competitor Analyses", value: "10,000+", delay: 0.1 },
    { label: "Cities Covered", value: "500+", delay: 0.2 },
    { label: "Data Points Analyzed", value: "2M+", delay: 0.3 },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gray-900 p-2 rounded-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              SpaAtlas
            </h1>
          </div>
          <Link href="/analyze">
            <Button size="lg" className="bg-gray-900 hover:bg-gray-800 text-white">
              Start Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section - Dark */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-5xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-block mb-6 px-4 py-2 bg-gray-800 rounded-full border border-gray-700"
            >
              <span className="text-sm font-medium text-gray-300">🚀 Competitive Intelligence for Nail Salons</span>
            </motion.div>
            
            <h2 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Know Your Competition.
              <br />
              <span className="text-gray-400">Dominate Your Market.</span>
            </h2>
            
            <p className="text-xl md:text-2xl text-gray-400 mb-12 leading-relaxed max-w-3xl mx-auto">
              Real-time competitive analysis powered by Google Maps. 
              Compare pricing, ratings, and market positioning in seconds.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/analyze">
                <Button size="lg" className="text-lg px-8 py-6 bg-white text-gray-900 hover:bg-gray-100">
                  Start Free Analysis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-6 border-gray-600 text-white hover:bg-gray-800"
                onClick={() => {
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View Demo
              </Button>
            </div>

            {/* Animated Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: stat.delay }}
                  className="text-center"
                >
                  <div className="text-4xl md:text-5xl font-bold mb-2">{stat.value}</div>
                  <div className="text-gray-400 text-sm uppercase tracking-wide">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container mx-auto px-4 py-20 bg-gray-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-6xl mx-auto"
        >
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">How It Works</h3>
            <p className="text-xl text-gray-600">Get competitive insights in 3 simple steps</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center"
            >
              <div className="bg-gray-900 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                1
              </div>
              <h4 className="text-2xl font-bold mb-3 text-gray-900">Enter Your Location</h4>
              <p className="text-gray-600 leading-relaxed">
                Simply enter your salon's address or any target location. Set your search radius from 1-50 miles.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-center"
            >
              <div className="bg-gray-900 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                2
              </div>
              <h4 className="text-2xl font-bold mb-3 text-gray-900">AI Analyzes Competitors</h4>
              <p className="text-gray-600 leading-relaxed">
                Our system pulls real-time data from Google Maps: pricing, ratings, reviews, and market positioning.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-center"
            >
              <div className="bg-gray-900 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                3
              </div>
              <h4 className="text-2xl font-bold mb-3 text-gray-900">Get Actionable Insights</h4>
              <p className="text-gray-600 leading-relaxed">
                View interactive charts, heat maps, and AI-powered recommendations to outperform your competition.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Powerful Features</h3>
            <p className="text-xl text-gray-600">Everything you need to stay ahead of the competition</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-2 border-gray-200 hover:border-gray-900 transition-all hover:shadow-lg">
              <CardContent className="p-6">
                <div className="bg-gray-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Target className="h-6 w-6 text-gray-900" />
                </div>
                <h4 className="text-lg font-bold mb-2 text-gray-900">Competitive Score</h4>
                <p className="text-gray-600 text-sm">
                  Smart algorithm ranks competitors by quality, popularity, and proximity
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-gray-200 hover:border-gray-900 transition-all hover:shadow-lg">
              <CardContent className="p-6">
                <div className="bg-gray-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-gray-900" />
                </div>
                <h4 className="text-lg font-bold mb-2 text-gray-900">Historical Tracking</h4>
                <p className="text-gray-600 text-sm">
                  Track market trends over time with longitudinal data analysis
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-gray-200 hover:border-gray-900 transition-all hover:shadow-lg">
              <CardContent className="p-6">
                <div className="bg-gray-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <MapPin className="h-6 w-6 text-gray-900" />
                </div>
                <h4 className="text-lg font-bold mb-2 text-gray-900">Heat Map View</h4>
                <p className="text-gray-600 text-sm">
                  Visualize competitor density and quality across your target area
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-gray-200 hover:border-gray-900 transition-all hover:shadow-lg">
              <CardContent className="p-6">
                <div className="bg-gray-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-gray-900" />
                </div>
                <h4 className="text-lg font-bold mb-2 text-gray-900">AI-Powered Insights</h4>
                <p className="text-gray-600 text-sm">
                  Research-driven recommendations backed by competitive data
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 text-white py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h3 className="text-4xl md:text-5xl font-bold mb-6">Ready to Dominate Your Market?</h3>
            <p className="text-xl text-gray-400 mb-10 leading-relaxed">
              Join thousands of nail salon owners using SpaAtlas to stay ahead of the competition.
              Get your first competitive analysis in under 2 minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/analyze">
                <Button size="lg" className="text-lg px-10 py-6 bg-white text-gray-900 hover:bg-gray-100">
                  Start Free Analysis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            <p className="text-sm text-gray-500 mt-6">No credit card required • Real-time data • Instant results</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="bg-gray-900 p-2 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">SpaAtlas</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-600 text-sm mb-1">© 2025 SpaAtlas. All rights reserved.</p>
              <p className="text-gray-500 text-xs">Powered by Google Maps Platform & Next.js 15</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}