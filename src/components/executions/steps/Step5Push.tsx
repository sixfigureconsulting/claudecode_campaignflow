"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Download, Send } from "lucide-react";
import type { CampaignLead } from "@/types/database";

function leadsToCSV(leads: CampaignLead[]): string {
  const headers = [
    "first_name", "last_name", "email", "company", "title",
    "linkedin_url", "website", "phone",
    "linkedin_step1", "linkedin_step2",
    "email_subject1", "email_body1", "email_subject2", "email_body2",
  ];

  const escape = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return s.includes(",") || s.includes("\n") ? `"${s}"` : s;
  };

  const rows = leads.map((l) =>
    [
      l.first_name, l.last_name, l.email, l.company, l.title,
      l.linkedin_url ?? "", l.website ?? "", l.phone ?? "",
      l.sequence?.linkedin_step1 ?? "",
      l.sequence?.linkedin_step2 ?? "",
      l.sequence?.email_subject1 ?? "",
      l.sequence?.email_body1 ?? "",
      l.sequence?.email_subject2 ?? "",
      l.sequence?.email_body2 ?? "",
    ].map(escape).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export function Step5Push({
  projectId,
  leads,
  hasInstantlyKey,
  hasHubSpotKey,
  onComplete,
}: {
  projectId: string;
  leads: CampaignLead[];
  hasInstantlyKey: boolean;
  hasHubSpotKey: boolean;
  onComplete: (campaignRunId: string | null) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(["csv"]));
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [results, setResults] = useState<Record<string, { success: boolean; count: number; message: string }>>({});
  const [campaignRunId, setCampaignRunId] = useState<string | null>(null);

  const toggle = (dest: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dest)) next.delete(dest);
      else next.add(dest);
      return next;
    });
  };

  const handlePush = async () => {
    setStatus("loading");

    const destinations = Array.from(selected);
    const res = await fetch("/api/executions/push-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, leads, destinations }),
    });
    const json = await res.json();

    if (!res.ok) {
      setStatus("error");
      return;
    }

    setResults(json.results ?? {});
    setCampaignRunId(json.campaignRunId ?? null);
    setStatus("done");

    // Trigger CSV download if selected
    if (selected.has("csv")) {
      const csv = leadsToCSV(leads);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    router.refresh();
  };

  const destinations = [
    {
      id: "instantly",
      label: "Instantly.ai",
      description: "Add leads to an Instantly campaign with email sequences",
      available: hasInstantlyKey,
      unavailableMsg: "Add Instantly key in Integrations",
      color: "purple",
    },
    {
      id: "hubspot",
      label: "HubSpot CRM",
      description: "Upsert leads as contacts in HubSpot",
      available: hasHubSpotKey,
      unavailableMsg: "Add HubSpot key in Integrations",
      color: "orange",
    },
    {
      id: "csv",
      label: "Download CSV",
      description: "Export all leads + sequences as a CSV file",
      available: true,
      unavailableMsg: "",
      color: "green",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {destinations.map((dest) => {
          const isSelected = selected.has(dest.id);
          const isAvailable = dest.available;

          return (
            <button
              key={dest.id}
              disabled={!isAvailable}
              onClick={() => isAvailable && toggle(dest.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                !isAvailable
                  ? "opacity-50 cursor-not-allowed border-border bg-muted/20"
                  : isSelected
                  ? "border-brand-400 bg-brand-50"
                  : "border-border hover:border-muted-foreground bg-muted/20"
              }`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                isSelected && isAvailable ? "border-brand-500 bg-brand-500" : "border-muted-foreground"
              }`}>
                {isSelected && isAvailable && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{dest.label}</span>
                  {!isAvailable && (
                    <span className="text-xs text-amber-600">{dest.unavailableMsg}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{dest.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {status !== "done" && (
        <Button
          variant="gradient"
          className="w-full"
          disabled={selected.size === 0 || status === "loading"}
          loading={status === "loading"}
          onClick={handlePush}
        >
          <Send className="h-4 w-4 mr-2" />
          {status === "loading"
            ? "Pushing leads..."
            : `Push ${leads.length} leads to ${selected.size} destination${selected.size !== 1 ? "s" : ""}`}
        </Button>
      )}

      {/* Push results */}
      {status === "done" && Object.keys(results).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Results</p>
          <div className="space-y-2">
            {Object.entries(results).map(([dest, r]) => (
              <div
                key={dest}
                className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                  r.success
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-red-50 border-red-200 text-red-600"
                }`}
              >
                {r.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <div>
                  <span className="font-medium capitalize">{dest}</span>
                  {" — "}
                  {r.message}
                </div>
              </div>
            ))}
          </div>

          <Button variant="gradient" className="w-full" onClick={() => onComplete(campaignRunId)}>
            Continue to Report →
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Push failed. Check your integration keys and try again.
        </div>
      )}
    </div>
  );
}
