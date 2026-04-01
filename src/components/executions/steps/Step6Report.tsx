"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, AlertCircle, Loader2, BarChart2,
  RefreshCw, Upload, Bell, Calendar,
} from "lucide-react";

type ManualStats = {
  emails_sent: string;
  open_count: string;
  reply_count: string;
  bounce_count: string;
};

export function Step6Report({
  projectId,
  campaignRunId,
  leadsCount,
  hasInstantlyKey,
  hasSlackKey,
  onComplete,
}: {
  projectId: string;
  campaignRunId: string | null;
  leadsCount: number;
  hasInstantlyKey: boolean;
  hasSlackKey: boolean;
  onComplete: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"auto" | "manual">(hasInstantlyKey && campaignRunId ? "auto" : "manual");
  const [notify, setNotify] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [manual, setManual] = useState<ManualStats>({
    emails_sent: String(leadsCount),
    open_count: "",
    reply_count: "",
    bounce_count: "",
  });

  const canAutoGenerate = hasInstantlyKey && !!campaignRunId;

  const handleGenerate = async () => {
    if (!campaignRunId) {
      setMessage("No campaign run ID — push leads to Instantly first.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage("");

    const body: Record<string, unknown> = { campaignRunId, notify };

    if (mode === "manual") {
      body.manualStats = {
        emails_sent: parseInt(manual.emails_sent) || leadsCount,
        open_count: parseInt(manual.open_count) || 0,
        reply_count: parseInt(manual.reply_count) || 0,
        bounce_count: parseInt(manual.bounce_count) || 0,
      };
    }

    const res = await fetch("/api/executions/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();

    if (!res.ok) {
      setMessage(json.error ?? "Failed to generate report.");
      setStatus("error");
      return;
    }

    setReportId(json.reportId);
    setStatus("done");
    setMessage("Report created and saved to your Reports tab.");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* What this step does */}
      <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart2 className="h-4 w-4 text-brand-500" />
          What happens here
        </div>
        <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
          <li>Creates a report in your <strong>Reports</strong> tab with campaign metrics</li>
          <li>Automatically re-pulls stats from Instantly <strong>every week</strong></li>
          {hasSlackKey && <li>Posts a summary to your connected <strong>Slack channel</strong></li>}
          <li>Sends a <strong>weekly email</strong> with your campaign performance</li>
        </ul>
      </div>

      {/* Auto vs manual toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          disabled={!canAutoGenerate}
          className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            mode === "auto"
              ? "bg-brand-500 text-white"
              : "bg-muted/40 text-muted-foreground hover:bg-muted"
          }`}
          onClick={() => setMode("auto")}
        >
          <RefreshCw className="h-4 w-4" />
          Pull from Instantly
          {!canAutoGenerate && <span className="text-xs">(requires Instantly key)</span>}
        </button>
        <button
          className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            mode === "manual"
              ? "bg-brand-500 text-white"
              : "bg-muted/40 text-muted-foreground hover:bg-muted"
          }`}
          onClick={() => setMode("manual")}
        >
          <Upload className="h-4 w-4" />
          Enter manually
        </button>
      </div>

      {/* Manual stats form */}
      {mode === "manual" && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "emails_sent", label: "Emails Sent" },
            { key: "open_count", label: "Emails Opened" },
            { key: "reply_count", label: "Replies" },
            { key: "bounce_count", label: "Bounces" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={manual[key as keyof ManualStats]}
                onChange={(e) =>
                  setManual((m) => ({ ...m, [key]: e.target.value }))
                }
                className="text-sm h-9"
              />
            </div>
          ))}
        </div>
      )}

      {/* Notify toggle */}
      <button
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
          notify ? "border-brand-400 bg-brand-50" : "border-border bg-muted/20"
        }`}
        onClick={() => setNotify((n) => !n)}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          notify ? "border-brand-500 bg-brand-500" : "border-muted-foreground"
        }`}>
          {notify && (
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">Send email + Slack notification</span>
            {hasSlackKey && <Badge variant="secondary" className="text-xs">Slack connected</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Email the report summary and post to Slack when generated
          </p>
        </div>
      </button>

      {/* Weekly auto-pull info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
        <Calendar className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>Weekly auto-reports enabled.</strong> CampaignFlow will automatically pull your
          Instantly campaign stats every Monday and create a new report — no action needed from you.
          {notify && " You'll receive an email + Slack notification each time."}
        </div>
      </div>

      {/* Status */}
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {mode === "auto" ? "Pulling stats from Instantly..." : "Creating report..."}
        </div>
      )}
      {status === "done" && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </div>
          {reportId && (
            <button
              onClick={() => router.push(`/clients`)}
              className="text-xs underline underline-offset-2 text-green-700 hover:text-green-800"
            >
              View in Reports tab →
            </button>
          )}
        </div>
      )}
      {status === "error" && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {message}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="gradient"
          className="flex-1"
          disabled={status === "loading" || !campaignRunId}
          loading={status === "loading"}
          onClick={handleGenerate}
        >
          <BarChart2 className="h-4 w-4 mr-2" />
          {status === "loading" ? "Generating..." : "Generate Report"}
        </Button>
        {status === "done" && (
          <Button variant="outline" onClick={onComplete}>
            Start new campaign
          </Button>
        )}
        {status !== "done" && (
          <Button variant="ghost" onClick={onComplete}>
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}
