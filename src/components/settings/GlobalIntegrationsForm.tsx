"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Key, CheckCircle2, Shield, Trash2 } from "lucide-react";

type ServiceConfig = {
  service: string;
  masked_key: string;
  updated_at: string;
};

const SERVICE_META = {
  apollo: {
    label: "Apollo.io",
    description: "Pull leads from your Apollo saved lists and enrich company data.",
    placeholder: "rXwioODN...",
    usedIn: "Lead sourcing",
  },
  apify: {
    label: "Apify",
    description: "Scrape leads from LinkedIn and other sources via Apify actors.",
    placeholder: "apify_api_...",
    usedIn: "Lead sourcing",
  },
  openai: {
    label: "OpenAI",
    description: "Qualify leads against your ICP and generate outreach sequences.",
    placeholder: "sk-proj-...",
    usedIn: "AI qualification & sequences",
  },
  heyreach: {
    label: "Heyreach",
    description: "Push LinkedIn sequences directly to Heyreach campaigns.",
    placeholder: "RwIHySyS...",
    usedIn: "LinkedIn outreach",
  },
  instantly: {
    label: "Instantly.ai",
    description: "Check duplicates and push email sequences to Instantly campaigns.",
    placeholder: "MmIwMTA4...",
    usedIn: "Email outreach",
  },
  hubspot: {
    label: "HubSpot",
    description: "Check existing contacts and push qualified leads to your CRM.",
    placeholder: "pat-eu1-...",
    usedIn: "CRM sync",
  },
  slack: {
    label: "Slack Webhook",
    description: "Post weekly campaign reports to a Slack channel automatically.",
    placeholder: "https://hooks.slack.com/services/...",
    usedIn: "Notifications",
  },
} as const;

const PLAIN_TEXT_SERVICES = new Set(["slack", "apify"]);
type ServiceKey = keyof typeof SERVICE_META;

export function GlobalIntegrationsForm({ existingConfigs }: { existingConfigs: ServiceConfig[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>(
    Object.fromEntries(Object.keys(SERVICE_META).map((s) => [s, ""]))
  );
  const [feedback, setFeedback] = useState<Record<string, { type: "success" | "error"; msg: string }>>({});

  const getExisting = (service: string) => existingConfigs.find((c) => c.service === service);

  const handleSave = async (service: ServiceKey) => {
    const key = keys[service]?.trim();
    if (!key) return;
    setSaving(service);
    setFeedback((f) => ({ ...f, [service]: undefined as any }));

    const res = await fetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service, api_key: key }),
    });

    const json = await res.json();
    setSaving(null);

    if (res.ok) {
      setFeedback((f) => ({ ...f, [service]: { type: "success", msg: "Saved successfully" } }));
      setKeys((k) => ({ ...k, [service]: "" }));
      router.refresh();
    } else {
      setFeedback((f) => ({ ...f, [service]: { type: "error", msg: json.error ?? "Failed to save" } }));
    }
  };

  const handleDelete = async (service: string) => {
    setDeleting(service);
    await fetch(`/api/settings/integrations?service=${service}`, { method: "DELETE" });
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <Shield className="h-4 w-4 shrink-0" />
        All keys are encrypted with AES-256 before storage and never exposed in responses.
      </div>

      {(Object.keys(SERVICE_META) as ServiceKey[]).map((service) => {
        const meta = SERVICE_META[service];
        const existing = getExisting(service);
        const fb = feedback[service];

        return (
          <Card key={service}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {meta.label}
                  {existing && (
                    <Badge variant="secondary" className="text-xs font-normal gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Connected
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                    {meta.usedIn}
                  </Badge>
                </CardTitle>
                {existing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive h-8 px-2"
                    onClick={() => handleDelete(service)}
                    disabled={deleting === service}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <CardDescription>{meta.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {existing && (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                  <code>{existing.masked_key}</code>
                  <span className="ml-auto">Updated {new Date(existing.updated_at).toLocaleDateString()}</span>
                </div>
              )}
              {fb && (
                <div className={`text-xs p-2 rounded flex items-center gap-1.5 ${
                  fb.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {fb.msg}
                </div>
              )}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type={PLAIN_TEXT_SERVICES.has(service) ? "text" : "password"}
                    placeholder={existing ? "Enter new value to replace..." : meta.placeholder}
                    className="pl-8 text-sm h-9"
                    value={keys[service]}
                    onChange={(e) => setKeys((k) => ({ ...k, [service]: e.target.value }))}
                  />
                </div>
                <Button
                  size="sm"
                  variant="gradient"
                  className="h-9 px-4"
                  onClick={() => handleSave(service)}
                  disabled={!keys[service]?.trim() || saving === service}
                  loading={saving === service}
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
