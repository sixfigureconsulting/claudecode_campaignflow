"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIRecommendationReport } from "./AIRecommendationReport";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import type { AIRecommendation, AIProvider } from "@/types";
import Link from "next/link";

interface AIRecommendationSectionProps {
  reportId: string;
  hasMetrics: boolean;
  isSubscribed: boolean;
  existingRecommendation: AIRecommendation | null;
}

export function AIRecommendationSection({
  reportId,
  hasMetrics,
  isSubscribed,
  existingRecommendation,
}: AIRecommendationSectionProps) {
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(
    existingRecommendation
  );
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, provider }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Generation failed");
        return;
      }

      setRecommendation(json.data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!hasMetrics) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Add metrics to this report before generating AI recommendations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-semibold">AI Recommendation Report</h2>
        </div>

        <div className="flex items-center gap-2">
          <Select value={provider} onValueChange={(v) => setProvider(v as AIProvider)}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI GPT-4o</SelectItem>
              <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={recommendation ? "outline" : "gradient"}
            size="sm"
            onClick={generate}
            loading={loading}
          >
            {recommendation ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          {error.includes("API key") && (
            <Link href="/settings" className="underline ml-1">
              Go to Settings
            </Link>
          )}
        </div>
      )}

      {recommendation && <AIRecommendationReport recommendation={recommendation} />}
    </div>
  );
}
