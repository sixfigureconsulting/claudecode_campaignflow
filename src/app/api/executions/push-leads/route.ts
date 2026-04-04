import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";
import { pushLeadsSchema } from "@/lib/validations";

// ── Types ─────────────────────────────────────────────────────────────────────

type Lead = {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  title: string;
  linkedin_url?: string | null;
  website?: string | null;
  phone?: string | null;
  sequence?: {
    linkedin_step1?: string;
    linkedin_step2?: string;
    email_subject1?: string;
    email_body1?: string;
    email_subject2?: string;
    email_body2?: string;
  };
};

type PushResult = { success: boolean; count: number; message: string; campaignId?: string };

// ── Ownership check ───────────────────────────────────────────────────────────

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

// ── Email platforms ───────────────────────────────────────────────────────────

async function pushToInstantly(leads: Lead[], apiKey: string, projectName: string): Promise<PushResult> {
  try {
    const listRes = await fetch("https://api.instantly.ai/api/v2/campaigns?limit=20", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!listRes.ok) throw new Error(`Instantly list error ${listRes.status}`);
    const listData = await listRes.json();

    let campaignId: string | null = null;
    const existing = (listData.items ?? []).find(
      (c: Record<string, unknown>) => (c.name as string)?.includes(projectName)
    );

    if (existing) {
      campaignId = existing.id as string;
    } else {
      const createRes = await fetch("https://api.instantly.ai/api/v2/campaigns", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${projectName} — CampaignFlow` }),
      });
      if (!createRes.ok) throw new Error(`Instantly create campaign error ${createRes.status}`);
      campaignId = ((await createRes.json()) as any).id as string;
    }

    if (!campaignId) throw new Error("Could not get Instantly campaign ID");

    const addRes = await fetch("https://api.instantly.ai/api/v2/leads", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: campaignId,
        leads: leads.map((l) => ({
          email: l.email,
          first_name: l.first_name,
          last_name: l.last_name,
          company_name: l.company,
          custom_variables: {
            title: l.title,
            email_subject1: l.sequence?.email_subject1 ?? "",
            email_body1: l.sequence?.email_body1 ?? "",
            email_subject2: l.sequence?.email_subject2 ?? "",
            email_body2: l.sequence?.email_body2 ?? "",
          },
        })),
      }),
    });
    if (!addRes.ok) throw new Error(`Instantly add leads error ${addRes.status}`);

    return { success: true, count: leads.length, message: `${leads.length} leads added to Instantly`, campaignId: campaignId ?? undefined };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

async function pushToHubSpot(leads: Lead[], apiKey: string): Promise<PushResult> {
  try {
    let successCount = 0;
    for (let i = 0; i < leads.length; i += 10) {
      const batch = leads.slice(i, i + 10);
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: batch.map((l) => ({
            idProperty: "email",
            properties: {
              email: l.email,
              firstname: l.first_name,
              lastname: l.last_name,
              company: l.company,
              jobtitle: l.title,
              website: l.website ?? "",
              linkedinbio: l.linkedin_url ?? "",
            },
          })),
        }),
      });
      if (res.ok) successCount += ((await res.json()).results ?? batch).length;
    }
    return { success: true, count: successCount, message: `${successCount} contacts upserted in HubSpot` };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

// ── Calling platforms ─────────────────────────────────────────────────────────

function leadsWithPhone(leads: Lead[]): Lead[] {
  return leads.filter((l) => l.phone && l.phone.trim());
}

// Bland AI — batch call endpoint
async function pushToBland(
  leads: Lead[],
  cfg: Record<string, string>,
  projectName: string
): Promise<PushResult> {
  try {
    const callable = leadsWithPhone(leads);
    if (callable.length === 0)
      return { success: false, count: 0, message: "No leads have phone numbers. Bland AI requires phone numbers." };

    const body: Record<string, unknown> = {
      base_prompt: cfg.base_prompt || `You are a sales representative calling on behalf of ${projectName}. Introduce yourself professionally and ask if this is a good time to talk.`,
      call_data: callable.map((l) => ({
        phone_number: l.phone,
        first_name: l.first_name,
        last_name: l.last_name,
        company: l.company,
        title: l.title,
      })),
      label: `CampaignFlow — ${projectName}`,
    };
    if (cfg.from_number) body.from = cfg.from_number;
    if (cfg.pathway_id) body.pathway_id = cfg.pathway_id;

    const res = await fetch("https://api.bland.ai/v1/batches", {
      method: "POST",
      headers: { Authorization: cfg.api_key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? err.error ?? `Bland API error ${res.status}`);
    }
    const data = await res.json();
    return {
      success: true,
      count: callable.length,
      message: `${callable.length} calls queued in Bland AI (batch: ${data.batch_id ?? "created"})`,
    };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

// VAPI — loop per lead (no batch endpoint)
async function pushToVapi(leads: Lead[], cfg: Record<string, string>): Promise<PushResult> {
  try {
    const callable = leadsWithPhone(leads);
    if (callable.length === 0)
      return { success: false, count: 0, message: "No leads have phone numbers. VAPI requires phone numbers." };
    if (!cfg.phone_number_id || !cfg.assistant_id)
      return { success: false, count: 0, message: "VAPI config incomplete — phone_number_id and assistant_id are required." };

    let successCount = 0;
    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < callable.length; i += 5) {
      await Promise.all(
        callable.slice(i, i + 5).map(async (l) => {
          const res = await fetch("https://api.vapi.ai/call/phone", {
            method: "POST",
            headers: { Authorization: `Bearer ${cfg.api_key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              phoneNumberId: cfg.phone_number_id,
              assistantId: cfg.assistant_id,
              customer: { number: l.phone },
              assistantOverrides: {
                variableValues: {
                  first_name: l.first_name,
                  last_name: l.last_name,
                  company: l.company,
                  title: l.title,
                },
              },
            }),
          });
          if (res.ok) successCount++;
        })
      );
    }
    return { success: true, count: successCount, message: `${successCount} calls dispatched via VAPI` };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

// Retell AI — loop per lead
async function pushToRetell(leads: Lead[], cfg: Record<string, string>): Promise<PushResult> {
  try {
    const callable = leadsWithPhone(leads);
    if (callable.length === 0)
      return { success: false, count: 0, message: "No leads have phone numbers. Retell AI requires phone numbers." };
    if (!cfg.agent_id || !cfg.from_number)
      return { success: false, count: 0, message: "Retell config incomplete — agent_id and from_number are required." };

    let successCount = 0;
    for (let i = 0; i < callable.length; i += 5) {
      await Promise.all(
        callable.slice(i, i + 5).map(async (l) => {
          const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
            method: "POST",
            headers: { Authorization: `Bearer ${cfg.api_key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              agent_id: cfg.agent_id,
              from_number: cfg.from_number,
              to_number: l.phone,
              retell_llm_dynamic_variables: {
                first_name: l.first_name,
                last_name: l.last_name,
                company: l.company,
                title: l.title,
              },
            }),
          });
          if (res.ok) successCount++;
        })
      );
    }
    return { success: true, count: successCount, message: `${successCount} calls dispatched via Retell AI` };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

// Synthflow AI — loop per lead
async function pushToSynthflow(leads: Lead[], cfg: Record<string, string>): Promise<PushResult> {
  try {
    const callable = leadsWithPhone(leads);
    if (callable.length === 0)
      return { success: false, count: 0, message: "No leads have phone numbers. Synthflow requires phone numbers." };
    if (!cfg.agent_id)
      return { success: false, count: 0, message: "Synthflow config incomplete — agent_id (model_id) is required." };

    let successCount = 0;
    for (let i = 0; i < callable.length; i += 5) {
      await Promise.all(
        callable.slice(i, i + 5).map(async (l) => {
          const res = await fetch("https://api.synthflow.ai/v2/calls", {
            method: "POST",
            headers: { Authorization: `Bearer ${cfg.api_key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model_id: cfg.agent_id,
              phone: l.phone,
              name: `${l.first_name} ${l.last_name}`.trim(),
              custom_variables: {
                company: l.company,
                title: l.title,
                email: l.email,
              },
            }),
          });
          if (res.ok) successCount++;
        })
      );
    }
    return { success: true, count: successCount, message: `${successCount} calls dispatched via Synthflow` };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

// Air AI — loop per lead
async function pushToAir(leads: Lead[], cfg: Record<string, string>): Promise<PushResult> {
  try {
    const callable = leadsWithPhone(leads);
    if (callable.length === 0)
      return { success: false, count: 0, message: "No leads have phone numbers. Air AI requires phone numbers." };
    if (!cfg.agent_id)
      return { success: false, count: 0, message: "Air AI config incomplete — agent_id is required." };

    let successCount = 0;
    for (let i = 0; i < callable.length; i += 5) {
      await Promise.all(
        callable.slice(i, i + 5).map(async (l) => {
          const res = await fetch("https://api.air.ai/v1/calls", {
            method: "POST",
            headers: { Authorization: `Bearer ${cfg.api_key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              agent_id: cfg.agent_id,
              to: l.phone,
              variables: {
                first_name: l.first_name,
                last_name: l.last_name,
                company: l.company,
                title: l.title,
              },
            }),
          });
          if (res.ok) successCount++;
        })
      );
    }
    return { success: true, count: successCount, message: `${successCount} calls dispatched via Air AI` };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

// Twilio — loop per lead using basic auth + form-encoded body
async function pushToTwilio(leads: Lead[], cfg: Record<string, string>): Promise<PushResult> {
  try {
    const callable = leadsWithPhone(leads);
    if (callable.length === 0)
      return { success: false, count: 0, message: "No leads have phone numbers. Twilio requires phone numbers." };
    if (!cfg.account_sid || !cfg.auth_token || !cfg.from_number || !cfg.twiml_url)
      return {
        success: false, count: 0,
        message: "Twilio config incomplete — account_sid, auth_token, from_number, and twiml_url are required.",
      };

    const authHeader = `Basic ${Buffer.from(`${cfg.account_sid}:${cfg.auth_token}`).toString("base64")}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.account_sid}/Calls.json`;

    let successCount = 0;
    for (let i = 0; i < callable.length; i += 5) {
      await Promise.all(
        callable.slice(i, i + 5).map(async (l) => {
          const body = new URLSearchParams({
            To: l.phone!,
            From: cfg.from_number,
            Url: cfg.twiml_url,
          });
          const res = await fetch(url, {
            method: "POST",
            headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
          if (res.ok) successCount++;
        })
      );
    }
    return { success: true, count: successCount, message: `${successCount} calls dispatched via Twilio` };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

// ── New outreach platforms ────────────────────────────────────────────────────

async function pushToSmartlead(leads: Lead[], cfg: Record<string, string>): Promise<PushResult> {
  try {
    if (!cfg.api_key || !cfg.campaign_id)
      return { success: false, count: 0, message: "Smartlead config incomplete — api_key and campaign_id are required." };

    const res = await fetch(
      `https://server.smartlead.ai/api/v1/campaigns/${cfg.campaign_id}/leads?api_key=${cfg.api_key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_list: leads.map((l) => ({
            email: l.email,
            first_name: l.first_name,
            last_name: l.last_name,
            company_name: l.company,
            phone_number: l.phone ?? "",
            linkedin_profile: l.linkedin_url ?? "",
            custom_fields: {
              title: l.title,
              email_step1_subject: l.sequence?.email_subject1 ?? "",
              email_step1_body: l.sequence?.email_body1 ?? "",
            },
          })),
        }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? `Smartlead API error ${res.status}`);
    }
    return { success: true, count: leads.length, message: `${leads.length} leads added to Smartlead campaign` };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

async function pushToLemlist(leads: Lead[], cfg: Record<string, string>): Promise<PushResult> {
  try {
    if (!cfg.api_key || !cfg.campaign_id)
      return { success: false, count: 0, message: "Lemlist config incomplete — api_key and campaign_id are required." };

    let successCount = 0;
    for (let i = 0; i < leads.length; i += 5) {
      await Promise.all(
        leads.slice(i, i + 5).map(async (l) => {
          if (!l.email) return;
          const res = await fetch(
            `https://api.lemlist.com/api/campaigns/${cfg.campaign_id}/leads/${encodeURIComponent(l.email)}?access_token=${cfg.api_key}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                firstName: l.first_name,
                lastName: l.last_name,
                companyName: l.company,
                linkedinUrl: l.linkedin_url ?? "",
                phone: l.phone ?? "",
                icebreaker: l.sequence?.email_body1 ?? "",
              }),
            }
          );
          if (res.ok || res.status === 409) successCount++; // 409 = already in campaign
        })
      );
    }
    return { success: true, count: successCount, message: `${successCount} leads added to Lemlist campaign` };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

// ── Webhook / automation tools ────────────────────────────────────────────────

async function pushToWebhook(leads: Lead[], webhookUrl: string, label: string): Promise<PushResult> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leads: leads.map((l) => ({
          first_name: l.first_name,
          last_name: l.last_name,
          email: l.email,
          company: l.company,
          title: l.title,
          phone: l.phone ?? null,
          linkedin_url: l.linkedin_url ?? null,
          website: l.website ?? null,
          sequence: l.sequence ?? null,
        })),
        count: leads.length,
        source: "campaignflow",
      }),
    });
    if (!res.ok) throw new Error(`Webhook responded with ${res.status}`);
    return { success: true, count: leads.length, message: `${leads.length} leads sent to ${label}` };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = pushLeadsSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });

    const { projectId, leads, destinations } = parsed.data;
    // Webhook URLs for automation tools — provided inline by the user at push time
    const webhookUrls: Record<string, string> = body.webhookUrls ?? {};

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: project } = await supabase.from("projects").select("name").eq("id", projectId).single();
    const projectName = project?.name ?? "CampaignFlow";

    // Helper to get config for any service from global integrations
    const getConfig = (service: string) => getGlobalApiConfig(supabase, user.id, service);

    const results: Record<string, PushResult> = {};
    const tasks: Promise<void>[] = [];

    // ── Email / CRM destinations ──────────────────────────────────────────────

    if (destinations.includes("instantly")) {
      tasks.push((async () => {
        const cfg = await getConfig("instantly");
        const key = getApiKey(cfg);
        results.instantly = key
          ? await pushToInstantly(leads as Lead[], key, projectName)
          : { success: false, count: 0, message: "Instantly key not configured" };
      })());
    }

    if (destinations.includes("hubspot")) {
      tasks.push((async () => {
        const cfg = await getConfig("hubspot");
        const key = getApiKey(cfg);
        results.hubspot = key
          ? await pushToHubSpot(leads as Lead[], key)
          : { success: false, count: 0, message: "HubSpot key not configured" };
      })());
    }

    if (destinations.includes("csv")) {
      results.csv = { success: true, count: leads.length, message: `${leads.length} leads ready to download` };
    }

    if (destinations.includes("smartlead")) {
      tasks.push((async () => {
        const cfg = await getConfig("smartlead");
        results.smartlead = cfg && typeof cfg === "object"
          ? await pushToSmartlead(leads as Lead[], cfg)
          : { success: false, count: 0, message: "Smartlead not configured" };
      })());
    }

    if (destinations.includes("lemlist")) {
      tasks.push((async () => {
        const cfg = await getConfig("lemlist");
        results.lemlist = cfg && typeof cfg === "object"
          ? await pushToLemlist(leads as Lead[], cfg)
          : { success: false, count: 0, message: "Lemlist not configured" };
      })());
    }

    // ── Webhook / automation tools ────────────────────────────────────────────

    for (const tool of ["n8n", "make", "zapier", "clay", "http"] as const) {
      if (destinations.includes(tool) && webhookUrls[tool]) {
        const label = { n8n: "n8n", make: "Make", zapier: "Zapier", clay: "Clay", http: "HTTP API" }[tool];
        tasks.push((async () => {
          results[tool] = await pushToWebhook(leads as Lead[], webhookUrls[tool], label);
        })());
      }
    }

    // ── Calling platforms ─────────────────────────────────────────────────────

    if (destinations.includes("bland")) {
      tasks.push((async () => {
        const cfg = await getConfig("bland");
        results.bland = cfg && typeof cfg === "object"
          ? await pushToBland(leads as Lead[], cfg, projectName)
          : { success: false, count: 0, message: "Bland AI not configured" };
      })());
    }

    if (destinations.includes("vapi")) {
      tasks.push((async () => {
        const cfg = await getConfig("vapi");
        results.vapi = cfg && typeof cfg === "object"
          ? await pushToVapi(leads as Lead[], cfg)
          : { success: false, count: 0, message: "VAPI not configured" };
      })());
    }

    if (destinations.includes("retell")) {
      tasks.push((async () => {
        const cfg = await getConfig("retell");
        results.retell = cfg && typeof cfg === "object"
          ? await pushToRetell(leads as Lead[], cfg)
          : { success: false, count: 0, message: "Retell AI not configured" };
      })());
    }

    if (destinations.includes("synthflow")) {
      tasks.push((async () => {
        const cfg = await getConfig("synthflow");
        results.synthflow = cfg && typeof cfg === "object"
          ? await pushToSynthflow(leads as Lead[], cfg)
          : { success: false, count: 0, message: "Synthflow not configured" };
      })());
    }

    if (destinations.includes("air")) {
      tasks.push((async () => {
        const cfg = await getConfig("air");
        results.air = cfg && typeof cfg === "object"
          ? await pushToAir(leads as Lead[], cfg)
          : { success: false, count: 0, message: "Air AI not configured" };
      })());
    }

    if (destinations.includes("twilio")) {
      tasks.push((async () => {
        const cfg = await getConfig("twilio");
        results.twilio = cfg && typeof cfg === "object"
          ? await pushToTwilio(leads as Lead[], cfg)
          : { success: false, count: 0, message: "Twilio not configured" };
      })());
    }

    await Promise.all(tasks);

    const successDestinations = Object.entries(results)
      .filter(([, v]) => v.success).map(([k]) => k).join(", ");

    await supabase.from("executions").insert({
      project_id: projectId,
      action_type: "campaign_workflow",
      status: "completed",
      inputs_summary: `Push ${leads.length} leads to: ${destinations.join(", ")}`,
      outputs_summary: successDestinations ? `Pushed to ${successDestinations}` : "Push failed",
      completed_at: new Date().toISOString(),
    });

    const instantlyResult = results.instantly as (PushResult & { campaignId?: string }) | undefined;
    const { data: campaignRun } = await supabase
      .from("campaign_runs")
      .insert({
        project_id: projectId,
        instantly_campaign_id: instantlyResult?.campaignId ?? null,
        leads_pushed: leads.length,
        next_stats_pull_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    return NextResponse.json({ results, campaignRunId: campaignRun?.id ?? null });
  } catch (error) {
    console.error("push-leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
