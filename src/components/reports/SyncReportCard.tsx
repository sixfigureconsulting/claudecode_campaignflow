"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertCircle, Zap, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SyncTool = "instantly" | "smartlead" | "heyreach" | "lemlist";

interface ConnectedTool {
  key: SyncTool;
  label: string;
  logo: string;
  color: string;
}

const TOOL_META: Record<SyncTool, Omit<ConnectedTool, "key">> = {
  instantly:  { label: "Instantly",  logo: "instantly.ai",    color: "bg-blue-500 hover:bg-blue-600" },
  smartlead:  { label: "Smartlead",  logo: "smartlead.ai",    color: "bg-violet-500 hover:bg-violet-600" },
  heyreach:   { label: "HeyReach",   logo: "heyreach.io",     color: "bg-emerald-500 hover:bg-emerald-600" },
  lemlist:    { label: "Lemlist",    logo: "lemlist.com",     color: "bg-orange-500 hover:bg-orange-600" },
};

// Tools that support campaign-level picking (Instantly confirmed; others aggregate)
const PICKER_TOOLS: Set<SyncTool> = new Set(["instantly"]);

interface SyncReportCardProps {
  reportId: string;
  connectedTools: SyncTool[];
  lastSyncedAt?: string | null;
}

type SyncPhase = "idle" | "loadingCampaigns" | "picking" | "syncing" | "success" | "error";
interface ToolState {
  phase: SyncPhase;
  message: string;
  campaigns?: { id: string; name: string; status: number }[];
  selectedId?: string;
  selectedName?: string;
}

export function SyncReportCard({ reportId, connectedTools, lastSyncedAt }: SyncReportCardProps) {
  const router = useRouter();
  const [toolState, setToolState] = useState<Record<string, ToolState>>({});

  const setState = (tool: SyncTool, patch: Partial<ToolState>) =>
    setToolState((prev) => ({ ...prev, [tool]: { ...prev[tool], phase: "idle", message: "", ...patch } }));

  // Step 1: For Instantly, fetch campaign list first; for others, go straight to sync
  const handleSyncClick = async (tool: SyncTool) => {
    if (PICKER_TOOLS.has(tool)) {
      setState(tool, { phase: "loadingCampaigns", message: "" });
      try {
        const res = await fetch(`/api/reports/sync/campaigns?tool=${tool}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load campaigns");
        setState(tool, {
          phase: "picking",
          message: "",
          campaigns: json.campaigns,
          selectedId: undefined,
          selectedName: undefined,
        });
      } catch (err: any) {
        setState(tool, { phase: "error", message: err.message ?? "Failed to load campaigns" });
      }
    } else {
      await runSync(tool);
    }
  };

  // Step 2: Execute the actual sync
  const runSync = async (tool: SyncTool, campaignId?: string, campaignName?: string) => {
    setState(tool, { phase: "syncing", message: "", selectedId: campaignId, selectedName: campaignName });

    const res = await fetch("/api/reports/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, tool, campaignId, campaignName }),
    });
    const json = await res.json();

    if (res.ok) {
      const { inserted, skipped, source } = json;
      const msg = inserted > 0
        ? `Synced ${inserted} metric${inserted !== 1 ? "s" : ""} from ${source}${skipped > 0 ? ` (${skipped} already up to date)` : ""}`
        : `Already up to date from ${source}`;
      setState(tool, { phase: "success", message: msg });
      router.refresh();
    } else {
      setState(tool, { phase: "error", message: json.error ?? "Sync failed" });
    }
  };

  const syncAll = async () => {
    for (const tool of connectedTools) {
      await handleSyncClick(tool);
    }
  };

  if (connectedTools.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Sync from Outbound Tool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              No outbound tools connected.{" "}
              <a href="/settings" className="underline font-medium">Add an API key in Settings → Integrations</a>{" "}
              to enable auto-sync (Instantly, Smartlead, HeyReach, or Lemlist).
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const anyBusy = connectedTools.some((t) => {
    const p = toolState[t]?.phase;
    return p === "loadingCampaigns" || p === "syncing";
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Sync from Outbound Tool
          </CardTitle>
          {connectedTools.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              disabled={anyBusy}
              onClick={syncAll}
            >
              <RefreshCw className={cn("h-3 w-3", anyBusy && "animate-spin")} />
              Sync All
            </Button>
          )}
        </div>
        {lastSyncedAt && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            Last synced {new Date(lastSyncedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Pull live metrics directly from your outbound tools into this report.
        </p>

        {connectedTools.map((key) => {
          const meta = TOOL_META[key];
          const state = toolState[key];
          const phase = state?.phase ?? "idle";
          const isBusy = phase === "loadingCampaigns" || phase === "syncing";
          const isPicking = phase === "picking";

          return (
            <div key={key} className="space-y-2">
              {/* Main sync button */}
              {!isPicking && (
                <Button
                  className={cn("w-full text-white text-sm h-9 transition-colors gap-2", meta.color)}
                  disabled={isBusy}
                  onClick={() => {
                    if (phase === "success" || phase === "error") {
                      setState(key, { phase: "idle", message: "" });
                    } else {
                      handleSyncClick(key);
                    }
                  }}
                >
                  <img
                    src={`https://logo.clearbit.com/${meta.logo}`}
                    alt=""
                    className="w-4 h-4 rounded bg-white/20 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {phase === "loadingCampaigns" ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Loading campaigns…</>
                  ) : phase === "syncing" ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Syncing from {meta.label}…</>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sync from {meta.label}
                      {PICKER_TOOLS.has(key) && <ChevronDown className="h-3.5 w-3.5 ml-auto opacity-70" />}
                    </>
                  )}
                </Button>
              )}

              {/* Campaign picker (Instantly only) */}
              {isPicking && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Pick a campaign to sync from {meta.label}:
                  </p>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={state?.selectedId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      const name = state?.campaigns?.find((c) => c.id === id)?.name ?? "";
                      setState(key, { ...state, phase: "picking", selectedId: id, selectedName: name });
                    }}
                  >
                    <option value="">— Select a campaign —</option>
                    {(state?.campaigns ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.status === 2 ? " (paused)" : c.status === 3 ? " (stopped)" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className={cn("flex-1 text-white text-xs h-8 gap-1.5", meta.color)}
                      disabled={!state?.selectedId}
                      onClick={() => runSync(key, state?.selectedId, state?.selectedName)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Sync Selected Campaign
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => setState(key, { phase: "idle", message: "" })}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Status message */}
              {(phase === "success" || phase === "error") && state?.message && (
                <div className={cn(
                  "flex items-start gap-1.5 text-xs px-2 py-1.5 rounded",
                  phase === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                )}>
                  {phase === "success"
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  }
                  {state.message}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
