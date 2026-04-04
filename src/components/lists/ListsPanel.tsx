"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Trash2, Download, Calendar, Tag,
  Database, ChevronRight, Search
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

export function ListsPanel({ initialLists }: { initialLists: LeadList[] }) {
  const router = useRouter();
  const [lists, setLists] = useState<LeadList[]>(initialLists);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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
      {/* Search + count */}
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
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-2xl bg-muted/30 text-center">
          <Database className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-sm">
            {lists.length === 0 ? "No saved lists yet" : "No lists match your search"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {lists.length === 0
              ? "Import leads in any campaign and choose "Save as list" — they'll appear here for reuse."
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
