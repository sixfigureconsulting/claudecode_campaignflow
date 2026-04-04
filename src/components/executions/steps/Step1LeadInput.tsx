"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertCircle, Loader2, Users, ArrowLeft, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignLead } from "@/types/database";

// ── Lead source catalog ───────────────────────────────────────────────────────

type SourceConfig = {
  id: string;
  label: string;
  description: string;
  icon: string;          // emoji or short string
  color: string;         // tailwind bg class
  modes: string[];       // which campaign types this appears in
  inputType: "apollo_url" | "apify_url" | "csv" | "webhook" | "clay" | "crm_url" | "gsheet_url" | "coming_soon";
  settingsService?: string; // matching key in integrations
  ctaLabel: string;
  placeholder?: string;
};

const SOURCES: SourceConfig[] = [
  // ── Outbound ──────────────────────────────────────────────────────────────
  {
    id: "apollo",
    label: "Apollo.io",
    description: "Pull contacts from Apollo saved lists. Enriches company data automatically.",
    icon: "🚀",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    modes: ["cold_email", "linkedin", "multi_channel", "cold_call", "custom"],
    inputType: "apollo_url",
    settingsService: "apollo",
    ctaLabel: "Fetch from Apollo",
    placeholder: "https://app.apollo.io/#/contacts?savedListId=...",
  },
  {
    id: "apify",
    label: "Apify",
    description: "Scrape LinkedIn profiles, company directories, or any website via Apify actors.",
    icon: "🕷️",
    color: "bg-orange-50 border-orange-200 hover:border-orange-400",
    modes: ["cold_email", "linkedin", "multi_channel", "cold_call", "custom"],
    inputType: "apify_url",
    settingsService: "apify",
    ctaLabel: "Fetch from Apify",
    placeholder: "https://api.apify.com/v2/datasets/...",
  },
  {
    id: "sales_navigator",
    label: "Sales Navigator",
    description: "Export from LinkedIn Sales Navigator via CSV or Apify scraper.",
    icon: "💼",
    color: "bg-sky-50 border-sky-200 hover:border-sky-400",
    modes: ["linkedin", "cold_email", "multi_channel"],
    inputType: "csv",
    ctaLabel: "Upload Sales Nav CSV",
  },
  {
    id: "hunter",
    label: "Hunter.io",
    description: "Find verified emails from domain search. Export list as CSV and import here.",
    icon: "🎯",
    color: "bg-red-50 border-red-200 hover:border-red-400",
    modes: ["cold_email", "multi_channel"],
    inputType: "csv",
    ctaLabel: "Upload Hunter CSV",
  },
  {
    id: "lusha",
    label: "Lusha",
    description: "Import contacts exported from Lusha's prospecting tool.",
    icon: "📋",
    color: "bg-teal-50 border-teal-200 hover:border-teal-400",
    modes: ["cold_email", "cold_call", "multi_channel"],
    inputType: "csv",
    ctaLabel: "Upload Lusha CSV",
  },
  {
    id: "seamless",
    label: "Seamless.AI",
    description: "Import leads exported from Seamless.AI.",
    icon: "✨",
    color: "bg-indigo-50 border-indigo-200 hover:border-indigo-400",
    modes: ["cold_email", "cold_call"],
    inputType: "csv",
    ctaLabel: "Upload Seamless CSV",
  },
  {
    id: "clay",
    label: "Clay",
    description: "Import enriched lead tables exported from Clay as CSV.",
    icon: "🧱",
    color: "bg-amber-50 border-amber-200 hover:border-amber-400",
    modes: ["cold_email", "linkedin", "multi_channel", "cold_call", "custom"],
    inputType: "csv",
    ctaLabel: "Upload Clay CSV",
  },
  {
    id: "csv",
    label: "CSV Upload",
    description: "Upload any CSV with contact data. Accepts most standard export formats.",
    icon: "📄",
    color: "bg-gray-50 border-gray-200 hover:border-gray-400",
    modes: ["cold_email", "linkedin", "multi_channel", "cold_call", "custom"],
    inputType: "csv",
    ctaLabel: "Upload CSV",
  },

  // ── Inbound / Intent ──────────────────────────────────────────────────────
  {
    id: "rb2b",
    label: "RB2B",
    description: "Import anonymous website visitor identifications from RB2B.",
    icon: "👁️",
    color: "bg-violet-50 border-violet-200 hover:border-violet-400",
    modes: ["custom"],
    inputType: "csv",
    ctaLabel: "Upload RB2B CSV",
  },
  {
    id: "hubspot",
    label: "HubSpot CRM",
    description: "Pull contacts or deals from HubSpot lists and segments.",
    icon: "🟠",
    color: "bg-orange-50 border-orange-200 hover:border-orange-400",
    modes: ["cold_email", "multi_channel", "custom"],
    inputType: "crm_url",
    settingsService: "hubspot",
    ctaLabel: "Import from HubSpot",
    placeholder: "HubSpot list name or ID...",
  },
  {
    id: "gsheet",
    label: "Google Sheets",
    description: "Paste a public Google Sheet URL containing contact data.",
    icon: "📊",
    color: "bg-green-50 border-green-200 hover:border-green-400",
    modes: ["cold_email", "linkedin", "multi_channel", "cold_call", "custom"],
    inputType: "gsheet_url",
    ctaLabel: "Import from Sheet",
    placeholder: "https://docs.google.com/spreadsheets/d/...",
  },
  {
    id: "webhook",
    label: "HTTP / Webhook",
    description: "Receive leads via a webhook URL. POST JSON arrays of contacts.",
    icon: "🔗",
    color: "bg-slate-50 border-slate-200 hover:border-slate-400",
    modes: ["cold_email", "linkedin", "multi_channel", "cold_call", "custom"],
    inputType: "webhook",
    ctaLabel: "Configure Webhook",
  },
  {
    id: "zoominfo",
    label: "ZoomInfo",
    description: "Import contacts exported from ZoomInfo as CSV.",
    icon: "🔵",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    modes: ["cold_email", "cold_call", "multi_channel"],
    inputType: "csv",
    ctaLabel: "Upload ZoomInfo CSV",
  },
];

// Which sources appear per campaign type
const TYPE_PRIORITY: Record<string, string[]> = {
  cold_email:    ["apollo", "apify", "clay", "hunter", "lusha", "seamless", "zoominfo", "gsheet", "csv", "hubspot", "webhook"],
  linkedin:      ["apollo", "apify", "sales_navigator", "clay", "gsheet", "csv", "webhook"],
  multi_channel: ["apollo", "apify", "sales_navigator", "clay", "hunter", "lusha", "zoominfo", "gsheet", "csv", "hubspot", "webhook"],
  cold_call:     ["apollo", "apify", "lusha", "seamless", "clay", "zoominfo", "gsheet", "csv", "webhook"],
  custom:        ["apollo", "apify", "clay", "rb2b", "hubspot", "gsheet", "csv", "webhook"],
};

// ── CSV parsing ───────────────────────────────────────────────────────────────

const COL_MAP: Record<string, keyof CampaignLead> = {
  first_name: "first_name", firstname: "first_name", "first name": "first_name",
  last_name: "last_name", lastname: "last_name", "last name": "last_name",
  email: "email", "email address": "email",
  company: "company", organization: "company", "company name": "company", organization_name: "company",
  title: "title", "job title": "title", jobtitle: "title", position: "title",
  linkedin_url: "linkedin_url", linkedin: "linkedin_url", "linkedin url": "linkedin_url", "linkedin profile url": "linkedin_url",
  website: "website", "website url": "website", "company website": "website",
  phone: "phone", "phone number": "phone", mobile: "phone",
};

function parseCSV(text: string): CampaignLead[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = ""; let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += char; }
    }
    values.push(current.trim());
    const lead: Partial<CampaignLead> = {};
    headers.forEach((header, i) => {
      const key = COL_MAP[header];
      if (key) (lead as Record<string, string>)[key] = values[i] ?? "";
    });
    return {
      first_name: lead.first_name ?? "", last_name: lead.last_name ?? "",
      email: lead.email ?? "", company: lead.company ?? "",
      title: lead.title ?? "", linkedin_url: lead.linkedin_url ?? null,
      website: lead.website ?? null, phone: lead.phone ?? null,
    } as CampaignLead;
  }).filter((l) => l.email && l.email.includes("@"));
}

function extractApolloListId(url: string): string | null {
  try {
    const hashPart = url.split("#")?.[1] ?? "";
    const params = new URLSearchParams(hashPart.split("?")?.[1] ?? "");
    const listId = params.get("savedListId");
    if (listId) return listId;
    const urlParams = new URLSearchParams(url.split("?")?.[1] ?? "");
    return urlParams.get("savedListId") ?? null;
  } catch { return null; }
}

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({
  source,
  isConnected,
  selected,
  onClick,
}: {
  source: SourceConfig;
  isConnected: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full text-left p-4 rounded-xl border-2 transition-all",
        selected
          ? "border-brand-500 bg-brand-50 shadow-sm"
          : cn("border", source.color),
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{source.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm">{source.label}</span>
            {isConnected && (
              <Badge className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-0">
                ✓ Connected
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{source.description}</p>
        </div>
      </div>
      {selected && (
        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center">
          <CheckCircle2 className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Step1LeadInput({
  projectId,
  hasApolloKey,
  hasApifyKey,
  hasHubSpotKey,
  campaignType,
  onComplete,
}: {
  projectId: string;
  hasApolloKey: boolean;
  hasApifyKey?: boolean;
  hasHubSpotKey?: boolean;
  campaignType?: string;
  onComplete: (leads: CampaignLead[]) => void;
}) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [previewLeads, setPreviewLeads] = useState<CampaignLead[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const type = campaignType ?? "cold_email";
  const priority = TYPE_PRIORITY[type] ?? TYPE_PRIORITY.cold_email;
  const availableSources = priority
    .map((id) => SOURCES.find((s) => s.id === id))
    .filter(Boolean) as SourceConfig[];

  const source = availableSources.find((s) => s.id === selectedSource);

  const isConnected = (s: SourceConfig) => {
    if (s.settingsService === "apollo") return hasApolloKey;
    if (s.settingsService === "apify") return !!hasApifyKey;
    if (s.settingsService === "hubspot") return !!hasHubSpotKey;
    return false; // CSV sources don't need a key
  };

  const needsKey = source?.settingsService && !isConnected(source);

  const reset = () => {
    setStatus("idle"); setMessage(""); setPreviewLeads([]);
    setInputValue(""); setFile(null);
  };

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) { setMessage("Please upload a CSV file."); setStatus("error"); return; }
    setFile(f); setStatus("idle"); setMessage(""); setPreviewLeads([]);
  };

  const handleFetch = async () => {
    if (!source) return;
    setStatus("loading"); setMessage(""); setPreviewLeads([]);

    if (source.inputType === "apollo_url") {
      const listId = extractApolloListId(inputValue.trim());
      const res = await fetch("/api/executions/fetch-apollo-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, apolloListId: listId ?? inputValue.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage(json.error ?? "Failed to fetch leads."); setStatus("error"); return; }
      setPreviewLeads(json.leads); setStatus("done");
      setMessage(`${json.total} leads fetched from Apollo`);

    } else if (source.inputType === "apify_url") {
      const res = await fetch("/api/executions/fetch-apify-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, datasetUrl: inputValue.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage(json.error ?? "Failed to fetch leads."); setStatus("error"); return; }
      setPreviewLeads(json.leads); setStatus("done");
      setMessage(`${json.total} leads fetched from Apify`);

    } else if (source.inputType === "csv") {
      if (!file) return;
      const text = await file.text();
      const leads = parseCSV(text);
      if (leads.length === 0) { setMessage("No valid leads found. Make sure the CSV has email addresses."); setStatus("error"); return; }
      setPreviewLeads(leads); setStatus("done");
      setMessage(`${leads.length} leads parsed from ${source.label}`);

    } else if (source.inputType === "gsheet_url") {
      // Convert share URL to CSV export URL
      const match = inputValue.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) { setMessage("Invalid Google Sheets URL."); setStatus("error"); return; }
      const sheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      try {
        const res = await fetch(csvUrl);
        if (!res.ok) { setMessage("Could not fetch Google Sheet. Make sure it is publicly shared."); setStatus("error"); return; }
        const text = await res.text();
        const leads = parseCSV(text);
        if (leads.length === 0) { setMessage("No valid leads found in the sheet."); setStatus("error"); return; }
        setPreviewLeads(leads); setStatus("done");
        setMessage(`${leads.length} leads imported from Google Sheets`);
      } catch { setMessage("Failed to fetch Google Sheet."); setStatus("error"); }

    } else {
      // coming_soon / webhook / crm — show placeholder
      setMessage("This source is coming soon. Use CSV export for now."); setStatus("error");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Source grid */}
      {!selectedSource && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Choose where your leads are coming from:
            </p>
            <Badge variant="outline" className="text-xs capitalize">{type.replace("_", " ")}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {availableSources.map((s) => (
              <SourceCard
                key={s.id}
                source={s}
                isConnected={isConnected(s)}
                selected={false}
                onClick={() => { setSelectedSource(s.id); reset(); }}
              />
            ))}
          </div>
        </>
      )}

      {/* Selected source — input form */}
      {source && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedSource(null); reset(); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All sources
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium flex items-center gap-1.5">
              <span>{source.icon}</span> {source.label}
            </span>
            {isConnected(source) && (
              <Badge className="text-[10px] bg-green-100 text-green-700 border-0">Connected</Badge>
            )}
          </div>

          {/* Key warning */}
          {needsKey && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Add your {source.label} API key in{" "}
              <a href="/settings" className="underline font-medium inline-flex items-center gap-0.5">
                Settings → Integrations <ExternalLink className="h-3 w-3" />
              </a>{" "}
              first.
            </div>
          )}

          {/* URL / text input */}
          {(source.inputType === "apollo_url" || source.inputType === "apify_url" ||
            source.inputType === "gsheet_url" || source.inputType === "crm_url") && (
            <div className="space-y-2">
              <Input
                placeholder={source.placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="text-sm"
                disabled={!!needsKey}
              />
              {source.inputType === "apollo_url" && (
                <p className="text-xs text-muted-foreground">Open your saved list in Apollo, copy the URL from your browser, and paste it here.</p>
              )}
              {source.inputType === "apify_url" && (
                <p className="text-xs text-muted-foreground">Paste the Apify dataset URL or actor run output URL.</p>
              )}
              {source.inputType === "gsheet_url" && (
                <p className="text-xs text-muted-foreground">The sheet must be publicly shared (Anyone with link can view).</p>
              )}
            </div>
          )}

          {/* CSV upload */}
          {source.inputType === "csv" && (
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                isDragging ? "border-brand-400 bg-brand-50" :
                file ? "border-green-400 bg-green-50" :
                "border-muted-foreground/25 hover:border-brand-400"
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Drop {source.label} CSV here or click to browse</p>
                  <p className="text-xs text-muted-foreground/70">Columns: first_name, last_name, email, company, title</p>
                </div>
              )}
            </div>
          )}

          {/* Webhook info */}
          {source.inputType === "webhook" && (
            <div className="p-4 bg-muted/40 rounded-xl border border-border text-sm space-y-2">
              <p className="font-medium">POST your leads to:</p>
              <code className="block text-xs bg-background border rounded p-2 text-muted-foreground break-all">
                {typeof window !== "undefined" ? window.location.origin : ""}/api/v1/projects/{projectId}/leads
              </code>
              <p className="text-xs text-muted-foreground">Send a JSON array of objects with first_name, last_name, email, company, title fields. Leads will appear here once received.</p>
            </div>
          )}

          {/* Status */}
          {status === "done" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {message}
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" /> {message}
            </div>
          )}
          {status === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Fetching leads from {source.label}...
            </div>
          )}

          {/* CTA */}
          {source.inputType !== "webhook" && previewLeads.length === 0 && (
            <Button
              variant="gradient"
              className="w-full"
              disabled={
                !!needsKey ||
                status === "loading" ||
                (source.inputType === "csv" ? !file : !inputValue.trim())
              }
              loading={status === "loading"}
              onClick={handleFetch}
            >
              {source.ctaLabel}
            </Button>
          )}

          {/* Lead preview */}
          {previewLeads.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Preview ({previewLeads.length} leads)
              </p>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-52">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        {["Name", "Title", "Company", "Email"].map((h) => (
                          <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {previewLeads.slice(0, 50).map((l, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-medium">{l.first_name} {l.last_name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{l.title}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{l.company}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{l.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewLeads.length > 50 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground border-t bg-muted/30">
                    Showing 50 of {previewLeads.length} leads
                  </div>
                )}
              </div>
              <Button variant="gradient" className="w-full" onClick={() => onComplete(previewLeads)}>
                Continue with {previewLeads.length} leads →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
