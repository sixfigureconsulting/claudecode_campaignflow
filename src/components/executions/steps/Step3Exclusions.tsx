"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Shield, Users } from "lucide-react";
import type { CampaignLead } from "@/types/database";

export function Step3Exclusions({
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
  onComplete: (leads: CampaignLead[]) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [checkedLeads, setCheckedLeads] = useState<CampaignLead[]>([]);
  const [sourcesChecked, setSourcesChecked] = useState<string[]>([]);
  // Manual re-include overrides: email → true means re-included
  const [reIncluded, setReIncluded] = useState<Set<string>>(new Set());

  const noSourcesConfigured = !hasInstantlyKey && !hasHubSpotKey;

  const handleCheck = async () => {
    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/executions/check-exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, leads }),
    });
    const json = await res.json();

    if (!res.ok) {
      setMessage(json.error ?? "Exclusion check failed.");
      setStatus("error");
      return;
    }

    setCheckedLeads(json.leads);
    setSourcesChecked(json.sources_checked ?? []);
    setReIncluded(new Set());
    setStatus("done");
    setMessage(json.summary);
  };

  const handleSkip = () => onComplete(leads);

  const toggleReInclude = (email: string) => {
    setReIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const isExcluded = (lead: CampaignLead) =>
    lead.excluded && !reIncluded.has(lead.email);

  const keptCount = checkedLeads.length > 0
    ? checkedLeads.filter((l) => !isExcluded(l)).length
    : leads.length;

  return (
    <div className="space-y-5">
      {/* Integration status */}
      <div className="flex gap-2 flex-wrap">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${
          hasInstantlyKey ? "border-purple-200 bg-purple-50 text-purple-700" : "border-dashed text-muted-foreground"
        }`}>
          {hasInstantlyKey ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          Instantly {hasInstantlyKey ? "connected" : "not configured"}
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${
          hasHubSpotKey ? "border-orange-200 bg-orange-50 text-orange-700" : "border-dashed text-muted-foreground"
        }`}>
          {hasHubSpotKey ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          HubSpot {hasHubSpotKey ? "connected" : "not configured"}
        </div>
      </div>

      {noSourcesConfigured && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          No exclusion sources configured. Connect Instantly or HubSpot in the Integrations tab, or skip this step.
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="gradient"
          className="flex-1"
          disabled={noSourcesConfigured || status === "loading"}
          loading={status === "loading"}
          onClick={handleCheck}
        >
          <Shield className="h-4 w-4 mr-2" />
          {status === "loading" ? "Checking..." : `Check ${leads.length} leads for duplicates`}
        </Button>
        <Button variant="outline" onClick={handleSkip}>
          Skip
        </Button>
      </div>

      {status === "error" && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {message}
        </div>
      )}
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking against {[hasInstantlyKey && "Instantly", hasHubSpotKey && "HubSpot"].filter(Boolean).join(" & ")}...
        </div>
      )}

      {/* Results */}
      {checkedLeads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Results
            </p>
            <p className="text-xs text-muted-foreground">{message}</p>
          </div>

          <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
            {checkedLeads.map((lead, i) => {
              const excluded = isExcluded(lead);
              return (
                <div key={i} className={`flex items-start gap-3 px-3 py-2.5 ${excluded ? "opacity-50" : ""}`}>
                  <div className="mt-0.5 shrink-0">
                    {excluded ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {lead.first_name} {lead.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">{lead.company}</span>
                      {excluded && lead.exclusion_source && (
                        <Badge variant="outline" className="text-xs text-red-500 border-red-200 ml-auto">
                          {lead.exclusion_reason}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                  </div>
                  {lead.excluded && (
                    <button
                      onClick={() => toggleReInclude(lead.email)}
                      className="text-xs text-muted-foreground hover:text-foreground shrink-0 mt-0.5 underline underline-offset-2"
                    >
                      {reIncluded.has(lead.email) ? "Exclude" : "Re-include"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            variant="gradient"
            className="w-full"
            onClick={() => onComplete(checkedLeads.filter((l) => !isExcluded(l)))}
          >
            Continue with {keptCount} leads →
          </Button>
        </div>
      )}
    </div>
  );
}
