"use client";

import { useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  Download,
  Target,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  BarChart2,
  FileCheck2,
} from "lucide-react";
import type { AIRecommendation } from "@/types";

interface AIRecommendationReportProps {
  recommendation: AIRecommendation;
}

export function AIRecommendationReport({ recommendation }: AIRecommendationReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;

    if (!reportRef.current) return;

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let yPosition = 0;
    while (yPosition < imgHeight) {
      pdf.addImage(imgData, "PNG", 0, -yPosition, imgWidth, imgHeight);
      yPosition += pageHeight;
      if (yPosition < imgHeight) {
        pdf.addPage();
      }
    }

    pdf.save(`ai-recommendation-${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="capitalize">
            {recommendation.provider}
          </Badge>
          {recommendation.model_used && (
            <span>{recommendation.model_used}</span>
          )}
          <span>·</span>
          <span>{formatDate(recommendation.generated_at)}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </Button>
      </div>

      <div ref={reportRef} className="space-y-4 bg-background p-1">
        {/* Executive Summary */}
        {recommendation.executive_summary && (
          <Card className="border-brand-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-brand-700">
                <FileCheck2 className="h-4 w-4" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{recommendation.executive_summary}</p>
            </CardContent>
          </Card>
        )}

        {/* KPI Analysis */}
        {recommendation.kpi_analysis && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-600" />
                KPI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{recommendation.kpi_analysis}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Weakest Metric */}
          {recommendation.weakest_metric && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="h-4 w-4" />
                  Weakest Metric
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-orange-800">
                  {recommendation.weakest_metric}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Bottleneck */}
          {recommendation.bottleneck_explanation && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                  <Target className="h-4 w-4" />
                  Primary Bottleneck
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">
                  {recommendation.bottleneck_explanation}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Steps */}
        {recommendation.action_steps && recommendation.action_steps.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                5 Tactical Action Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {recommendation.action_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Strategic Improvements */}
        {recommendation.strategic_improvements &&
          recommendation.strategic_improvements.length > 0 && (
            <Card className="border-purple-200 bg-purple-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
                  <Lightbulb className="h-4 w-4" />
                  3 Strategic Improvements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {recommendation.strategic_improvements.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed pt-0.5">{item}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
}
