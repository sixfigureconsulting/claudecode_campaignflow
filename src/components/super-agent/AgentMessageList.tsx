"use client";

import { useEffect, useRef } from "react";
import { Bot, User, ChevronDown } from "lucide-react";
import { ToolStepCard } from "./ToolStepCard";
import type { AgentUIMessage } from "@/types/database";
import { cn } from "@/lib/utils";

interface Props {
  messages: AgentUIMessage[];
}

export function AgentMessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="space-y-4">
      {messages.map((msg, i) => {
        switch (msg.type) {
          case "user":
            return (
              <div key={i} className="flex justify-end">
                <div className="flex items-start gap-2.5 max-w-[80%]">
                  <div className="bg-violet-600/30 border border-violet-500/30 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white/90">
                    {msg.text}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-violet-600/40 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-violet-300" />
                  </div>
                </div>
              </div>
            );

          case "agent_thinking":
            return (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-300" />
                </div>
                <details className="flex-1 group">
                  <summary className="flex items-center gap-1.5 text-xs text-white/35 cursor-pointer hover:text-white/55 transition-colors list-none">
                    <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                    Agent thinking…
                  </summary>
                  <div className="mt-2 bg-white/3 border border-white/8 rounded-xl px-3 py-2.5 text-xs text-white/40 font-mono whitespace-pre-wrap leading-relaxed">
                    {msg.text}
                  </div>
                </details>
              </div>
            );

          case "tool_start":
            return (
              <div key={i} className="pl-9">
                <ToolStepCard
                  name={msg.name}
                  label={msg.label}
                  inputSummary={msg.inputSummary}
                  status="running"
                />
              </div>
            );

          case "tool_result": {
            // Replace the matching tool_start card with the result
            return (
              <div key={i} className="pl-9">
                <ToolStepCard
                  name={msg.name}
                  label={msg.label}
                  inputSummary=""
                  status={msg.success ? "success" : "error"}
                  resultSummary={msg.resultSummary}
                  leadCount={msg.leadCount}
                />
              </div>
            );
          }

          case "agent_text":
            return (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-300" />
                </div>
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </div>
              </div>
            );

          case "plan_ready":
            // Rendered separately by the parent
            return null;

          default:
            return null;
        }
      })}
      <div ref={bottomRef} />
    </div>
  );
}
