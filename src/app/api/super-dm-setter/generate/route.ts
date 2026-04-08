import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { decryptApiKey } from "@/lib/encryption";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  industry: z.enum(["real_estate", "high_ticket", "dm_sales", "agency", "coaching", "saas", "other"]),
  channel: z.enum(["linkedin", "instagram", "sms", "whatsapp", "twitter", "facebook", "email"]),
  messageType: z
    .enum(["opener", "pain_point", "poke_the_bear", "pitch", "followup", "urgency", "objection", "book_appt"])
    .default("opener"),
  tone: z.enum(["professional", "casual", "direct", "empathetic", "urgency"]),
  prospectName: z.string().max(100).optional(),
  contextNotes: z.string().max(1000).optional(),
  conversation: z.string().min(1).max(8000),
  provider: z.enum(["anthropic", "openai"]),
  // Vision (screenshot) support
  imageBase64: z.string().optional(),
  imageMimeType: z.string().optional(),
  // CSV batch mode
  csvMode: z.boolean().optional(),
});

const SYSTEM_PROMPT = `You are Super DM Setter — an elite AI trained in high-converting appointment-setting across every major DM channel and industry.

CORE PRINCIPLES:
1. Speed to Lead: First to respond wins. Every minute of delay loses conversions.
2. Pattern Interrupt: The opener must stop the scroll and spark curiosity — no generic lines.
3. One CTA Per Message: End with exactly ONE clear next step. No ambiguity.
4. Conversation Temperature: Score intent from Cold to Fire using micro-signals.
5. Channel Intelligence: Message length, tone, and style adapt hard to the platform.
6. Objection Reframe: Validate → Pivot → Bridge → CTA. Never argue.

CHANNEL FORMATTING RULES (follow strictly):
- LinkedIn DM: 3–5 sentences. Professional but human. One emoji max.
- Instagram DM: 1–3 sentences. Casual and conversational. Up to 2 emoji.
- SMS/WhatsApp: 1–2 sentences MAXIMUM. Ultra-short. Like texting a close friend.
- Twitter/X DM: 1 sentence only. No salesy language at all.
- Facebook DM: Warm and friendly. 2–3 sentences.
- Email (cold): Max 4 sentences. One CTA only.

MESSAGE TYPE BEHAVIORS:
- opener: Pattern interrupt to get a reply. No pitch. Create curiosity only.
- pain_point: Ask a targeted question to uncover their core problem.
- poke_the_bear: Stir the pain. Make them feel the cost of not acting.
- pitch: Introduce your solution with context from previous replies.
- objection: Validate concern → reframe → bridge to value → CTA.
- followup: Re-engage a ghost. Direct, caring, not desperate.
- urgency: Drive immediate action with real scarcity or time sensitivity.
- book_appt: Push for the calendar booking. Remove all friction.

INDUSTRY KNOWLEDGE:
- Real Estate: Market timing urgency, rate windows, neighborhood FOMO.
- High-Ticket Sales: Pain-first, transformation-led. Never pitch features.
- DM Sales: Social proof → curiosity → fast CTA. Short and punchy.
- Agency: Lead with specific niche results ("We got [niche] X leads in Y days").
- Coaching: Empathy-led, outcome-driven, story-based.
- SaaS: ROI-first, time-to-value, free trial/demo hooks.

CONVERSATION TEMPERATURE (for non-CSV modes):
- Cold (0–25): No reply, skeptical, one-word, deflection.
- Warm (26–55): Asks questions, shares context, curious but not committed.
- Hot (56–80): Shares pain, asks about price/timing, decision coming soon.
- Fire (81–100): "How do I start?", shares budget, expresses urgency.
Set suggest_call to true when temperature is 56+.

OUTPUT: Return only valid JSON, no markdown fences, no extra text:
{
  "temperature": "cold|warm|hot|fire",
  "temperature_score": 0-100,
  "temperature_reason": "2 sentence analysis",
  "suggest_call": true|false,
  "call_reason": "why to call NOW (if true)",
  "call_action": "call|voice_note|video_loom",
  "messages": [
    {
      "rank": 1,
      "message": "copy-paste ready message text",
      "strategy": "strategy name",
      "why_it_works": "1 sentence",
      "conversion_probability": "high|medium|low"
    }
  ]
}`;

function buildUserPrompt(data: z.infer<typeof requestSchema>): string {
  const industryMap: Record<string, string> = {
    real_estate: "Real Estate", high_ticket: "High-Ticket Sales", dm_sales: "DM Sales",
    agency: "Agency Services", coaching: "Coaching / Consulting", saas: "SaaS", other: "Other",
  };
  const channelMap: Record<string, string> = {
    linkedin: "LinkedIn DM", instagram: "Instagram DM", sms: "SMS", whatsapp: "WhatsApp",
    twitter: "Twitter/X DM", facebook: "Facebook DM", email: "Cold Email",
  };
  const messageTypeMap: Record<string, string> = {
    opener: "Conversation Opener (pattern interrupt, get a reply)",
    pain_point: "Discover Pain Point (question to uncover their core problem)",
    poke_the_bear: "Poke the Bear (stir pain, make them feel urgency)",
    pitch: "Pitch the Offer (introduce solution with context)",
    objection: "Handle Objection (validate → reframe → bridge)",
    followup: "Follow-Up (re-engage a ghost)",
    urgency: "Urgency Close (drive immediate action)",
    book_appt: "Book Appointment (push for calendar booking)",
  };

  return `GENERATE: ${messageTypeMap[data.messageType] || data.messageType}

CONTEXT:
- Industry: ${industryMap[data.industry]}
- Channel: ${channelMap[data.channel]}
- Tone: ${data.tone}${data.prospectName ? `\n- Prospect Name: ${data.prospectName}` : ""}${data.contextNotes ? `\n- Notes: ${data.contextNotes}` : ""}
${data.csvMode ? "- Mode: CSV batch (temperature scoring not needed, set cold/50 as default, suggest_call false)" : ""}

CONVERSATION (newest at bottom):
---
${data.conversation}
---

Generate 3 copy-paste ready messages for the channel. Return JSON only.`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = rateLimit(`super-dm:${user.id}`, { limit: 20, windowMs: 60_000 });
    if (!rl.success) return rateLimitResponse(rl.resetAt);

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    const { data: aiConfig } = await supabase
      .from("ai_configs")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", data.provider)
      .single();

    if (!aiConfig) {
      return NextResponse.json(
        { error: `No ${data.provider === "openai" ? "OpenAI" : "Anthropic"} API key configured. Add it in Settings → AI Configuration.` },
        { status: 400 }
      );
    }

    const apiKey = decryptApiKey(aiConfig.api_key_encrypted);
    const userPrompt = buildUserPrompt(data);
    const hasImage = !!data.imageBase64;

    let result: Record<string, unknown>;

    if (data.provider === "openai") {
      const client = new OpenAI({ apiKey });
      const model = aiConfig.model_preference || "gpt-4o";

      const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [];
      if (hasImage && data.imageBase64 && data.imageMimeType) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${data.imageMimeType};base64,${data.imageBase64}`, detail: "high" },
        });
      }
      userContent.push({ type: "text", text: userPrompt });

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("OpenAI returned an empty response");
      result = JSON.parse(content);
    } else {
      const client = new Anthropic({ apiKey });
      const model = aiConfig.model_preference || "claude-opus-4-6";

      const userContent: Anthropic.ContentBlockParam[] = [];

      if (hasImage && data.imageBase64 && data.imageMimeType) {
        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
        type AllowedMime = typeof allowedTypes[number];
        const mimeType: AllowedMime = allowedTypes.includes(data.imageMimeType as AllowedMime)
          ? (data.imageMimeType as AllowedMime)
          : "image/jpeg";
        userContent.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data: data.imageBase64 },
        });
        userContent.push({ type: "text", text: `This is a screenshot of a DM conversation. Read it carefully and analyze the prospect's signals.\n\n${userPrompt}` });
      } else {
        userContent.push({ type: "text", text: userPrompt });
      }

      const response = await client.messages.create({
        model,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.7,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("Anthropic returned an empty response");
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse AI response");
      result = JSON.parse(jsonMatch[0]);
    }

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    console.error("Super DM Setter error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
