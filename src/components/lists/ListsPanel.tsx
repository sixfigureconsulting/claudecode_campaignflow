"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Trash2, Download, Calendar,
  Database, Search, Upload, X, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LeadList = {
  id: string;
  name: string;
  source: string | null;
  lead_count: number;
  created_at: string;
  updated_at: string;
};

const SOURCE_LABELS: Record<string, string> = {
  apollo: "Apollo.io",
  apify: "Apify",
  hunter: "Hunter.io",
  hubspot: "HubSpot",
  gsheet: "Google Sheets",
  csv: "CSV Upload",
  webhook: "Webhook",
  saved_list: "Saved List",
};

const SOURCE_COLORS: Record<string, string> = {
  apollo: "bg-blue-100 text-blue-700",
  apify: "bg-orange-100 text-orange-700",
  hunter: "bg-red-100 text-red-700",
  hubspot: "bg-orange-100 text-orange-700",
  gsheet: "bg-green-100 text-green-700",
  csv: "bg-gray-100 text-gray-600",
  webhook: "bg-slate-100 text-slate-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type ParsedLead = {
  first_name: string; last_name: string; email: string;
  company: string; title: string; phone: string;
  linkedin_url: string; website: string;
};

const REQUIRED_LIST_FIELDS: { label: string; aliases: string[] }[] = [
  { label: "First Name",   aliases: ["first_name", "firstname", "first name", "first", "name", "full name", "contact name"] },
  { label: "Last Name",    aliases: ["last_name", "lastname", "last name", "last"] },
  { label: "Email",        aliases: ["email", "email_address", "email address", "work email", "work_email"] },
  { label: "LinkedIn URL", aliases: ["linkedin_url", "linkedin", "linkedin url", "linkedin profile url", "linkedin profile"] },
];

function getMissingCSVColumns(text: string): string[] {
  const firstLine = text.split(/\r?\n/).find(Boolean) ?? "";
  const headers = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return REQUIRED_LIST_FIELDS
    .filter(({ aliases }) => !aliases.some((a) => headers.includes(a)))
    .map(({ label }) => label);
}

function parseCSV(text: string): ParsedLead[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/['"]/g, ""));
  return lines.slice(1).map((line) => {
    const cols = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? [];
    const clean = (v?: string) => (v ?? "").replace(/^"|"$/g, "").trim();
    const get = (...keys: string[]) => clean(cols[keys.map((k) => headers.indexOf(k)).find((i) => i >= 0) ?? -1]);
    return {
      first_name: get("first_name", "firstname", "first name", "first"),
      last_name: get("last_name", "lastname", "last name", "last"),
      email: get("email", "email_address", "work_email", "work email"),
      company: get("company", "company_name", "organization"),
      title: get("title", "job_title", "position"),
      phone: get("phone", "phone_number", "mobile"),
      linkedin_url: get("linkedin_url", "linkedin", "linkedin url", "linkedin_profile"),
      website: get("website", "website_url", "domain"),
    };
  }).filter((r) => r.email || r.first_name);
}

export function ListsPanel({ initialLists }: { initialLists: LeadList[] }) {
  const router = useRouter();
  const [lists, setLists] = useState<LeadList[]>(initialLists);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // New list modal state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [parsedFile, setParsedFile] = useState<{ leads: ParsedLead[]; fileName: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);

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

  const openModal = () => {
    setListName("");
    setParsedFile(null);
    setNameError("");
    setFileError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (uploading) return;
    setModalOpen(false);
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setFileError("Please upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const missing = getMissingCSVColumns(text);
      if (missing.length > 0) {
        setFileError(`Missing required columns: ${missing.join(", ")}. Add these columns to your CSV before uploading.`);
        return;
      }
      const leads = parseCSV(text);
      if (leads.length === 0) { setFileError("No valid rows found. Make sure your CSV has headers and at least one data row."); return; }
      setFileError("");
      setParsedFile({ leads, fileName: file.name });
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSave = async () => {
    let valid = true;
    if (!listName.trim()) { setNameError("List name is required."); valid = false; }
    if (!parsedFile) { setFileError("Please upload a CSV file."); valid = false; }
    if (!valid) return;
    setUploading(true);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: listName.trim(), source: "csv", leads: parsedFile!.leads }),
    });
    const json = await res.json();
    if (!res.ok) { setFileError(json.error ?? "Save failed."); setUploading(false); return; }
    setLists((prev) => [{
      id: json.id, name: listName.trim(), source: "csv",
      lead_count: json.lead_count, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, ...prev]);
    setModalOpen(false);
    setUploading(false);
    router.refresh();
  };

  const handleDownload = async (list: LeadList) => {
    setDownloading(list.id);
    const res = await fetch(`/api/lists/${list.id}`);
    const json = await res.json();
    if (!res.ok || !json.leads?.length) { setDownloading(null); return; }

    const headers = ["first_name", "last_name", "email", "company", "title", "phone", "linkedin_url", "website"];
    const rows = json.leads.map((l: Record<string, string>) =>
      headers.map((h) => `"${(l[h] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${list.name.replace(/\s+/g, "_")}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setDownloading(null);
  };

  return (
    <div className="space-y-4">
      {/* Search + count + upload */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search lists…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground">{lists.length} list{lists.length !== 1 ? "s" : ""}</span>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={openModal}>
          + New List
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
      </div>

      {/* New list modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Create New List</h3>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step 1 — name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">1. Name your list</label>
              <Input
                autoFocus
                value={listName}
                onChange={(e) => { setListName(e.target.value); setNameError(""); }}
                placeholder="e.g. Q2 Outbound Prospects"
                className="h-9 text-sm"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            {/* Step 2 — CSV upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">2. Upload a CSV</label>
              {parsedFile ? (
                <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{parsedFile.fileName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{parsedFile.leads.length.toLocaleString()} contacts ready to import</p>
                  </div>
                  <button onClick={() => { setParsedFile(null); setFileError(""); }} className="text-muted-foreground hover:text-destructive ml-3">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition-colors text-center",
                    dragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <Upload className="h-6 w-6 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">Drop a CSV here or <span className="text-primary underline underline-offset-2">browse</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Required: first_name, last_name, email, linkedin_url</p>
                </div>
              )}
              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={closeModal} disabled={uploading}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={uploading} className="gap-1.5">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {uploading ? "Saving…" : "Create List"}
              </Button>
            </div>
          </div>
        </div>
      )}


      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-2xl bg-muted/30 text-center">
          <Database className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-sm">
            {lists.length === 0 ? "No saved lists yet" : "No lists match your search"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {lists.length === 0
              ? "Import leads in any campaign and choose \"Save as list\" \u2014 they'll appear here for reuse."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((list) => (
            <div
              key={list.id}
              className="bg-card border rounded-2xl p-5 hover:shadow-sm transition-shadow flex flex-col gap-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-brand-600" />
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleDownload(list)}
                    disabled={downloading === list.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Download CSV"
                  >
                    <Download className={cn("h-3.5 w-3.5", downloading === list.id && "animate-pulse")} />
                  </button>
                  <button
                    onClick={() => handleDelete(list.id)}
                    disabled={deleting === list.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                    title="Delete list"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Name + meta */}
              <div className="flex-1">
                <p className="font-semibold text-sm leading-snug">{list.name}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                    <Users className="h-3 w-3" />
                    {list.lead_count.toLocaleString()} leads
                  </span>
                  {list.source && (
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", SOURCE_COLORS[list.source] ?? "bg-muted text-muted-foreground")}>
                      {SOURCE_LABELS[list.source] ?? list.source}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2">
                  <Calendar className="h-3 w-3" />
                  {formatDate(list.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
