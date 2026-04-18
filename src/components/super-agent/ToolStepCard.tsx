"use client";

import type { ComponentType } from "react";
import { Loader2, CheckCircle2, XCircle, Users, Zap, Target, Megaphone, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const TOOL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  research_icp: Target,
  build_lead_list: Users,
  generate_sequences: Zap,
  create_campaign: Megaphone,
  create_comment_automation: MessageSquare,
};

type StepStatus = "running" | "success" | "error";

interface Props {
  name: string;
  label: string;
  inputSummary: string;
  status: StepStatus;
  resultSummary?: string;
  leadCount?: number;
}

export function ToolStepCard({ name, label, inputSummary, status, resultSummary, leadCount }: Props) {
  const Icon = TOOL_ICONS[name] ?? Zap;

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-xl border text-sm transition-all",
      status === "running" && "bg-violet-500/8 border-violet-500/25",
      status === "success" && "bg-emerald-500/8 border-emerald-500/20",
      status === "error"   && "bg-red-500/8 border-red-500/20",
    )}>
      {/* Icon */}
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
        status === "running" && "bg-violet-500/20",
        status === "success" && "bg-emerald-500/20",
        status === "error"   && "bg-red-500/20",
      )}>
        <Icon className={cn(
          "w-4 h-4",
          status === "running" && "text-violet-400",
          status === "success" && "text-emerald-400",
          status === "error"   && "text-red-400",
        )} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white/90">{label}</span>
          {status === "running" && <Loader2 className="w-3 h-3 animate-spin text-violet-400" />}
          {status === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          {status === "error"   && <XCircle className="w-3.5 h-3.5 text-red-400" />}
          {leadCount !== undefined && leadCount > 0 && (
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full">
              {leadCount.toLocaleString()} leads
            </span>
          )}
        </div>
        <p className="text-xs text-white/40 mt-0.5 truncate">{inputSummary}</p>
        {resultSummary && status !== "running" && (
          <p className={cn(
            "text-xs mt-1",
            status === "success" ? "text-white/60" : "text-red-400/80"
          )}>
            {resultSummary}
          </p>
        )}
      </div>
    </div>
  );
}
