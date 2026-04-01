import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { qualifyLeadsSchema } from "@/lib/validations";

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
    const parsed = qualifyLeadsSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );

    const { projectId, leads, icpDescription } = parsed.data;

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

    // Build a single batch prompt to qualify all leads at once (cheaper + faster)
    const leadList = leads
      .map(
        (l, i) =>
          `${i + 1}. ${l.first_name} ${l.last_name} | ${l.title} @ ${l.company}${l.website ? ` (${l.website})` : ""}`
      )
      .join("\n");

    const systemPrompt = `You are a B2B sales qualification expert. Given an ICP (Ideal Customer Profile) description and a list of leads, qualify each lead as FIT or NOT_FIT with a brief one-sentence reason.

Respond with a JSON array ONLY — no markdown, no explanation. Each element must have:
- "index": the 1-based lead number
- "qualified": true or false
- "reason": one sentence max`;

    const userPrompt = `ICP Description:
${icpDescription}

Leads to qualify:
${leadList}

Return JSON array only.`;

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
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: `OpenAI error: ${err.error?.message ?? res.statusText}` },
        { status: 502 }
      );
    }

    const aiResponse = await res.json();
    let qualifications: Array<{ index: number; qualified: boolean; reason: string }> = [];

    try {
      const content = aiResponse.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content);
      // Handle both { results: [...] } and [...] shapes
      qualifications = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.results)
        ? parsed.results
        : Array.isArray(parsed.leads)
        ? parsed.leads
        : [];
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI qualification response" },
        { status: 500 }
      );
    }

    // Merge qualification results back into leads
    const qualifiedLeads = leads.map((lead, i) => {
      const q = qualifications.find((r) => r.index === i + 1);
      return {
        ...lead,
        qualified: q?.qualified ?? true,
        qualification_reason: q?.reason ?? "",
      };
    });

    const qualifiedCount = qualifiedLeads.filter((l) => l.qualified).length;

    return NextResponse.json({
      leads: qualifiedLeads,
      summary: `${qualifiedCount} of ${leads.length} leads qualify against your ICP`,
    });
  } catch (error) {
    console.error("qualify-leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
