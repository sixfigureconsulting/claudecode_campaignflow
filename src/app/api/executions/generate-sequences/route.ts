import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { generateSequencesSchema } from "@/lib/validations";
import type { InfluenceType } from "@/lib/validations";

async function verifyOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
) {
  const { data } = await supabase
    .from("projects")
    .select("id, clients!inner(user_id)")
    .eq("id", projectId)
    .eq("clients.user_id", userId)
    .single();
  return !!data;
}

type Lead = {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  title: string;
  linkedin_url?: string | null;
  website?: string | null;
};

type Sequence = {
  linkedin_step1?: string;
  linkedin_step2?: string;
  email_subject1?: string;
  email_body1?: string;
  email_subject2?: string;
  email_body2?: string;
};

// Per-principle instruction injected as the primary driver
const INFLUENCE_INSTRUCTIONS: Record<InfluenceType, string> = {
  reciprocity: `PRIMARY DRIVER — RECIPROCITY: Open by giving something genuinely useful before asking for anything. Lead with a specific insight, pattern, mini-audit finding, or checklist directly relevant to this prospect's role, segment, or company. Make the value feel tailored — never generic. The first CTA should be to receive or view that asset, not to book a call. The "gift" must feel real and earned, not manufactured.`,

  commitment: `PRIMARY DRIVER — COMMITMENT & CONSISTENCY: Make the first ask extremely low-friction. Use micro-CTA language: "Worth a 2-min skim?", "Want the short breakdown?", "Open to a quick Loom?". Never request a 30–45 minute call in the first message. Each touchpoint references the previous small yes and gently ladders toward a bigger conversation. Make it easy to say yes to a tiny thing first.`,

  social_proof: `PRIMARY DRIVER — SOCIAL PROOF: Lead with a specific peer result that mirrors this prospect's world. Name the type of firm, segment, and 1–2 concrete metrics or outcomes. Make the proof feel directly relevant — similar industry, company size, GTM motion, or geography. Use quiet confidence, not hype. Keep numbers believable and specific. Avoid vague claims like "many clients" — name the segment.`,

  liking: `PRIMARY DRIVER — LIKING: Open with 1–2 lines showing genuine, specific research about this prospect. Reference something observable — a recent post, hire, product launch, positioning shift, or market move. Make it clear you've done real homework, not generic flattery. Tone: a smart peer who genuinely understands their world and is trying to help, never a needy salesperson seeking approval.`,

  authority: `PRIMARY DRIVER — AUTHORITY: Establish credibility immediately through niche focus, volume of experience, or clear result patterns. Keep it compact: "We only work with B2B service firms doing $500K–$5M ARR" or "We've run 100+ cold campaigns for firms like yours — most add 10–25 SQLs/month." Put authority in the opening or signature — never a long bio. Let specificity carry the weight, not adjectives.`,

  scarcity: `PRIMARY DRIVER — SCARCITY: Use honest, concrete, and explained urgency. Be specific about the limit ("3 build slots this quarter", "10 beta seats", "pricing locks end of this month") and briefly explain why the limit exists. Never use vague or manufactured urgency like "limited time offer". If the offer has no real scarcity, do not invent it — omit this element and rely on other principles instead.`,

  unity: `PRIMARY DRIVER — UNITY: Frame the entire message around shared identity and in-group belonging. Use language that signals "we're in the same world": "founder-led firms", "bootstrapped B2B teams", "AI-forward GTM teams", "B2B service companies in the GCC". Make it obvious the sender faces the same category of problems and lives in the same ecosystem. Frame as "we, not you vs. me" throughout.`,
};

const BASE_SYSTEM_PROMPT = `You are an expert B2B outbound copywriter and GTM strategist. You write cold emails and LinkedIn DMs for B2B service businesses using Robert Cialdini's principles of influence embedded naturally — no AI buzzwords, no generic corporate speak.

OUTPUT FORMAT:
- Return valid JSON only. No markdown, no explanation, no labels.
- Raw copy only — no placeholder brackets unless explicitly needed.
- Copy must feel human, direct, and written by a real person.

ALWAYS APPLY ALL SEVEN PRINCIPLES (where appropriate):
1. Reciprocity — lead with value: insight, teardown, checklist, micro-audit specific to the prospect's segment.
2. Commitment & Consistency — micro-asks first. Default first CTAs: "Worth a 2-min skim?", "Want the short breakdown?", "Okay if I send you the 2-page summary?". Avoid big asks (30–45 min calls) unless later in sequence.
3. Social Proof — at least one specific peer example: segment, firm type, 1–2 concrete metrics. No hype.
4. Liking — 1–2 opening lines showing real research: recent event, content, hiring pattern, or visible strategy.
5. Authority — 1–2 compact cues: niche focus, experience volume, result patterns. Never a long bio.
6. Scarcity — only when real and explained. Never vague urgency.
7. Unity — shared identity language: niche, stage, geography, go-to-market style.

STYLE:
- Voice: conversational, confident, respectful. Sound like a smart peer, not a sales bot.
- Short sentences, short paragraphs. Skimmable. Every line earns its place.
- No jargon unless natural for ICP (SQLs, pipeline, GTM, SDR are fine).
- No superlatives, no hype, no buzzwords ("synergy", "revolutionary", "game-changing").
- Cold email: 50–130 words per email, one clear CTA per email, strong curiosity-driven subject line.
- LinkedIn DM: shorter, more casual, back-and-forth conversational tone, no long essays.`;

async function generateForLead(
  lead: Lead,
  channels: string[],
  offerContext: string,
  influenceType: InfluenceType,
  openaiKey: string
): Promise<Sequence> {
  const wantsLinkedIn = channels.includes("linkedin");
  const wantsEmail = channels.includes("email");

  const channelInstructions: string[] = [];
  if (wantsLinkedIn) {
    channelInstructions.push(
      `- linkedin_step1: LinkedIn connection request note (max 300 chars, no subject, casual and human)
- linkedin_step2: LinkedIn follow-up message sent 3 days after connection (max 500 chars, reference the connection request implicitly, softer angle)`
    );
  }
  if (wantsEmail) {
    channelInstructions.push(
      `- email_subject1: Cold email subject line (max 60 chars, curiosity-driven, no clickbait)
- email_body1: Cold email body (50–130 words, first line personalised to their role/company/segment, one clear soft CTA)
- email_subject2: Follow-up subject line (different angle, acknowledges silence naturally)
- email_body2: Follow-up email body (50–100 words, different angle from email 1, one clear CTA)`
    );
  }

  const primaryInstruction = INFLUENCE_INSTRUCTIONS[influenceType];

  const userPrompt = `${primaryInstruction}

Lead details:
- Name: ${lead.first_name} ${lead.last_name}
- Title: ${lead.title}
- Company: ${lead.company}${lead.website ? ` (${lead.website})` : ""}${lead.linkedin_url ? `\n- LinkedIn: ${lead.linkedin_url}` : ""}

Offer / Context:
${offerContext}

Return a JSON object with exactly these fields (omit fields for channels not requested):
${channelInstructions.join("\n")}

JSON only. No explanation.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: BASE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.75,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content) as Sequence;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = generateSequencesSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );

    const { projectId, leads, channels, offerContext, influenceType } = parsed.data;

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Get OpenAI API key
    const { data: keyRow } = await supabase
      .from("integration_configs")
      .select("api_key_encrypted")
      .eq("project_id", projectId)
      .eq("service", "openai")
      .single();

    if (!keyRow)
      return NextResponse.json(
        { error: "OpenAI API key not configured. Add it in the Integrations tab." },
        { status: 400 }
      );

    const openaiKey = decryptApiKey(keyRow.api_key_encrypted);

    // Generate sequences for each lead (sequential to avoid rate limits)
    const results = [];
    for (const lead of leads) {
      try {
        const sequence = await generateForLead(lead, channels, offerContext, influenceType, openaiKey);
        results.push({ ...lead, sequence });
      } catch (err) {
        results.push({ ...lead, sequence: null, error: String(err) });
      }
    }

    const successCount = results.filter((r) => r.sequence !== null).length;

    // Log execution
    await supabase.from("executions").insert({
      project_id: projectId,
      action_type: "campaign_workflow",
      status: "completed",
      inputs_summary: `Generated ${influenceType}-led sequences for ${leads.length} leads (channels: ${channels.join(", ")})`,
      outputs_summary: `${successCount}/${leads.length} sequences generated`,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      leads: results,
      summary: `${successCount} of ${leads.length} sequences generated`,
    });
  } catch (error) {
    console.error("generate-sequences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
