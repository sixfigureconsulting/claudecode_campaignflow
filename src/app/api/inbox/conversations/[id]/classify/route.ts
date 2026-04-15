import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Warmup tool signal phrases — auto-classify as 'warmup' without AI call
const WARMUP_SIGNALS = [
  "this is a warmup email",
  "warmup sequence",
  "email warmup",
  "instantly.ai",
  "smartlead warmup",
  "mailreach",
  "lemwarm",
  "warmbox",
  "you're one of the great",
  "great email i ever received",
];

function isWarmupEmail(subject: string, body: string): boolean {
  const text = `${subject} ${body}`.toLowerCase();
  return WARMUP_SIGNALS.some((signal) => text.includes(signal));
}

// POST /api/inbox/conversations/[id]/classify — run AI classification
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Fetch conversation + settings + messages
  const [convoResult, settingsResult] = await Promise.all([
    supabase
      .from("inbox_conversations")
      .select("id, subject, contact_name, contact_email, contact_company, inbox_messages(body, direction, sent_at)")
      .eq("id", id)
      .eq("user_id", user.id)
      .order("sent_at", { referencedTable: "inbox_messages", ascending: true })
      .single(),
    supabase
      .from("inbox_settings")
      .select("icp_description, sales_keywords, blocked_senders, block_warmup_tools, ai_provider")
      .eq("user_id", user.id)
      .single(),
  ]);

  if (convoResult.error || !convoResult.data) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const convo = convoResult.data;
  const settings = settingsResult.data;
  const messages = (convo.inbox_messages ?? []) as Array<{ body: string; direction: string }>;
  const inboundMessages = messages.filter((m) => m.direction === "inbound");
  const fullText = inboundMessages.map((m) => m.body).join("\n\n");

  // Fast-path: blocked sender check
  if (settings?.blocked_senders?.length && convo.contact_email) {
    const email = convo.contact_email.toLowerCase();
    const domain = email.split("@")[1] ?? "";
    const isBlocked = settings.blocked_senders.some(
      (s: string) => email.includes(s.toLowerCase()) || domain.includes(s.toLowerCase())
    );
    if (isBlocked) {
      await supabase.from("inbox_conversations").update({
        classification: "not_prospect",
        classification_reason: "Sender is on your block list.",
        classification_score: 0,
        is_blocked: true,
      }).eq("id", id).eq("user_id", user.id);
      return NextResponse.json({ classification: "not_prospect", reason: "Blocked sender" });
    }
  }

  // Fast-path: warmup detection
  if (settings?.block_warmup_tools !== false) {
    if (isWarmupEmail(convo.subject ?? "", fullText)) {
      await supabase.from("inbox_conversations").update({
        classification: "warmup",
        classification_reason: "Detected warmup email signals. Automatically filtered.",
        classification_score: 95,
      }).eq("id", id).eq("user_id", user.id);
      return NextResponse.json({ classification: "warmup", reason: "Warmup email detected" });
    }
  }

  // AI classification
  const aiProvider = settings?.ai_provider ?? "anthropic";
  const keywords = settings?.sales_keywords ?? ["proposal", "demo", "appointment", "meeting", "pricing", "quote"];
  const icp = settings?.icp_description ?? "";

  const systemPrompt = `You are a sales intelligence assistant. Classify whether an incoming conversation is from a genuine sales prospect.

Return JSON in EXACTLY this format (no markdown, no extra text):
{"classification":"prospect"|"not_prospect","reason":"one sentence explanation","score":0-100}

Classification rules:
- "prospect": the sender appears to be a potential buyer or customer — they mention interest, ask about pricing/demo/proposal/appointment, or match the ICP
- "not_prospect": internal emails, invoices, HR, newsletters, spam, promotions, automated notifications, or clearly non-sales content
- score: confidence 0-100

Sales keywords that indicate a prospect: ${keywords.join(", ")}
${icp ? `\nIdeal Customer Profile: ${icp}` : ""}`;

  const userContent = `Subject: ${convo.subject ?? "(no subject)"}
From: ${convo.contact_name ?? ""} <${convo.contact_email ?? ""}>
${convo.contact_company ? `Company: ${convo.contact_company}` : ""}

Message:
${fullText.slice(0, 3000)}`;

  try {
    let classification = "unclassified";
    let reason = "AI classification unavailable";
    let score = 50;

    if (aiProvider === "anthropic") {
      const apiKey = getApiKey(await getGlobalApiConfig(supabase, user.id, "anthropic"));
      if (!apiKey) throw new Error("Anthropic API key not configured");
      const anthropic = new Anthropic({ apiKey });
      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      });
      const text = resp.content[0].type === "text" ? resp.content[0].text : "";
      const parsed = JSON.parse(text);
      classification = parsed.classification;
      reason = parsed.reason;
      score = parsed.score;
    } else {
      const apiKey = getApiKey(await getGlobalApiConfig(supabase, user.id, "openai"));
      if (!apiKey) throw new Error("OpenAI API key not configured");
      const openai = new OpenAI({ apiKey });
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      });
      const text = resp.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(text);
      classification = parsed.classification;
      reason = parsed.reason;
      score = parsed.score;
    }

    await supabase.from("inbox_conversations").update({
      classification,
      classification_reason: reason,
      classification_score: score,
    }).eq("id", id).eq("user_id", user.id);

    return NextResponse.json({ classification, reason, score });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Classification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
