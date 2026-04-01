import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { pushLeadsSchema } from "@/lib/validations";

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
  sequence?: {
    linkedin_step1?: string;
    linkedin_step2?: string;
    email_subject1?: string;
    email_body1?: string;
    email_subject2?: string;
    email_body2?: string;
  };
};

// Push leads to Instantly — creates a campaign or uses existing
async function pushToInstantly(
  leads: Lead[],
  apiKey: string,
  projectName: string
): Promise<{ success: boolean; count: number; message: string; campaignId?: string }> {
  try {
    // 1. Find or create campaign
    const listRes = await fetch(
      "https://api.instantly.ai/api/v2/campaigns?limit=20",
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
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
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: `${projectName} — CampaignFlow` }),
      });
      if (!createRes.ok) throw new Error(`Instantly create campaign error ${createRes.status}`);
      const created = await createRes.json();
      campaignId = created.id as string;
    }

    if (!campaignId) throw new Error("Could not get Instantly campaign ID");

    // 2. Add leads
    const leadsPayload = leads.map((l) => ({
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
    }));

    const addRes = await fetch(
      `https://api.instantly.ai/api/v2/leads`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ campaign_id: campaignId, leads: leadsPayload }),
      }
    );
    if (!addRes.ok) throw new Error(`Instantly add leads error ${addRes.status}`);

    return { success: true, count: leads.length, message: `${leads.length} leads added to Instantly`, campaignId: campaignId ?? undefined };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
}

// Push leads to HubSpot as contacts
async function pushToHubSpot(
  leads: Lead[],
  apiKey: string
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    let successCount = 0;
    // HubSpot batch create/update contacts
    const inputs = leads.map((l) => ({
      properties: {
        email: l.email,
        firstname: l.first_name,
        lastname: l.last_name,
        company: l.company,
        jobtitle: l.title,
        website: l.website ?? "",
        linkedinbio: l.linkedin_url ?? "",
      },
    }));

    // Process in batches of 10
    for (let i = 0; i < inputs.length; i += 10) {
      const batch = inputs.slice(i, i + 10);
      const res = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: batch.map((b) => ({ ...b, idProperty: "email" })),
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        successCount += (data.results ?? batch).length;
      }
    }

    return { success: true, count: successCount, message: `${successCount} contacts upserted in HubSpot` };
  } catch (err) {
    return { success: false, count: 0, message: String(err) };
  }
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
    const parsed = pushLeadsSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );

    const { projectId, leads, destinations } = parsed.data;

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Get project name for campaign naming
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();
    const projectName = project?.name ?? "CampaignFlow";

    // Fetch relevant keys
    const { data: configs } = await supabase
      .from("integration_configs")
      .select("service, api_key_encrypted")
      .eq("project_id", projectId)
      .in("service", ["instantly", "hubspot"]);

    const getKey = (service: string) => {
      const row = (configs ?? []).find((c) => c.service === service);
      return row ? decryptApiKey(row.api_key_encrypted) : null;
    };

    const results: Record<string, { success: boolean; count: number; message: string }> = {};

    // Run all requested destinations in parallel
    const tasks: Promise<void>[] = [];

    if (destinations.includes("instantly")) {
      const key = getKey("instantly");
      if (!key) {
        results.instantly = { success: false, count: 0, message: "Instantly key not configured" };
      } else {
        tasks.push(
          pushToInstantly(leads as Lead[], key, projectName).then((r) => {
            results.instantly = r;
          })
        );
      }
    }

    if (destinations.includes("hubspot")) {
      const key = getKey("hubspot");
      if (!key) {
        results.hubspot = { success: false, count: 0, message: "HubSpot key not configured" };
      } else {
        tasks.push(
          pushToHubSpot(leads as Lead[], key).then((r) => {
            results.hubspot = r;
          })
        );
      }
    }

    if (destinations.includes("csv")) {
      // CSV is handled client-side; just acknowledge
      results.csv = { success: true, count: leads.length, message: `${leads.length} leads ready to download` };
    }

    await Promise.all(tasks);

    // Log execution
    const successDestinations = Object.entries(results)
      .filter(([, v]) => v.success)
      .map(([k]) => k)
      .join(", ");

    await supabase.from("executions").insert({
      project_id: projectId,
      action_type: "campaign_workflow",
      status: "completed",
      inputs_summary: `Push ${leads.length} leads to: ${destinations.join(", ")}`,
      outputs_summary: successDestinations
        ? `Pushed to ${successDestinations}`
        : "Push failed",
      completed_at: new Date().toISOString(),
    });

    // Create a campaign_run record to enable weekly reporting
    // Capture the Instantly campaign ID from the push result if available
    const instantlyResult = results.instantly as (typeof results.instantly & { campaignId?: string }) | undefined;
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
