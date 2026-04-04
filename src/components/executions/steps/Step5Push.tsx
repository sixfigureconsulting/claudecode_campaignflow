"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Send, Phone, Zap, Mail, Globe } from "lucide-react";
import type { CampaignLead } from "@/types/database";
import { cn } from "@/lib/utils";

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
      l.sequence?.linkedin_step1 ?? "", l.sequence?.linkedin_step2 ?? "",
      l.sequence?.email_subject1 ?? "", l.sequence?.email_body1 ?? "",
      l.sequence?.email_subject2 ?? "", l.sequence?.email_body2 ?? "",
    ].map(escape).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

type DestResult = { success: boolean; count: number; message: string };

// Webhook-based automation tool IDs
const WEBHOOK_DEST_IDS = ["n8n", "make", "zapier", "clay", "http"];

export function Step5Push({
  projectId,
  leads,
  hasInstantlyKey,
  hasHubSpotKey,
  hasHeyreachKey,
  hasSmartleadKey,
  hasLemlistKey,
  connectedCallingServices,
  onComplete,
}: {
  projectId: string;
  leads: CampaignLead[];
  hasInstantlyKey: boolean;
  hasHubSpotKey: boolean;
  hasHeyreachKey?: boolean;
  hasSmartleadKey?: boolean;
  hasLemlistKey?: boolean;
  connectedCallingServices?: string[];
  onComplete: (campaignRunId: string | null) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(["csv"]));
  const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [results, setResults] = useState<Record<string, DestResult>>({});
  const [campaignRunId, setCampaignRunId] = useState<string | null>(null);

  const connected = connectedCallingServices ?? [];
  const leadsWithPhone = leads.filter((l) => l.phone?.trim()).length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePush = async () => {
    setStatus("loading");

    // Collect webhook URLs for selected automation tools
    const resolvedWebhookUrls: Record<string, string> = {};
    for (const id of WEBHOOK_DEST_IDS) {
      if (selected.has(id) && webhookUrls[id]?.trim()) {
        resolvedWebhookUrls[id] = webhookUrls[id].trim();
      }
    }

    const res = await fetch("/api/executions/push-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        leads,
        destinations: Array.from(selected),
        webhookUrls: resolvedWebhookUrls,
      }),
    });
    const json = await res.json();

    if (!res.ok) { setStatus("error"); return; }

    setResults(json.results ?? {});
    setCampaignRunId(json.campaignRunId ?? null);
    setStatus("done");

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

  // ── Checkbox row ────────────────────────────────────────────────────────────
  const DestRow = ({
    id, label, description, available, unavailableMsg,
  }: { id: string; label: string; description: string; available: boolean; unavailableMsg?: string }) => {
    const isSelected = selected.has(id);
    return (
      <button
        disabled={!available}
        onClick={() => available && toggle(id)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors",
          !available
            ? "opacity-50 cursor-not-allowed border-border bg-muted/20"
            : isSelected ? "border-brand-400 bg-brand-50" : "border-border hover:border-muted-foreground bg-muted/20"
        )}
      >
        <div className={cn(
          "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
          isSelected && available ? "border-brand-500 bg-brand-500" : "border-muted-foreground"
        )}>
          {isSelected && available && (
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{label}</span>
            {!available && unavailableMsg && (
              <span className="text-xs text-amber-600">{unavailableMsg}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </button>
    );
  };

  // ── Webhook row (has URL input when selected) ────────────────────────────
  const WebhookRow = ({
    id, label, description, placeholder,
  }: { id: string; label: string; description: string; placeholder: string }) => {
    const isSelected = selected.has(id);
    return (
      <div className={cn(
        "rounded-lg border transition-colors overflow-hidden",
        isSelected ? "border-brand-400" : "border-border"
      )}>
        <button
          onClick={() => toggle(id)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
            isSelected ? "bg-brand-50" : "bg-muted/20 hover:border-muted-foreground"
          )}
        >
          <div className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
            isSelected ? "border-brand-500 bg-brand-500" : "border-muted-foreground"
          )}>
            {isSelected && (
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{label}</span>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </button>
        {isSelected && (
          <div className="px-4 pb-3 pt-1 border-t border-brand-100 bg-brand-50/50">
            <Input
              className="text-xs h-8 bg-white"
              placeholder={placeholder}
              value={webhookUrls[id] ?? ""}
              onChange={(e) => setWebhookUrls((prev) => ({ ...prev, [id]: e.target.value }))}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              CampaignFlow will POST all leads as a JSON array to this URL.
            </p>
          </div>
        )}
      </div>
    );
  };

  // ── Section header ──────────────────────────────────────────────────────
  const SectionHeader = ({ icon: Icon, label, sub }: { icon: React.ElementType; label: string; sub?: string }) => (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Outreach platforms ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionHeader icon={Mail} label="Outreach Platforms" />
        <DestRow id="instantly" label="Instantly.ai" description="Add leads to an Instantly campaign with email sequences"
          available={hasInstantlyKey} unavailableMsg="Add key in Settings → Integrations" />
        <DestRow id="heyreach" label="Heyreach" description="Push to LinkedIn sequences in Heyreach"
          available={!!hasHeyreachKey} unavailableMsg="Add key in Settings → Integrations" />
        <DestRow id="smartlead" label="Smartlead" description="Add leads to Smartlead cold email campaigns"
          available={!!hasSmartleadKey} unavailableMsg="Add key in Settings → Integrations" />
        <DestRow id="lemlist" label="Lemlist" description="Push leads into Lemlist multichannel sequences"
          available={!!hasLemlistKey} unavailableMsg="Add key in Settings → Integrations" />
        <DestRow id="hubspot" label="HubSpot CRM" description="Upsert leads as contacts in HubSpot"
          available={hasHubSpotKey} unavailableMsg="Add key in Settings → Integrations" />
        <DestRow id="csv" label="Download CSV" description="Export all leads + sequences as a CSV file" available={true} />
      </div>

      {/* ── Automation / Webhooks ────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionHeader icon={Zap} label="Automation Tools" sub="— paste your webhook URL below" />
        <WebhookRow id="n8n" label="n8n"
          description="Trigger an n8n workflow with leads as JSON payload"
          placeholder="https://your-n8n.com/webhook/abc123" />
        <WebhookRow id="make" label="Make (Integromat)"
          description="Send leads to a Make scenario via webhook"
          placeholder="https://hook.eu1.make.com/abc123..." />
        <WebhookRow id="zapier" label="Zapier"
          description="Trigger a Zap with leads as JSON payload"
          placeholder="https://hooks.zapier.com/hooks/catch/..." />
        <WebhookRow id="clay" label="Clay"
          description="Push leads to a Clay table via webhook"
          placeholder="https://api.clay.com/v1/sources/webhook/..." />
        <WebhookRow id="http" label="Custom HTTP API"
          description="POST leads to any custom endpoint as a JSON array"
          placeholder="https://your-api.com/leads/ingest" />
      </div>

      {/* ── Calling platforms ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionHeader icon={Phone} label="Calling Platforms" sub={leadsWithPhone > 0 ? `(${leadsWithPhone} leads have phone numbers)` : undefined} />
        {leadsWithPhone === 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No leads have phone numbers. Ensure your leads include a <code className="font-mono">phone</code> field to use calling platforms.
          </p>
        )}
        {(["bland", "vapi", "retell", "synthflow", "air", "twilio"] as const).map((id) => {
          const labels: Record<string, string> = {
            bland: "Bland AI", vapi: "VAPI", retell: "Retell AI",
            synthflow: "Synthflow AI", air: "Air AI", twilio: "Twilio",
          };
          const descs: Record<string, string> = {
            bland: "Dispatch batch outbound calls via Bland AI",
            vapi: "Trigger outbound calls via VAPI voice agents",
            retell: "Create outbound phone calls via Retell AI",
            synthflow: "Send leads to Synthflow for automated calling",
            air: "Dispatch autonomous sales calls via Air AI",
            twilio: "Make outbound calls via Twilio programmable voice",
          };
          const available = connected.includes(id) && leadsWithPhone > 0;
          return (
            <DestRow
              key={id}
              id={id}
              label={labels[id]}
              description={descs[id]}
              available={available}
              unavailableMsg={!connected.includes(id) ? "Configure in Settings → Integrations" : "No phone numbers in leads"}
            />
          );
        })}
      </div>

      {status !== "done" && (
        <Button
          variant="gradient"
          className="w-full"
          disabled={selected.size === 0 || status === "loading" ||
            // Require webhook URLs for selected webhook destinations
            WEBHOOK_DEST_IDS.some((id) => selected.has(id) && !webhookUrls[id]?.trim())
          }
          loading={status === "loading"}
          onClick={handlePush}
        >
          <Send className="h-4 w-4 mr-2" />
          {status === "loading"
            ? "Pushing leads…"
            : `Push ${leads.length} leads to ${selected.size} destination${selected.size !== 1 ? "s" : ""}`}
        </Button>
      )}
      {WEBHOOK_DEST_IDS.some((id) => selected.has(id) && !webhookUrls[id]?.trim()) && status !== "done" && (
        <p className="text-xs text-amber-600">Enter the webhook URL for each selected automation tool above.</p>
      )}

      {/* Results */}
      {status === "done" && Object.keys(results).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Results</p>
          <div className="space-y-2">
            {Object.entries(results).map(([dest, r]) => (
              <div key={dest} className={cn(
                "flex items-center gap-3 p-3 rounded-lg border text-sm",
                r.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"
              )}>
                {r.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <div>
                  <span className="font-medium capitalize">{dest}</span>
                  {" — "}{r.message}
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
