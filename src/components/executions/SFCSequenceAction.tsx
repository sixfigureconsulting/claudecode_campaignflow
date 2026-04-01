"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertCircle, Loader2, Zap, Linkedin, Mail, Phone } from "lucide-react";

const STEP_META = [
  { icon: Linkedin, label: "LinkedIn DM #1", day: "Day 1" },
  { icon: Linkedin, label: "LinkedIn Follow-up", day: "Day 3" },
  { icon: Mail, label: "Cold Email #1", day: "Day 5" },
  { icon: Mail, label: "Email Follow-up", day: "Day 8" },
  { icon: Phone, label: "VAPI Call Script", day: "Day 12" },
];

type LeadResult = {
  lead: string;
  status?: string;
  sequence: Record<string, { subject: string | null; body: string }> | null;
  heyreach?: { success: boolean; message: string };
  instantly?: { success: boolean; message: string };
};

export function SFCSequenceAction({
  projectId,
  hasAnthropicKey,
  hasHeyreachKey,
  hasInstantlyKey,
}: {
  projectId: string;
  hasAnthropicKey: boolean;
  hasHeyreachKey: boolean;
  hasInstantlyKey: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [summary, setSummary] = useState<string>("");
  const [results, setResults] = useState<LeadResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      setSummary("Please upload a CSV file.");
      setStatus("error");
      return;
    }
    setFile(f);
    setStatus("idle");
    setSummary("");
    setResults([]);
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
    setSummary("");
    setResults([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);

    const res = await fetch("/api/executions/sfc-sequence", { method: "POST", body: formData });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSummary(json.error ?? "Failed to generate sequences.");
      setStatus("error");
      return;
    }

    setSummary(json.summary ?? "Done.");
    setResults(json.results ?? []);
    setStatus("done");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            SFC Sequence Builder
          </CardTitle>
          <div className="flex gap-1">
            {hasHeyreachKey && <Badge variant="secondary" className="text-xs">Heyreach</Badge>}
            {hasInstantlyKey && <Badge variant="secondary" className="text-xs">Instantly</Badge>}
          </div>
        </div>
        <CardDescription>
          Upload a CSV of warm leads (first_name, last_name, email, company, title, linkedin_url, previous_reply).
          Generates 5-step re-engagement sequences and pushes to configured channels. Max 10 leads.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAnthropicKey && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Add your Anthropic API key in Settings → AI Configuration to use this action.
          </div>
        )}

        {/* Channel indicators */}
        <div className="flex gap-2 text-xs text-muted-foreground">
          <div className={`flex items-center gap-1 px-2 py-1 rounded border ${hasHeyreachKey ? "border-blue-200 bg-blue-50 text-blue-700" : "border-dashed"}`}>
            <Linkedin className="h-3 w-3" />
            Heyreach {hasHeyreachKey ? "✓" : "(not configured)"}
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded border ${hasInstantlyKey ? "border-purple-200 bg-purple-50 text-purple-700" : "border-dashed"}`}>
            <Mail className="h-3 w-3" />
            Instantly {hasInstantlyKey ? "✓" : "(not configured)"}
          </div>
        </div>

        {/* Step preview */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STEP_META.map((step, i) => (
            <div key={i} className="flex-shrink-0 text-center px-3 py-2 bg-muted/50 rounded-lg text-xs">
              <step.icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
              <div className="font-medium">{step.day}</div>
              <div className="text-muted-foreground">{step.label}</div>
            </div>
          ))}
        </div>

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
              <p className="text-xs text-muted-foreground/70">first_name, last_name, email, company, title, linkedin_url</p>
            </div>
          )}
        </div>

        {/* Status */}
        {status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating sequences with Claude... this may take up to a minute.
          </div>
        )}
        {status === "done" && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {summary}
          </div>
        )}
        {status === "error" && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {summary}
          </div>
        )}

        <Button
          variant="gradient"
          className="w-full"
          disabled={!file || !hasAnthropicKey || status === "loading"}
          loading={status === "loading"}
          onClick={handleRun}
        >
          Generate + Push Sequences
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2 mt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Results</p>
            {results.map((r, i) => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                  onClick={() => setExpanded(expanded === r.lead ? null : r.lead)}
                >
                  <span className="font-medium">{r.lead || `Lead ${i + 1}`}</span>
                  <div className="flex items-center gap-2">
                    {r.heyreach && (
                      <Badge variant={r.heyreach.success ? "secondary" : "outline"} className="text-xs">
                        {r.heyreach.success ? "✓ HeyReach" : "✗ HeyReach"}
                      </Badge>
                    )}
                    {r.instantly && (
                      <Badge variant={r.instantly.success ? "secondary" : "outline"} className="text-xs">
                        {r.instantly.success ? "✓ Instantly" : "✗ Instantly"}
                      </Badge>
                    )}
                    {r.sequence ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </div>
                </button>

                {expanded === r.lead && r.sequence && (
                  <div className="border-t divide-y text-xs">
                    {STEP_META.map((step, si) => {
                      const key = `step${si + 1}`;
                      const s = r.sequence![key];
                      if (!s) return null;
                      return (
                        <div key={si} className="px-3 py-2 space-y-1">
                          <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                            <step.icon className="h-3 w-3" />
                            {step.label} · {step.day}
                          </div>
                          {s.subject && <div className="font-medium">Subject: {s.subject}</div>}
                          <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{s.body}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
