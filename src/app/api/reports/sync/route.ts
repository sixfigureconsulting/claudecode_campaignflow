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
// Docs: https://developer.instantly.ai/
// Fetches aggregate analytics across all campaigns in the workspace

async function syncInstantly(apiKey: string): Promise<{ metrics: MetricRow[]; source: string }> {
  // Get list of campaigns
  const listRes = await fetch("https://api.instantly.ai/api/v2/campaigns?limit=100&status=1", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!listRes.ok) {
    throw new Error(`Instantly API error: ${listRes.status} ${await listRes.text()}`);
  }

  const listData = await listRes.json();
  const campaigns: any[] = listData.items ?? listData.campaigns ?? [];

  let totalSent = 0, totalOpened = 0, totalReplied = 0, totalBounced = 0;

  // Aggregate analytics per campaign
  for (const campaign of campaigns.slice(0, 20)) {
    const analyticsRes = await fetch(
      `https://api.instantly.ai/api/v2/analytics/campaign/count?campaign_id=${campaign.id}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!analyticsRes.ok) continue;
    const a = await analyticsRes.json();
    totalSent    += a.emails_sent_count ?? a.total_sent ?? 0;
    totalOpened  += a.unique_opens ?? a.opened ?? 0;
    totalReplied += a.total_replies ?? a.replied ?? 0;
    totalBounced += a.bounced ?? 0;
  }

  const metrics: MetricRow[] = ([
    { name: "Emails Sent",    value: totalSent,    category: "leads"   as const },
    { name: "Emails Opened",  value: totalOpened,  category: "traffic" as const },
    { name: "Replies",        value: totalReplied, category: "custom"  as const },
    { name: "Bounced",        value: totalBounced, category: "custom"  as const },
  ] as MetricRow[]).filter((m) => m.value > 0);

  return { metrics, source: `Instantly (${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""})` };
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reportId, tool } = await request.json();
    if (!reportId || !["instantly", "smartlead"].includes(tool)) {
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
    const { metrics, source } = tool === "instantly"
      ? await syncInstantly(apiKey)
      : await syncSmartlead(apiKey);

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
