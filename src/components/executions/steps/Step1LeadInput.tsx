"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Link2, CheckCircle2, AlertCircle, Loader2, Users } from "lucide-react";
import type { CampaignLead } from "@/types/database";

// Flexible CSV column name map (lowercase → CampaignLead key)
const COL_MAP: Record<string, keyof CampaignLead> = {
  first_name: "first_name", firstname: "first_name", "first name": "first_name",
  last_name: "last_name", lastname: "last_name", "last name": "last_name",
  email: "email", "email address": "email",
  company: "company", organization: "company", "company name": "company",
  organization_name: "company",
  title: "title", "job title": "title", jobtitle: "title", position: "title",
  linkedin_url: "linkedin_url", linkedin: "linkedin_url", "linkedin url": "linkedin_url",
  "linkedin profile url": "linkedin_url",
  website: "website", "website url": "website", "company website": "website",
  phone: "phone", "phone number": "phone", mobile: "phone",
};

function parseCSV(text: string): CampaignLead[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  return lines
    .slice(1)
    .map((line) => {
      // Handle quoted fields
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
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
        first_name: lead.first_name ?? "",
        last_name: lead.last_name ?? "",
        email: lead.email ?? "",
        company: lead.company ?? "",
        title: lead.title ?? "",
        linkedin_url: lead.linkedin_url ?? null,
        website: lead.website ?? null,
        phone: lead.phone ?? null,
      } as CampaignLead;
    })
    .filter((l) => l.email && l.email.includes("@"));
}

function extractApolloListId(url: string): string | null {
  try {
    // Handle hash-based URLs: https://app.apollo.io/#/contacts?savedListId=XXXX
    const hashPart = url.split("#")?.[1] ?? "";
    const params = new URLSearchParams(hashPart.split("?")?.[1] ?? "");
    const listId = params.get("savedListId");
    if (listId) return listId;
    // Fallback: try regular query string
    const urlParams = new URLSearchParams(url.split("?")?.[1] ?? "");
    return urlParams.get("savedListId") ?? null;
  } catch {
    return null;
  }
}

export function Step1LeadInput({
  projectId,
  hasApolloKey,
  onComplete,
}: {
  projectId: string;
  hasApolloKey: boolean;
  onComplete: (leads: CampaignLead[]) => void;
}) {
  const [mode, setMode] = useState<"apollo" | "csv">("apollo");
  const [apolloUrl, setApolloUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [previewLeads, setPreviewLeads] = useState<CampaignLead[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      setMessage("Please upload a CSV file.");
      setStatus("error");
      return;
    }
    setFile(f);
    setStatus("idle");
    setMessage("");
    setPreviewLeads([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleApolloFetch = async () => {
    const listId = extractApolloListId(apolloUrl.trim());
    if (!listId && apolloUrl.trim()) {
      // Try treating the raw input as a list ID directly
    }
    setStatus("loading");
    setMessage("");
    setPreviewLeads([]);

    const res = await fetch("/api/executions/fetch-apollo-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, apolloListId: listId ?? apolloUrl.trim() }),
    });
    const json = await res.json();

    if (!res.ok) {
      setMessage(json.error ?? "Failed to fetch leads.");
      setStatus("error");
      return;
    }

    setPreviewLeads(json.leads);
    setStatus("done");
    setMessage(`${json.total} leads fetched from Apollo`);
  };

  const handleCSVParse = async () => {
    if (!file) return;
    setStatus("loading");
    const text = await file.text();
    const leads = parseCSV(text);
    if (leads.length === 0) {
      setMessage("No valid leads found. Make sure the CSV has email addresses.");
      setStatus("error");
      return;
    }
    setPreviewLeads(leads);
    setStatus("done");
    setMessage(`${leads.length} leads parsed from CSV`);
  };

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            mode === "apollo"
              ? "bg-brand-500 text-white"
              : "bg-muted/40 text-muted-foreground hover:bg-muted"
          }`}
          onClick={() => { setMode("apollo"); setStatus("idle"); setMessage(""); setPreviewLeads([]); }}
        >
          <Link2 className="h-4 w-4" />
          Apollo List URL
        </button>
        <button
          className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            mode === "csv"
              ? "bg-brand-500 text-white"
              : "bg-muted/40 text-muted-foreground hover:bg-muted"
          }`}
          onClick={() => { setMode("csv"); setStatus("idle"); setMessage(""); setPreviewLeads([]); }}
        >
          <Upload className="h-4 w-4" />
          Upload CSV
        </button>
      </div>

      {/* Apollo URL mode */}
      {mode === "apollo" && (
        <div className="space-y-3">
          {!hasApolloKey && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Add your Apollo API key in the Integrations tab first.
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Apollo Saved List URL
            </label>
            <Input
              placeholder="https://app.apollo.io/#/contacts?savedListId=..."
              value={apolloUrl}
              onChange={(e) => setApolloUrl(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Open your saved list in Apollo, copy the URL from your browser, and paste it here.
            </p>
          </div>
          <Button
            variant="gradient"
            className="w-full"
            disabled={!apolloUrl.trim() || !hasApolloKey || status === "loading"}
            loading={status === "loading"}
            onClick={handleApolloFetch}
          >
            {status === "loading" ? "Fetching leads..." : "Fetch Leads from Apollo"}
          </Button>
        </div>
      )}

      {/* CSV upload mode */}
      {mode === "csv" && (
        <div className="space-y-3">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging ? "border-brand-400 bg-brand-50" : file ? "border-green-400 bg-green-50" : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop CSV here or click to browse</p>
                <p className="text-xs text-muted-foreground/70">
                  Columns: first_name, last_name, email, company, title, linkedin_url
                </p>
              </div>
            )}
          </div>
          <Button
            variant="gradient"
            className="w-full"
            disabled={!file || status === "loading"}
            loading={status === "loading"}
            onClick={handleCSVParse}
          >
            {status === "loading" ? "Parsing..." : "Parse CSV"}
          </Button>
        </div>
      )}

      {/* Status messages */}
      {status === "done" && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      )}
      {status === "error" && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {message}
        </div>
      )}
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Fetching leads from Apollo...
        </div>
      )}

      {/* Lead preview table */}
      {previewLeads.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Preview ({previewLeads.length} leads)
          </p>
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-48">
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
                      <td className="px-3 py-1.5">{l.first_name} {l.last_name}</td>
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

          <Button
            variant="gradient"
            className="w-full"
            onClick={() => onComplete(previewLeads)}
          >
            Continue with {previewLeads.length} leads →
          </Button>
        </div>
      )}
    </div>
  );
}
