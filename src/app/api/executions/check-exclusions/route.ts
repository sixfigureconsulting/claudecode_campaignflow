import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { checkExclusionsSchema } from "@/lib/validations";
import { requireCredits, deductCredits } from "@/lib/credits";

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

// Check emails against Instantly campaigns
async function checkInstantly(
  emails: string[],
  apiKey: string
): Promise<Set<string>> {
  const found = new Set<string>();
  try {
    // Instantly v2 API: search leads by email
    const res = await fetch(
      `https://api.instantly.ai/api/v2/leads/list?limit=100`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return found;

    const data = await res.json();
    const existingEmails: string[] = (data.items ?? data.leads ?? []).map(
      (l: Record<string, unknown>) =>
        ((l.email as string) ?? "").toLowerCase()
    );
    for (const email of emails) {
      if (existingEmails.includes(email.toLowerCase())) {
        found.add(email.toLowerCase());
      }
    }
  } catch {
    // Non-fatal — return empty set
  }
  return found;
}

// Check emails against HubSpot contacts
async function checkHubSpot(
  emails: string[],
  apiKey: string
): Promise<Set<string>> {
  const found = new Set<string>();
  try {
    // HubSpot Contacts API v3 — search by email
    const res = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "email",
                  operator: "IN",
                  values: emails.slice(0, 100), // HubSpot IN filter limit
                },
              ],
            },
          ],
          properties: ["email"],
          limit: 100,
        }),
      }
    );
    if (!res.ok) return found;

    const data = await res.json();
    for (const result of data.results ?? []) {
      const email = result.properties?.email as string | undefined;
      if (email) found.add(email.toLowerCase());
    }
  } catch {
    // Non-fatal
  }
  return found;
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
    const parsed = checkExclusionsSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );

    const { projectId, leads } = parsed.data;

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Credit check — 1 credit per lead checked
    const { allowed, balance, required } = await requireCredits(supabase, user.id, "check_exclusions", leads.length);
    if (!allowed) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${required} (${leads.length} leads × 1), have ${balance}.` },
        { status: 402 }
      );
    }

    // Fetch available integration keys
    const { data: configs } = await supabase
      .from("integration_configs")
      .select("service, api_key_encrypted")
      .eq("project_id", projectId)
      .in("service", ["instantly", "hubspot"]);

    const getKey = (service: string) => {
      const row = (configs ?? []).find((c) => c.service === service);
      return row ? decryptApiKey(row.api_key_encrypted) : null;
    };

    const instantlyKey = getKey("instantly");
    const hubspotKey = getKey("hubspot");

    const emails = leads.map((l) => l.email).filter(Boolean);

    // Run both checks in parallel
    const [instantlyExcluded, hubspotExcluded] = await Promise.all([
      instantlyKey ? checkInstantly(emails, instantlyKey) : Promise.resolve(new Set<string>()),
      hubspotKey ? checkHubSpot(emails, hubspotKey) : Promise.resolve(new Set<string>()),
    ]);

    const checkedLeads = leads.map((lead) => {
      const emailLower = lead.email.toLowerCase();
      if (instantlyExcluded.has(emailLower)) {
        return { ...lead, excluded: true, exclusion_reason: "Already in Instantly", exclusion_source: "instantly" };
      }
      if (hubspotExcluded.has(emailLower)) {
        return { ...lead, excluded: true, exclusion_reason: "Already in HubSpot CRM", exclusion_source: "hubspot" };
      }
      return { ...lead, excluded: false };
    });

    const excludedCount = checkedLeads.filter((l) => l.excluded).length;
    const sources: string[] = [];
    if (instantlyKey) sources.push("Instantly");
    if (hubspotKey) sources.push("HubSpot");

    await deductCredits(supabase, user.id, "check_exclusions", leads.length, { project_id: projectId });
    return NextResponse.json({
      leads: checkedLeads,
      summary:
        sources.length === 0
          ? "No exclusion sources configured — all leads kept"
          : `Checked against ${sources.join(" & ")}. ${excludedCount} duplicate${excludedCount !== 1 ? "s" : ""} found`,
      sources_checked: sources,
    });
  } catch (error) {
    console.error("check-exclusions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
