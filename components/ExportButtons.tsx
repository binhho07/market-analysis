"use client";

import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

interface ExportButtonsProps {
  onExport?: (format: "csv" | "pdf") => void;
}

export function ExportButtons({ onExport }: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExportCSV = async () => {
    if (onExport) {
      setIsExporting("csv");
      try {
        await onExport("csv");
      } finally {
        setIsExporting(null);
      }
    }
  };

  const handleExportPDF = async () => {
    if (onExport) {
      setIsExporting("pdf");
      try {
        await onExport("pdf");
      } finally {
        setIsExporting(null);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="flex flex-wrap gap-4 justify-center md:justify-start"
    >
      <Button 
        onClick={handleExportCSV} 
        variant="outline" 
        size="lg"
        disabled={isExporting !== null}
        className="transition-all hover:bg-green-50 hover:border-[#2CA02C] hover:text-[#2CA02C]"
      >
        <Download className="mr-2 h-4 w-4" />
        {isExporting === "csv" ? "Exporting..." : "Export CSV"}
      </Button>
      <Button 
        onClick={handleExportPDF} 
        variant="outline" 
        size="lg"
        disabled={isExporting !== null}
        className="transition-all hover:bg-orange-50 hover:border-[#E6863B] hover:text-[#E6863B]"
      >
        <FileText className="mr-2 h-4 w-4" />
        {isExporting === "pdf" ? "Exporting..." : "Export PDF"}
      </Button>
    </motion.div>
  );
}

