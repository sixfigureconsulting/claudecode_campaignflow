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
  logo: string;          // clearbit logo domain or direct URL
  color: string;         // tailwind bg + border class
  modes: string[];       // which campaign types this appears in
  inputType: "apollo_url" | "apify_url" | "csv" | "webhook" | "hunter_domain" | "hubspot_list" | "gsheet_url" | "calling_api" | "coming_soon";
  settingsService?: string;
  ctaLabel: string;
  placeholder?: string;
  callingPlatform?: true; // visual grouping
};

const SOURCES: SourceConfig[] = [
  // ── Outbound ──────────────────────────────────────────────────────────────
  {
    id: "apollo",
    label: "Apollo.io",
    description: "Pull contacts from Apollo saved lists. Enriches company data automatically.",
    logo: "apollo.io",
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
    logo: "apify.com",
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
    logo: "linkedin.com",
    color: "bg-sky-50 border-sky-200 hover:border-sky-400",
    modes: ["linkedin", "cold_email", "multi_channel"],
    inputType: "csv",
    ctaLabel: "Upload Sales Nav CSV",
  },
  {
    id: "hunter",
    label: "Hunter.io",
    description: "Find all verified emails at a company domain. Enter the domain and Hunter fetches contacts automatically.",
    logo: "hunter.io",
    color: "bg-red-50 border-red-200 hover:border-red-400",
    modes: ["cold_email", "multi_channel"],
    inputType: "hunter_domain",
    settingsService: "hunter",
    ctaLabel: "Fetch from Hunter.io",
    placeholder: "acme.com",
  },
  {
    id: "lusha",
    label: "Lusha",
    description: "Import contacts exported from Lusha's prospecting tool.",
    logo: "lusha.com",
    color: "bg-teal-50 border-teal-200 hover:border-teal-400",
    modes: ["cold_email", "cold_call", "multi_channel"],
    inputType: "csv",
    ctaLabel: "Upload Lusha CSV",
  },
  {
    id: "seamless",
    label: "Seamless.AI",
    description: "Import leads exported from Seamless.AI.",
    logo: "seamless.ai",
    color: "bg-indigo-50 border-indigo-200 hover:border-indigo-400",
    modes: ["cold_email", "cold_call"],
    inputType: "csv",
    ctaLabel: "Upload Seamless CSV",
  },
  {
    id: "zoominfo",
    label: "ZoomInfo",
    description: "Import contacts exported from ZoomInfo as CSV.",
    logo: "zoominfo.com",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    modes: ["cold_email", "cold_call", "multi_channel"],
    inputType: "csv",
    ctaLabel: "Upload ZoomInfo CSV",
  },
  {
    id: "rb2b",
    label: "RB2B",
    description: "Import website visitor identifications from RB2B.",
    logo: "rb2b.com",
    color: "bg-violet-50 border-violet-200 hover:border-violet-400",
    modes: ["custom"],
    inputType: "csv",
    ctaLabel: "Upload RB2B CSV",
  },
  {
    id: "hubspot",
    label: "HubSpot CRM",
    description: "Pull contacts from a HubSpot contact list by ID. Find list IDs in HubSpot → Contacts → Lists.",
    logo: "hubspot.com",
    color: "bg-orange-50 border-orange-200 hover:border-orange-400",
    modes: ["cold_email", "multi_channel", "custom"],
    inputType: "hubspot_list",
    settingsService: "hubspot",
    ctaLabel: "Import from HubSpot",
    placeholder: "e.g. 12345",
  },
  {
    id: "gsheet",
    label: "Google Sheets",
    description: "Paste a public Google Sheet URL containing contact data.",
    logo: "sheets.google.com",
    color: "bg-green-50 border-green-200 hover:border-green-400",
    modes: ["cold_email", "linkedin", "multi_channel", "cold_call", "custom"],
    inputType: "gsheet_url",
    ctaLabel: "Import from Sheet",
    placeholder: "https://docs.google.com/spreadsheets/d/...",
  },
  {
    id: "csv",
    label: "CSV Upload",
    description: "Upload any CSV with contact data. Accepts most standard export formats.",
    logo: "__csv__",
    color: "bg-gray-50 border-gray-200 hover:border-gray-400",
    modes: ["cold_email", "linkedin", "multi_channel", "cold_call", "custom"],
    inputType: "csv",
    ctaLabel: "Upload CSV",
  },
  {
    id: "webhook",
    label: "HTTP / Webhook",
    description: "Receive leads via a webhook URL. POST JSON arrays of contacts.",
    logo: "__webhook__",
    color: "bg-slate-50 border-slate-200 hover:border-slate-400",
    modes: ["cold_email", "linkedin", "multi_channel", "cold_call", "custom"],
    inputType: "webhook",
    ctaLabel: "Configure Webhook",
  },

  // ── Calling platforms (cold_call only) ────────────────────────────────────
  {
    id: "retell",
    label: "Retell AI",
    description: "AI-powered voice agents for outbound calls. Leads dialed automatically via Retell's API in Step 5.",
    logo: "retellai.com",
    color: "bg-violet-50 border-violet-200 hover:border-violet-400",
    modes: ["cold_call"],
    inputType: "calling_api",
    settingsService: "retell",
    ctaLabel: "Connect Retell AI",
    callingPlatform: true,
  },
  {
    id: "vapi",
    label: "VAPI",
    description: "Build and deploy voice AI agents. CampaignFlow pushes leads to VAPI to trigger outbound call batches.",
    logo: "vapi.ai",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    modes: ["cold_call"],
    inputType: "calling_api",
    settingsService: "vapi",
    ctaLabel: "Connect VAPI",
    callingPlatform: true,
  },
  {
    id: "bland",
    label: "Bland AI",
    description: "Scalable AI phone calls at any volume. Send your lead list to Bland AI to start automated call campaigns.",
    logo: "bland.ai",
    color: "bg-green-50 border-green-200 hover:border-green-400",
    modes: ["cold_call"],
    inputType: "calling_api",
    settingsService: "bland",
    ctaLabel: "Connect Bland AI",
    callingPlatform: true,
  },
  {
    id: "air",
    label: "Air AI",
    description: "Fully autonomous AI sales calls with human-like conversation. Integrates via REST API.",
    logo: "air.ai",
    color: "bg-sky-50 border-sky-200 hover:border-sky-400",
    modes: ["cold_call"],
    inputType: "calling_api",
    settingsService: "air",
    ctaLabel: "Connect Air AI",
    callingPlatform: true,
  },
  {
    id: "synthflow",
    label: "Synthflow AI",
    description: "No-code AI calling platform. Push leads to Synthflow workflows to trigger outbound follow-up calls.",
    logo: "synthflow.ai",
    color: "bg-teal-50 border-teal-200 hover:border-teal-400",
    modes: ["cold_call"],
    inputType: "calling_api",
    settingsService: "synthflow",
    ctaLabel: "Connect Synthflow",
    callingPlatform: true,
  },
  {
    id: "twilio",
    label: "Twilio",
    description: "Programmable voice calls via Twilio's API. Use with your own call scripts or IVR flows.",
    logo: "twilio.com",
    color: "bg-red-50 border-red-200 hover:border-red-400",
    modes: ["cold_call"],
    inputType: "calling_api",
    settingsService: "twilio",
    ctaLabel: "Connect Twilio",
    callingPlatform: true,
  },
];

// Which sources appear per campaign type
const TYPE_PRIORITY: Record<string, string[]> = {
  cold_email:    ["apollo", "apify", "hunter", "lusha", "seamless", "zoominfo", "gsheet", "csv", "hubspot", "webhook"],
  linkedin:      ["apollo", "apify", "sales_navigator", "gsheet", "csv", "webhook"],
  multi_channel: ["apollo", "apify", "sales_navigator", "hunter", "lusha", "zoominfo", "gsheet", "csv", "hubspot", "webhook"],
  cold_call:     ["retell", "vapi", "bland", "air", "synthflow", "twilio", "apollo", "apify", "lusha", "seamless", "zoominfo", "gsheet", "csv", "webhook"],
  custom:        ["apollo", "apify", "rb2b", "hubspot", "gsheet", "csv", "webhook"],
};

// ── CSV parsing ───────────────────────────────────────────────────────────────

const COL_MAP: Record<string, keyof CampaignLead> = {
  // Name
  first_name: "first_name", firstname: "first_name", "first name": "first_name",
  last_name: "last_name", lastname: "last_name", "last name": "last_name",
  name: "first_name", "full name": "first_name", "contact name": "first_name",
  // Email
  email: "email", "email address": "email", "work email": "email",
  // Company
  company: "company", organization: "company", "company name": "company",
  organization_name: "company", "account name": "company",
  // Title
  title: "title", "job title": "title", jobtitle: "title",
  position: "title", role: "title", "job role": "title",
  // LinkedIn
  linkedin_url: "linkedin_url", linkedin: "linkedin_url",
  "linkedin url": "linkedin_url", "linkedin profile url": "linkedin_url",
  "company linkedin url": "linkedin_url", "company linkedin": "linkedin_url",
  // Website
  website: "website", "website url": "website", "company website": "website",
  "website url": "website", url: "website",
  // Phone
  phone: "phone", "phone number": "phone", mobile: "phone",
  "company phone": "phone", "direct phone": "phone", telephone: "phone",
  "phone 1": "phone", "mobile phone": "phone",
};

function parseCSV(text: string): CampaignLead[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  return lines.slice(1).map((line) => {
    // Handle quoted fields correctly
    const values: string[] = [];
    let current = ""; let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { values.push(current.trim().replace(/^"|"$/g, "")); current = ""; }
      else { current += char; }
    }
    values.push(current.trim().replace(/^"|"$/g, ""));

    const lead: Partial<CampaignLead> = {};
    headers.forEach((header, i) => {
      const key = COL_MAP[header];
      if (key && values[i]) (lead as Record<string, string>)[key] = values[i];
    });

    // If "name" column was mapped to first_name, try to split "First Last"
    if (lead.first_name && !lead.last_name && lead.first_name.includes(" ")) {
      const parts = lead.first_name.trim().split(/\s+/);
      lead.first_name = parts[0];
      lead.last_name = parts.slice(1).join(" ");
    }

    return {
      first_name: lead.first_name ?? "",
      last_name: lead.last_name ?? "",
      email: lead.email ?? "",
      company: lead.company ?? "",
      title: lead.title ?? "",
      linkedin_url: lead.linkedin_url ?? null,
      website: lead.website ?? null,
      phone: lead.phone ?? null,
    } as CampaignLead;
  }).filter((l) => {
    // Accept leads with a valid email OR a phone number (cold calling)
    const hasEmail = l.email && l.email.includes("@");
    const hasPhone = l.phone && l.phone.trim().length > 5;
    const hasIdentifier = l.company || l.first_name;
    return (hasEmail || hasPhone) && hasIdentifier;
  });
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

function SourceLogo({ logo, label }: { logo: string; label: string }) {
  const [failed, setFailed] = useState(false);

  if (logo === "__csv__") {
    return (
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      </div>
    );
  }

  if (logo === "__webhook__") {
    return (
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
        </svg>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-sm font-bold text-muted-foreground">
        {label.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={`https://logo.clearbit.com/${logo}`}
      alt={label}
      className="w-9 h-9 rounded-lg object-contain shrink-0 bg-white border border-border/50 p-1"
      onError={() => setFailed(true)}
    />
  );
}

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
        <SourceLogo logo={source.logo} label={source.label} />
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
  hasHunterKey,
  campaignType,
  onComplete,
}: {
  projectId: string;
  hasApolloKey: boolean;
  hasApifyKey?: boolean;
  hasHubSpotKey?: boolean;
  hasHunterKey?: boolean;
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
    if (s.settingsService === "hunter") return !!hasHunterKey;
    return false; // CSV/gsheet/webhook sources don't need a key
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
      if (leads.length === 0) { setMessage("No valid leads found. Make sure the CSV has an email or phone column, plus a company or name column."); setStatus("error"); return; }
      setPreviewLeads(leads); setStatus("done");
      setMessage(`${leads.length} leads parsed from ${source.label}`);

    } else if (source.inputType === "hunter_domain") {
      const res = await fetch("/api/executions/fetch-hunter-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, domain: inputValue.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage(json.error ?? "Failed to fetch leads."); setStatus("error"); return; }
      setPreviewLeads(json.leads); setStatus("done");
      setMessage(`${json.total} contacts found at ${inputValue.trim()}`);

    } else if (source.inputType === "hubspot_list") {
      const res = await fetch("/api/executions/fetch-hubspot-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, listId: inputValue.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage(json.error ?? "Failed to fetch leads."); setStatus("error"); return; }
      setPreviewLeads(json.leads); setStatus("done");
      setMessage(`${json.total} contacts imported from HubSpot list`);

    } else if (source.inputType === "gsheet_url") {
      // Server-side fetch to bypass browser CORS restrictions on Google's export endpoint
      const res = await fetch("/api/executions/fetch-gsheet-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: inputValue.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage(json.error ?? "Failed to fetch Google Sheet."); setStatus("error"); return; }
      setPreviewLeads(json.leads); setStatus("done");
      setMessage(`${json.total} leads imported from Google Sheets`);

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
            <Badge variant="outline" className="text-xs capitalize">{type.replace(/_/g, " ")}</Badge>
          </div>
          {(() => {
            const callingPlatforms = availableSources.filter((s) => s.callingPlatform);
            const leadSources = availableSources.filter((s) => !s.callingPlatform);
            return (
              <div className="space-y-5">
                {callingPlatforms.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Calling Platforms
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {callingPlatforms.map((s) => (
                        <SourceCard
                          key={s.id}
                          source={s}
                          isConnected={isConnected(s)}
                          selected={false}
                          onClick={() => { setSelectedSource(s.id); reset(); }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {leadSources.length > 0 && (
                  <div className="space-y-2">
                    {callingPlatforms.length > 0 && (
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Lead Sources
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {leadSources.map((s) => (
                        <SourceCard
                          key={s.id}
                          source={s}
                          isConnected={isConnected(s)}
                          selected={false}
                          onClick={() => { setSelectedSource(s.id); reset(); }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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
              <SourceLogo logo={source.logo} label={source.label} />
              {source.label}
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
            source.inputType === "gsheet_url" || source.inputType === "hunter_domain" ||
            source.inputType === "hubspot_list") && (
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
              {source.inputType === "hunter_domain" && (
                <p className="text-xs text-muted-foreground">Enter the company domain (e.g. <code className="bg-muted px-1 rounded">stripe.com</code>). Hunter will return all verified emails at that domain.</p>
              )}
              {source.inputType === "hubspot_list" && (
                <p className="text-xs text-muted-foreground">Find your list ID in HubSpot → Contacts → Lists. The numeric ID is shown in the URL.</p>
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

          {/* Calling platform info */}
          {source.inputType === "calling_api" && (
            <div className="space-y-4">
              <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl text-sm space-y-2">
                <p className="font-semibold text-violet-900 flex items-center gap-2">
                  <span className="text-base">📞</span> How it works
                </p>
                <ol className="list-decimal list-inside space-y-1 text-violet-800 text-xs leading-relaxed">
                  <li>Import your leads from any source below (Apollo, CSV, etc.)</li>
                  <li>Qualify and filter them through Steps 2–4</li>
                  <li>In Step 5 (Push), CampaignFlow sends the list to <strong>{source.label}</strong> via API to trigger outbound calls</li>
                </ol>
              </div>
              {needsKey ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Add your {source.label} API key in{" "}
                  <a href="/settings" className="underline font-medium inline-flex items-center gap-0.5">
                    Settings → Integrations <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  to enable calling in Step 5.
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {source.label} is connected. Your leads will be sent for outbound calls in Step 5.
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Now import your leads using Apollo, CSV, or any other source. Once you reach Step 5, CampaignFlow will dispatch the calls via {source.label}.
              </p>
              <Button
                variant="gradient"
                className="w-full"
                onClick={() => { setSelectedSource(null); reset(); }}
              >
                Select lead source →
              </Button>
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
          {source.inputType !== "webhook" && source.inputType !== "calling_api" && previewLeads.length === 0 && (
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
          {/* Status messages for non-URL input types that fall through to coming_soon */}
          {source.inputType === "coming_soon" && (
            <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
              Direct API import coming soon. Export from {source.label} as CSV and use the CSV Upload source.
            </div>
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
