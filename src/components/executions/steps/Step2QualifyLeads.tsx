"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Sparkles, Users } from "lucide-react";
import type { CampaignLead } from "@/types/database";

const ICP_STORAGE_KEY = (projectId: string) => `cf_icp_${projectId}`;

export function Step2QualifyLeads({
  projectId,
  leads,
  hasOpenAIKey,
  onComplete,
}: {
  projectId: string;
  leads: CampaignLead[];
  hasOpenAIKey: boolean;
  onComplete: (leads: CampaignLead[]) => void;
}) {
  const [icpDescription, setIcpDescription] = useState<string>(() => {
    try { return localStorage.getItem(ICP_STORAGE_KEY(projectId)) ?? ""; } catch { return ""; }
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [qualifiedLeads, setQualifiedLeads] = useState<CampaignLead[]>([]);
  // Manual overrides: map email → qualified bool
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const saveICP = (val: string) => {
    setIcpDescription(val);
    try { localStorage.setItem(ICP_STORAGE_KEY(projectId), val); } catch {}
  };

  const handleQualify = async () => {
    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/executions/qualify-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, leads, icpDescription }),
    });
    const json = await res.json();

    if (!res.ok) {
      setMessage(json.error ?? "Qualification failed.");
      setStatus("error");
      return;
    }

    setQualifiedLeads(json.leads);
    setOverrides({});
    setStatus("done");
    setMessage(json.summary);
  };

  const handleSkip = () => {
    onComplete(leads.map((l) => ({ ...l, qualified: true, qualification_reason: "Skipped" })));
  };

  const toggle = (email: string, current: boolean) => {
    setOverrides((o) => ({ ...o, [email]: !current }));
  };

  const getQualified = (lead: CampaignLead): boolean => {
    if (lead.email in overrides) return overrides[lead.email];
    return lead.qualified ?? true;
  };

  const finalLeads =
    qualifiedLeads.length > 0
      ? qualifiedLeads.map((l) => ({ ...l, qualified: getQualified(l) }))
      : leads;

  const qualCount = finalLeads.filter((l) => l.qualified !== false).length;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          ICP Description
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">(saved per project)</span>
        </label>
        <Textarea
          placeholder={`Describe your ideal customer profile. e.g.:\n"B2B SaaS companies with 50-500 employees, Series A or B funded, VP of Sales or Revenue Operations titles, using Salesforce as their CRM, based in the US or UK."`}
          className="text-sm min-h-[120px] resize-y"
          value={icpDescription}
          onChange={(e) => saveICP(e.target.value)}
        />
      </div>

      {!hasOpenAIKey && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Add your OpenAI API key in the Integrations tab to use AI qualification.
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="gradient"
          className="flex-1"
          disabled={!icpDescription.trim() || !hasOpenAIKey || status === "loading"}
          loading={status === "loading"}
          onClick={handleQualify}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {status === "loading" ? "Qualifying..." : `Qualify ${leads.length} Leads`}
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
          Scoring leads against your ICP...
        </div>
      )}

      {/* Results */}
      {qualifiedLeads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Results
            </p>
            <p className="text-xs text-muted-foreground">{message}</p>
          </div>

          <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
            {qualifiedLeads.map((lead, i) => {
              const isQual = getQualified(lead);
              return (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5">
                  <button
                    onClick={() => toggle(lead.email, isQual)}
                    className="mt-0.5 shrink-0"
                    title="Click to override"
                  >
                    {isQual ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {lead.first_name} {lead.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">{lead.title} @ {lead.company}</span>
                      <Badge
                        variant={isQual ? "secondary" : "outline"}
                        className={`text-xs ml-auto ${isQual ? "text-green-700 bg-green-50 border-green-200" : ""}`}
                      >
                        {isQual ? "Fit" : "Not Fit"}
                      </Badge>
                    </div>
                    {lead.qualification_reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">{lead.qualification_reason}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            variant="gradient"
            className="w-full"
            onClick={() => onComplete(finalLeads.filter((l) => l.qualified !== false))}
          >
            Continue with {qualCount} qualified leads →
          </Button>
        </div>
      )}
    </div>
  );
}
