import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Instantly sync ────────────────────────────────────────────────────────────
// API confirmed: GET /api/v2/campaigns/analytics returns an array of per-campaign
// objects. Fields: emails_sent_count, open_count, reply_count, bounced_count,
// contacted_count, total_opportunities, total_opportunity_value.
// Status values: 1=active, 2=paused, 3=stopped.

async function syncInstantly(
  apiKey: string,
  campaignId?: string,
  campaignName?: string
): Promise<{ metrics: MetricRow[]; source: string }> {
  const headers = { Authorization: `Bearer ${apiKey}` };

  const url = campaignId
    ? `https://api.instantly.ai/api/v2/campaigns/analytics?id=${campaignId}`
    : "https://api.instantly.ai/api/v2/campaigns/analytics";

  const analyticsRes = await fetch(url, { headers });

  if (!analyticsRes.ok) {
    throw new Error(`Instantly API error: ${analyticsRes.status} ${await analyticsRes.text()}`);
  }

  const analyticsData = await analyticsRes.json();
  const rows: any[] = Array.isArray(analyticsData) ? analyticsData : [];

  let totalSent = 0, totalOpened = 0, totalReplied = 0, totalBounced = 0,
      totalContacted = 0, totalOpportunities = 0, totalOpportunityValue = 0;

  for (const row of rows) {
    totalSent             += row.emails_sent_count    ?? 0;
    totalOpened           += row.open_count_unique    ?? row.open_count ?? 0;
    totalReplied          += row.reply_count          ?? 0;
    totalBounced          += row.bounced_count        ?? 0;
    totalContacted        += row.contacted_count      ?? 0;
    totalOpportunities    += row.total_opportunities  ?? 0;
    totalOpportunityValue += row.total_opportunity_value ?? 0;
  }

  const metrics: MetricRow[] = ([
    { name: "Emails Sent",         value: totalSent,             category: "leads"   as const },
    { name: "Unique Opens",        value: totalOpened,           category: "traffic" as const },
    { name: "Replies",             value: totalReplied,          category: "custom"  as const },
    { name: "Bounced",             value: totalBounced,          category: "custom"  as const },
    { name: "Opportunities",       value: totalOpportunities,    category: "leads"   as const },
    { name: "Pipeline Value ($)",  value: totalOpportunityValue, category: "revenue" as const },
  ] as MetricRow[]).filter((m) => m.value > 0);

  const sourceLabel = campaignName
    ? `Instantly — ${campaignName}`
    : `Instantly (${rows.length} campaign${rows.length !== 1 ? "s" : ""})`;

  return { metrics, source: sourceLabel };
}

// ── Smartlead sync ────────────────────────────────────────────────────────────
// Docs: https://helpcenter.smartlead.ai/en/articles/125-full-api-documentation

async function syncSmartlead(apiKey: string): Promise<{ metrics: MetricRow[]; source: string }> {
  // Get all campaigns
  const listRes = await fetch(
    `https://server.smartlead.ai/api/v1/campaigns?api_key=${apiKey}&limit=100&offset=0`
  );

  if (!listRes.ok) {
    throw new Error(`Smartlead API error: ${listRes.status} ${await listRes.text()}`);
  }

  const campaigns: any[] = await listRes.json();

  let totalSent = 0, totalOpened = 0, totalReplied = 0, totalClicked = 0, totalBounced = 0;

  for (const campaign of (campaigns ?? []).slice(0, 20)) {
    const statsRes = await fetch(
      `https://server.smartlead.ai/api/v1/campaigns/${campaign.id}/statistics?api_key=${apiKey}`
    );
    if (!statsRes.ok) continue;
    const s = await statsRes.json();
    totalSent    += s.sent_count ?? 0;
    totalOpened  += s.open_count ?? 0;
    totalReplied += s.reply_count ?? 0;
    totalClicked += s.click_count ?? 0;
    totalBounced += s.bounce_count ?? 0;
  }

  const metrics: MetricRow[] = ([
    { name: "Emails Sent",    value: totalSent,    category: "leads"   as const },
    { name: "Emails Opened",  value: totalOpened,  category: "traffic" as const },
    { name: "Replies",        value: totalReplied, category: "custom"  as const },
    { name: "Link Clicks",    value: totalClicked, category: "custom"  as const },
    { name: "Bounced",        value: totalBounced, category: "custom"  as const },
  ] as MetricRow[]).filter((m) => m.value > 0);

  return { metrics, source: `Smartlead (${(campaigns ?? []).length} campaign${(campaigns ?? []).length !== 1 ? "s" : ""})` };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MetricRow = {
  name: string;
  value: number;
  category: "traffic" | "leads" | "revenue" | "cost" | "custom";
};

// ── HeyReach sync ─────────────────────────────────────────────────────────────
// Docs: https://api.heyreach.io/api-documentation

async function syncHeyreach(apiKey: string): Promise<{ metrics: MetricRow[]; source: string }> {
  // Get all campaigns
  const listRes = await fetch("https://api.heyreach.io/api/public/campaign/GetAll", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ offset: 0, limit: 50 }),
  });

  if (!listRes.ok) throw new Error(`HeyReach API error: ${listRes.status} ${await listRes.text()}`);

  const listData = await listRes.json();
  const campaigns: any[] = listData.items ?? listData.data ?? [];

  let totalSent = 0, totalAccepted = 0, totalReplied = 0, totalMeetings = 0;

  for (const c of campaigns.slice(0, 20)) {
    totalSent     += c.stats?.connection_requests_sent ?? c.totalCount ?? 0;
    totalAccepted += c.stats?.connection_requests_accepted ?? c.acceptedCount ?? 0;
    totalReplied  += c.stats?.messages_replied ?? c.repliedCount ?? 0;
    totalMeetings += c.stats?.meetings_booked ?? 0;
  }

  const metrics: MetricRow[] = ([
    { name: "Connection Requests Sent", value: totalSent,     category: "leads"   as const },
    { name: "Connections Accepted",     value: totalAccepted, category: "traffic" as const },
    { name: "Replies",                  value: totalReplied,  category: "custom"  as const },
    { name: "Meetings Booked",          value: totalMeetings, category: "custom"  as const },
  ] as MetricRow[]).filter((m) => m.value > 0);

  return { metrics, source: `HeyReach (${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""})` };
}

// ── Lemlist sync ──────────────────────────────────────────────────────────────
// Docs: https://developer.lemlist.com/

async function syncLemlist(apiKey: string): Promise<{ metrics: MetricRow[]; source: string }> {
  const headers = { Authorization: `Basic ${Buffer.from(`:${apiKey}`).toString("base64")}` };

  const listRes = await fetch("https://api.lemlist.com/api/campaigns", { headers });
  if (!listRes.ok) throw new Error(`Lemlist API error: ${listRes.status} ${await listRes.text()}`);

  const campaigns: any[] = await listRes.json();

  let totalSent = 0, totalOpened = 0, totalReplied = 0, totalBounced = 0;

  for (const c of (campaigns ?? []).slice(0, 20)) {
    const statsRes = await fetch(`https://api.lemlist.com/api/campaigns/${c._id}/stats`, { headers });
    if (!statsRes.ok) continue;
    const s = await statsRes.json();
    totalSent    += s.emailsSent ?? 0;
    totalOpened  += s.emailsOpened ?? 0;
    totalReplied += s.emailsReplied ?? 0;
    totalBounced += s.emailsBounced ?? 0;
  }

  const metrics: MetricRow[] = ([
    { name: "Emails Sent",   value: totalSent,    category: "leads"   as const },
    { name: "Emails Opened", value: totalOpened,  category: "traffic" as const },
    { name: "Replies",       value: totalReplied, category: "custom"  as const },
    { name: "Bounced",       value: totalBounced, category: "custom"  as const },
  ] as MetricRow[]).filter((m) => m.value > 0);

  return { metrics, source: `Lemlist (${(campaigns ?? []).length} campaign${(campaigns ?? []).length !== 1 ? "s" : ""})` };
}

// ── Route handler ─────────────────────────────────────────────────────────────

const SUPPORTED_TOOLS = ["instantly", "smartlead", "heyreach", "lemlist"] as const;
type SyncTool = typeof SUPPORTED_TOOLS[number];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reportId, tool, campaignId, campaignName } = await request.json();
    if (!reportId || !SUPPORTED_TOOLS.includes(tool)) {
      return NextResponse.json({ error: "Missing reportId or invalid tool" }, { status: 400 });
    }

    // Verify report belongs to this user
    const { data: report } = await supabase
      .from("reports")
      .select("id, project_id, projects!inner(clients!inner(user_id))")
      .eq("id", reportId)
      .single();

    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    // Get decrypted API key from global integrations store
    const apiKey = await getGlobalApiKey(supabase, user.id, tool);
    if (!apiKey) {
      return NextResponse.json(
        { error: `No ${tool} API key found. Add it in Settings → Integrations first.` },
        { status: 400 }
      );
    }

    // Fetch from the tool's API
    let metrics: MetricRow[];
    let source: string;

    if (tool === "instantly") {
      ({ metrics, source } = await syncInstantly(apiKey, campaignId, campaignName));
    } else if (tool === "smartlead") {
      ({ metrics, source } = await syncSmartlead(apiKey));
    } else if (tool === "heyreach") {
      ({ metrics, source } = await syncHeyreach(apiKey));
    } else {
      ({ metrics, source } = await syncLemlist(apiKey));
    }

    if (metrics.length === 0) {
      return NextResponse.json({ error: "No data returned from the API. Check that your account has active campaigns." }, { status: 400 });
    }

    // Insert metrics into report (skip existing ones with same name)
    const { data: existing } = await supabase
      .from("report_metrics")
      .select("metric_name")
      .eq("report_id", reportId);

    const existingNames = new Set((existing ?? []).map((m: any) => m.metric_name.toLowerCase()));

    const toInsert = metrics
      .filter((m) => !existingNames.has(m.name.toLowerCase()))
      .map((m, i) => ({
        report_id: reportId,
        metric_name: m.name,
        metric_value: m.value,
        metric_category: m.category,
        display_order: (existing?.length ?? 0) + i,
      }));

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from("report_metrics").insert(toInsert);
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      inserted: toInsert.length,
      skipped: metrics.length - toInsert.length,
      source,
    });
  } catch (err: any) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: err.message ?? "Sync failed" }, { status: 500 });
  }
}
