"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, RefreshCw, Zap, Rocket } from "lucide-react";
import { AgentIntakeForm } from "./AgentIntakeForm";
import { AgentMessageList } from "./AgentMessageList";
import { OutreachPlanReview } from "./OutreachPlanReview";
import type { AgentUIMessage, OutreachPlan } from "@/types/database";

type Phase = "intake" | "running" | "plan_ready" | "launched";

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

  useEffect(() => { return () => { esRef.current?.close(); }; }, []);

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
      const d = JSON.parse(e.data) as { callId: string; name: string; label: string; inputSummary: string };
      setRunningTools((prev: Map<string, RunningTool>) => { const n = new Map(prev); n.set(d.callId, d); return n; });
      appendMessage({ type: "tool_start", ...d });
    });
    es.addEventListener("tool_result", (e: MessageEvent) => {
      const d = JSON.parse(e.data) as { callId: string; name: string; label: string; success: boolean; resultSummary: string; leadCount?: number };
      setRunningTools((prev: Map<string, RunningTool>) => { const n = new Map<string, RunningTool>(prev); n.delete(d.callId); return n; });
      appendMessage({ type: "tool_result", ...d });
    });
    es.addEventListener("credits_update", (e: MessageEvent) => {
      const { balance } = JSON.parse(e.data) as { balance: number };
      setCreditBalance(balance);
    });
    es.addEventListener("plan_ready", (e: MessageEvent) => {
      const { plan: p } = JSON.parse(e.data) as { plan: OutreachPlan };
      setPlan(p);
    });
    es.addEventListener("done", () => { es.close(); esRef.current = null; setPhase("plan_ready"); });
    es.addEventListener("error", (e: MessageEvent) => {
      const { message } = JSON.parse((e as MessageEvent).data ?? "{}") as { message?: string };
      appendMessage({ type: "agent_text", text: `Error: ${message ?? "Unknown error"}` });
      es.close(); esRef.current = null;
      setPhase((prev: Phase) => prev === "running" ? "plan_ready" : prev);
    });
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        esRef.current = null;
        setPhase((prev: Phase) => prev === "running" ? "plan_ready" : prev);
      }
    };
  }, [appendMessage]);

  const handleStart = useCallback(async (data: { offer: string; icp: string; goals: string; channels: string[] }) => {
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
      setMessages([{ type: "user", text: `Offer: ${data.offer.slice(0, 100)}\nICP: ${data.icp.slice(0, 100)}\nChannels: ${data.channels.join(", ")}` }]);
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

  // suppress unused-var lint — runningTools used for SSE bookkeeping only
  void runningTools;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Credit badge */}
      <div className="flex justify-end">
        <div className="flex items-center gap-1.5 text-xs font-semibold bg-white/[0.06] border border-white/[0.08] px-3 py-1.5 rounded-full text-white/55">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          {creditBalance.toLocaleString()} credits
        </div>
      </div>

      {/* ── Intake ── */}
      {phase === "intake" && (
        <div className="rounded-2xl border border-white/[0.08]" style={{ background: "rgba(15,12,32,0.97)" }}>
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,rgba(124,58,237,.35),rgba(79,70,229,.35))", border: "1px solid rgba(139,92,246,.3)" }}>
              <Bot className="w-4 h-4 text-violet-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Configure Campaign</p>
              <p className="text-xs text-white/40">50 credits · Everything created in DRAFT — you approve before launch</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <AgentIntakeForm onStart={handleStart} loading={formLoading} error={formError} />
          </div>
        </div>
      )}

      {/* ── Running / Plan Ready ── */}
      {(phase === "running" || phase === "plan_ready") && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.07] min-h-[240px] p-5"
            style={{ background: "rgba(10,11,22,0.98)" }}>
            {phase === "running" && messages.length === 0 && (
              <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-white/35">
                <Bot className="w-4 h-4 animate-pulse text-violet-400" />
                Agent initialising…
              </div>
            )}
            <AgentMessageList messages={messages.filter((m: AgentUIMessage) => m.type !== "plan_ready")} />
          </div>

          {phase === "plan_ready" && plan && (
            <div className="rounded-2xl border border-white/[0.07] p-6" style={{ background: "rgba(12,13,26,0.98)" }}>
              <OutreachPlanReview plan={plan} sessionId={sessionId!} onLaunched={() => setPhase("launched")} />
            </div>
          )}

          {phase === "plan_ready" && !plan && (
            <div className="rounded-2xl border border-white/[0.07] p-6 text-center text-sm text-white/45"
              style={{ background: "rgba(12,13,26,0.98)" }}>
              Agent completed — no structured plan returned. Review the messages above.
            </div>
          )}

          <div className="flex justify-center">
            <button onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/55 transition-colors">
              <RefreshCw className="w-3 h-3" />
              Start a new session
            </button>
          </div>
        </div>
      )}

      {/* ── Launched ── */}
      {phase === "launched" && (
        <div className="rounded-2xl border border-emerald-500/20 p-8 text-center space-y-3"
          style={{ background: "rgba(8,20,14,0.97)" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.3)" }}>
            <Rocket className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-lg font-black text-white">Campaigns are live!</p>
          <p className="text-sm text-white/45">All campaigns and automations are now running.</p>
          <button onClick={handleReset}
            className="mt-2 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/55 transition-colors mx-auto">
            <RefreshCw className="w-3 h-3" />
            Run another campaign
          </button>
        </div>
      )}

    </div>
  );
}
