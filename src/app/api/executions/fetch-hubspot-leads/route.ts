import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";
import { fetchHubSpotLeadsSchema } from "@/lib/validations";
import type { CampaignLead } from "@/types/database";

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = fetchHubSpotLeadsSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });

    const { projectId, listId } = parsed.data;

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const config = await getGlobalApiConfig(supabase, user.id, "hubspot");
    const apiKey = getApiKey(config);
    if (!apiKey)
      return NextResponse.json(
        { error: "HubSpot API key not configured. Add it in Settings → Integrations." },
        { status: 400 }
      );

    // Step 1: Get list memberships (record IDs)
    const membRes = await fetch(
      `https://api.hubapi.com/crm/v3/lists/${encodeURIComponent(listId)}/memberships?limit=100`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!membRes.ok) {
      const err = await membRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: `HubSpot list error: ${err.message ?? membRes.statusText}. Check your list ID is correct.` },
        { status: 502 }
      );
    }

    const membData = await membRes.json();
    const recordIds: string[] = (membData.results ?? []).map((r: any) => r.recordId as string);

    if (recordIds.length === 0)
      return NextResponse.json({ leads: [], total: 0 });

    // Step 2: Batch-read contact properties (process in chunks of 100)
    const props = ["firstname", "lastname", "email", "company", "jobtitle", "website", "phone", "hs_linkedin_url"];
    const leads: CampaignLead[] = [];

    for (let i = 0; i < recordIds.length; i += 100) {
      const chunk = recordIds.slice(i, i + 100);
      const batchRes = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/batch/read",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: chunk.map((id) => ({ id })),
            properties: props,
          }),
        }
      );

      if (!batchRes.ok) {
        const err = await batchRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: `HubSpot contacts error: ${err.message ?? batchRes.statusText}` },
          { status: 502 }
        );
      }

      const batchData = await batchRes.json();
      for (const c of batchData.results ?? []) {
        const p = c.properties ?? {};
        if (!p.email) continue;
        leads.push({
          first_name: p.firstname ?? "",
          last_name: p.lastname ?? "",
          email: p.email,
          company: p.company ?? "",
          title: p.jobtitle ?? "",
          linkedin_url: p.hs_linkedin_url ?? null,
          website: p.website ?? null,
          phone: p.phone ?? null,
        });
      }
    }

    return NextResponse.json({ leads, total: leads.length });
  } catch (error) {
    console.error("fetch-hubspot-leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
