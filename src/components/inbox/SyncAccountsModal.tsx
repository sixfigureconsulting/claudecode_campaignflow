"use client";

import { useState } from "react";
import { X, Mail, Linkedin, MessageCircle, Globe, Plus, CheckCircle2, ChevronRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InboxAccount } from "@/types/database";

// ── Provider config ────────────────────────────────────────────────────────────

type ProviderDef = {
  id: "gmail" | "linkedin" | "manychat" | "form";
  label: string;
  description: string;
  color: string;
  bg: string;
  icon: React.ElementType;
  method: "oauth" | "api_key" | "webhook";
  keyLabel?: string;
  keyPlaceholder?: string;
  keyHint?: string;
};

const PROVIDERS: ProviderDef[] = [
  {
    id: "gmail",
    label: "Gmail",
    description: "Pull conversations from one or more Gmail accounts via OAuth. Reply directly from the inbox.",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    icon: Mail,
    method: "oauth",
  },
  {
    id: "linkedin",
    label: "LinkedIn (HeyReach)",
    description: "Sync LinkedIn DM conversations pulled via your HeyReach integration.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    icon: Linkedin,
    method: "api_key",
    keyLabel: "HeyReach API Key",
    keyPlaceholder: "hr_live_...",
    keyHint: "Uses your existing HeyReach connection to pull LinkedIn DMs.",
  },
  {
    id: "manychat",
    label: "ManyChat (Instagram / Facebook)",
    description: "Sync DM conversations from Instagram & Facebook Messenger via ManyChat.",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    icon: MessageCircle,
    method: "api_key",
    keyLabel: "ManyChat API Key",
    keyPlaceholder: "Bearer ...",
    keyHint: "Found in your ManyChat account under Settings → API.",
  },
  {
    id: "form",
    label: "Website Form",
    description: "Generate a webhook URL to pipe form submissions (Typeform, Tally, custom forms) into your inbox.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    icon: Globe,
    method: "webhook",
  },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onAccountAdded: (account: InboxAccount) => void;
  appUrl: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SyncAccountsModal({ onClose, onAccountAdded, appUrl }: Props) {
  const [step, setStep] = useState<"choose" | "configure">("choose");
  const [selectedProvider, setSelectedProvider] = useState<ProviderDef | null>(null);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);

  function selectProvider(p: ProviderDef) {
    setSelectedProvider(p);
    setLabel(p.label);
    setApiKey("");
    setError("");
    setStep("configure");
  }

  async function handleConnect() {
    if (!selectedProvider) return;
    setError("");
    setSaving(true);

    try {
      if (selectedProvider.method === "oauth") {
        // Redirect to OAuth flow
        window.location.href = `/api/oauth/${selectedProvider.id}?label=${encodeURIComponent(label || selectedProvider.label)}`;
        return;
      }

      const res = await fetch("/api/inbox/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider.id,
          account_label: label || selectedProvider.label,
          api_key: selectedProvider.method === "api_key" ? apiKey : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? json.error ?? "Failed to connect account");
        return;
      }

      // For webhook type, show the generated URL
      if (selectedProvider.method === "webhook" && json.account?.extra_config?.webhook_token) {
        const token = json.account.extra_config.webhook_token;
        setWebhookUrl(`${appUrl}/api/inbox/webhook/${token}`);
        onAccountAdded(json.account);
        return; // stay on modal to show webhook URL
      }

      onAccountAdded(json.account);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function copyWebhook() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-brand-800 bg-brand-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-brand-800">
          <div>
            <h2 className="text-base font-bold text-white">
              {step === "choose" ? "Sync Accounts" : `Connect ${selectedProvider?.label}`}
            </h2>
            <p className="text-xs text-brand-400 mt-0.5">
              {step === "choose"
                ? "Choose a channel to pull conversations into your inbox."
                : "Configure your connection details below."}
            </p>
          </div>
          <button onClick={onClose} className="text-brand-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {/* ── Step 1: Choose provider ───────────────────────────────────── */}
          {step === "choose" && (
            <div className="space-y-2.5">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProvider(p)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-brand-800 hover:border-brand-600 hover:bg-brand-900 transition-all text-left group"
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${p.bg}`}>
                    <p.icon className={`w-4.5 h-4.5 ${p.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{p.label}</p>
                    <p className="text-xs text-brand-400 mt-0.5 leading-relaxed line-clamp-2">{p.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-brand-600 group-hover:text-brand-400 shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: Configure ─────────────────────────────────────────── */}
          {step === "configure" && selectedProvider && (
            <div className="space-y-4">
              {/* Provider badge */}
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${selectedProvider.bg}`}>
                <selectedProvider.icon className={`w-3.5 h-3.5 ${selectedProvider.color}`} />
                <span className="text-xs font-semibold text-white/80">{selectedProvider.label}</span>
              </div>

              {/* Webhook result */}
              {webhookUrl && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-sm font-semibold text-emerald-300">Webhook created!</p>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Paste this URL into your form provider&apos;s webhook settings. Submissions will appear in your inbox automatically.
                  </p>
                  <div className="flex items-center gap-2 bg-brand-900 rounded-lg border border-brand-700 px-3 py-2">
                    <code className="text-xs text-brand-200 flex-1 truncate">{webhookUrl}</code>
                    <button onClick={copyWebhook} className="text-brand-400 hover:text-white transition-colors shrink-0">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={onClose}>
                    Done
                  </Button>
                </div>
              )}

              {!webhookUrl && (
                <>
                  {/* Account label */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-brand-300">Account Label</label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder={`e.g. Work ${selectedProvider.label}`}
                      className="bg-brand-900 border-brand-700 text-white placeholder:text-brand-500 text-sm"
                    />
                    <p className="text-[11px] text-brand-500">
                      Give this connection a name so you can tell it apart from others of the same type.
                    </p>
                  </div>

                  {/* API key field */}
                  {selectedProvider.method === "api_key" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-brand-300">{selectedProvider.keyLabel}</label>
                      <Input
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={selectedProvider.keyPlaceholder}
                        type="password"
                        className="bg-brand-900 border-brand-700 text-white placeholder:text-brand-500 text-sm font-mono"
                      />
                      {selectedProvider.keyHint && (
                        <p className="text-[11px] text-brand-500">{selectedProvider.keyHint}</p>
                      )}
                    </div>
                  )}

                  {/* OAuth info */}
                  {selectedProvider.method === "oauth" && (
                    <div className="rounded-xl border border-brand-800 bg-brand-900 p-4 text-xs text-brand-400 leading-relaxed">
                      Clicking <strong className="text-white">Connect with Google</strong> will open Google&apos;s OAuth screen.
                      CampaignFlow will request read + send access to this Gmail account to sync conversations and let you reply from the inbox.
                    </div>
                  )}

                  {error && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep("choose")}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleConnect}
                      disabled={saving || (selectedProvider.method === "api_key" && !apiKey.trim())}
                      className="flex-1 bg-brand-600 hover:bg-brand-500 text-white"
                    >
                      {saving ? "Connecting…" : selectedProvider.method === "oauth" ? "Connect with Google" : "Save Connection"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Account button (compact) ─────────────────────────────────────────────

export function AddAccountButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-brand-800 transition-all"
    >
      <Plus className="w-3.5 h-3.5" />
      Add account
    </button>
  );
}
