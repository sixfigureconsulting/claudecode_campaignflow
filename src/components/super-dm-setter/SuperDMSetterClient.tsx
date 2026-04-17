"use client";

import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import {
  Zap,
  Phone,
  MessageSquare,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Mic,
  Video,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  X,
  ImageIcon,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  ArrowDown,
  Flame,
  Rocket,
} from "lucide-react";
import { CampaignWizard } from "@/components/social/CampaignWizard";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Industry = "real_estate" | "high_ticket" | "dm_sales" | "agency" | "coaching" | "saas" | "other";
type Channel = "linkedin" | "instagram" | "sms" | "whatsapp" | "twitter" | "facebook" | "email";
type MessageType = "opener" | "pain_point" | "poke_the_bear" | "pitch" | "followup" | "urgency" | "objection" | "book_appt";
type Tone = "professional" | "casual" | "direct" | "empathetic" | "urgency";
type TempLevel = "cold" | "warm" | "hot" | "fire";
type Provider = "anthropic" | "openai";
type InputMode = "paste" | "screenshot" | "csv";

interface DMMessage { rank: number; message: string; strategy: string; why_it_works: string; conversion_probability: "high" | "medium" | "low"; }
interface DMResult { temperature: TempLevel; temperature_score: number; temperature_reason: string; suggest_call: boolean; call_reason: string; call_action: "call" | "voice_note" | "video_loom"; messages: DMMessage[]; }
interface CsvLead { name?: string; company?: string; role?: string; recent_activity?: string; url?: string; notes?: string; [key: string]: string | undefined; }
interface CsvResult { lead: CsvLead; opener: string; strategy: string; loading: boolean; error?: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { value: "real_estate" as Industry, label: "Real Estate", emoji: "🏠" },
  { value: "high_ticket" as Industry, label: "High-Ticket Sales", emoji: "💎" },
  { value: "dm_sales" as Industry, label: "DM Sales", emoji: "📲" },
  { value: "agency" as Industry, label: "Agency Services", emoji: "🏢" },
  { value: "coaching" as Industry, label: "Coaching / Consulting", emoji: "🎯" },
  { value: "saas" as Industry, label: "SaaS", emoji: "⚡" },
  { value: "other" as Industry, label: "Other", emoji: "✦" },
];

const CHANNELS = [
  { value: "linkedin" as Channel, label: "LinkedIn DM", emoji: "💼", limit: "3–5 sentences" },
  { value: "instagram" as Channel, label: "Instagram DM", emoji: "📸", limit: "1–3 sentences" },
  { value: "sms" as Channel, label: "SMS", emoji: "💬", limit: "1–2 sentences" },
  { value: "whatsapp" as Channel, label: "WhatsApp", emoji: "📱", limit: "1–2 sentences" },
  { value: "twitter" as Channel, label: "Twitter / X DM", emoji: "🐦", limit: "1 sentence" },
  { value: "facebook" as Channel, label: "Facebook DM", emoji: "👥", limit: "2–3 sentences" },
  { value: "email" as Channel, label: "Cold Email", emoji: "✉️", limit: "4 sentences max" },
];

const MESSAGE_TYPES = [
  { value: "opener" as MessageType,       label: "Opener",           desc: "Pattern interrupt",          active: "bg-violet-500/25 border-violet-400/60 shadow-[0_0_24px_rgba(139,92,246,0.35)]",  icon: "⚡", text: "text-violet-300"  },
  { value: "pain_point" as MessageType,   label: "Discover Pain",    desc: "Uncover core problem",        active: "bg-blue-500/25 border-blue-400/60 shadow-[0_0_24px_rgba(59,130,246,0.35)]",     icon: "🔍", text: "text-blue-300"    },
  { value: "poke_the_bear" as MessageType,label: "Poke the Bear",    desc: "Stir pain, create urgency",   active: "bg-amber-500/25 border-amber-400/60 shadow-[0_0_24px_rgba(245,158,11,0.35)]",   icon: "🐻", text: "text-amber-300"   },
  { value: "pitch" as MessageType,        label: "Pitch Offer",      desc: "Introduce with context",      active: "bg-emerald-500/25 border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.35)]",icon: "🎯", text: "text-emerald-300" },
  { value: "objection" as MessageType,    label: "Handle Objection", desc: "Reframe and bridge",          active: "bg-yellow-500/25 border-yellow-400/60 shadow-[0_0_24px_rgba(234,179,8,0.35)]",   icon: "🛡️", text: "text-yellow-300"  },
  { value: "followup" as MessageType,     label: "Follow-Up",        desc: "Re-engage a ghost",           active: "bg-sky-500/25 border-sky-400/60 shadow-[0_0_24px_rgba(14,165,233,0.35)]",       icon: "🔄", text: "text-sky-300"     },
  { value: "urgency" as MessageType,      label: "Urgency Close",    desc: "Drive action with scarcity",  active: "bg-red-500/25 border-red-400/60 shadow-[0_0_24px_rgba(239,68,68,0.35)]",        icon: "🔥", text: "text-red-300"     },
  { value: "book_appt" as MessageType,    label: "Book Appointment", desc: "Push for calendar link",      active: "bg-teal-500/25 border-teal-400/60 shadow-[0_0_24px_rgba(20,184,166,0.35)]",    icon: "📅", text: "text-teal-300"    },
];

const TONES = [
  { value: "professional" as Tone, label: "Professional" },
  { value: "casual" as Tone,       label: "Casual" },
  { value: "direct" as Tone,       label: "Direct & Bold" },
  { value: "empathetic" as Tone,   label: "Empathetic" },
  { value: "urgency" as Tone,      label: "Urgency-Driven" },
];

const TEMP_CONFIG: Record<TempLevel, { label: string; badge: string; bar: string; cardBg: string; glow: string }> = {
  cold: { label: "Cold",      badge: "bg-blue-500/20 text-blue-300 border-blue-400/40",    bar: "bg-gradient-to-r from-blue-600 to-blue-400",            cardBg: "bg-blue-950/40 border-blue-500/20",   glow: "" },
  warm: { label: "Warm 🌡️",  badge: "bg-amber-500/20 text-amber-300 border-amber-400/40", bar: "bg-gradient-to-r from-amber-500 to-yellow-400",         cardBg: "bg-amber-950/40 border-amber-500/20", glow: "" },
  hot:  { label: "Hot 🔥",   badge: "bg-orange-500/20 text-orange-300 border-orange-400/40",bar: "bg-gradient-to-r from-orange-500 to-amber-400",        cardBg: "bg-orange-950/40 border-orange-500/30",glow: "shadow-[0_0_40px_rgba(249,115,22,0.15)]" },
  fire: { label: "FIRE 🔥🔥", badge: "bg-red-500/20 text-red-300 border-red-400/40",      bar: "bg-gradient-to-r from-red-500 via-orange-500 to-amber-400",cardBg: "bg-red-950/40 border-red-500/30",    glow: "shadow-[0_0_50px_rgba(239,68,68,0.2)]"  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all", done ? "bg-emerald-500/20 border border-emerald-400/50 text-emerald-400" : "bg-violet-500/20 border border-violet-400/50 text-violet-300")}>
      {done ? <CheckCircle2 className="w-4 h-4" /> : n}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex-shrink-0",
        copied ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border-white/10")}>
      {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
    </button>
  );
}

function HeatMeter({ score, level }: { score: number; level: TempLevel }) {
  const cfg = TEMP_CONFIG[level];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest uppercase text-white/40">Conversation Temperature</span>
        <span className={cn("text-xs font-bold px-3 py-1 rounded-full border", cfg.badge)}>{cfg.label} · {score}/100</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700 relative", cfg.bar)} style={{ width: `${score}%` }}>
          <div className="absolute inset-0 bg-white/20 rounded-full" />
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-white/20 font-medium">
        <span>❄️ Cold</span><span>🌡️ Warm</span><span>🔥 Hot</span><span>💥 Fire</span>
      </div>
    </div>
  );
}

function CallBanner({ callAction, callReason, onDismiss }: { callAction: string; callReason: string; onDismiss: () => void }) {
  const cfg: Record<string, { icon: React.ReactNode; label: string; sub: string }> = {
    call:       { icon: <Phone className="w-5 h-5" />, label: "📞 Call Them RIGHT NOW",    sub: "They're live — every second you wait drops close rate by 10%" },
    voice_note: { icon: <Mic className="w-5 h-5" />,   label: "🎙️ Drop a Voice Note",     sub: "30-second voice message converts 3× better than text here" },
    video_loom: { icon: <Video className="w-5 h-5" />, label: "🎬 Send a Loom Video",     sub: "A personal face video makes you impossible to ignore" },
  };
  const c = cfg[callAction] || cfg.call;
  return (
    <div className="relative rounded-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-red-900/80 via-orange-900/70 to-red-900/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.2),transparent_60%)]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />
      <div className="relative p-4 flex items-start gap-3">
        <div className="relative flex-shrink-0 mt-0.5">
          <span className="animate-ping absolute inset-0 rounded-full bg-red-500/40" />
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-red-500/30 border border-red-400/50 text-red-300">{c.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black tracking-widest uppercase text-red-400 mb-0.5">⚡ SPEED TO LEAD — ACT NOW</p>
          <p className="text-white font-bold text-sm">{c.label}</p>
          <p className="text-red-200/60 text-xs mt-0.5">{c.sub}</p>
          <p className="text-white/50 text-xs mt-2 italic leading-relaxed">&ldquo;{callReason}&rdquo;</p>
        </div>
        <button onClick={onDismiss} className="text-white/20 hover:text-white/60 flex-shrink-0 transition-colors"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ─── Step 1: Agent Config ─────────────────────────────────────────────────────

function AgentConfigStep({ industry, setIndustry, channel, setChannel, messageType, setMessageType, tone, setTone, provider, setProvider, onConfirm, configured, onEdit, configuredProviders }: {
  industry: Industry; setIndustry: (v: Industry) => void;
  channel: Channel; setChannel: (v: Channel) => void;
  messageType: MessageType; setMessageType: (v: MessageType) => void;
  tone: Tone; setTone: (v: Tone) => void;
  provider: Provider; setProvider: (v: Provider) => void;
  onConfirm: () => void; configured: boolean; onEdit: () => void;
  configuredProviders: string[];
}) {
  const [expanded, setExpanded] = useState(!configured);
  const channelInfo = CHANNELS.find((c) => c.value === channel);
  const selectedMT = MESSAGE_TYPES.find((m) => m.value === messageType);
  const selectedInd = INDUSTRIES.find((i) => i.value === industry);

  const handleConfirm = () => { setExpanded(false); onConfirm(); };

  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0f0b25]" style={{ boxShadow: "0 0 0 1px rgba(139,92,246,0.15), 0 20px 60px rgba(0,0,0,0.4)" }}>
      {/* Gradient top accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

      {/* Header */}
      <button onClick={() => { if (configured) { setExpanded((e) => !e); if (!expanded) onEdit(); } }}
        className="w-full flex items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-white/[0.02]">
        <StepBadge n={1} done={configured} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Configure Your DM Agent</p>
          {configured && !expanded && (
            <p className="text-xs text-white/30 truncate mt-0.5">
              {selectedInd?.emoji} {selectedInd?.label} · {channelInfo?.emoji} {channelInfo?.label} · {selectedMT?.icon} {selectedMT?.label} · {tone}
            </p>
          )}
        </div>
        {configured && (
          <div className="flex items-center gap-1.5 text-violet-400/60 hover:text-violet-300 transition-colors">
            <span className="text-xs font-medium">Edit</span>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        )}
      </button>

      {/* Form */}
      {expanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-white/[0.06]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
            {[
              { label: "Industry", value: industry, onChange: (v: string) => setIndustry(v as Industry), options: INDUSTRIES },
              { label: `Channel · ${channelInfo?.limit || ""}`, value: channel, onChange: (v: string) => setChannel(v as Channel), options: CHANNELS },
              { label: "Tone & Style", value: tone, onChange: (v: string) => setTone(v as Tone), options: TONES },
            ].map((field) => (
              <div key={field.label} className="space-y-2">
                <label className="text-[11px] font-bold tracking-widest uppercase text-white/30">{field.label}</label>
                <div className="relative">
                  <select value={field.value} onChange={(e) => field.onChange(e.target.value)}
                    className="w-full appearance-none bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/40 pr-9 hover:bg-white/[0.06] transition-colors cursor-pointer">
                    {"options" in field && (field.options as Array<{ value: string; label: string; emoji?: string }>).map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#0f0b25]">{o.emoji ? `${o.emoji} ${o.label}` : o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                </div>
              </div>
            ))}

            {/* AI Provider */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold tracking-widest uppercase text-white/30">AI Model</label>
              <div className="flex gap-2">
                {(["anthropic", "openai"] as Provider[]).map((p) => {
                  const hasKey = configuredProviders.includes(p);
                  return (
                    <button key={p} onClick={() => setProvider(p)}
                      className={cn("flex-1 py-3 rounded-xl text-xs font-bold border transition-all relative",
                        provider === p
                          ? "bg-gradient-to-br from-violet-600/40 to-indigo-600/30 border-violet-400/50 text-violet-200 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                          : "bg-white/[0.03] border-white/10 text-white/30 hover:text-white/50 hover:bg-white/[0.06]")}>
                      {p === "anthropic" ? "✦ Claude" : "⬡ GPT-4o"}
                      {!hasKey && (
                        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-[#0f0b25] flex items-center justify-center text-[8px] font-black text-black">!</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Inline warning when selected provider has no key */}
              {!configuredProviders.includes(provider) && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-400/25 rounded-xl px-3 py-2.5">
                  <span className="text-amber-400 text-sm flex-shrink-0 mt-px">⚠</span>
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    No {provider === "anthropic" ? "Anthropic (Claude)" : "OpenAI"} API key found.{" "}
                    <a href="/settings" className="underline underline-offset-2 text-amber-300 hover:text-white transition-colors font-semibold">
                      Add it in Settings → AI Configuration
                    </a>{" "}
                    before generating — or switch to the other model above.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Message Types */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold tracking-widest uppercase text-white/30">Message Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MESSAGE_TYPES.map((m) => {
                const isActive = messageType === m.value;
                return (
                  <button key={m.value} onClick={() => setMessageType(m.value)}
                    className={cn("text-left px-3 py-3 rounded-xl border text-xs transition-all duration-200",
                      isActive ? m.active : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:bg-white/[0.06] hover:border-white/[0.15] hover:text-white/60")}>
                    <p className={cn("font-bold text-sm mb-0.5", isActive ? m.text : "")}>{m.icon} {m.label}</p>
                    <p className={cn("text-[10px] leading-tight", isActive ? "text-white/50" : "text-white/20")}>{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={handleConfirm} disabled={!configuredProviders.includes(provider)}
            className={cn("flex items-center gap-2 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all",
              configuredProviders.includes(provider)
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)]"
                : "bg-white/5 border border-white/10 text-white/25 cursor-not-allowed")}>
            <CheckCircle2 className="w-4 h-4" />
            {configuredProviders.includes(provider) ? "Agent is Ready — Continue" : "Add API Key to Continue"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Input ────────────────────────────────────────────────────────────

function InputStep({ enabled, inputMode, setInputMode, conversation, setConversation, screenshot, setScreenshot, csvLeads, setCsvLeads, loading, onGenerate, onGenerateCsv, prospectName, setProspectName, contextNotes, setContextNotes }: {
  enabled: boolean; inputMode: InputMode; setInputMode: (v: InputMode) => void;
  conversation: string; setConversation: (v: string) => void;
  screenshot: File | null; setScreenshot: (f: File | null) => void;
  csvLeads: CsvLead[]; setCsvLeads: (l: CsvLead[]) => void;
  loading: boolean; onGenerate: () => void; onGenerateCsv: () => void;
  prospectName: string; setProspectName: (v: string) => void;
  contextNotes: string; setContextNotes: (v: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCsvFile = (file: File) => {
    Papa.parse<CsvLead>(file, { header: true, skipEmptyLines: true, complete: (r) => setCsvLeads(r.data.slice(0, 50)) });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (!file) return;
    if (file.type.startsWith("image/")) { setInputMode("screenshot"); handleImageFile(file); }
    else if (file.name.endsWith(".csv")) { setInputMode("csv"); handleCsvFile(file); }
  }, [setInputMode]);

  const canGenerate = (inputMode === "paste" && conversation.trim().length > 0) || (inputMode === "screenshot" && screenshot !== null) || (inputMode === "csv" && csvLeads.length > 0);

  const TABS = [
    { value: "paste" as InputMode,      icon: <MessageSquare className="w-5 h-5" />, label: "Paste Conversation", sub: "Type or paste the DM thread",     activeClass: "border-indigo-400/60 bg-indigo-500/15 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.2)]" },
    { value: "screenshot" as InputMode, icon: <ImageIcon className="w-5 h-5" />,      label: "Drop Screenshot",    sub: "Drag or upload an image",          activeClass: "border-violet-400/60 bg-violet-500/15 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.2)]" },
    { value: "csv" as InputMode,        icon: <FileSpreadsheet className="w-5 h-5" />, label: "CSV Leads",          sub: "Bulk openers for a lead list",     activeClass: "border-emerald-400/60 bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]" },
  ];

  return (
    <div className={cn("rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0b0f20] transition-opacity duration-300", !enabled && "opacity-30 pointer-events-none")} style={{ boxShadow: "0 0 0 1px rgba(99,102,241,0.12), 0 20px 60px rgba(0,0,0,0.4)" }}>
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
      <div className="flex items-center gap-3 px-6 py-4">
        <StepBadge n={2} done={false} />
        <div>
          <p className="text-sm font-bold text-white">Add Your Conversation</p>
          <p className="text-xs text-white/30 mt-0.5">Paste text, drop a screenshot, or upload a CSV of leads</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-5 border-t border-white/[0.06]">
        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 pt-4">
          {TABS.map((tab) => (
            <button key={tab.value} onClick={() => setInputMode(tab.value)}
              className={cn("flex flex-col items-center gap-2 px-3 py-4 rounded-xl border text-center transition-all duration-200",
                inputMode === tab.value ? tab.activeClass : "bg-white/[0.03] border-white/[0.08] text-white/25 hover:bg-white/[0.06] hover:text-white/50")}>
              {tab.icon}
              <div>
                <p className="text-xs font-bold leading-tight">{tab.label}</p>
                <p className="text-[10px] mt-0.5 opacity-60 hidden sm:block">{tab.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Paste */}
        {inputMode === "paste" && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold tracking-widest uppercase text-white/30">Conversation Thread</label>
              <span className="text-[10px] text-white/20">{conversation.length}/5000</span>
            </div>
            <textarea value={conversation} onChange={(e) => setConversation(e.target.value)} maxLength={5000} rows={8}
              placeholder={"Paste the full DM thread here. Newest messages at the bottom.\n\nExample:\nYou: Hey [Name], noticed your post about...\nThem: Yeah what's this?\nYou: We help [niche] get X without Y..."}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/40 resize-none font-mono leading-relaxed transition-colors hover:bg-white/[0.06]" />
          </div>
        )}

        {/* Screenshot */}
        {inputMode === "screenshot" && (
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
            onClick={() => !screenshotPreview && fileInputRef.current?.click()}
            className={cn("relative rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden",
              dragOver ? "border-violet-400/70 bg-violet-500/10" : screenshotPreview ? "border-white/10 cursor-default" : "border-white/[0.12] hover:border-violet-400/40 bg-white/[0.02] hover:bg-violet-500/5")}>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
            {screenshotPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshotPreview} alt="screenshot" className="w-full max-h-64 object-contain" />
                <button onClick={(e) => { e.stopPropagation(); setScreenshot(null); setScreenshotPreview(null); }}
                  className="absolute top-2 right-2 bg-black/70 border border-white/20 rounded-full p-1.5 text-white/60 hover:text-white transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white/60">Drop your screenshot here</p>
                  <p className="text-xs text-white/25 mt-1">PNG, JPG, WEBP · or click to browse</p>
                </div>
                <p className="text-[10px] text-white/20 max-w-xs leading-relaxed">Claude Vision will read the conversation and generate the next perfect message</p>
              </div>
            )}
          </div>
        )}

        {/* CSV */}
        {inputMode === "csv" && (
          <div className="space-y-3">
            {csvLeads.length === 0 ? (
              <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
                onClick={() => csvInputRef.current?.click()}
                className={cn("rounded-xl border-2 border-dashed transition-all cursor-pointer py-12 flex flex-col items-center gap-4 text-center px-6",
                  dragOver ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/[0.12] hover:border-emerald-400/30 bg-white/[0.02] hover:bg-emerald-500/5")}>
                <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])} />
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white/60">Drop your CSV here</p>
                  <p className="text-xs text-white/25 mt-1">Max 50 leads per batch</p>
                </div>
                <div className="text-[10px] text-white/25 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2 font-mono">
                  Columns: <span className="text-emerald-400/70">name, company, role, recent_activity, url, notes</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/30">{csvLeads.length} leads loaded</p>
                  <button onClick={() => setCsvLeads([])} className="text-xs text-white/20 hover:text-white/50 flex items-center gap-1 transition-colors"><X className="w-3 h-3" /> Clear</button>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.05] max-h-48 overflow-y-auto">
                  {csvLeads.slice(0, 6).map((lead, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-[10px] text-white/20 w-4">{i + 1}</span>
                      <p className="text-xs text-white/70 font-semibold truncate">{lead.name || "—"}</p>
                      <p className="text-xs text-white/30 truncate">{lead.company || lead.role || ""}</p>
                    </div>
                  ))}
                  {csvLeads.length > 6 && <div className="px-4 py-2 text-[10px] text-white/20">+{csvLeads.length - 6} more leads</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prospect Name + Context (single-conv and screenshot modes only) */}
        {inputMode !== "csv" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold tracking-widest uppercase text-white/30">
                Prospect Name <span className="text-white/20 normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                maxLength={100}
                placeholder="e.g. Sarah Johnson"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/40 transition-colors hover:bg-white/[0.06]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold tracking-widest uppercase text-white/30">
                Context Notes <span className="text-white/20 normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={contextNotes}
                onChange={(e) => setContextNotes(e.target.value)}
                maxLength={300}
                placeholder="e.g. CEO at 8-figure agency, replied twice"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/40 transition-colors hover:bg-white/[0.06]"
              />
            </div>
          </div>
        )}

        {/* Generate */}
        <button onClick={inputMode === "csv" ? onGenerateCsv : onGenerate} disabled={loading || !canGenerate}
          className={cn("w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl font-bold text-sm transition-all duration-200",
            loading || !canGenerate
              ? "bg-white/[0.05] text-white/25 cursor-not-allowed"
              : "bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:via-indigo-500 hover:to-blue-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_45px_rgba(99,102,241,0.55)]")}>
          {loading ? (
            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{inputMode === "csv" ? "Generating openers..." : "Analyzing conversation..."}</>
          ) : (
            <><Sparkles className="w-4 h-4" />{inputMode === "csv" ? `Generate Openers for ${csvLeads.length} Leads` : "Generate Messages"}<ArrowDown className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function SingleResults({ result, channel, onRegenerate }: { result: DMResult; channel: Channel; onRegenerate: () => void }) {
  const [callDismissed, setCallDismissed] = useState(false);
  const cfg = TEMP_CONFIG[result.temperature];
  const showCallBanner = result.suggest_call && !callDismissed && (result.temperature === "hot" || result.temperature === "fire");

  return (
    <div className={cn("rounded-2xl overflow-hidden border bg-[#0d0d1e]", cfg.cardBg, cfg.glow)} style={{ boxShadow: result.temperature === "fire" ? "0 0 0 1px rgba(239,68,68,0.25), 0 20px 60px rgba(0,0,0,0.5)" : "0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.4)" }}>
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
        <HeatMeter score={result.temperature_score} level={result.temperature} />
        <p className="text-xs text-white/40 leading-relaxed mt-3">{result.temperature_reason}</p>
      </div>

      <div className="px-6 py-5 space-y-4">
        {showCallBanner && <CallBanner callAction={result.call_action} callReason={result.call_reason} onDismiss={() => setCallDismissed(true)} />}

        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">Messages — Ranked by Conversion</p>
          <button onClick={onRegenerate} className="text-[11px] text-white/25 hover:text-violet-400 flex items-center gap-1 transition-colors font-medium">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
            Regenerate
          </button>
        </div>

        <div className="space-y-3">
          {result.messages.map((msg) => {
            const probColors = { high: "text-emerald-300 bg-emerald-500/15 border-emerald-400/30", medium: "text-amber-300 bg-amber-500/15 border-amber-400/30", low: "text-white/30 bg-white/5 border-white/10" };
            return (
              <div key={msg.rank} className={cn("rounded-xl border p-4 space-y-3 transition-all", msg.rank === 1 ? "bg-gradient-to-br from-violet-900/30 to-indigo-900/20 border-violet-400/30 shadow-[0_0_25px_rgba(139,92,246,0.15)]" : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]")}>
                <div className="flex items-center gap-2 flex-wrap">
                  {msg.rank === 1 && <span className="text-[10px] font-black tracking-widest uppercase bg-gradient-to-r from-violet-500/30 to-indigo-500/30 text-violet-300 border border-violet-400/40 px-2.5 py-0.5 rounded-full">★ BEST OPTION</span>}
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-full">{msg.strategy}</span>
                  <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border", probColors[msg.conversion_probability])}>{msg.conversion_probability} prob.</span>
                  <div className="ml-auto"><CopyButton text={msg.message} /></div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 text-sm text-white/75 leading-relaxed whitespace-pre-wrap border border-white/[0.07] font-mono">
                  {msg.message}
                </div>
                <p className="text-[11px] text-white/30 italic">{msg.why_it_works}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          {["One CTA per message only", "Match their reply energy", "Never pitch on first contact", "Short messages get more replies", "Follow up 3× before giving up", "Always end with a question"].map((tip) => (
            <p key={tip} className="text-[10px] text-white/25 flex items-start gap-1.5">
              <span className="text-violet-500 flex-shrink-0 mt-px">›</span>{tip}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function CsvResults({ results, onRegenerate }: { results: CsvResult[]; onRegenerate: () => void }) {
  const done = results.filter((r) => !r.loading && !r.error).length;
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0b110f]" style={{ boxShadow: "0 0 0 1px rgba(16,185,129,0.15), 0 20px 60px rgba(0,0,0,0.4)" }}>
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <StepBadge n={3} done={done === results.length} />
          <div>
            <p className="text-sm font-bold text-white">Generated Openers</p>
            <p className="text-xs text-white/30">{done} of {results.length} complete</p>
          </div>
        </div>
        <button onClick={onRegenerate} className="text-xs text-white/25 hover:text-emerald-400 transition-colors font-medium">Regenerate</button>
      </div>
      {done < results.length && (
        <div className="px-6 py-2">
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${(done / results.length) * 100}%` }} />
          </div>
        </div>
      )}
      <div className="divide-y divide-white/[0.05]">
        {results.map((r, i) => (
          <div key={i} className="px-6 py-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-white truncate">{r.lead.name || `Lead ${i + 1}`}</p>
                  {r.lead.company && <span className="text-xs text-white/30 truncate">{r.lead.company}</span>}
                  {r.lead.role && <span className="text-[10px] bg-white/[0.06] border border-white/[0.08] text-white/30 px-2 py-0.5 rounded-full">{r.lead.role}</span>}
                </div>
                {r.lead.url && <p className="text-[10px] text-white/20 truncate mt-0.5 font-mono">{r.lead.url}</p>}
              </div>
              {!r.loading && !r.error && <CopyButton text={r.opener} />}
            </div>
            {r.loading && <div className="flex items-center gap-2 text-xs text-white/25"><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generating...</div>}
            {r.error && <p className="text-xs text-red-400/70">{r.error}</p>}
            {!r.loading && !r.error && r.opener && (
              <div className="bg-black/20 rounded-xl px-4 py-3 text-sm text-white/65 border border-white/[0.07] leading-relaxed">{r.opener}</div>
            )}
            {!r.loading && !r.error && r.strategy && <p className="text-[10px] text-white/20 italic">Strategy: {r.strategy}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SuperDMSetterClient({ configuredProviders = [] }: { configuredProviders?: string[] }) {
  const [mode, setMode] = useState<"ai" | "campaign">("ai");
  const [industry, setIndustry] = useState<Industry>("high_ticket");
  const [channel, setChannel] = useState<Channel>("linkedin");
  const [messageType, setMessageType] = useState<MessageType>("opener");
  const [tone, setTone] = useState<Tone>("direct");
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [agentConfigured, setAgentConfigured] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("paste");
  const [conversation, setConversation] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [csvLeads, setCsvLeads] = useState<CsvLead[]>([]);
  const [result, setResult] = useState<DMResult | null>(null);
  const [csvResults, setCsvResults] = useState<CsvResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const scrollToResults = () => setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

  const getImageBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => { const [header, base64] = (e.target?.result as string).split(","); resolve({ base64, mimeType: header.match(/data:([^;]+)/)?.[1] || "image/jpeg" }); };
      reader.onerror = reject; reader.readAsDataURL(file);
    });

  const generate = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const body: Record<string, unknown> = { industry, channel, messageType, tone, provider };
      if (prospectName.trim()) body.prospectName = prospectName.trim();
      if (contextNotes.trim()) body.contextNotes = contextNotes.trim();
      if (inputMode === "paste") { body.conversation = conversation.trim(); }
      else if (inputMode === "screenshot" && screenshot) {
        const { base64, mimeType } = await getImageBase64(screenshot);
        body.imageBase64 = base64; body.imageMimeType = mimeType;
        body.conversation = "[See attached screenshot]";
      }
      const res = await fetch("/api/super-dm-setter/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) setError(json.error || "Something went wrong."); else { setResult(json.data as DMResult); scrollToResults(); }
    } catch { setError("Network error — please try again."); }
    finally { setLoading(false); }
  };

  const generateCsv = async () => {
    if (!csvLeads.length) return;
    setLoading(true); setError(null); setCsvResults([]);
    const initial: CsvResult[] = csvLeads.map((lead) => ({ lead, opener: "", strategy: "", loading: true }));
    setCsvResults(initial); scrollToResults();
    const updated = [...initial];
    for (let i = 0; i < csvLeads.length; i += 3) {
      await Promise.all(csvLeads.slice(i, i + 3).map(async (lead, bi) => {
        const idx = i + bi;
        const ctx = [lead.name && `Name: ${lead.name}`, lead.company && `Company: ${lead.company}`, lead.role && `Role: ${lead.role}`, lead.recent_activity && `Recent Activity: ${lead.recent_activity}`, lead.url && `Profile/URL: ${lead.url}`, lead.notes && `Notes: ${lead.notes}`].filter(Boolean).join("\n");
        try {
          const res = await fetch("/api/super-dm-setter/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ industry, channel, messageType: "opener", tone, provider, conversation: `Generate a personalized opener for this lead:\n\n${ctx}`, csvMode: true }) });
          const json = await res.json();
          updated[idx] = res.ok && json.data?.messages?.[0] ? { lead, opener: json.data.messages[0].message, strategy: json.data.messages[0].strategy, loading: false } : { lead, opener: "", strategy: "", loading: false, error: json.error || "Failed" };
        } catch { updated[idx] = { lead, opener: "", strategy: "", loading: false, error: "Network error" }; }
        setCsvResults([...updated]);
      }));
    }
    setLoading(false);
  };

  const hasResults = result !== null || csvResults.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* ── Mode toggle ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.08] rounded-xl p-1">
        <button
          onClick={() => setMode("ai")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
            mode === "ai"
              ? "bg-violet-500/20 border border-violet-400/30 text-violet-300"
              : "text-white/30 hover:text-white/50"
          )}
        >
          <Sparkles className="w-3.5 h-3.5" /> AI Writing
        </button>
        <button
          onClick={() => setMode("campaign")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
            mode === "campaign"
              ? "bg-indigo-500/20 border border-indigo-400/30 text-indigo-300"
              : "text-white/30 hover:text-white/50"
          )}
        >
          <Rocket className="w-3.5 h-3.5" /> Launch Campaign
        </button>
      </div>

      {/* ── Campaign mode ─────────────────────────────────────────────────── */}
      {mode === "campaign" && (
        <CampaignWizard onClose={() => setMode("ai")} />
      )}

      {/* ── AI Writing mode ───────────────────────────────────────────────── */}
      {mode === "ai" && (
        <>
          <AgentConfigStep industry={industry} setIndustry={setIndustry} channel={channel} setChannel={setChannel} messageType={messageType} setMessageType={setMessageType} tone={tone} setTone={setTone} provider={provider} setProvider={setProvider} onConfirm={() => setAgentConfigured(true)} configured={agentConfigured} onEdit={() => setAgentConfigured(false)} configuredProviders={configuredProviders} />

          {agentConfigured && (
            <div className="flex justify-center py-1">
              <div className="flex flex-col items-center gap-1">
                <div className="w-px h-5 bg-gradient-to-b from-violet-500/40 to-indigo-500/20" />
                <ArrowDown className="w-3.5 h-3.5 text-indigo-500/40" />
              </div>
            </div>
          )}

          <InputStep enabled={agentConfigured} inputMode={inputMode} setInputMode={setInputMode} conversation={conversation} setConversation={setConversation} screenshot={screenshot} setScreenshot={setScreenshot} csvLeads={csvLeads} setCsvLeads={setCsvLeads} loading={loading} onGenerate={generate} onGenerateCsv={generateCsv} prospectName={prospectName} setProspectName={setProspectName} contextNotes={contextNotes} setContextNotes={setContextNotes} />

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300/80">{error}</p>
            </div>
          )}

          {hasResults && (
            <div className="flex justify-center py-1">
              <div className="flex flex-col items-center gap-1">
                <div className="w-px h-5 bg-gradient-to-b from-indigo-500/20 to-white/5" />
                <ArrowDown className="w-3.5 h-3.5 text-white/15" />
              </div>
            </div>
          )}

          <div ref={resultsRef}>
            {result && <SingleResults result={result} channel={channel} onRegenerate={generate} />}
            {csvResults.length > 0 && <CsvResults results={csvResults} onRegenerate={generateCsv} />}
          </div>
        </>
      )}
    </div>
  );
}
