import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { generateSequencesSchema } from "@/lib/validations";

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

async function generateForLead(
  lead: Lead,
  channels: string[],
  offerContext: string,
  openaiKey: string
): Promise<Sequence> {
  const wantsLinkedIn = channels.includes("linkedin");
  const wantsEmail = channels.includes("email");

  const channelInstructions: string[] = [];
  if (wantsLinkedIn) {
    channelInstructions.push(
      `- linkedin_step1: First LinkedIn DM connection request (max 300 chars, no subject)
- linkedin_step2: LinkedIn follow-up message 3 days later (max 500 chars, casual tone)`
    );
  }
  if (wantsEmail) {
    channelInstructions.push(
      `- email_subject1: Cold email subject line (max 60 chars)
- email_body1: Cold email body (3-5 short sentences, first-line personalised to their role/company)
- email_subject2: Follow-up email subject line
- email_body2: Follow-up email body (2-3 sentences, different angle)`
    );
  }

  const systemPrompt = `You are an expert B2B outreach copywriter. Write highly personalised, concise outreach sequences. Never use buzzwords like "synergy". Sound human, direct, and relevant to the prospect's role. Always include a soft CTA. Return valid JSON only — no markdown.`;

  const userPrompt = `Write a personalised outreach sequence for this lead.

Lead:
- Name: ${lead.first_name} ${lead.last_name}
- Title: ${lead.title}
- Company: ${lead.company}${lead.website ? ` (${lead.website})` : ""}${lead.linkedin_url ? `\n- LinkedIn: ${lead.linkedin_url}` : ""}

Offer / Context:
${offerContext}

Return a JSON object with these fields:
${channelInstructions.join("\n")}

JSON only, no explanation.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
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

    const { projectId, leads, channels, offerContext } = parsed.data;

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
        const sequence = await generateForLead(lead, channels, offerContext, openaiKey);
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
      inputs_summary: `Generated sequences for ${leads.length} leads (channels: ${channels.join(", ")})`,
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
