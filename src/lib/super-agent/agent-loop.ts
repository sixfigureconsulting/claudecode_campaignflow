import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, BetaContentBlock, BetaToolUseBlock, BetaTextBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPER_AGENT_SYSTEM_PROMPT } from "./system-prompt";
import {
  SUPER_AGENT_TOOLS,
  executeResearchIcp,
  executeBuildLeadList,
  executeGenerateSequences,
  executeCreateCampaign,
  executeCreateCommentAutomation,
  type ToolExecutionResult,
} from "./tools";
import { deductCredits } from "@/lib/credits";
import { decryptApiKey } from "@/lib/encryption";
import type { OutreachPlan } from "@/types/database";

export type EmitFn = (event: string, data: unknown) => void;

function buildAvailabilityContext(available: Record<string, boolean>): string {
  const lines = Object.entries(available)
    .map(([k, v]) => `  - ${k}: ${v ? "available" : "NOT configured"}`)
    .join("\n");
  return `\nAVAILABLE INTEGRATIONS:\n${lines}\n`;
}

interface RunAgentLoopOptions {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string;
  offer: string;
  icp: string;
  goals: string;
  channels: string[];
  availableIntegrations: Record<string, boolean>;
  emit: EmitFn;
}

export async function runAgentLoop(opts: RunAgentLoopOptions): Promise<void> {
  const { supabase, userId, sessionId, offer, icp, goals, channels, availableIntegrations, emit } = opts;

  const { data: aiConfig } = await supabase
    .from("ai_configs")
    .select("api_key_encrypted")
    .eq("user_id", userId)
    .eq("provider", "anthropic")
    .single();

  if (!aiConfig) {
    emit("error", { message: "No Anthropic API key configured. Add one in Settings → AI Config." });
    await markSessionFailed(supabase, sessionId);
    return;
  }

  const apiKey = decryptApiKey(aiConfig.api_key_encrypted as string);
  const client = new Anthropic({ apiKey });

  const systemPrompt =
    SUPER_AGENT_SYSTEM_PROMPT +
    buildAvailabilityContext(availableIntegrations) +
    `\nOFFER: ${offer}\nICP: ${icp}\nGOALS: ${goals}\nCHANNELS: ${channels.join(", ")}\n`;

  const userMessage = `Please build a complete outreach campaign for me.

OFFER: ${offer}
ICP: ${icp}
GOALS: ${goals}
CHANNELS: ${channels.join(", ")}

Research the ICP, build lead lists using available integrations, generate sequences, and create draft campaigns. Return the structured outreach plan when done.`;

  await persistMessage(supabase, sessionId, userId, "user", [{ type: "text", text: userMessage }], "user_message", {});

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  let inputTokensTotal = 0;
  let outputTokensTotal = 0;
  const createdListIds: string[] = [];
  const createdCampaignIds: string[] = [];
  const createdAutomationIds: string[] = [];

  for (let turn = 0; turn < 20; turn++) {
    let response: BetaMessage;

    try {
      response = await client.beta.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: systemPrompt,
        tools: SUPER_AGENT_TOOLS as Anthropic.Beta.Messages.BetaTool[],
        messages: messages as Anthropic.Beta.Messages.BetaMessageParam[],
        betas: ["interleaved-thinking-2025-05-14"],
      });
    } catch (err) {
      emit("error", { message: `Agent API error: ${String(err)}` });
      await markSessionFailed(supabase, sessionId);
      return;
    }

    inputTokensTotal += response.usage.input_tokens;
    outputTokensTotal += response.usage.output_tokens;

    // Emit non-tool blocks first
    for (const block of response.content) {
      if (block.type === "thinking" && "thinking" in block && block.thinking) {
        emit("agent_thinking", { text: block.thinking });
        await persistMessage(supabase, sessionId, userId, "assistant", [block], "agent_thinking", { text: block.thinking });
      } else if (block.type === "text" && (block as BetaTextBlock).text.trim()) {
        emit("agent_text", { text: (block as BetaTextBlock).text });
        await persistMessage(supabase, sessionId, userId, "assistant", [block], "agent_text", { text: (block as BetaTextBlock).text });
      }
    }

    // Add assistant turn to history
    messages.push({ role: "assistant", content: response.content as Anthropic.MessageParam["content"] });

    // Execute all tool_use blocks and collect results
    const toolUseBlocks = response.content.filter((b: BetaContentBlock): b is BetaToolUseBlock => b.type === "tool_use");

    if (toolUseBlocks.length > 0) {
      const toolResultContent: Anthropic.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        const toolName = toolBlock.name;
        const toolInput = toolBlock.input as Record<string, unknown>;
        const callId = toolBlock.id;

        // Emit tool_start
        const inputSummary = buildInputSummary(toolName, toolInput);
        emit("tool_start", { callId, name: toolName, label: TOOL_LABELS[toolName] ?? toolName, inputSummary });
        await persistMessage(supabase, sessionId, userId, "assistant", [toolBlock], "tool_start", { callId, name: toolName, inputSummary });

        // Execute tool
        const result = await executeTool(supabase, userId, toolName, toolInput);

        // Deduct credits
        const creditResult = await deductCredits(supabase, userId, "super_agent_tool_call", 1, { session_id: sessionId, tool: toolName });

        // Track created resources
        if (result.success) {
          if (toolName === "build_lead_list" && result.data.list_id) createdListIds.push(result.data.list_id as string);
          if (toolName === "create_campaign" && result.data.campaign_id) createdCampaignIds.push(result.data.campaign_id as string);
          if (toolName === "create_comment_automation" && result.data.automation_id) createdAutomationIds.push(result.data.automation_id as string);
        }

        // Emit tool_result
        emit("tool_result", {
          callId,
          name: toolName,
          label: TOOL_LABELS[toolName] ?? toolName,
          success: result.success,
          resultSummary: result.summary,
          leadCount: (result.data.lead_count as number | undefined) ?? undefined,
        });
        emit("credits_update", { balance: creditResult.balance });

        const resultPayload = result.success
          ? result.data
          : { error: result.error, summary: result.summary };

        await persistMessage(supabase, sessionId, userId, "tool_result", [{
          type: "tool_result",
          tool_use_id: callId,
          content: JSON.stringify(resultPayload),
        }], "tool_result", {
          callId,
          name: toolName,
          success: result.success,
          resultSummary: result.summary,
        });

        toolResultContent.push({
          type: "tool_result",
          tool_use_id: callId,
          content: JSON.stringify(resultPayload),
        });
      }

      // Add tool results as the next user message
      messages.push({ role: "user", content: toolResultContent });
    }

    if (response.stop_reason === "end_turn") {
      // Parse OutreachPlan from the last text block
      const lastText = [...response.content].reverse().find((b: BetaContentBlock): b is BetaTextBlock => b.type === "text");
      let outreachPlan: OutreachPlan | null = null;

      if (lastText) {
        const jsonMatch = lastText.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            outreachPlan = JSON.parse(jsonMatch[0]) as OutreachPlan;
          } catch {
            // Prose mixed with JSON — skip
          }
        }
      }

      await supabase
        .from("super_agent_sessions")
        .update({
          status: "awaiting_approval",
          outreach_plan: outreachPlan,
          created_list_ids: createdListIds,
          created_campaign_ids: createdCampaignIds,
          created_automation_ids: createdAutomationIds,
          input_tokens: inputTokensTotal,
          output_tokens: outputTokensTotal,
        })
        .eq("id", sessionId);

      if (outreachPlan) {
        emit("plan_ready", { plan: outreachPlan });
      }
      emit("done", { sessionId });
      return;
    }

    // continue loop on tool_use stop_reason
  }

  // Exceeded turn limit
  await markSessionFailed(supabase, sessionId);
  emit("error", { message: "Agent reached maximum turn limit without completing." });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function executeTool(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  // SupabaseClient types differ between @supabase/supabase-js and the server helper,
  // but at runtime they are the same object. Cast through unknown to satisfy TS.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  switch (toolName) {
    case "research_icp":
      return executeResearchIcp(db, userId, input as Parameters<typeof executeResearchIcp>[2]);
    case "build_lead_list":
      return executeBuildLeadList(db, userId, input as Parameters<typeof executeBuildLeadList>[2]);
    case "generate_sequences":
      return executeGenerateSequences(db, userId, input as Parameters<typeof executeGenerateSequences>[2]);
    case "create_campaign":
      return executeCreateCampaign(db, userId, input as Parameters<typeof executeCreateCampaign>[2]);
    case "create_comment_automation":
      return executeCreateCommentAutomation(db, userId, input as Parameters<typeof executeCreateCommentAutomation>[2]);
    default:
      return { success: false, summary: `Unknown tool: ${toolName}`, data: {}, error: "Unknown tool" };
  }
}

async function persistMessage(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  role: string,
  content: unknown[],
  displayType: string,
  displayData: Record<string, unknown>
) {
  await supabase.from("super_agent_messages").insert({
    session_id: sessionId,
    user_id: userId,
    role,
    content,
    display_type: displayType,
    display_data: displayData,
  });
}

async function markSessionFailed(supabase: SupabaseClient, sessionId: string) {
  await supabase.from("super_agent_sessions").update({ status: "failed" }).eq("id", sessionId);
}

function buildInputSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "research_icp":
      return `ICP: "${String(input.icp_description ?? "").slice(0, 60)}…"`;
    case "build_lead_list":
      return `${input.source} → "${input.list_name}"`;
    case "generate_sequences":
      return `${input.channel} sequence, ${input.tone} tone`;
    case "create_campaign":
      return `"${input.name}" (${input.channel})`;
    case "create_comment_automation":
      return `${input.platform}: keyword "${input.keyword}"`;
    default:
      return JSON.stringify(input).slice(0, 80);
  }
}

const TOOL_LABELS: Record<string, string> = {
  research_icp: "Researching ICP",
  build_lead_list: "Building Lead List",
  generate_sequences: "Generating Sequences",
  create_campaign: "Creating Campaign",
  create_comment_automation: "Creating Comment Automation",
};
