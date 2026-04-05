"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function SendReportEmailButton({ reportId, hasMetrics }: { reportId: string; hasMetrics: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const send = async () => {
    if (!hasMetrics) return;
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch(`/api/reports/${reportId}/email`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMsg(json.error ?? "Failed to send email");
      } else {
        setStatus("done");
        setMsg(json.slackSent ? "Email + Slack sent!" : "Email sent to your inbox");
      }
    } catch {
      setStatus("error");
      setMsg("Network error. Please try again.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={send}
        disabled={status === "loading" || !hasMetrics || status === "done"}
        className="gap-2 w-fit"
      >
        {status === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : status === "done" ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Mail className="h-3.5 w-3.5" />
        )}
        {status === "done" ? "Sent!" : "Email Report"}
      </Button>
      {msg && (
        <p className={`text-xs flex items-center gap-1 ${status === "error" ? "text-red-600" : "text-green-600"}`}>
          {status === "error" && <AlertCircle className="h-3 w-3 shrink-0" />}
          {msg}
        </p>
      )}
      {!hasMetrics && (
        <p className="text-xs text-muted-foreground">Sync metrics first to enable email sending.</p>
      )}
    </div>
  );
}
