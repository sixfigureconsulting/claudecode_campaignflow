import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig } from "@/lib/api/get-integration-config";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type OutboundSyncConfig = {
  signing_secret?: string;
  instantly_webhook_url?: string;
  smartlead_webhook_url?: string;
  heyreach_webhook_url?: string;
  generic_webhook_url?: string;
};

export type OutboundSyncSep = "instantly" | "smartlead" | "heyreach";

export async function getOutboundSyncConfig(
  supabase: SupabaseClient,
  userId: string
): Promise<OutboundSyncConfig | null> {
  const raw = await getGlobalApiConfig(supabase, userId, "outboundsync");
  if (!raw || typeof raw !== "object") return null;
  return raw as OutboundSyncConfig;
}

export function pickSepWebhookUrl(cfg: OutboundSyncConfig, sep: OutboundSyncSep): string | null {
  if (sep === "instantly") return cfg.instantly_webhook_url || null;
  if (sep === "smartlead") return cfg.smartlead_webhook_url || null;
  if (sep === "heyreach")  return cfg.heyreach_webhook_url  || null;
  return null;
}

type EnsureResult = { registered: boolean; skipped?: string; error?: string };

// Registers an OutboundSync webhook URL on the given SEP campaign/list.
// Best-effort: never throws; returns a small status object for logging.
export async function ensureOutboundSyncWebhook(args: {
  sep: OutboundSyncSep;
  sepCampaignId: string;
  sepApiKey: string;
  outboundSyncUrl: string;
}): Promise<EnsureResult> {
  const { sep, sepCampaignId, sepApiKey, outboundSyncUrl } = args;
  if (!outboundSyncUrl) return { registered: false, skipped: "no url" };

  try {
    if (sep === "instantly") return await registerInstantlyWebhook(sepCampaignId, sepApiKey, outboundSyncUrl);
    if (sep === "smartlead") return await registerSmartleadWebhook(sepCampaignId, sepApiKey, outboundSyncUrl);
    if (sep === "heyreach")  return await registerHeyreachWebhook(sepCampaignId, sepApiKey, outboundSyncUrl);
    return { registered: false, skipped: "unknown sep" };
  } catch (err) {
    return { registered: false, error: String(err) };
  }
}

async function registerInstantlyWebhook(campaignId: string, apiKey: string, url: string): Promise<EnsureResult> {
  const listRes = await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}/webhooks`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (listRes.ok) {
    const list = await listRes.json().catch(() => ({}));
    const items = (list?.items ?? list ?? []) as Array<Record<string, unknown>>;
    if (items.some((w) => (w.url as string) === url || (w.webhook_url as string) === url)) {
      return { registered: true, skipped: "already registered" };
    }
  }
  const res = await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}/webhooks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, events: ["reply_received", "email_bounced", "unsubscribe"] }),
  });
  if (!res.ok) return { registered: false, error: `instantly ${res.status}` };
  return { registered: true };
}

async function registerSmartleadWebhook(campaignId: string, apiKey: string, url: string): Promise<EnsureResult> {
  const listRes = await fetch(
    `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/webhooks?api_key=${apiKey}`
  );
  if (listRes.ok) {
    const items = (await listRes.json().catch(() => [])) as Array<Record<string, unknown>>;
    if (Array.isArray(items) && items.some((w) => (w.webhook_url as string) === url)) {
      return { registered: true, skipped: "already registered" };
    }
  }
  const res = await fetch(
    `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/webhooks?api_key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "CampaignFlow → OutboundSync",
        webhook_url: url,
        event_types: ["EMAIL_REPLY", "EMAIL_BOUNCE", "LEAD_UNSUBSCRIBED"],
      }),
    }
  );
  if (!res.ok) return { registered: false, error: `smartlead ${res.status}` };
  return { registered: true };
}

async function registerHeyreachWebhook(listId: string, apiKey: string, url: string): Promise<EnsureResult> {
  const listRes = await fetch("https://api.heyreach.io/api/public/v1/webhooks/GetAll", {
    headers: { "X-API-KEY": apiKey },
  });
  if (listRes.ok) {
    const data = (await listRes.json().catch(() => ({}))) as { items?: Array<Record<string, unknown>> };
    const items = data?.items ?? [];
    if (items.some((w) => (w.webhookUrl as string) === url || (w.url as string) === url)) {
      return { registered: true, skipped: "already registered" };
    }
  }
  const res = await fetch("https://api.heyreach.io/api/public/v1/webhooks/Create", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "CampaignFlow → OutboundSync",
      webhookUrl: url,
      listId,
      eventTypes: ["MESSAGE_REPLY", "CAMPAIGN_LEAD_STATUS_CHANGED"],
    }),
  });
  if (!res.ok) return { registered: false, error: `heyreach ${res.status}` };
  return { registered: true };
}

// Canonical payload shape for events forwarded from CampaignFlow to OutboundSync.
// Payload is CampaignFlow-branded (not an SEP-native shape); users set up an
// OutboundSync rule to accept this. Signed with HMAC-SHA256 using signing_secret.
export type ForwardedEvent = {
  event_type: "reply.classified_interested" | "reply.classified" | "lead.pushed";
  occurred_at?: string;
  contact?: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
  };
  context?: Record<string, unknown>;
};

export async function forwardEventToOutboundSync(
  supabase: SupabaseClient,
  userId: string,
  event: ForwardedEvent
): Promise<{ forwarded: boolean; error?: string }> {
  try {
    const cfg = await getOutboundSyncConfig(supabase, userId);
    if (!cfg?.generic_webhook_url || !cfg?.signing_secret) {
      return { forwarded: false, error: "outboundsync not configured" };
    }

    const body = JSON.stringify({
      source: "campaignflow",
      occurred_at: event.occurred_at ?? new Date().toISOString(),
      ...event,
    });
    const signature = crypto.createHmac("sha256", cfg.signing_secret).update(body).digest("hex");

    const res = await fetch(cfg.generic_webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CampaignFlow-Source": "campaignflow-inbox",
        "X-CampaignFlow-Signature": `sha256=${signature}`,
      },
      body,
    });
    if (!res.ok) return { forwarded: false, error: `outboundsync ${res.status}` };
    return { forwarded: true };
  } catch (err) {
    return { forwarded: false, error: String(err) };
  }
}
