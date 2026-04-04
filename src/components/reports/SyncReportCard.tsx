"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncReportCardProps {
  reportId: string;
  hasInstantly: boolean;
  hasSmartlead: boolean;
}

type SyncState = "idle" | "loading" | "success" | "error";

interface ToolResult {
  state: SyncState;
  message: string;
}

export function SyncReportCard({ reportId, hasInstantly, hasSmartlead }: SyncReportCardProps) {
  const router = useRouter();
  const [results, setResults] = useState<Record<string, ToolResult>>({});

  const sync = async (tool: "instantly" | "smartlead") => {
    setResults((r) => ({ ...r, [tool]: { state: "loading", message: "" } }));

    const res = await fetch("/api/reports/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, tool }),
    });

    const json = await res.json();

    if (res.ok) {
      const { inserted, skipped, source } = json;
      const msg = inserted > 0
        ? `Synced ${inserted} metric${inserted !== 1 ? "s" : ""} from ${source}${skipped > 0 ? ` (${skipped} already existed)` : ""}`
        : `All metrics already synced from ${source}`;
      setResults((r) => ({ ...r, [tool]: { state: "success", message: msg } }));
      router.refresh();
    } else {
      setResults((r) => ({ ...r, [tool]: { state: "error", message: json.error ?? "Sync failed" } }));
    }
  };

  const tools: Array<{ key: "instantly" | "smartlead"; label: string; color: string; has: boolean }> = [
    { key: "instantly", label: "Instantly Sync", color: "bg-blue-500 hover:bg-blue-600", has: hasInstantly },
    { key: "smartlead", label: "Smartlead Sync", color: "bg-violet-500 hover:bg-violet-600", has: hasSmartlead },
  ];

  const anyConnected = hasInstantly || hasSmartlead;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Sync Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Pull live campaign metrics directly from your email tool into this report.
        </p>

        {!anyConnected && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            No email tools connected. Add your Instantly or Smartlead API key in{" "}
            <a href="/settings" className="underline font-medium">Settings → Integrations</a>.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {tools.map(({ key, label, color, has }) => {
            const result = results[key];
            return (
              <div key={key} className="space-y-1.5">
                <Button
                  className={cn("w-full text-white text-sm h-9 transition-colors", color)}
                  disabled={!has || result?.state === "loading"}
                  onClick={() => sync(key)}
                >
                  {result?.state === "loading" ? (
                    <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  )}
                  {result?.state === "loading" ? "Syncing..." : label}
                  {!has && <span className="ml-2 opacity-60 text-xs">(not connected)</span>}
                </Button>

                {result && result.state !== "loading" && result.message && (
                  <div className={cn(
                    "flex items-start gap-1.5 text-xs px-2 py-1.5 rounded",
                    result.state === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-600 border border-red-200"
                  )}>
                    {result.state === "success"
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    }
                    {result.message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
