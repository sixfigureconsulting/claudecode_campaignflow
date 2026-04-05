import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";

async function getGlobalApiKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  service: string
): Promise<string | null> {
  try {
    const { data: defaultClient } = await supabase
      .from("clients").select("id")
      .eq("user_id", userId).eq("name", "__default__").single();
    if (!defaultClient) return null;

    const { data: intProject } = await supabase
      .from("projects").select("id")
      .eq("client_id", defaultClient.id).eq("name", "__integrations__").single();
    if (!intProject) return null;

    const { data: config } = await supabase
      .from("integration_configs")
      .select("api_key_encrypted")
      .eq("project_id", intProject.id)
      .eq("service", service)
      .single();
    if (!config) return null;

    return decryptApiKey(config.api_key_encrypted);
  } catch {
    return null;
  }
}

export type CampaignItem = {
  id: string;
  name: string;
  status: number; // 1=active 2=paused 3=stopped
};

async function fetchInstantlyCampaigns(apiKey: string): Promise<CampaignItem[]> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const res = await fetch(
    "https://api.instantly.ai/api/v2/campaigns?limit=100&skip=0",
    { headers }
  );
  if (!res.ok) throw new Error(`Instantly API error: ${res.status}`);
  const data = await res.json();
  const items: any[] = data.items ?? data ?? [];
  return items.map((c: any) => ({ id: c.id, name: c.name ?? c.campaign_name ?? c.id, status: c.status ?? 1 }));
}

async function fetchSmartleadCampaigns(apiKey: string): Promise<CampaignItem[]> {
  const res = await fetch(
    `https://server.smartlead.ai/api/v1/campaigns?api_key=${apiKey}&limit=100&offset=0`
  );
  if (!res.ok) throw new Error(`Smartlead API error: ${res.status}`);
  const data: any[] = await res.json();
  return (data ?? []).map((c: any) => ({ id: String(c.id), name: c.name ?? c.id, status: c.status === "ACTIVE" ? 1 : 2 }));
}

async function fetchHeyreachCampaigns(apiKey: string): Promise<CampaignItem[]> {
  const res = await fetch("https://api.heyreach.io/api/public/campaign/GetAll", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ offset: 0, limit: 50 }),
  });
  if (!res.ok) throw new Error(`HeyReach API error: ${res.status}`);
  const data = await res.json();
  const items: any[] = data.items ?? data.data ?? [];
  return items.map((c: any) => ({ id: String(c.id), name: c.name ?? c.id, status: 1 }));
}

async function fetchLemlistCampaigns(apiKey: string): Promise<CampaignItem[]> {
  const headers = { Authorization: `Basic ${Buffer.from(`:${apiKey}`).toString("base64")}` };
  const res = await fetch("https://api.lemlist.com/api/campaigns", { headers });
  if (!res.ok) throw new Error(`Lemlist API error: ${res.status}`);
  const data: any[] = await res.json();
  return (data ?? []).map((c: any) => ({ id: c._id, name: c.name ?? c._id, status: 1 }));
}

export async function GET(request: NextRequest) {
  try {
    const tool = request.nextUrl.searchParams.get("tool");
    if (!tool) return NextResponse.json({ error: "Missing tool parameter" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = await getGlobalApiKey(supabase, user.id, tool);
    if (!apiKey) {
      return NextResponse.json({ error: `No ${tool} API key found.` }, { status: 400 });
    }

    let campaigns: CampaignItem[] = [];
    if (tool === "instantly")  campaigns = await fetchInstantlyCampaigns(apiKey);
    else if (tool === "smartlead") campaigns = await fetchSmartleadCampaigns(apiKey);
    else if (tool === "heyreach")  campaigns = await fetchHeyreachCampaigns(apiKey);
    else if (tool === "lemlist")   campaigns = await fetchLemlistCampaigns(apiKey);
    else return NextResponse.json({ error: "Unsupported tool" }, { status: 400 });

    return NextResponse.json({ campaigns });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch campaigns" }, { status: 500 });
  }
}
