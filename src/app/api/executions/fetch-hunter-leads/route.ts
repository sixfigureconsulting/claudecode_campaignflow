import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";
import { fetchHunterLeadsSchema } from "@/lib/validations";
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
    const parsed = fetchHunterLeadsSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });

    const { projectId, domain } = parsed.data;

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const config = await getGlobalApiConfig(supabase, user.id, "hunter");
    const apiKey = getApiKey(config);
    if (!apiKey)
      return NextResponse.json(
        { error: "Hunter.io API key not configured. Add it in Settings → Integrations." },
        { status: 400 }
      );

    // Strip protocol and path — Hunter expects bare domain
    const cleanDomain = domain.replace(/^https?:\/\//, "").split("/")[0].trim();

    const leads: CampaignLead[] = [];
    let offset = 0;

    do {
      const res = await fetch(
        `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(cleanDomain)}&limit=100&offset=${offset}&api_key=${apiKey}`
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: `Hunter.io API error: ${(err.errors?.[0]?.details ?? err.message) ?? res.statusText}` },
          { status: 502 }
        );
      }

      const data = await res.json();
      const emails: any[] = data.data?.emails ?? [];
      const orgName: string = data.data?.organization ?? cleanDomain;

      if (emails.length === 0) break;

      for (const e of emails) {
        if (!e.value) continue;
        leads.push({
          first_name: e.first_name ?? "",
          last_name: e.last_name ?? "",
          email: e.value,
          company: orgName,
          title: e.position ?? "",
          linkedin_url: e.linkedin ?? null,
          website: `https://${cleanDomain}`,
          phone: e.phone_number ?? null,
        });
      }

      offset += 100;
      if (emails.length < 100) break;
      if (leads.length >= 500) break;
    } while (true);

    return NextResponse.json({ leads, total: leads.length });
  } catch (error) {
    console.error("fetch-hunter-leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
