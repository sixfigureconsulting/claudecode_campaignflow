import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// POST /api/inbox/conversations/[id]/reply
// body: { body?: string; mode: "send" | "draft_ai"; ai_provider?: "anthropic" | "openai" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const mode: "send" | "draft_ai" = body.mode ?? "send";

  // Fetch conversation context
  const { data: convo, error: convoErr } = await supabase
    .from("inbox_conversations")
    .select(`
      id, subject, contact_name, contact_email, classification,
      inbox_messages ( direction, sender_name, body, sent_at ),
      inbox_accounts ( provider, account_label )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .order("sent_at", { referencedTable: "inbox_messages", ascending: true })
    .single();

  if (convoErr || !convo) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // ── Draft AI mode: generate a reply draft ──────────────────────────────────
  if (mode === "draft_ai") {
    const aiProvider = body.ai_provider ?? "anthropic";
    const messages = (convo.inbox_messages ?? []) as Array<{ direction: string; body: string }>;
    const threadContext = messages
      .map((m) => `[${m.direction === "inbound" ? "Them" : "You"}]: ${m.body}`)
      .join("\n\n");

    const systemPrompt = `You are an expert sales assistant helping write a reply to a prospect.
Write a concise, professional, and personalized reply that:
- Continues the conversation naturally
- Is warm but direct
- Moves toward booking a call or demo if the context warrants
- Is 2-4 sentences max unless the context requires more
- Does NOT use generic filler phrases like "Hope this email finds you well"
Return ONLY the reply text, no subject line, no preamble.`;

    const userContent = `Conversation with ${convo.contact_name ?? "prospect"} (${convo.contact_email ?? ""}):
Subject: ${convo.subject ?? "(no subject)"}

${threadContext}

Write a reply:`;

    try {
      let draft = "";
      if (aiProvider === "anthropic") {
        const apiKey = getApiKey(await getGlobalApiConfig(supabase, user.id, "anthropic"));
        if (!apiKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 400 });
        const anthropic = new Anthropic({ apiKey });
        const resp = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        });
        draft = resp.content[0].type === "text" ? resp.content[0].text : "";
      } else {
        const apiKey = getApiKey(await getGlobalApiConfig(supabase, user.id, "openai"));
        if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 400 });
        const openai = new OpenAI({ apiKey });
        const resp = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        });
        draft = resp.choices[0]?.message?.content ?? "";
      }
      return NextResponse.json({ draft });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI draft failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Send mode: store outbound message ─────────────────────────────────────
  const replyBody: string = body.body;
  if (!replyBody?.trim()) {
    return NextResponse.json({ error: "Reply body is required" }, { status: 400 });
  }

  const { data: message, error: msgErr } = await supabase
    .from("inbox_messages")
    .insert({
      conversation_id: id,
      user_id: user.id,
      direction: "outbound",
      sender_name: user.user_metadata?.full_name ?? user.email ?? "You",
      sender_email: user.email ?? "",
      body: replyBody,
      sent_at: new Date().toISOString(),
    })
    .select("id, conversation_id, user_id, direction, sender_name, sender_email, body, sent_at, created_at")
    .single();

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  // Update conversation last_message_at
  await supabase
    .from("inbox_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  // NOTE: Actual sending via Gmail API / ManyChat / LinkedIn would be triggered here
  // based on convo.inbox_accounts.provider. Tracked as inbox_messages direction='outbound'.

  return NextResponse.json({ message, sent: true });
}
