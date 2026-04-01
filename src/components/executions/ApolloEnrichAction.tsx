"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle2, AlertCircle, Building2, Loader2 } from "lucide-react";

export function ApolloEnrichAction({
  projectId,
  hasApiKey,
}: {
  projectId: string;
  hasApiKey: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      setMessage("Please upload a CSV file.");
      setStatus("error");
      return;
    }
    setFile(f);
    setStatus("idle");
    setMessage("");
    setDownloadUrl(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleRun = async () => {
    if (!file) return;

    setStatus("loading");
    setMessage("");
    setDownloadUrl(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);

    const res = await fetch("/api/executions/apollo-enrich", { method: "POST", body: formData });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error ?? "Enrichment failed.");
      setStatus("error");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const fname = `enriched_${file.name}`;

    setDownloadUrl(url);
    setDownloadName(fname);
    setStatus("done");
    setMessage(`Done! Download your enriched CSV below.`);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Apollo Enrich
          </CardTitle>
          {!hasApiKey && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              Apollo key required
            </Badge>
          )}
        </div>
        <CardDescription>
          Upload a CSV with a &quot;Company Name&quot; column. We&apos;ll add website URLs via Apollo.io (up to 50 rows).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasApiKey && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Add your Apollo.io API key in the Integrations tab to use this action.
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-brand-400 bg-brand-50"
              : file
              ? "border-green-400 bg-green-50"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          ) : (
            <div className="space-y-1">
              <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drop CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground/70">Must have a &quot;Company Name&quot; column</p>
            </div>
          )}
        </div>

        {/* Status */}
        {status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enriching... this may take a minute for large files.
          </div>
        )}
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

        <div className="flex gap-2">
          <Button
            variant="gradient"
            className="flex-1"
            disabled={!file || !hasApiKey || status === "loading"}
            loading={status === "loading"}
            onClick={handleRun}
          >
            Run Enrichment
          </Button>

          {downloadUrl && (
            <a href={downloadUrl} download={downloadName}>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
