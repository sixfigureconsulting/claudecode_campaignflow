"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Users, Trash2, Download, Calendar, Database, Search, Upload, X,
  Loader2, ArrowLeft, CheckCircle2, AlertCircle, ExternalLink,
  BookmarkPlus, Plus, Sparkles,
} from "lucide-react";
import type { CampaignLead } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadList = {
  id: string; name: string; source: string | null;
  lead_count: number; created_at: string; updated_at: string;
};

type SourceConfig = {
  id: string; label: string; description: string;
  logo: string; inputType: "url" | "domain" | "list_id" | "csv" | "none";
  settingsService?: string; ctaLabel: string; placeholder?: string;
  hint?: string;
  color: string; badgeColor: string;
};

// ─── Source catalog (API-based only — CSV handled separately) ─────────────────

const API_SOURCES: SourceConfig[] = [
  {
    id: "apollo", label: "Apollo.io", description: "Pull contacts from an Apollo saved list. Paste the list URL from your browser.",
    logo: "apollo.io", inputType: "url", settingsService: "apollo",
    ctaLabel: "Fetch from Apollo", placeholder: "https://app.apollo.io/#/contacts?savedListId=...",
    hint: "Open your saved list in Apollo, copy the URL and paste it here.",
    color: "border-blue-200 bg-blue-50/50 hover:border-blue-400", badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    id: "apify", label: "Apify", description: "Import leads from any Apify dataset or actor run — LinkedIn scraper, domain search, and more.",
    logo: "apify.com", inputType: "url", settingsService: "apify",
    ctaLabel: "Fetch from Apify", placeholder: "https://api.apify.com/v2/datasets/...",
    hint: "Paste the Apify dataset URL or actor run output URL.",
    color: "border-orange-200 bg-orange-50/50 hover:border-orange-400", badgeColor: "bg-orange-100 text-orange-700",
  },
  {
    id: "phantombuster", label: "PhantomBuster", description: "Import leads from any phantom — LinkedIn scraper, email finder, Sales Nav extractor, and more.",
    logo: "phantombuster.com", inputType: "url", settingsService: "phantombuster",
    ctaLabel: "Fetch from PhantomBuster", placeholder: "https://phantombuster.com/username/phantoms/12345678/...",
    hint: "Paste the phantom URL from your PhantomBuster dashboard.",
    color: "border-purple-200 bg-purple-50/50 hover:border-purple-400", badgeColor: "bg-purple-100 text-purple-700",
  },
  {
    id: "hunter", label: "Hunter.io", description: "Find all verified emails at a company domain automatically.",
    logo: "hunter.io", inputType: "domain", settingsService: "hunter",
    ctaLabel: "Find Emails", placeholder: "stripe.com",
    hint: "Enter the company domain — Hunter returns all verified emails at that domain.",
    color: "border-red-200 bg-red-50/50 hover:border-red-400", badgeColor: "bg-red-100 text-red-700",
  },
  {
    id: "hubspot", label: "HubSpot CRM", description: "Pull contacts from a HubSpot contact list by its numeric list ID.",
    logo: "hubspot.com", inputType: "list_id", settingsService: "hubspot",
    ctaLabel: "Import from HubSpot", placeholder: "e.g. 12345",
    hint: "Find your list ID in HubSpot → Contacts → Lists. The numeric ID appears in the URL.",
    color: "border-orange-200 bg-orange-50/50 hover:border-orange-400", badgeColor: "bg-orange-100 text-orange-700",
  },
  {
    id: "gsheet", label: "Google Sheets", description: "Import from a public Google Sheet containing contact data.",
    logo: "sheets.google.com", inputType: "url", settingsService: undefined,
    ctaLabel: "Import from Sheet", placeholder: "https://docs.google.com/spreadsheets/d/...",
    hint: "The sheet must be shared as \"Anyone with the link can view\".",
    color: "border-green-200 bg-green-50/50 hover:border-green-400", badgeColor: "bg-green-100 text-green-700",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  apollo: "Apollo.io", apify: "Apify", hunter: "Hunter.io", hubspot: "HubSpot",
  gsheet: "Google Sheets", csv: "CSV Upload", phantombuster: "PhantomBuster",
  webhook: "Webhook", saved_list: "Saved List",
};

const SOURCE_BADGE: Record<string, string> = {
  apollo: "bg-blue-100 text-blue-700", apify: "bg-orange-100 text-orange-700",
  hunter: "bg-red-100 text-red-700", hubspot: "bg-orange-100 text-orange-700",
  gsheet: "bg-green-100 text-green-700", csv: "bg-gray-100 text-gray-600",
  phantombuster: "bg-purple-100 text-purple-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// CSV parsing (lenient — matches Step1LeadInput's COL_MAP)
const COL_MAP: Record<string, keyof CampaignLead> = {
  first_name: "first_name", firstname: "first_name", "first name": "first_name", first: "first_name",
  last_name: "last_name", lastname: "last_name", "last name": "last_name", last: "last_name",
  name: "first_name", "full name": "first_name", "contact name": "first_name",
  email: "email", "email address": "email", "work email": "email", email_address: "email", work_email: "email",
  company: "company", organization: "company", "company name": "company", organization_name: "company", "account name": "company",
  title: "title", "job title": "title", jobtitle: "title", position: "title", role: "title",
  linkedin_url: "linkedin_url", linkedin: "linkedin_url", "linkedin url": "linkedin_url", "linkedin profile url": "linkedin_url",
  website: "website", "website url": "website", "company website": "website", url: "website",
  phone: "phone", "phone number": "phone", mobile: "phone", "direct phone": "phone", telephone: "phone", "mobile phone": "phone",
};

function parseCSV(text: string): CampaignLead[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let cur = ""; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { values.push(cur.trim().replace(/^"|"$/g, "")); cur = ""; }
      else { cur += ch; }
    }
    values.push(cur.trim().replace(/^"|"$/g, ""));
    const lead: Partial<CampaignLead> = {};
    headers.forEach((h, i) => { const k = COL_MAP[h]; if (k && values[i]) (lead as Record<string, string>)[k] = values[i]; });
    if (lead.first_name && !lead.last_name && lead.first_name.includes(" ")) {
      const p = lead.first_name.trim().split(/\s+/); lead.first_name = p[0]; lead.last_name = p.slice(1).join(" ");
    }
    return { first_name: lead.first_name ?? "", last_name: lead.last_name ?? "", email: lead.email ?? "", company: lead.company ?? "", title: lead.title ?? "", linkedin_url: lead.linkedin_url ?? null, website: lead.website ?? null, phone: lead.phone ?? null } as CampaignLead;
  }).filter((l) => (l.email?.includes("@") || (l.phone && l.phone.length > 5)) && !!(l.company || l.first_name));
}

// ─── SourceLogo ───────────────────────────────────────────────────────────────

function SourceLogo({ logo, label, size = "md" }: { logo: string; label: string; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const dim = size === "sm" ? "w-7 h-7" : "w-9 h-9";

  if (logo === "__csv__") {
    return (
      <div className={cn(dim, "rounded-lg bg-gray-100 flex items-center justify-center shrink-0")}>
        <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
    );
  }

  if (failed) {
    return (
      <div className={cn(dim, "rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground")}>
        {label.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={`https://logo.clearbit.com/${logo}`}
      alt={label}
      className={cn(dim, "rounded-lg object-contain shrink-0 bg-white border border-border/50 p-1")}
      onError={() => setFailed(true)}
    />
  );
}

// ─── ListBuilder — full source picker + fetch + save workflow ─────────────────

function ListBuilder({
  connectedServices,
  onSaved,
  onCancel,
}: {
  connectedServices: string[];
  onSaved: (list: LeadList) => void;
  onCancel: () => void;
}) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [csvMode, setCsvMode] = useState(false);

  // Input state
  const [inputValue, setInputValue] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch state
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [leads, setLeads] = useState<CampaignLead[]>([]);

  // Save state
  const [listName, setListName] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const source = API_SOURCES.find((s) => s.id === selectedSource);
  const needsKey = source?.settingsService && !connectedServices.includes(source.settingsService);

  const reset = () => {
    setStatus("idle"); setMessage(""); setLeads([]);
    setInputValue(""); setCsvFile(null); setListName(""); setNameError("");
  };

  const selectSource = (id: string) => { setSelectedSource(id); setCsvMode(false); reset(); };
  const selectCsv = () => { setSelectedSource(null); setCsvMode(true); reset(); };
  const goBack = () => { setSelectedSource(null); setCsvMode(false); reset(); };

  // Fetch via API route
  const handleFetch = async () => {
    if (!source) return;
    setStatus("loading"); setMessage(""); setLeads([]);
    const res = await fetch("/api/lists/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: source.id, inputValue: inputValue.trim() }),
    });
    const json = await res.json();
    if (!res.ok) { setMessage(json.error ?? "Failed to fetch leads."); setStatus("error"); return; }
    setLeads(json.leads ?? []); setStatus("done");
    setMessage(`${json.total} leads fetched from ${source.label}`);
    setListName(`${source.label} – ${new Date().toLocaleDateString()}`);
  };

  // Parse CSV client-side
  const handleCsvFile = async (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setMessage("Please upload a .csv file."); setStatus("error"); return;
    }
    setCsvFile(file); setStatus("idle"); setMessage(""); setLeads([]);
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length === 0) {
      setMessage("No valid leads found. Check your CSV has email/phone plus name/company columns."); setStatus("error"); return;
    }
    setLeads(parsed); setStatus("done");
    setMessage(`${parsed.length} leads parsed from ${file.name}`);
    setListName(file.name.replace(/\.csv$/i, ""));
  };

  // Save the list
  const handleSave = async () => {
    if (!listName.trim()) { setNameError("List name is required."); return; }
    setSaving(true);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: listName.trim(), source: csvMode ? "csv" : (source?.id ?? "csv"), leads }),
    });
    const json = await res.json();
    if (!res.ok) { setNameError(json.error ?? "Save failed."); setSaving(false); return; }
    onSaved({
      id: json.id, name: listName.trim(), source: csvMode ? "csv" : (source?.id ?? "csv"),
      lead_count: json.lead_count, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
  };

  const canFetch = source && !needsKey && inputValue.trim().length > 0;

  return (
    <div className="border rounded-2xl bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          {(selectedSource || csvMode) && (
            <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-1">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <Sparkles className="h-4 w-4 text-brand-500" />
          <h3 className="font-semibold text-sm">
            {selectedSource ? `Import from ${source?.label}` : csvMode ? "Upload CSV" : "Build New List"}
          </h3>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5">
        {/* ── Step 1: Source picker ── */}
        {!selectedSource && !csvMode && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose where to pull your leads from:</p>

            {/* API sources */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Integrations</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {API_SOURCES.map((s) => {
                  const connected = !s.settingsService || connectedServices.includes(s.settingsService);
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectSource(s.id)}
                      className={cn("w-full text-left p-3.5 rounded-xl border-2 transition-all", s.color)}
                    >
                      <div className="flex items-start gap-3">
                        <SourceLogo logo={s.logo} label={s.label} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm">{s.label}</span>
                            {connected && s.settingsService && (
                              <Badge className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-0">✓ Connected</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CSV option */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manual Import</p>
              <button
                onClick={selectCsv}
                className="w-full text-left p-3.5 rounded-xl border-2 border-gray-200 bg-gray-50/50 hover:border-gray-400 transition-all"
              >
                <div className="flex items-center gap-3">
                  <SourceLogo logo="__csv__" label="CSV" />
                  <div>
                    <p className="font-semibold text-sm">CSV Upload</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Upload any CSV — Apollo, ZoomInfo, Lusha, Sales Navigator, or your own export.</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2a: API source form ── */}
        {selectedSource && source && (
          <div className="space-y-4">
            {/* Key warning */}
            {needsKey && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Add your {source.label} API key in{" "}
                <a href="/settings" className="underline font-medium inline-flex items-center gap-0.5">
                  Settings → Integrations <ExternalLink className="h-3 w-3" />
                </a>{" "}first.
              </div>
            )}

            {/* Input */}
            {leads.length === 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {source.inputType === "domain" ? "Company Domain" : source.inputType === "list_id" ? "List ID" : "URL"}
                </label>
                <Input
                  placeholder={source.placeholder}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={!!needsKey}
                  className="text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter" && canFetch) handleFetch(); }}
                />
                {source.hint && <p className="text-xs text-muted-foreground">{source.hint}</p>}
              </div>
            )}

            {/* Status */}
            {status === "loading" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Fetching leads from {source.label}…
              </div>
            )}
            {status === "error" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {message}
              </div>
            )}
            {status === "done" && leads.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
                <CheckCircle2 className="h-4 w-4" /> {message}
              </div>
            )}

            {/* Fetch button */}
            {leads.length === 0 && status !== "loading" && (
              <Button variant="gradient" className="w-full" disabled={!canFetch} onClick={handleFetch}>
                {source.ctaLabel}
              </Button>
            )}
          </div>
        )}

        {/* ── Step 2b: CSV upload ── */}
        {csvMode && leads.length === 0 && (
          <div className="space-y-3">
            <div
              className={cn("border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                isDragging ? "border-brand-400 bg-brand-50" : "border-muted-foreground/20 hover:border-brand-400 hover:bg-brand-50/30")}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f); }}
            >
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
              <Upload className="h-7 w-7 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Drop your CSV here or <span className="text-brand-600 underline underline-offset-2">browse</span></p>
              <p className="text-xs text-muted-foreground/60 mt-1.5">Accepts: Apollo, ZoomInfo, Lusha, Sales Nav, or any standard export</p>
              <p className="text-xs text-muted-foreground/40 mt-1">Recognised columns: first_name, last_name, email, company, title, phone, linkedin_url</p>
            </div>
            {status === "error" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {message}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Lead preview + save ── */}
        {leads.length > 0 && (
          <div className="space-y-4">
            {/* Preview table */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Preview — {leads.length} leads
              </p>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>{["Name", "Title", "Company", "Email"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {leads.slice(0, 50).map((l, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-1.5 font-medium">{l.first_name} {l.last_name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[120px]">{l.title}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[120px]">{l.company}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[160px]">{l.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {leads.length > 50 && (
                  <div className="px-3 py-1.5 text-xs text-muted-foreground border-t bg-muted/20">
                    Showing 50 of {leads.length} leads
                  </div>
                )}
              </div>
            </div>

            {/* Name + save */}
            <div className="border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/20 flex items-center gap-2">
                <BookmarkPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Save this list</span>
              </div>
              <div className="px-4 py-3 border-t space-y-3">
                <div className="space-y-1">
                  <Input
                    autoFocus
                    value={listName}
                    onChange={(e) => { setListName(e.target.value); setNameError(""); }}
                    placeholder="e.g. Q2 LinkedIn Prospects"
                    className="text-sm"
                  />
                  {nameError && <p className="text-xs text-destructive">{nameError}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={reset}>
                    ← Start over
                  </Button>
                  <Button size="sm" variant="gradient" className="ml-auto gap-1.5" loading={saving} onClick={handleSave}>
                    {!saving && <CheckCircle2 className="h-3.5 w-3.5" />}
                    Save {leads.length.toLocaleString()} leads
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ListsPanel ──────────────────────────────────────────────────────────

export function ListsPanel({
  initialLists,
  connectedServices = [],
}: {
  initialLists: LeadList[];
  connectedServices?: string[];
}) {
  const router = useRouter();
  const [lists, setLists] = useState<LeadList[]>(initialLists);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  const filtered = lists.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.source && SOURCE_LABELS[l.source]?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this list? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    setLists((prev) => prev.filter((l) => l.id !== id));
    setDeleting(null);
    router.refresh();
  };

  const handleDownload = async (list: LeadList) => {
    setDownloading(list.id);
    const res = await fetch(`/api/lists/${list.id}`);
    const json = await res.json();
    if (!res.ok || !json.leads?.length) { setDownloading(null); return; }
    const headers = ["first_name", "last_name", "email", "company", "title", "phone", "linkedin_url", "website"];
    const rows = json.leads.map((l: Record<string, string>) => headers.map((h) => `"${(l[h] ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${list.name.replace(/\s+/g, "_")}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    setDownloading(null);
  };

  const handleSaved = (list: LeadList) => {
    setLists((prev) => [list, ...prev]);
    setBuilding(false);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-9 h-9 text-sm" placeholder="Search lists…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground">{lists.length} list{lists.length !== 1 ? "s" : ""}</span>
        <Button
          size="sm"
          className="gap-1.5 ml-auto"
          variant={building ? "outline" : "gradient"}
          onClick={() => setBuilding((v) => !v)}
        >
          {building ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {building ? "Cancel" : "+ New List"}
        </Button>
      </div>

      {/* List builder */}
      {building && (
        <ListBuilder
          connectedServices={connectedServices}
          onSaved={handleSaved}
          onCancel={() => setBuilding(false)}
        />
      )}

      {/* Lists grid */}
      {filtered.length === 0 && !building ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-2xl bg-muted/20 text-center">
          <Database className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-sm">{lists.length === 0 ? "No saved lists yet" : "No lists match your search"}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
            {lists.length === 0
              ? "Click \"+ New List\" to import from Apollo, Apify, CSV, Google Sheets, and more."
              : "Try a different search term."}
          </p>
          {lists.length === 0 && (
            <Button size="sm" variant="gradient" className="mt-4 gap-1.5" onClick={() => setBuilding(true)}>
              <Plus className="h-3.5 w-3.5" /> Build your first list
            </Button>
          )}
        </div>
      ) : filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((list) => (
            <div key={list.id} className="bg-card border rounded-2xl p-5 hover:shadow-sm transition-shadow flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-brand-600" />
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => handleDownload(list)} disabled={downloading === list.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Download CSV">
                    <Download className={cn("h-3.5 w-3.5", downloading === list.id && "animate-pulse")} />
                  </button>
                  <button onClick={() => handleDelete(list.id)} disabled={deleting === list.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm leading-snug">{list.name}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                    <Users className="h-3 w-3" />{list.lead_count.toLocaleString()} leads
                  </span>
                  {list.source && (
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", SOURCE_BADGE[list.source] ?? "bg-muted text-muted-foreground")}>
                      {SOURCE_LABELS[list.source] ?? list.source}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2">
                  <Calendar className="h-3 w-3" />{formatDate(list.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
