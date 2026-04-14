import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";
import { deductCredits } from "@/lib/credits";

// POST /api/social/campaigns/[id]/launch
// Launches a social DM campaign:
//   - LinkedIn → push leads to Heyreach list
//   - Reddit   → send DMs via /api/social/send/reddit (one per lead)
//   - Others   → mark active, actual send handled by future cron
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Fetch the campaign (ownership enforced by RLS)
  const { data: campaign, error: campErr } = await supabase
    .from("social_campaigns")
    .select("id, channel, name, message_config, schedule_config, status, total_leads")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status === "active" || campaign.status === "completed") {
    return NextResponse.json({ error: "Campaign already launched" }, { status: 409 });
  }

  // Fetch leads that are still pending
  const { data: leads, error: leadsErr } = await supabase
    .from("social_campaign_leads")
    .select("id, first_name, last_name, email, company, title, linkedin_url, reddit_username, twitter_handle")
    .eq("campaign_id", id)
    .eq("status", "pending")
    .limit(100); // hard cap per launch — prevents runaway sends

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: "No pending leads in this campaign" }, { status: 400 });
  }

  // Check credits: 1 credit per DM send
  const { allowed } = await (async () => {
    const { data } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .single();
    const balance = data?.balance ?? 0;
    return { allowed: balance >= leads.length };
  })();

  if (!allowed) {
    return NextResponse.json(
      { error: "Insufficient credits. Top up to launch this campaign." },
      { status: 402 }
    );
  }

  // Mark campaign as active
  await supabase
    .from("social_campaigns")
    .update({ status: "active" })
    .eq("id", id);

  const channel = campaign.channel as string;
  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  // ── LinkedIn → Heyreach ───────────────────────────────────────────────────
  if (channel === "linkedin") {
    const heyreachConfig = await getGlobalApiConfig(supabase, user.id, "heyreach");
    const heyreachKey = getApiKey(heyreachConfig);

    if (!heyreachKey) {
      await supabase.from("social_campaigns").update({ status: "failed" }).eq("id", id);
      return NextResponse.json({ error: "Heyreach API key not configured in Settings → Integrations" }, { status: 400 });
    }

    // Get or create a Heyreach list for this campaign
    const listsRes = await fetch("https://api.heyreach.io/api/public/v1/lists/GetAllLists", {
      headers: { "X-API-KEY": heyreachKey },
    });

    let listId: string | null = null;

    if (listsRes.ok) {
      const listsData = await listsRes.json();
      const existingList = (listsData?.items ?? listsData ?? [])
        .find((l: Record<string, unknown>) => (l.name as string)?.includes(campaign.name));
      listId = existingList?.id ?? null;
    }

    if (!listId) {
      const createRes = await fetch("https://api.heyreach.io/api/public/v1/lists/Create", {
        method: "POST",
        headers: { "X-API-KEY": heyreachKey, "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${campaign.name} — CampaignFlow` }),
      });
      if (createRes.ok) {
        listId = ((await createRes.json()) as { id: string })?.id ?? null;
      }
    }

    if (!listId) {
      await supabase.from("social_campaigns").update({ status: "failed" }).eq("id", id);
      return NextResponse.json({ error: "Could not create Heyreach list" }, { status: 500 });
    }

    const addRes = await fetch(`https://api.heyreach.io/api/public/v1/lists/${listId}/AddLeadsToList`, {
      method: "POST",
      headers: { "X-API-KEY": heyreachKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        leads: leads.map((l) => ({
          linkedInProfileUrl: l.linkedin_url ?? "",
          firstName: l.first_name,
          lastName: l.last_name,
          companyName: l.company,
        })),
      }),
    });

    if (addRes.ok) {
      sentCount = leads.length;
      const leadIds = leads.map((l) => l.id);
      await supabase
        .from("social_campaign_leads")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .in("id", leadIds);
    } else {
      failedCount = leads.length;
      errors.push("Heyreach API error: " + addRes.status);
    }
  }

  // ── Reddit → DM send ──────────────────────────────────────────────────────
  else if (channel === "reddit") {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    for (const lead of leads) {
      if (!lead.reddit_username) {
        await supabase
          .from("social_campaign_leads")
          .update({ status: "skipped", error_message: "No Reddit username" })
          .eq("id", lead.id);
        continue;
      }

      try {
        const res = await fetch(`${baseUrl}/api/social/send/reddit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaign_id: id,
            lead_id: lead.id,
            reddit_username: lead.reddit_username,
            subject: (campaign.message_config as Record<string, string>)?.subject ?? "Hey",
            message: (campaign.message_config as Record<string, string>)?.message_template ?? "",
            lead: { first_name: lead.first_name, company: lead.company, title: lead.title },
          }),
        });

        if (res.ok) {
          sentCount++;
        } else {
          failedCount++;
          errors.push(`Failed to DM ${lead.reddit_username}: ${res.status}`);
        }
      } catch (e) {
        failedCount++;
        errors.push(String(e));
      }
    }
  }

  // ── Twitter → DM send ────────────────────────────────────────────────────
  else if (channel === "twitter") {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    for (const lead of leads) {
      if (!lead.twitter_handle) {
        await supabase
          .from("social_campaign_leads")
          .update({ status: "skipped", error_message: "No Twitter handle" })
          .eq("id", lead.id);
        continue;
      }

      try {
        const res = await fetch(`${baseUrl}/api/social/send/twitter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaign_id: id,
            lead_id: lead.id,
            twitter_username: lead.twitter_handle,
            message: (campaign.message_config as Record<string, string>)?.message_template ?? "",
          }),
        });

        if (res.ok) {
          sentCount++;
        } else {
          failedCount++;
          errors.push(`Failed to DM @${lead.twitter_handle}: ${res.status}`);
        }
      } catch (e) {
        failedCount++;
        errors.push(String(e));
      }
    }
  }

  // ── Other channels → mark active, cron handles send ───────────────────────
  else {
    // Instagram, Facebook, Email — mark active, cron will process
    sentCount = 0;
  }

  // Deduct 1 credit per sent DM
  if (sentCount > 0) {
    await deductCredits(supabase, user.id, "social_dm_send", sentCount, {
      campaign_id: id,
      channel,
    });
  }

  // Update campaign stats
  await supabase
    .from("social_campaigns")
    .update({
      status: sentCount > 0 ? "active" : failedCount > 0 ? "failed" : "active",
      sent_count: sentCount,
      failed_count: failedCount,
    })
    .eq("id", id);

  return NextResponse.json({
    success: true,
    sent: sentCount,
    failed: failedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
