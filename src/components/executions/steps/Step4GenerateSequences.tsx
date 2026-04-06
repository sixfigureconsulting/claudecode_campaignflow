"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Zap, Linkedin, Mail, ChevronDown, ChevronUp, Gift, TrendingUp, Users, Heart, BadgeCheck, Clock, Globe } from "lucide-react";
import type { CampaignLead } from "@/types/database";
import type { InfluenceType } from "@/lib/validations";

const OFFER_STORAGE_KEY = (projectId: string) => `cf_offer_${projectId}`;

const PRINCIPLES: {
  id: InfluenceType;
  label: string;
  tagline: string;
  icon: React.ElementType;
  color: string;
  activeColor: string;
}[] = [
  {
    id: "reciprocity",
    label: "Reciprocity",
    tagline: "Lead with genuine value",
    icon: Gift,
    color: "border-emerald-200 text-emerald-700 bg-emerald-50",
    activeColor: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300",
  },
  {
    id: "commitment",
    label: "Commitment",
    tagline: "Micro-ask first, ladder up",
    icon: TrendingUp,
    color: "border-blue-200 text-blue-700 bg-blue-50",
    activeColor: "border-blue-500 bg-blue-50 ring-2 ring-blue-300",
  },
  {
    id: "social_proof",
    label: "Social Proof",
    tagline: "Show peer results",
    icon: Users,
    color: "border-purple-200 text-purple-700 bg-purple-50",
    activeColor: "border-purple-500 bg-purple-50 ring-2 ring-purple-300",
  },
  {
    id: "liking",
    label: "Liking",
    tagline: "Genuine research first",
    icon: Heart,
    color: "border-rose-200 text-rose-700 bg-rose-50",
    activeColor: "border-rose-500 bg-rose-50 ring-2 ring-rose-300",
  },
  {
    id: "authority",
    label: "Authority",
    tagline: "Establish niche credibility",
    icon: BadgeCheck,
    color: "border-amber-200 text-amber-700 bg-amber-50",
    activeColor: "border-amber-500 bg-amber-50 ring-2 ring-amber-300",
  },
  {
    id: "scarcity",
    label: "Scarcity",
    tagline: "Honest urgency only",
    icon: Clock,
    color: "border-red-200 text-red-700 bg-red-50",
    activeColor: "border-red-500 bg-red-50 ring-2 ring-red-300",
  },
  {
    id: "unity",
    label: "Unity",
    tagline: "Same tribe framing",
    icon: Globe,
    color: "border-cyan-200 text-cyan-700 bg-cyan-50",
    activeColor: "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-300",
  },
];

const PRINCIPLE_HINTS: Record<InfluenceType, string> = {
  reciprocity: "Opens with a tailored insight, mini-audit, or checklist. CTA is to receive the value — not to book a call.",
  commitment: "Starts with a 2-min ask. No 30-min meeting requests upfront. Ladders to a call across touches.",
  social_proof: "Leads with a specific peer result — segment, firm type, and 1–2 real metrics. Quiet confidence, no hype.",
  liking: "Opens by referencing something observable about the prospect (post, hire, product launch). Smart peer tone.",
  authority: "Establishes niche focus and result patterns in 1–2 lines. Specificity carries the weight, not a long bio.",
  scarcity: "Uses concrete, explained urgency — limited slots, cohort, or timing window. Never vague or manufactured.",
  unity: "Frames shared identity — founder-led, bootstrapped, B2B, geography. 'We, not you vs. me' language throughout.",
};

export function Step4GenerateSequences({
  projectId,
  leads,
  hasOpenAIKey,
  hasHeyreachKey,
  onComplete,
}: {
  projectId: string;
  leads: CampaignLead[];
  hasOpenAIKey: boolean;
  hasHeyreachKey: boolean;
  onComplete: (leads: CampaignLead[]) => void;
}) {
  const [channels, setChannels] = useState<Set<string>>(new Set(["email"]));
  const [influenceType, setInfluenceType] = useState<InfluenceType>("reciprocity");
  const [offerContext, setOfferContext] = useState<string>(() => {
    try { return localStorage.getItem(OFFER_STORAGE_KEY(projectId)) ?? ""; } catch { return ""; }
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<CampaignLead[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const saveOffer = (val: string) => {
    setOfferContext(val);
    try { localStorage.setItem(OFFER_STORAGE_KEY(projectId), val); } catch {}
  };

  const toggleChannel = (ch: string) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  const handleGenerate = async () => {
    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/executions/generate-sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        leads,
        channels: Array.from(channels),
        offerContext,
        influenceType,
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setMessage(json.error ?? "Sequence generation failed.");
      setStatus("error");
      return;
    }

    setResults(json.leads);
    setStatus("done");
    setMessage(json.summary);
  };

  const selectedPrinciple = PRINCIPLES.find((p) => p.id === influenceType)!;

  return (
    <div className="space-y-5">
      {/* Channel selection */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-2">Channels</label>
        <div className="flex gap-2">
          <button
            onClick={() => toggleChannel("linkedin")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              channels.has("linkedin")
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            <Linkedin className="h-4 w-4" />
            LinkedIn
            {channels.has("linkedin") && <CheckCircle2 className="h-3.5 w-3.5" />}
            {!hasHeyreachKey && channels.has("linkedin") && (
              <span className="text-xs text-amber-600">(no Heyreach)</span>
            )}
          </button>
          <button
            onClick={() => toggleChannel("email")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              channels.has("email")
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            <Mail className="h-4 w-4" />
            Cold Email
            {channels.has("email") && <CheckCircle2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Cialdini principle picker */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1">
          Influence Framework
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">— based on Cialdini's Principles of Influence</span>
        </label>
        <p className="text-xs text-muted-foreground mb-3">
          Choose the primary psychological driver for your copy. All 7 principles are woven in — this one leads.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRINCIPLES.map((p) => {
            const Icon = p.icon;
            const isSelected = influenceType === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setInfluenceType(p.id)}
                className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border text-left transition-all ${
                  isSelected ? p.activeColor : "border-border hover:border-muted-foreground bg-background"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-semibold ${isSelected ? "" : "text-foreground"}`}>{p.label}</span>
                  {isSelected && <CheckCircle2 className="h-3 w-3 ml-auto shrink-0" />}
                </div>
                <span className="text-[11px] text-muted-foreground leading-tight">{p.tagline}</span>
              </button>
            );
          })}
        </div>
        {/* Hint for selected principle */}
        <div className={`mt-2 px-3 py-2 rounded-lg border text-xs ${selectedPrinciple.color}`}>
          <span className="font-medium">{selectedPrinciple.label}:</span>{" "}
          {PRINCIPLE_HINTS[influenceType]}
        </div>
      </div>

      {/* Offer context */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Offer / Context
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">(saved per project)</span>
        </label>
        <Textarea
          placeholder={`Describe what you're offering and why it's relevant. e.g.:\n"We help B2B SaaS companies reduce churn by 30% through automated customer success workflows. Our clients typically see results within 60 days. We're offering a free 2-week pilot."`}
          className="text-sm min-h-[100px] resize-y"
          value={offerContext}
          onChange={(e) => saveOffer(e.target.value)}
        />
      </div>

      {!hasOpenAIKey && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Add your OpenAI API key in the Integrations tab to generate sequences.
        </div>
      )}

      <Button
        variant="gradient"
        className="w-full"
        disabled={channels.size === 0 || !offerContext.trim() || !hasOpenAIKey || status === "loading"}
        loading={status === "loading"}
        onClick={handleGenerate}
      >
        <Zap className="h-4 w-4 mr-2" />
        {status === "loading"
          ? `Writing ${selectedPrinciple.label}-led sequences...`
          : `Generate ${selectedPrinciple.label}-led sequences for ${leads.length} leads`}
      </Button>

      {status === "error" && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {message}
        </div>
      )}
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Writing personalised sequences using {selectedPrinciple.label} principle... this may take a minute for large lists.
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {message}
            </p>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((lead, i) => {
              const key = `${lead.email}-${i}`;
              const isOpen = expanded === key;
              const hasSeq = !!lead.sequence;
              return (
                <div key={key} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors text-left"
                    onClick={() => setExpanded(isOpen ? null : key)}
                  >
                    <div className="flex items-center gap-2">
                      {hasSeq ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      )}
                      <span className="font-medium">{lead.first_name} {lead.last_name}</span>
                      <span className="text-xs text-muted-foreground">{lead.title} @ {lead.company}</span>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {isOpen && lead.sequence && (
                    <div className="border-t divide-y text-xs bg-muted/20">
                      {channels.has("linkedin") && (lead.sequence.linkedin_step1 || lead.sequence.linkedin_step2) && (
                        <>
                          {lead.sequence.linkedin_step1 && (
                            <div className="px-3 py-2.5 space-y-1">
                              <div className="flex items-center gap-1.5 font-medium text-blue-600">
                                <Linkedin className="h-3 w-3" />
                                LinkedIn Connection Request
                              </div>
                              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{lead.sequence.linkedin_step1}</p>
                            </div>
                          )}
                          {lead.sequence.linkedin_step2 && (
                            <div className="px-3 py-2.5 space-y-1">
                              <div className="flex items-center gap-1.5 font-medium text-blue-600">
                                <Linkedin className="h-3 w-3" />
                                LinkedIn Follow-up (Day 3)
                              </div>
                              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{lead.sequence.linkedin_step2}</p>
                            </div>
                          )}
                        </>
                      )}
                      {channels.has("email") && (lead.sequence.email_body1 || lead.sequence.email_body2) && (
                        <>
                          {lead.sequence.email_body1 && (
                            <div className="px-3 py-2.5 space-y-1">
                              <div className="flex items-center gap-1.5 font-medium text-purple-600">
                                <Mail className="h-3 w-3" />
                                Cold Email #1
                              </div>
                              {lead.sequence.email_subject1 && (
                                <p className="font-medium">Subject: {lead.sequence.email_subject1}</p>
                              )}
                              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{lead.sequence.email_body1}</p>
                            </div>
                          )}
                          {lead.sequence.email_body2 && (
                            <div className="px-3 py-2.5 space-y-1">
                              <div className="flex items-center gap-1.5 font-medium text-purple-600">
                                <Mail className="h-3 w-3" />
                                Email Follow-up
                              </div>
                              {lead.sequence.email_subject2 && (
                                <p className="font-medium">Subject: {lead.sequence.email_subject2}</p>
                              )}
                              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{lead.sequence.email_body2}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            variant="gradient"
            className="w-full"
            onClick={() => onComplete(results)}
          >
            Continue to push →
          </Button>
        </div>
      )}
    </div>
  );
}
