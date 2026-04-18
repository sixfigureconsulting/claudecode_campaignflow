"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, RefreshCw, Coins } from "lucide-react";
import { AgentIntakeForm } from "./AgentIntakeForm";
import { AgentMessageList } from "./AgentMessageList";
import { OutreachPlanReview } from "./OutreachPlanReview";
import type { AgentUIMessage, OutreachPlan } from "@/types/database";

type Phase = "intake" | "running" | "plan_ready" | "launched";

// Running tool step state
interface RunningTool {
  callId: string;
  name: string;
  label: string;
  inputSummary: string;
}

interface Props {
  initialCreditBalance: number;
}

export function SuperAgentClient({ initialCreditBalance }: Props) {
  const [phase, setPhase] = useState<Phase>("intake");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentUIMessage[]>([]);
  const [plan, setPlan] = useState<OutreachPlan | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState(initialCreditBalance);
  const [runningTools, setRunningTools] = useState<Map<string, RunningTool>>(new Map());
  const esRef = useRef<EventSource | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  const appendMessage = useCallback((msg: AgentUIMessage) => {
    setMessages((prev: AgentUIMessage[]) => [...prev, msg]);
  }, []);

  const connectSSE = useCallback((sid: string) => {
    const es = new EventSource(`/api/super-agent/stream?sessionId=${sid}`);
    esRef.current = es;

    es.addEventListener("agent_thinking", (e: MessageEvent) => {
      const { text } = JSON.parse(e.data) as { text: string };
      appendMessage({ type: "agent_thinking", text });
    });

    es.addEventListener("agent_text", (e: MessageEvent) => {
      const { text } = JSON.parse(e.data) as { text: string };
      appendMessage({ type: "agent_text", text });
    });

    es.addEventListener("tool_start", (e: MessageEvent) => {
      const { callId, name, label, inputSummary } = JSON.parse(e.data) as {
        callId: string; name: string; label: string; inputSummary: string;
      };
      setRunningTools((prev: Map<string, RunningTool>) => {
        const next = new Map(prev);
        next.set(callId, { callId, name, label, inputSummary });
        return next;
      });
      appendMessage({ type: "tool_start", callId, name, label, inputSummary });
    });

    es.addEventListener("tool_result", (e: MessageEvent) => {
      const { callId, name, label, success, resultSummary, leadCount } = JSON.parse(e.data) as {
        callId: string; name: string; label: string; success: boolean; resultSummary: string; leadCount?: number;
      };
      setRunningTools((prev: Map<string, RunningTool>) => {
        const next = new Map<string, RunningTool>(prev);
        next.delete(callId);
        return next;
      });
      appendMessage({ type: "tool_result", callId, name, label, success, resultSummary, leadCount });
    });

    es.addEventListener("credits_update", (e: MessageEvent) => {
      const { balance } = JSON.parse(e.data) as { balance: number };
      setCreditBalance(balance);
    });

    es.addEventListener("plan_ready", (e: MessageEvent) => {
      const { plan: outreachPlan } = JSON.parse(e.data) as { plan: OutreachPlan };
      setPlan(outreachPlan);
    });

    es.addEventListener("done", () => {
      es.close();
      esRef.current = null;
      setPhase("plan_ready");
    });

    es.addEventListener("error", (e: MessageEvent) => {
      const { message } = JSON.parse(e.data ?? "{}") as { message?: string };
      appendMessage({ type: "agent_text", text: `Error: ${message ?? "Unknown error"}` });
      es.close();
      esRef.current = null;
      setPhase("plan_ready"); // still show what was completed
    });

    // Handle connection drops
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        esRef.current = null;
        // Only update phase if still running
        setPhase((prev: Phase) => (prev === "running" ? "plan_ready" : prev));
      }
    };
  }, [appendMessage]);

  const handleStart = useCallback(async (data: {
    offer: string; icp: string; goals: string; channels: string[];
  }) => {
    setFormLoading(true);
    setFormError(null);

    try {
      const res = await fetch("/api/super-agent/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json() as { sessionId?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to start session");

      const sid = json.sessionId!;
      setSessionId(sid);
      setMessages([{ type: "user", text: `Launch outreach for: ${data.offer.slice(0, 80)}…\nICP: ${data.icp.slice(0, 80)}…\nChannels: ${data.channels.join(", ")}` }]);
      setPhase("running");
      connectSSE(sid);
    } catch (err) {
      setFormError(String(err));
    } finally {
      setFormLoading(false);
    }
  }, [connectSSE]);

  const handleReset = () => {
    esRef.current?.close();
    esRef.current = null;
    setPhase("intake");
    setSessionId(null);
    setMessages([]);
    setPlan(null);
    setFormError(null);
    setRunningTools(new Map());
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Credit badge */}
      <div className="flex justify-end">
        <div className="flex items-center gap-1.5 text-xs font-semibold bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-white/60">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          {creditBalance.toLocaleString()} credits
        </div>
      </div>

      {/* Intake form */}
      {phase === "intake" && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-600/30 border border-violet-500/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h2 className="font-bold text-white">Super AI Agent</h2>
              <p className="text-xs text-white/40">Describe your offer and ICP. The agent does the rest.</p>
            </div>
          </div>
          <AgentIntakeForm onStart={handleStart} loading={formLoading} error={formError} />
        </div>
      )}

      {/* Running / plan_ready */}
      {(phase === "running" || phase === "plan_ready") && (
        <div className="space-y-4">
          {/* Chat messages */}
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 min-h-[300px]">
            {phase === "running" && messages.length === 0 && (
              <div className="flex items-center gap-3 text-sm text-white/40 py-8 justify-center">
                <Bot className="w-5 h-5 animate-pulse text-violet-400" />
                Agent starting…
              </div>
            )}
            <AgentMessageList messages={messages.filter((m: AgentUIMessage) => m.type !== "plan_ready")} />
          </div>

          {/* Plan review */}
          {phase === "plan_ready" && plan && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
              <OutreachPlanReview
                plan={plan}
                sessionId={sessionId!}
                onLaunched={() => setPhase("launched")}
              />
            </div>
          )}

          {phase === "plan_ready" && !plan && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 text-center text-sm text-white/50">
              Agent completed but no structured plan was returned. Check the messages above.
            </div>
          )}

          {/* Reset button */}
          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Start a new session
            </button>
          </div>
        </div>
      )}

      {/* Launched */}
      {phase === "launched" && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          <div className="text-center py-6 space-y-3">
            <p className="text-lg font-bold text-white">Campaigns are live!</p>
            <p className="text-sm text-white/50">Your campaigns and automations are now running.</p>
          </div>
          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Run another campaign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
