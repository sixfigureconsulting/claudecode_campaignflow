import OpenAI from "openai";
import type { AIRecommendation } from "@/types";

export async function generateWithOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  modelPreference?: string | null
): Promise<Partial<AIRecommendation>> {
  const client = new OpenAI({ apiKey });
  const model = modelPreference || "gpt-4o";

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  const parsed = JSON.parse(content);
  return {
    provider: "openai",
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
