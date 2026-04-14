"use client";

import { useState, useEffect } from "react";
import {
  Linkedin, MessageCircle, Twitter, Mail, Instagram, Facebook,
  ChevronRight, ChevronLeft, Rocket, Users, Settings2, Calendar,
  CheckCircle2, Loader2, AlertCircle, Clock, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Channel = "linkedin" | "reddit" | "twitter" | "email" | "instagram" | "facebook";

interface LeadList {
  id: string;
  name: string;
  source?: string | null;
  lead_count: number;
  created_at: string;
}

interface WizardState {
  // Step 1
  channel: Channel | null;
  // Step 2
  list_id: string;
  list_name: string;
  lead_count: number;
  // Step 3
  industry: string;
  tone: string;
  message_type: string;
  subject: string;
  message_template: string;
  // Step 4
  campaign_name: string;
  send_immediately: boolean;
  daily_limit: number;
}

const CHANNELS: Array<{
  value: Channel;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  badge?: string;
  note?: string;
}> = [
  { value: "linkedin",  label: "LinkedIn",        icon: <Linkedin className="w-5 h-5" />,       color: "text-blue-400",    bg: "bg-blue-500/15 border-blue-400/40",    badge: "Via Heyreach" },
  { value: "reddit",    label: "Reddit",           icon: <MessageCircle className="w-5 h-5" />, color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-400/40", note: "Requires Reddit connection" },
  { value: "twitter",   label: "Twitter / X",     icon: <Twitter className="w-5 h-5" />,        color: "text-sky-400",     bg: "bg-sky-500/15 border-sky-400/40",       note: "Requires Twitter connection" },
  { value: "email",     label: "Email",            icon: <Mail className="w-5 h-5" />,           color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-400/40" },
  { value: "instagram", label: "Instagram",        icon: <Instagram className="w-5 h-5" />,      color: "text-pink-400",    bg: "bg-pink-500/15 border-pink-400/40",     note: "Coming soon" },
  { value: "facebook",  label: "Facebook",         icon: <Facebook className="w-5 h-5" />,       color: "text-indigo-400",  bg: "bg-indigo-500/15 border-indigo-400/40", note: "Coming soon" },
];

const INDUSTRIES = [
  { value: "real_estate", label: "Real Estate" },
  { value: "high_ticket", label: "High-Ticket Sales" },
  { value: "dm_sales",    label: "DM Sales" },
  { value: "agency",      label: "Agency" },
  { value: "coaching",    label: "Coaching / Consulting" },
  { value: "saas",        label: "SaaS" },
  { value: "other",       label: "Other" },
];

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "casual",       label: "Casual" },
  { value: "direct",       label: "Direct & Bold" },
  { value: "empathetic",   label: "Empathetic" },
  { value: "urgency",      label: "Urgency-Driven" },
];

const MESSAGE_TYPES = [
  { value: "opener",    label: "Opener"           },
  { value: "pain_point",label: "Discover Pain"    },
  { value: "pitch",     label: "Pitch Offer"      },
  { value: "followup",  label: "Follow-Up"        },
];

const STEP_LABELS = ["Channel", "Leads", "Message", "Launch"];

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i < current
              ? "bg-emerald-400 w-6"
              : i === current
              ? "bg-violet-400 w-8"
              : "bg-white/10 w-4"
          )}
        />
      ))}
    </div>
  );
}

// ── Step 1: Channel ───────────────────────────────────────────────────────────

function ChannelStep({
  value,
  onChange,
}: {
  value: Channel | null;
  onChange: (c: Channel) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40 font-medium tracking-widest uppercase">Select outreach channel</p>
      <div className="grid grid-cols-2 gap-2.5">
        {CHANNELS.map((ch) => {
          const isDisabled = ch.note?.includes("soon");
          return (
            <button
              key={ch.value}
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(ch.value)}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
                value === ch.value
                  ? ch.bg + " " + ch.color
                  : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:bg-white/[0.06] hover:text-white/60",
                isDisabled && "opacity-30 cursor-not-allowed"
              )}
            >
              <span className={cn("flex-shrink-0", value === ch.value ? ch.color : "text-white/30")}>
                {ch.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{ch.label}</p>
                {ch.badge && (
                  <p className={cn("text-[10px] font-medium mt-0.5", value === ch.value ? ch.color + "/70" : "text-white/25")}>
                    {ch.badge}
                  </p>
                )}
                {ch.note && !ch.badge && (
                  <p className="text-[10px] text-white/25 mt-0.5">{ch.note}</p>
                )}
              </div>
              {value === ch.value && (
                <CheckCircle2 className={cn("w-4 h-4 flex-shrink-0", ch.color)} />
              )}
            </button>
          );
        })}
      </div>

      {value === "reddit" && (
        <div className="flex items-start gap-2 bg-orange-950/40 border border-orange-500/20 rounded-lg px-3.5 py-2.5">
          <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-300/80 leading-relaxed">
            Reddit DMs require your Reddit account to be connected.{" "}
            <a href="/settings?scroll=reddit" className="text-orange-300 underline underline-offset-2 font-medium">
              Connect in Settings →
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Lead list ─────────────────────────────────────────────────────────

function LeadsStep({
  listId,
  onChange,
}: {
  listId: string;
  onChange: (id: string, name: string, count: number) => void;
}) {
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/lists")
      .then((r) => r.json())
      .then((d) => {
        setLists(d.lists ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/40 py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading lists…</span>
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="text-center py-10 space-y-2">
        <Users className="w-8 h-8 text-white/20 mx-auto" />
        <p className="text-sm text-white/40">No lead lists yet.</p>
        <a href="/lists" className="text-xs text-violet-400 underline underline-offset-2">
          Build a list first →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40 font-medium tracking-widest uppercase">Choose a lead list</p>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
        {lists.map((list) => (
          <button
            key={list.id}
            onClick={() => onChange(list.id, list.name, list.lead_count)}
            className={cn(
              "w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
              listId === list.id
                ? "bg-violet-500/15 border-violet-400/40 text-violet-300"
                : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
            )}
          >
            <div>
              <p className="text-sm font-semibold">{list.name}</p>
              {list.source && <p className="text-[10px] text-white/30 mt-0.5">{list.source}</p>}
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <span className={cn("text-sm font-bold tabular-nums", listId === list.id ? "text-violet-300" : "text-white/40")}>
                {list.lead_count.toLocaleString()}
              </span>
              <Users className="w-3.5 h-3.5 text-white/20" />
              {listId === list.id && <CheckCircle2 className="w-4 h-4 text-violet-400" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 3: Message config ────────────────────────────────────────────────────

function MessageStep({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40 font-medium tracking-widest uppercase">Configure message</p>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-white/30">Industry</label>
          <select
            value={state.industry}
            onChange={(e) => onChange({ industry: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-violet-400/50"
          >
            {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-white/30">Tone</label>
          <select
            value={state.tone}
            onChange={(e) => onChange({ tone: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-violet-400/50"
          >
            {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-white/30">Type</label>
          <select
            value={state.message_type}
            onChange={(e) => onChange({ message_type: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-violet-400/50"
          >
            {MESSAGE_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-widest uppercase text-white/30">Subject / Opening Line</label>
        <input
          type="text"
          value={state.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="Hey {{first_name}}, quick question…"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/50"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-widest uppercase text-white/30">
          Message template <span className="text-white/20 normal-case font-normal">— use {"{{first_name}}"}, {"{{company}}"}, {"{{title}}"}</span>
        </label>
        <textarea
          value={state.message_template}
          onChange={(e) => onChange({ message_template: e.target.value })}
          placeholder="Hey {{first_name}}, saw you're at {{company}} as a {{title}}…"
          rows={5}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/50 resize-none"
        />
        <p className="text-[10px] text-white/25">
          {state.message_template.length} chars
        </p>
      </div>
    </div>
  );
}

// ── Step 4: Launch ────────────────────────────────────────────────────────────

function LaunchStep({
  state,
  onChange,
  onLaunch,
  launching,
  launchResult,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onLaunch: () => void;
  launching: boolean;
  launchResult: { success: boolean; sent: number; failed: number; error?: string } | null;
}) {
  const channel = CHANNELS.find((c) => c.value === state.channel);

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40 font-medium tracking-widest uppercase">Name & schedule</p>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-widest uppercase text-white/30">Campaign name</label>
        <input
          type="text"
          value={state.campaign_name}
          onChange={(e) => onChange({ campaign_name: e.target.value })}
          placeholder={`${state.list_name || "My List"} — ${channel?.label ?? ""} Outreach`}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-400/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onChange({ send_immediately: true })}
          className={cn(
            "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left transition-all",
            state.send_immediately
              ? "bg-violet-500/15 border-violet-400/40 text-violet-300"
              : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:bg-white/[0.06]"
          )}
        >
          <Zap className={cn("w-4 h-4 flex-shrink-0", state.send_immediately ? "text-violet-400" : "text-white/20")} />
          <div>
            <p className="text-xs font-semibold">Send immediately</p>
            <p className="text-[10px] text-white/30 mt-0.5">Launch right now</p>
          </div>
        </button>

        <button
          onClick={() => onChange({ send_immediately: false })}
          className={cn(
            "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left transition-all",
            !state.send_immediately
              ? "bg-amber-500/15 border-amber-400/40 text-amber-300"
              : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:bg-white/[0.06]"
          )}
        >
          <Clock className={cn("w-4 h-4 flex-shrink-0", !state.send_immediately ? "text-amber-400" : "text-white/20")} />
          <div>
            <p className="text-xs font-semibold">Save as draft</p>
            <p className="text-[10px] text-white/30 mt-0.5">Launch manually later</p>
          </div>
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-widest uppercase text-white/30">Daily limit (DMs per day)</label>
        <input
          type="number"
          min={1}
          max={50}
          value={state.daily_limit}
          onChange={(e) => onChange({ daily_limit: Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-400/50"
        />
        <p className="text-[10px] text-white/25">Reddit recommends ≤ 10/day to avoid rate limits.</p>
      </div>

      {/* Summary */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-2">
        <p className="text-[10px] font-bold tracking-widest uppercase text-white/30">Campaign summary</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span className="text-white/40">Channel</span>
          <span className="text-white/70 font-medium">{channel?.label ?? "—"}</span>
          <span className="text-white/40">Lead list</span>
          <span className="text-white/70 font-medium">{state.list_name || "—"}</span>
          <span className="text-white/40">Leads</span>
          <span className="text-white/70 font-medium">{state.lead_count.toLocaleString()}</span>
          <span className="text-white/40">Credits needed</span>
          <span className="text-violet-300 font-bold">{state.lead_count} credits</span>
        </div>
      </div>

      {launchResult && (
        <div className={cn(
          "flex items-start gap-2 rounded-xl border px-4 py-3",
          launchResult.success
            ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-300"
            : "bg-red-950/40 border-red-500/20 text-red-300"
        )}>
          {launchResult.success
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <div className="text-xs">
            {launchResult.success
              ? <p>Launched! <strong>{launchResult.sent}</strong> DMs sent{launchResult.failed > 0 ? `, ${launchResult.failed} failed` : ""}.</p>
              : <p>{launchResult.error ?? "Launch failed. Please try again."}</p>}
          </div>
        </div>
      )}

      <button
        onClick={onLaunch}
        disabled={launching || !state.campaign_name.trim()}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-sm transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)]"
      >
        {launching ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Launching…</>
        ) : (
          <><Rocket className="w-4 h-4" /> {state.send_immediately ? "Launch Campaign" : "Save Draft"}</>
        )}
      </button>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function CampaignWizard({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    channel: null,
    list_id: "",
    list_name: "",
    lead_count: 0,
    industry: "saas",
    tone: "professional",
    message_type: "opener",
    subject: "",
    message_template: "",
    campaign_name: "",
    send_immediately: true,
    daily_limit: 10,
  });
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<{
    success: boolean; sent: number; failed: number; error?: string;
  } | null>(null);

  const patch = (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p }));

  const canNext = () => {
    if (step === 0) return !!state.channel;
    if (step === 1) return !!state.list_id;
    if (step === 2) return !!state.message_template.trim();
    return false;
  };

  const handleLaunch = async () => {
    setLaunching(true);
    setLaunchResult(null);

    try {
      // Create campaign
      const createRes = await fetch("/api/social/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.campaign_name,
          channel: state.channel,
          list_id: state.list_id,
          message_config: {
            industry:         state.industry,
            tone:             state.tone,
            message_type:     state.message_type,
            subject:          state.subject,
            message_template: state.message_template,
          },
          schedule_config: {
            send_immediately: state.send_immediately,
            daily_limit:      state.daily_limit,
          },
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        setLaunchResult({ success: false, sent: 0, failed: 0, error: createData.error });
        setLaunching(false);
        return;
      }

      if (!state.send_immediately) {
        setLaunchResult({ success: true, sent: 0, failed: 0 });
        setLaunching(false);
        return;
      }

      // Launch immediately
      const launchRes = await fetch(`/api/social/campaigns/${createData.id}/launch`, {
        method: "POST",
      });
      const launchData = await launchRes.json();

      if (!launchRes.ok) {
        setLaunchResult({ success: false, sent: 0, failed: 0, error: launchData.error });
      } else {
        setLaunchResult({
          success: true,
          sent:    launchData.sent ?? 0,
          failed:  launchData.failed ?? 0,
        });
      }
    } catch (e) {
      setLaunchResult({ success: false, sent: 0, failed: 0, error: String(e) });
    }

    setLaunching(false);
  };

  return (
    <div className="bg-[#0d0f1e] border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-violet-500/20 border border-violet-400/30">
            <Rocket className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Launch Campaign</p>
            <p className="text-[10px] text-white/35 mt-0.5">{STEP_LABELS[step]} · Step {step + 1} of 4</p>
          </div>
        </div>
        <StepDots current={step} total={4} />
      </div>

      {/* Body */}
      <div className="p-5">
        {step === 0 && (
          <ChannelStep value={state.channel} onChange={(c) => patch({ channel: c })} />
        )}
        {step === 1 && (
          <LeadsStep
            listId={state.list_id}
            onChange={(id, name, count) => patch({ list_id: id, list_name: name, lead_count: count })}
          />
        )}
        {step === 2 && (
          <MessageStep state={state} onChange={patch} />
        )}
        {step === 3 && (
          <LaunchStep
            state={state}
            onChange={patch}
            onLaunch={handleLaunch}
            launching={launching}
            launchResult={launchResult}
          />
        )}
      </div>

      {/* Footer nav */}
      {step < 3 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
          <button
            onClick={() => step > 0 ? setStep((s) => s - 1) : onClose?.()}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {step === 0 ? "Cancel" : "Back"}
          </button>
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="flex items-center gap-1.5 text-xs font-bold text-violet-300 hover:text-violet-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
