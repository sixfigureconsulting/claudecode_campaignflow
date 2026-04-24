"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Shield, Trash2, ChevronDown, ChevronUp, Phone, MessageCircle, AlertCircle } from "lucide-react";

type ServiceConfig = { service: string; masked_key: string; updated_at: string };

// ── Logo component ────────────────────────────────────────────────────────────
// Uses Simple Icons CDN (jsdelivr) for well-known brands, falls back to colored initials

type LogoDef =
  | { type: "si"; slug: string; bg: string }        // Simple Icons
  | { type: "img"; url: string; bg: string }         // Direct image URL
  | { type: "initials"; initials: string; bg: string }; // Colored text

function ServiceLogo({ logo, name }: { logo: LogoDef; name: string }) {
  const [failed, setFailed] = useState(false);

  const Fallback = () => (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0"
      style={{ background: logo.bg }}
    >
      {logo.type === "initials" ? logo.initials : name.slice(0, 2).toUpperCase()}
    </div>
  );

  if (logo.type === "initials" || failed) return <Fallback />;

  const src =
    logo.type === "si"
      ? `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${logo.slug}.svg`
      : logo.url;

  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 p-2.5"
      style={{ background: logo.bg }}
    >
      <img
        src={src}
        alt={name}
        className="w-full h-full object-contain"
        style={{ filter: "brightness(0) invert(1)" }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ── Service metadata ──────────────────────────────────────────────────────────

type FieldDef = { key: string; label: string; placeholder: string; required: boolean; secret?: boolean };

type ServiceMeta = {
  label: string;
  description: string;
  usedIn: string;
  logo: LogoDef;
  fields: FieldDef[];   // single-field services have exactly 1 field with key "api_key"
  multiField?: boolean; // true → JSON-encode all fields into one encrypted blob
};

const INTEGRATIONS: Record<string, ServiceMeta> = {
  // ── Lead sourcing ──────────────────────────────────────────────────────────
  apollo: {
    label: "Apollo.io", usedIn: "Lead sourcing",
    description: "Pull contacts from Apollo saved lists and enrich company data.",
    logo: { type: "initials", initials: "AP", bg: "#3b55e6" },
    fields: [{ key: "api_key", label: "API Key", placeholder: "rXwioODN...", required: true, secret: true }],
  },
  apify: {
    label: "Apify", usedIn: "Lead sourcing",
    description: "Scrape LinkedIn profiles, company directories, and websites via Apify actors.",
    logo: { type: "initials", initials: "AP", bg: "#ff9012" },
    fields: [{ key: "api_key", label: "API Key", placeholder: "apify_api_...", required: true, secret: false }],
  },
  hunter: {
    label: "Hunter.io", usedIn: "Lead sourcing",
    description: "Find verified email addresses at any company domain instantly.",
    logo: { type: "initials", initials: "H", bg: "#e53835" },
    fields: [{ key: "api_key", label: "API Key", placeholder: "abc1234def...", required: true, secret: true }],
  },
  phantombuster: {
    label: "PhantomBuster", usedIn: "Lead sourcing",
    description: "Automate LinkedIn scraping, email finding, and more. Works with any phantom you've built.",
    logo: { type: "initials", initials: "PB", bg: "#7c3aed" },
    fields: [{ key: "api_key", label: "API Key", placeholder: "your-phantombuster-api-key", required: true, secret: true }],
  },

  // ── AI ─────────────────────────────────────────────────────────────────────
  openai: {
    label: "OpenAI", usedIn: "AI",
    description: "Qualify leads against your ICP and generate personalised outreach sequences.",
    logo: { type: "si", slug: "openai", bg: "#000000" },
    fields: [{ key: "api_key", label: "API Key", placeholder: "sk-proj-...", required: true, secret: true }],
  },

  // ── Outreach ───────────────────────────────────────────────────────────────
  heyreach: {
    label: "Heyreach", usedIn: "LinkedIn outreach",
    description: "Push LinkedIn sequences directly into Heyreach campaigns.",
    logo: { type: "initials", initials: "HR", bg: "#6c47ff" },
    fields: [{ key: "api_key", label: "API Key", placeholder: "RwIHySyS...", required: true, secret: true }],
  },
  instantly: {
    label: "Instantly.ai", usedIn: "Email outreach",
    description: "Check duplicates, push email sequences, and sync campaign analytics.",
    logo: { type: "initials", initials: "IN", bg: "#111827" },
    fields: [{ key: "api_key", label: "API Key", placeholder: "MmIwMTA4...", required: true, secret: true }],
  },
  smartlead: {
    label: "Smartlead", usedIn: "Email outreach",
    description: "Push leads into Smartlead cold email campaigns and sync analytics.",
    logo: { type: "initials", initials: "SL", bg: "#16a34a" },
    multiField: true,
    fields: [
      { key: "api_key",     label: "API Key",     placeholder: "sl_live_...",  required: true,  secret: true },
      { key: "campaign_id", label: "Campaign ID", placeholder: "12345",        required: true },
    ],
  },
  lemlist: {
    label: "Lemlist", usedIn: "Email outreach",
    description: "Push leads into Lemlist multichannel sequences.",
    logo: { type: "initials", initials: "LL", bg: "#6366f1" },
    multiField: true,
    fields: [
      { key: "api_key",     label: "API Key",     placeholder: "lem_...",      required: true,  secret: true },
      { key: "campaign_id", label: "Campaign ID", placeholder: "cam_abc...",   required: true },
    ],
  },

  // ── CRM ────────────────────────────────────────────────────────────────────
  hubspot: {
    label: "HubSpot", usedIn: "CRM",
    description: "Pull contacts from lists, check duplicates, and push qualified leads to your CRM.",
    logo: { type: "si", slug: "hubspot", bg: "#ff7a59" },
    fields: [{ key: "api_key", label: "Private App Token", placeholder: "pat-eu1-...", required: true, secret: true }],
  },
  outboundsync: {
    label: "OutboundSync", usedIn: "CRM Sync",
    description: "Pipe replies, bounces, and unsubscribes from Instantly/Smartlead/Heyreach into your CRM (HubSpot, Salesforce, Close). Paste your per-SEP webhook URL from your OutboundSync workspace — we auto-register it on campaign launch. Prospect replies from the unified inbox are forwarded to the generic URL with an HMAC-SHA256 signature.",
    logo: { type: "initials", initials: "OS", bg: "#0f766e" },
    multiField: true,
    fields: [
      { key: "signing_secret",        label: "HMAC Signing Secret",     placeholder: "any-random-string-32+chars", required: true, secret: true },
      { key: "instantly_webhook_url", label: "Instantly Webhook URL",   placeholder: "https://hooks.outboundsync.com/instantly/...", required: false },
      { key: "smartlead_webhook_url", label: "Smartlead Webhook URL",   placeholder: "https://hooks.outboundsync.com/smartlead/...", required: false },
      { key: "heyreach_webhook_url",  label: "Heyreach Webhook URL",    placeholder: "https://hooks.outboundsync.com/heyreach/...",  required: false },
      { key: "generic_webhook_url",   label: "Generic (CampaignFlow) Webhook URL", placeholder: "https://hooks.outboundsync.com/generic/...", required: false },
    ],
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  slack: {
    label: "Slack", usedIn: "Notifications",
    description: "Post weekly campaign performance reports to a Slack channel automatically.",
    logo: { type: "si", slug: "slack", bg: "#4a154b" },
    fields: [{ key: "api_key", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/...", required: true, secret: false }],
  },
};

const CALLING_PLATFORMS: Record<string, ServiceMeta> = {
  retell: {
    label: "Retell AI", usedIn: "Cold Call",
    description: "AI voice agents for outbound calls. Leads dispatched via Retell in Step 5.",
    logo: { type: "initials", initials: "RE", bg: "#7c3aed" },
    multiField: true,
    fields: [
      { key: "api_key",     label: "API Key",     placeholder: "key_...",      required: true,  secret: true },
      { key: "agent_id",    label: "Agent ID",    placeholder: "agent_...",    required: true },
      { key: "from_number", label: "From Number", placeholder: "+14157774444", required: true },
    ],
  },
  vapi: {
    label: "VAPI", usedIn: "Cold Call",
    description: "Voice AI agents. Requires a phone number and assistant configured in VAPI.",
    logo: { type: "initials", initials: "VA", bg: "#1d4ed8" },
    multiField: true,
    fields: [
      { key: "api_key",         label: "API Key",         placeholder: "vapi_...",   required: true,  secret: true },
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "pn_...",     required: true },
      { key: "assistant_id",    label: "Assistant ID",    placeholder: "ast_...",    required: true },
    ],
  },
  bland: {
    label: "Bland AI", usedIn: "Cold Call",
    description: "Scalable AI phone calls at any volume. Batch dispatch with one API call.",
    logo: { type: "initials", initials: "BL", bg: "#15803d" },
    multiField: true,
    fields: [
      { key: "api_key",     label: "API Key",                 placeholder: "sk-...",       required: true,  secret: true },
      { key: "from_number", label: "From Number (optional)",  placeholder: "+14157774444", required: false },
      { key: "pathway_id",  label: "Pathway ID (optional)",   placeholder: "path_...",     required: false },
    ],
  },
  synthflow: {
    label: "Synthflow AI", usedIn: "Cold Call",
    description: "No-code AI calling platform. Create an agent in Synthflow and paste its Model ID.",
    logo: { type: "initials", initials: "SF", bg: "#0d9488" },
    multiField: true,
    fields: [
      { key: "api_key",  label: "API Key",              placeholder: "sfai_...",    required: true, secret: true },
      { key: "agent_id", label: "Model ID (Agent ID)",  placeholder: "model_...",   required: true },
    ],
  },
  air: {
    label: "Air AI", usedIn: "Cold Call",
    description: "Autonomous AI sales calls with human-like conversation via REST API.",
    logo: { type: "initials", initials: "AI", bg: "#0369a1" },
    multiField: true,
    fields: [
      { key: "api_key",  label: "API Key",  placeholder: "air_...",    required: true, secret: true },
      { key: "agent_id", label: "Agent ID", placeholder: "agent_...",  required: true },
    ],
  },
  twilio: {
    label: "Twilio", usedIn: "Cold Call",
    description: "Programmable voice calls. Requires a TwiML URL that handles the call script.",
    logo: { type: "si", slug: "twilio", bg: "#f22f46" },
    multiField: true,
    fields: [
      { key: "account_sid", label: "Account SID",  placeholder: "ACxxxx...",                required: true },
      { key: "auth_token",  label: "Auth Token",   placeholder: "your_auth_token",          required: true, secret: true },
      { key: "from_number", label: "From Number",  placeholder: "+14157774444",             required: true },
      { key: "twiml_url",   label: "TwiML URL",    placeholder: "https://yourapp.com/twiml", required: true },
    ],
  },
};

// ── Card component ────────────────────────────────────────────────────────────

function IntegrationCard({
  serviceId,
  meta,
  existing,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  serviceId: string;
  meta: ServiceMeta;
  existing?: ServiceConfig;
  onSave: (id: string, payload: Record<string, string>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving: boolean;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(meta.fields.map((f) => [f.key, ""]))
  );
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const connected = !!existing;

  const handleSave = async () => {
    const missing = meta.fields.filter((f) => f.required && !fields[f.key]?.trim());
    if (missing.length > 0) {
      setFeedback({ type: "error", msg: `Required: ${missing.map((m) => m.label).join(", ")}` });
      return;
    }
    setFeedback(null);
    const payload: Record<string, string> = {};
    for (const f of meta.fields) {
      if (fields[f.key]?.trim()) payload[f.key] = fields[f.key].trim();
    }
    await onSave(serviceId, payload);
    setFeedback({ type: "success", msg: "Saved!" });
    setFields(Object.fromEntries(meta.fields.map((f) => [f.key, ""])));
    setTimeout(() => setExpanded(false), 800);
  };

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-shadow ${expanded ? "shadow-md border-brand-200" : "hover:shadow-sm"}`}>
      {/* Card header */}
      <div className="flex items-start gap-4 p-6">
        <ServiceLogo logo={meta.logo} name={meta.label} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm">{meta.label}</span>
            {connected && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Connected
              </span>
            )}
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {meta.usedIn}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {connected && !expanded && (
            <button
              onClick={() => onDelete(serviceId)}
              disabled={deleting}
              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-muted"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              connected
                ? "border-border text-muted-foreground hover:bg-muted"
                : "border-brand-500 text-brand-600 bg-brand-50 hover:bg-brand-100"
            }`}
          >
            {connected ? "Manage" : "Connect"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t border-border bg-muted/30 px-5 py-4 space-y-3">
          {connected && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              <span>Currently connected — enter new values below to update</span>
              {existing && <span className="ml-auto">Updated {new Date(existing.updated_at).toLocaleDateString()}</span>}
            </div>
          )}
          {feedback && (
            <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 ${
              feedback.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"
            }`}>
              {feedback.msg}
            </div>
          )}
          <div className="space-y-2">
            {meta.fields.map((field) => (
              <div key={field.key}>
                {meta.fields.length > 1 && (
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                  </label>
                )}
                <Input
                  type={field.secret ? "password" : "text"}
                  placeholder={connected ? `${field.label} — enter to replace` : field.placeholder}
                  className="text-sm h-9 bg-white"
                  value={fields[field.key] ?? ""}
                  onChange={(e) => setFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="gradient" className="flex-1 h-9" onClick={handleSave} disabled={saving} loading={saving}>
              {connected ? "Update" : "Save & Connect"}
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

// ── OAuth connection card ──────────────────────────────────────────────────────

interface OAuthConnection {
  platform: string;
  platform_username?: string | null;
}

function OAuthCard({
  platform,
  label,
  icon,
  description,
  connection,
  connectUrl,
  onDisconnect,
}: {
  platform: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  connection?: OAuthConnection | null;
  connectUrl: string;
  onDisconnect: (platform: string) => void;
}) {
  const connected = !!connection;

  return (
    <div className="bg-white border rounded-2xl p-6 flex items-start gap-4">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-orange-500/10 text-orange-500 border border-orange-200 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-sm">{label}</span>
          {connected && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {connection.platform_username ? `u/${connection.platform_username}` : "Connected"}
            </span>
          )}
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Social DM Outreach
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0">
        {connected ? (
          <button
            onClick={() => onDisconnect(platform)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-lg hover:bg-muted border border-border"
          >
            Disconnect
          </button>
        ) : (
          <a
            href={connectUrl}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            Connect →
          </a>
        )}
      </div>
    </div>
  );
}

export function GlobalIntegrationsForm({ existingConfigs }: { existingConfigs: ServiceConfig[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [oauthConnections, setOauthConnections] = useState<OAuthConnection[]>([]);
  const [oauthMsg, setOauthMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load OAuth connections
  useEffect(() => {
    fetch("/api/oauth/connections")
      .then((r) => r.json())
      .then((d) => setOauthConnections(d.connections ?? []))
      .catch(() => {});
  }, []);

  // Handle OAuth callback results
  useEffect(() => {
    const redditResult  = searchParams.get("reddit_oauth");
    const twitterResult = searchParams.get("twitter_oauth");
    const username = searchParams.get("username");

    if (redditResult === "success") {
      setOauthMsg({ type: "success", text: `Reddit connected${username ? ` as u/${username}` : ""}!` });
      fetch("/api/oauth/connections")
        .then((r) => r.json())
        .then((d) => setOauthConnections(d.connections ?? []))
        .catch(() => {});
    } else if (redditResult === "denied") {
      setOauthMsg({ type: "error", text: "Reddit connection cancelled." });
    } else if (redditResult === "error") {
      setOauthMsg({ type: "error", text: "Reddit connection failed. Please try again." });
    } else if (twitterResult === "success") {
      setOauthMsg({ type: "success", text: `Twitter/X connected${username ? ` as @${username}` : ""}!` });
      fetch("/api/oauth/connections")
        .then((r) => r.json())
        .then((d) => setOauthConnections(d.connections ?? []))
        .catch(() => {});
    } else if (twitterResult === "denied") {
      setOauthMsg({ type: "error", text: "Twitter/X connection cancelled." });
    } else if (twitterResult === "error") {
      setOauthMsg({ type: "error", text: "Twitter/X connection failed. Please try again." });
    }
  }, [searchParams]);

  const handleDisconnectOAuth = async (platform: string) => {
    await fetch(`/api/oauth/connections?platform=${platform}`, { method: "DELETE" });
    setOauthConnections((prev) => prev.filter((c) => c.platform !== platform));
  };

  const getExisting = (service: string) => existingConfigs.find((c) => c.service === service);

  const handleSave = async (serviceId: string, payload: Record<string, string>) => {
    setSaving(serviceId);
    const meta = INTEGRATIONS[serviceId] ?? CALLING_PLATFORMS[serviceId];
    const isSingleField = !meta?.multiField && Object.keys(payload).length === 1;
    const api_key = isSingleField ? payload.api_key : JSON.stringify(payload);

    await fetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: serviceId, api_key }),
    });
    setSaving(null);
    router.refresh();
  };

  const handleDelete = async (serviceId: string) => {
    setDeleting(serviceId);
    await fetch(`/api/settings/integrations?service=${serviceId}`, { method: "DELETE" });
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* Encryption notice */}
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground border border-border">
        <Shield className="h-4 w-4 shrink-0 text-green-600" />
        All API keys are encrypted with AES-256 before storage and never exposed in API responses.
      </div>

      {/* ── Standard integrations ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Integrations</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(INTEGRATIONS).map(([id, meta]) => (
            <IntegrationCard
              key={id}
              serviceId={id}
              meta={meta}
              existing={getExisting(id)}
              onSave={handleSave}
              onDelete={handleDelete}
              saving={saving === id}
              deleting={deleting === id}
            />
          ))}
        </div>
      </div>

      {/* ── Social OAuth connections ───────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Social Accounts</h3>
          <Badge variant="outline" className="text-xs">Social DM campaigns</Badge>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Connect social accounts to send DMs directly from CampaignFlow. Tokens are stored encrypted.
        </p>
        {oauthMsg && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${oauthMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {oauthMsg.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
            {oauthMsg.text}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <OAuthCard
            platform="reddit"
            label="Reddit"
            icon={<MessageCircle className="w-5 h-5" />}
            description="Connect your Reddit account to send private messages to prospects directly from social campaigns."
            connection={oauthConnections.find((c) => c.platform === "reddit")}
            connectUrl="/api/oauth/reddit"
            onDisconnect={handleDisconnectOAuth}
          />
          <OAuthCard
            platform="twitter"
            label="Twitter / X"
            icon={<MessageCircle className="w-5 h-5" />}
            description="Connect your Twitter/X account to send DMs to prospects from social campaigns."
            connection={oauthConnections.find((c) => c.platform === "twitter")}
            connectUrl="/api/oauth/twitter"
            onDisconnect={handleDisconnectOAuth}
          />
          <IntegrationCard
            serviceId="manychat"
            meta={{
              label: "ManyChat",
              description: "Connect your ManyChat account to send Instagram and Facebook DMs to prospects. Requires an active ManyChat account linked to your IG Business page.",
              usedIn: "Instagram / Facebook outreach",
              logo: { type: "initials", initials: "MC", bg: "#00aff0" },
              fields: [{ key: "api_key", label: "API Key", placeholder: "your-manychat-api-key", required: true, secret: true }],
            }}
            existing={getExisting("manychat")}
            onSave={handleSave}
            onDelete={handleDelete}
            saving={saving === "manychat"}
            deleting={deleting === "manychat"}
          />
        </div>
      </div>

      {/* ── Calling platforms ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Calling Platforms</h3>
          <Badge variant="outline" className="text-xs">Cold Call campaigns · Step 5</Badge>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Configure your AI calling platform. Leads with phone numbers are dispatched here in Step 5.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Object.entries(CALLING_PLATFORMS).map(([id, meta]) => (
            <IntegrationCard
              key={id}
              serviceId={id}
              meta={meta}
              existing={getExisting(id)}
              onSave={handleSave}
              onDelete={handleDelete}
              saving={saving === id}
              deleting={deleting === id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
