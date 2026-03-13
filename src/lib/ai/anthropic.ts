import Anthropic from "@anthropic-ai/sdk";
import type { AIRecommendation } from "@/types";

export async function generateWithAnthropic(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  modelPreference?: string | null
): Promise<Partial<AIRecommendation>> {
  const client = new Anthropic({ apiKey });
  const model = modelPreference || "claude-opus-4-6";

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.4,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic returned an empty response");
  }

  const content = textBlock.text;

  // Extract JSON — Claude may wrap in markdown fences despite instructions
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not extract JSON from Anthropic response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    provider: "anthropic",
    model_used: model,
    executive_summary: parsed.executive_summary ?? null,
    kpi_analysis: parsed.kpi_analysis ?? null,
    weakest_metric: parsed.weakest_metric ?? null,
    bottleneck_explanation: parsed.bottleneck_explanation ?? null,
    action_steps: Array.isArray(parsed.action_steps) ? parsed.action_steps : null,
    strategic_improvements: Array.isArray(parsed.strategic_improvements)
      ? parsed.strategic_improvements
      : null,
    raw_response: content,
  };
}
