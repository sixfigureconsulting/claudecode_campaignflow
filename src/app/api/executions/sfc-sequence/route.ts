import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { requireCredits, deductCredits } from "@/lib/credits";

export const maxDuration = 60;

const MAX_LEADS = 10;

type Lead = Record<string, string>;

interface SequenceStep {
  subject: string | null;
  body: string;
}
interface Sequence {
  step1: SequenceStep;
  step2: SequenceStep;
  step3: SequenceStep;
  step4: SequenceStep;
  step5: SequenceStep;
}

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

async function generateSequence(lead: Lead, anthropic: Anthropic): Promise<Sequence | null> {
  const system = `You are a Senior SDR at Six Figure Consulting (SFC), an AI Outbound Agency that books qualified appointments for B2B agencies and service businesses.

SFC helps established agencies and B2B service businesses get qualified appointments via AI-powered multichannel acquisition systems (LinkedIn DMs, cold email, Voice AI).

ICP: Agency owners, B2B founders, CEOs with 2-10 employees, $120k-$500k/yr revenue, US/Canada, selling high-ticket services ($5k+).

Your job: Write a 5-step re-engagement sequence for a lead who previously replied to outreach but never booked a call. They showed interest but went cold.

Tone: Human, founder-to-founder, curious, short, no hype. Each message must feel genuinely written for THIS specific person.

Return ONLY a valid JSON object, no markdown, no backticks, exactly this shape:
{
  "step1": { "subject": null, "body": "..." },
  "step2": { "subject": null, "body": "..." },
  "step3": { "subject": "...", "body": "..." },
  "step4": { "subject": "Re: ...", "body": "..." },
  "step5": { "subject": null, "body": "Hi {{first_name}}, this is [caller] from Six Figure Consulting. I noticed we chatted a while back about [pain point]. Wanted to see if [outcome]. Take care!" }
}

Rules per step:
- step1 (LinkedIn DM #1, Day 1): 2-3 sentences. Reference their previous reply indirectly. Re-open the convo naturally. No pitch.
- step2 (LinkedIn Follow-up, Day 3): 1-2 sentences. Soft value drop or observation. End with a question.
- step3 (Cold Email #1, Day 5): Subject line + 3-4 short paragraphs. Reference their business specifically. One CTA: quick call.
- step4 (Email Follow-up, Day 8): Subject "Re: [previous subject]". 2 short paragraphs. Last nudge. No pressure.
- step5 (VAPI Call Script, Day 12): 3-4 sentence voicemail/call opener. Natural speech rhythm. Reference the cold trail. Offer a clear next step.`;

  const user = `Lead details:
Name: ${lead.first_name || ""} ${lead.last_name || ""}
Title: ${lead.title || lead.job_title || ""}
Company: ${lead.company || lead.company_name || ""}
LinkedIn: ${lead.linkedin_url || lead.linkedin || ""}
Email: ${lead.email || ""}
Previous reply they sent us: "${lead.previous_reply || lead.reply || lead.last_reply || "They replied with interest but went quiet."}"
Industry/Niche: ${lead.industry || lead.niche || "B2B Agency"}
Location: ${lead.location || lead.city || "US/Canada"}

Generate a 5-step personalized re-engagement sequence for this specific person.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as Sequence;
  } catch {
    return null;
  }
}

async function pushToHeyreach(lead: Lead, sequence: Sequence, heyreachKey: string) {
  try {
    // Add lead to the default list first, then we can add to campaign
    const res = await fetch("https://api.heyreach.io/api/public/v1/lists/GetAllLists", {
      method: "GET",
      headers: { "X-API-KEY": heyreachKey, "Content-Type": "application/json" },
    });

    if (!res.ok) return { success: false, message: "Failed to fetch Heyreach lists" };

    const listsData = await res.json();
    const lists = listsData?.items || listsData || [];
    let listId = lists[0]?.id;

    // Create a list if none exist
    if (!listId) {
      const createRes = await fetch("https://api.heyreach.io/api/public/v1/lists/Create", {
        method: "POST",
        headers: { "X-API-KEY": heyreachKey, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "SFC Re-engagement" }),
      });
      if (createRes.ok) {
        const created = await createRes.json();
        listId = created?.id;
      }
    }

    if (!listId) return { success: false, message: "Could not find or create a Heyreach list" };

    const addRes = await fetch(`https://api.heyreach.io/api/public/v1/lists/${listId}/AddLeadsToList`, {
      method: "POST",
      headers: { "X-API-KEY": heyreachKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        leads: [{
          linkedInProfileUrl: lead.linkedin_url || lead.linkedin || "",
          firstName: lead.first_name || "",
          lastName: lead.last_name || "",
          companyName: lead.company || "",
          customVariables: [
            { name: "step1_message", value: sequence.step1?.body || "" },
            { name: "step2_message", value: sequence.step2?.body || "" },
          ],
        }],
      }),
    });

    return { success: addRes.ok, message: addRes.ok ? "Added to Heyreach list" : "Failed to add lead" };
  } catch (e) {
    return { success: false, message: String(e) };
  }
}

async function pushToInstantly(lead: Lead, sequence: Sequence, instantlyKey: string) {
  try {
    // List campaigns to find or use existing
    const campsRes = await fetch("https://api.instantly.ai/api/v2/campaigns?limit=10", {
      headers: { Authorization: `Bearer ${instantlyKey}` },
    });

    let campaignId: string | null = null;
    if (campsRes.ok) {
      const camps = await campsRes.json();
      const existing = (camps?.items || camps || []).find(
        (c: { name: string; id: string }) => c.name?.includes("SFC Re-engagement")
      );
      campaignId = existing?.id || null;
    }

    // Create campaign if not found
    if (!campaignId) {
      const createRes = await fetch("https://api.instantly.ai/api/v2/campaigns", {
        method: "POST",
        headers: { Authorization: `Bearer ${instantlyKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "SFC Re-engagement Cold Email" }),
      });
      if (createRes.ok) {
        const created = await createRes.json();
        campaignId = created?.id || null;
      }
    }

    if (!campaignId) return { success: false, message: "Could not find or create Instantly campaign" };

    const leadRes = await fetch("https://api.instantly.ai/api/v2/leads", {
      method: "POST",
      headers: { Authorization: `Bearer ${instantlyKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: campaignId,
        email: lead.email || "",
        first_name: lead.first_name || "",
        last_name: lead.last_name || "",
        company_name: lead.company || "",
        custom_variables: {
          email1_subject: sequence.step3?.subject || "",
          email1_body: sequence.step3?.body || "",
          email2_subject: sequence.step4?.subject || "",
          email2_body: sequence.step4?.body || "",
        },
      }),
    });

    return { success: leadRes.ok, message: leadRes.ok ? "Added to Instantly campaign" : "Failed to add lead" };
  } catch (e) {
    return { success: false, message: String(e) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: "Missing file or projectId" }, { status: 400 });
    }

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get all integration keys for this project
    const { data: configs } = await supabase
      .from("integration_configs")
      .select("service, api_key_encrypted")
      .eq("project_id", projectId);

    const getKey = (service: string) => {
      const c = (configs ?? []).find((r) => r.service === service);
      return c ? decryptApiKey(c.api_key_encrypted) : null;
    };

    // Get Anthropic key — prefer user's ai_configs, fallback message if missing
    const { data: aiConfig } = await supabase
      .from("ai_configs")
      .select("api_key_encrypted")
      .eq("user_id", user.id)
      .eq("provider", "anthropic")
      .single();

    if (!aiConfig) {
      return NextResponse.json({
        error: "Anthropic API key not configured. Add it in Settings → AI Configuration.",
      }, { status: 400 });
    }

    const anthropicKey = decryptApiKey(aiConfig.api_key_encrypted);
    const heyreachKey = getKey("heyreach");
    const instantlyKey = getKey("instantly");

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // Parse CSV
    const text = await file.text();
    const { data: rows } = Papa.parse<Lead>(text, { header: true, skipEmptyLines: true });

    if (!rows.length) {
      return NextResponse.json({ error: "CSV is empty or has no rows" }, { status: 400 });
    }

    const limited = rows.slice(0, MAX_LEADS);
    const results = [];

    // Credit check — 15 credits per lead sequence
    const { allowed, balance, required } = await requireCredits(supabase, user.id, "sfc_sequence", limited.length);
    if (!allowed) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${required} (${limited.length} leads × 15), have ${balance}.` },
        { status: 402 }
      );
    }

    // Log execution start
    const { data: execRow } = await supabase
      .from("executions")
      .insert({
        project_id: projectId,
        action_type: "sfc_sequence_builder",
        status: "running",
        inputs_summary: `${limited.length} leads from ${file.name}`,
      })
      .select("id")
      .single();

    const execId = execRow?.id;

    let generated = 0;
    let pushedHeyreach = 0;
    let pushedInstantly = 0;

    for (const lead of limited) {
      const sequence = await generateSequence(lead, anthropic);
      if (!sequence) {
        results.push({ lead: `${lead.first_name} ${lead.last_name}`, status: "failed", sequence: null });
        continue;
      }

      generated++;
      const leadResult: {
        lead: string;
        sequence: Sequence;
        heyreach?: { success: boolean; message: string };
        instantly?: { success: boolean; message: string };
      } = { lead: `${lead.first_name} ${lead.last_name}`, sequence };

      if (heyreachKey) {
        const hr = await pushToHeyreach(lead, sequence, heyreachKey);
        leadResult.heyreach = hr;
        if (hr.success) pushedHeyreach++;
      }

      if (instantlyKey) {
        const ins = await pushToInstantly(lead, sequence, instantlyKey);
        leadResult.instantly = ins;
        if (ins.success) pushedInstantly++;
      }

      results.push(leadResult);
    }

    const parts = [`${generated}/${limited.length} sequences generated`];
    if (heyreachKey) parts.push(`${pushedHeyreach} pushed to Heyreach`);
    if (instantlyKey) parts.push(`${pushedInstantly} pushed to Instantly`);
    if (!heyreachKey && !instantlyKey) parts.push("no push keys configured — sequences generated only");

    if (execId) {
      await supabase
        .from("executions")
        .update({
          status: "completed",
          outputs_summary: parts.join(", "),
          completed_at: new Date().toISOString(),
        })
        .eq("id", execId);
    }

    if (generated > 0) {
      await deductCredits(supabase, user.id, "sfc_sequence", generated, { project_id: projectId });
    }
    return NextResponse.json({ success: true, summary: parts.join(", "), results });
  } catch (error) {
    console.error("SFC sequence error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
