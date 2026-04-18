import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";
import { decryptApiKey } from "@/lib/encryption";
import type { CampaignLead } from "@/types/database";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ToolExecutionResult {
  success: boolean;
  summary: string;
  data: Record<string, unknown>;
  error?: string;
}

// ── Tool 1: Research ICP ──────────────────────────────────────────────────────

export async function executeResearchIcp(
  supabase: SupabaseClient,
  userId: string,
  input: { icp_description: string; offer: string; channels?: string[] }
): Promise<ToolExecutionResult> {
  try {
    const { data: aiConfig } = await supabase
      .from("ai_configs")
      .select("api_key_encrypted, model_preference")
      .eq("user_id", userId)
      .eq("provider", "anthropic")
      .single();

    if (!aiConfig) {
      return {
        success: false,
        summary: "No Anthropic API key configured — skipping ICP research.",
        data: {},
        error: "No Anthropic API key",
      };
    }

    const apiKey = decryptApiKey(aiConfig.api_key_encrypted);
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      thinking: { type: "enabled", budget_tokens: 2000 },
      messages: [{
        role: "user",
        content: `Analyze this ICP and offer, then return structured JSON only (no markdown):

OFFER: ${input.offer}
ICP: ${input.icp_description}
CHANNELS: ${(input.channels ?? []).join(", ") || "all channels"}

Return this exact JSON:
{
  "titles": ["top 5 job titles to target"],
  "company_types": ["types of companies"],
  "company_sizes": ["size ranges e.g. 11-50, 51-200"],
  "pain_points": ["top 3-4 pain points this offer solves"],
  "best_channels": ["channels ranked best to worst for this ICP"],
  "search_keywords": ["Apollo/LinkedIn search keywords for this ICP"],
  "qualifying_signals": ["signals that indicate a good fit"]
}`,
      }],
    });

    const textBlock = response.content.find((b: Anthropic.ContentBlock) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Empty response");

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse ICP analysis");
    const analysis = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const titles = (analysis.titles as string[]) ?? [];
    const channels = (analysis.best_channels as string[]) ?? [];

    return {
      success: true,
      summary: `ICP researched: targeting ${titles.slice(0, 3).join(", ")}. Best channels: ${channels.slice(0, 2).join(", ")}.`,
      data: analysis,
    };
  } catch (err) {
    return {
      success: false,
      summary: "ICP research failed — continuing with user's description.",
      data: {},
      error: String(err),
    };
  }
}

// ── Tool 2: Build Lead List ───────────────────────────────────────────────────

export async function executeBuildLeadList(
  supabase: SupabaseClient,
  userId: string,
  input: { source: string; input_value: string; list_name: string }
): Promise<ToolExecutionResult> {
  try {
    const { source, input_value, list_name } = input;

    // Fetch leads using per-source logic
    let leads: CampaignLead[] = [];

    if (source === "apollo") {
      leads = await scrapeApollo(supabase, userId, input_value);
    } else if (source === "hunter") {
      leads = await scrapeHunter(supabase, userId, input_value);
    } else if (source === "gsheet") {
      leads = await scrapeGSheet(input_value);
    } else if (source === "apify") {
      leads = await scrapeApify(supabase, userId, input_value);
    } else {
      return { success: false, summary: `Source '${source}' not supported in agent mode.`, data: {}, error: "Unsupported source" };
    }

    if (leads.length === 0) {
      return { success: false, summary: `No leads found from ${source}. Check the URL or API key.`, data: {}, error: "No leads returned" };
    }

    // Save to lead_lists
    const { data: list, error: listErr } = await supabase
      .from("lead_lists")
      .insert({ user_id: userId, name: list_name, source, lead_count: leads.length })
      .select("id")
      .single();

    if (listErr || !list) throw new Error(listErr?.message ?? "Failed to create list");

    // Save contacts in batches of 100
    for (let i = 0; i < leads.length; i += 100) {
      const batch = leads.slice(i, i + 100).map((l) => ({
        list_id: list.id,
        first_name: l.first_name,
        last_name: l.last_name,
        email: l.email,
        company: l.company,
        title: l.title,
        linkedin_url: l.linkedin_url ?? null,
        website: l.website ?? null,
        phone: l.phone ?? null,
      }));
      await supabase.from("lead_list_contacts").insert(batch);
    }

    return {
      success: true,
      summary: `Built "${list_name}" with ${leads.length} leads from ${source}.`,
      data: { list_id: list.id, lead_count: leads.length, list_name },
    };
  } catch (err) {
    return { success: false, summary: `Failed to build lead list from ${input.source}.`, data: {}, error: String(err) };
  }
}

// ── Tool 3: Generate Sequences ────────────────────────────────────────────────

export async function executeGenerateSequences(
  supabase: SupabaseClient,
  userId: string,
  input: { channel: string; offer: string; icp: string; tone: string; sample_lead?: { first_name?: string; company?: string; title?: string } }
): Promise<ToolExecutionResult> {
  try {
    const { data: aiConfig } = await supabase
      .from("ai_configs")
      .select("api_key_encrypted, model_preference")
      .eq("user_id", userId)
      .eq("provider", "anthropic")
      .single();

    if (!aiConfig) {
      return { success: false, summary: "No Anthropic API key — cannot generate sequences.", data: {}, error: "No AI key" };
    }

    const apiKey = decryptApiKey(aiConfig.api_key_encrypted);
    const client = new Anthropic({ apiKey });

    const channelMap: Record<string, string> = {
      linkedin: "LinkedIn DM", instagram: "Instagram DM", reddit: "Reddit DM",
      twitter: "Twitter/X DM", email: "Cold Email",
    };

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      thinking: { type: "enabled", budget_tokens: 3000 },
      messages: [{
        role: "user",
        content: `Generate a 3-step outreach sequence for ${channelMap[input.channel] ?? input.channel}.

OFFER: ${input.offer}
ICP: ${input.icp}
TONE: ${input.tone}
${input.sample_lead ? `SAMPLE LEAD: ${input.sample_lead.first_name ?? "prospect"} at ${input.sample_lead.company ?? "their company"} (${input.sample_lead.title ?? "unknown title"})` : ""}

Return JSON only (no markdown):
{
  "step1": {
    "label": "Opener",
    "message": "copy-paste ready message",
    "why": "brief strategy note"
  },
  "step2": {
    "label": "Follow-up",
    "message": "copy-paste ready follow-up (send 3 days later)",
    "why": "brief strategy note"
  },
  "step3": {
    "label": "Last touch",
    "message": "copy-paste ready final message (send 7 days later)",
    "why": "brief strategy note"
  }
}`,
      }],
    });

    const textBlock = response.content.find((b: Anthropic.ContentBlock) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Empty response");
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse sequences");
    const sequences = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    return {
      success: true,
      summary: `Generated 3-step ${input.channel} sequence for "${input.offer.slice(0, 40)}…".`,
      data: { sequences, channel: input.channel },
    };
  } catch (err) {
    return { success: false, summary: "Failed to generate sequences.", data: {}, error: String(err) };
  }
}

// ── Tool 4: Create Campaign ───────────────────────────────────────────────────

export async function executeCreateCampaign(
  supabase: SupabaseClient,
  userId: string,
  input: { name: string; channel: string; list_id: string; message_config: Record<string, unknown> }
): Promise<ToolExecutionResult> {
  try {
    // Verify the list belongs to this user
    const { data: list } = await supabase
      .from("lead_lists")
      .select("id, lead_count")
      .eq("id", input.list_id)
      .eq("user_id", userId)
      .single();

    if (!list) {
      return { success: false, summary: "Lead list not found — skipping campaign creation.", data: {}, error: "List not found" };
    }

    const { data: campaign, error } = await supabase
      .from("social_campaigns")
      .insert({
        user_id: userId,
        name: input.name,
        channel: input.channel,
        list_id: input.list_id,
        message_config: input.message_config,
        schedule_config: {},
        status: "draft",
        total_leads: list.lead_count,
      })
      .select("id")
      .single();

    if (error || !campaign) throw new Error(error?.message ?? "Insert failed");

    return {
      success: true,
      summary: `Created "${input.name}" (${input.channel}) campaign in draft with ${list.lead_count} leads.`,
      data: { campaign_id: campaign.id, name: input.name, channel: input.channel, lead_count: list.lead_count },
    };
  } catch (err) {
    return { success: false, summary: `Failed to create campaign "${input.name}".`, data: {}, error: String(err) };
  }
}

// ── Tool 5: Create Comment Automation ────────────────────────────────────────

export async function executeCreateCommentAutomation(
  supabase: SupabaseClient,
  userId: string,
  input: { name: string; platform: string; keyword: string; reply_dm: string; post_url?: string }
): Promise<ToolExecutionResult> {
  try {
    const { data: automation, error } = await supabase
      .from("comment_automations")
      .insert({
        user_id: userId,
        name: input.name,
        platform: input.platform,
        keyword: input.keyword,
        reply_dm: input.reply_dm,
        post_url: input.post_url ?? null,
        status: "draft",
      })
      .select("id")
      .single();

    if (error || !automation) throw new Error(error?.message ?? "Insert failed");

    return {
      success: true,
      summary: `Created "${input.name}" ${input.platform} comment automation in draft. Keyword: "${input.keyword}".`,
      data: { automation_id: automation.id, name: input.name, platform: input.platform, keyword: input.keyword },
    };
  } catch (err) {
    return { success: false, summary: `Failed to create comment automation "${input.name}".`, data: {}, error: String(err) };
  }
}

// ── Anthropic tool definitions ────────────────────────────────────────────────

export const SUPER_AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "research_icp",
    description: "Researches the ideal customer profile to identify job titles, company types, pain points, and best outreach channels. Always call this first before building lists.",
    input_schema: {
      type: "object" as const,
      properties: {
        icp_description: { type: "string", description: "The ICP description from the user" },
        offer: { type: "string", description: "The user's offer or product" },
        channels: { type: "array", items: { type: "string" }, description: "Channels to optimize ICP for" },
      },
      required: ["icp_description", "offer"],
    },
  },
  {
    name: "build_lead_list",
    description: "Builds a lead list using an integration. Only use sources listed as available. Saves the list and returns the list_id.",
    input_schema: {
      type: "object" as const,
      properties: {
        source: { type: "string", enum: ["apollo", "apify", "hunter", "gsheet"], description: "The data source to use" },
        input_value: { type: "string", description: "Apollo list URL, Hunter domain, Apify dataset URL, or Google Sheets URL" },
        list_name: { type: "string", description: "Name for the lead list" },
      },
      required: ["source", "input_value", "list_name"],
    },
  },
  {
    name: "generate_sequences",
    description: "Generates a 3-step personalized outreach sequence for a channel using the offer and ICP context.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel: { type: "string", enum: ["linkedin", "instagram", "reddit", "twitter", "email"] },
        offer: { type: "string" },
        icp: { type: "string" },
        tone: { type: "string", enum: ["professional", "casual", "direct", "empathetic", "urgency"] },
        sample_lead: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            company: { type: "string" },
            title: { type: "string" },
          },
        },
      },
      required: ["channel", "offer", "icp", "tone"],
    },
  },
  {
    name: "create_campaign",
    description: "Creates a social outreach campaign in DRAFT status. Does NOT launch it. Returns the campaign_id.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        channel: { type: "string", enum: ["linkedin", "instagram", "reddit", "twitter", "email"] },
        list_id: { type: "string", description: "UUID from a previous build_lead_list call" },
        message_config: {
          type: "object",
          description: "Message settings including tone, sequences from generate_sequences",
        },
      },
      required: ["name", "channel", "list_id", "message_config"],
    },
  },
  {
    name: "create_comment_automation",
    description: "Creates an Instagram or Facebook comment-to-DM automation in DRAFT status. Only use if instagram or facebook are in the channels list.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        platform: { type: "string", enum: ["instagram", "facebook"] },
        keyword: { type: "string", description: "Comment keyword that triggers the DM" },
        reply_dm: { type: "string", description: "The DM message to send" },
        post_url: { type: "string", description: "Optional: specific post URL to monitor" },
      },
      required: ["name", "platform", "keyword", "reply_dm"],
    },
  },
];

// ── Internal scrapers ─────────────────────────────────────────────────────────

async function scrapeApollo(supabase: SupabaseClient, userId: string, inputValue: string): Promise<CampaignLead[]> {
  const config = await getGlobalApiConfig(supabase, userId, "apollo");
  const apiKey = getApiKey(config);
  if (!apiKey) throw new Error("Apollo API key not configured");

  const savedListId = inputValue.includes("saved_lists")
    ? (inputValue.split("saved_lists/")[1]?.split(/[/?#]/)[0]?.split("-")[0] ?? inputValue.trim())
    : inputValue.trim();

  const leads: CampaignLead[] = [];
  let page = 1;

  while (leads.length < 500) {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({ saved_list_id: savedListId, page, per_page: 100 }),
    });
    if (!res.ok) break;
    const data = await res.json() as { people?: Record<string, unknown>[] };
    const people = data.people ?? [];
    if (people.length === 0) break;
    for (const p of people) {
      const phones = p.phone_numbers as Array<Record<string, unknown>> | undefined;
      leads.push({
        first_name: (p.first_name as string) ?? "",
        last_name: (p.last_name as string) ?? "",
        email: (p.email as string) ?? "",
        company: (p.organization_name as string) ?? ((p.organization as Record<string, unknown>)?.name as string) ?? "",
        title: (p.title as string) ?? "",
        linkedin_url: (p.linkedin_url as string) ?? null,
        website: (p.website_url as string) ?? null,
        phone: phones?.[0]?.raw_number as string ?? null,
      });
    }
    if (people.length < 100) break;
    page++;
  }
  return leads.filter((l) => l.email?.includes("@"));
}

async function scrapeHunter(supabase: SupabaseClient, userId: string, inputValue: string): Promise<CampaignLead[]> {
  const config = await getGlobalApiConfig(supabase, userId, "hunter");
  const apiKey = getApiKey(config);
  if (!apiKey) throw new Error("Hunter.io API key not configured");

  const domain = inputValue.replace(/^https?:\/\//, "").split("/")[0].trim();
  const leads: CampaignLead[] = [];
  let offset = 0;

  while (leads.length < 500) {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=100&offset=${offset}&api_key=${apiKey}`);
    if (!res.ok) break;
    const data = await res.json() as { data?: { emails?: Record<string, unknown>[]; organization?: string } };
    const emails = data.data?.emails ?? [];
    if (emails.length === 0) break;
    const org = data.data?.organization ?? domain;
    for (const e of emails) {
      if (!e.value) continue;
      leads.push({
        first_name: (e.first_name as string) ?? "",
        last_name: (e.last_name as string) ?? "",
        email: e.value as string,
        company: org,
        title: (e.position as string) ?? "",
        linkedin_url: (e.linkedin as string) ?? null,
        website: `https://${domain}`,
        phone: (e.phone_number as string) ?? null,
      });
    }
    offset += 100;
    if (emails.length < 100) break;
  }
  return leads;
}

async function scrapeGSheet(inputValue: string): Promise<CampaignLead[]> {
  const match = inputValue.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("Invalid Google Sheets URL");
  const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
  const res = await fetch(csvUrl, { headers: { "User-Agent": "CampaignFlow/1.0" }, redirect: "follow" });
  if (!res.ok || res.url.includes("accounts.google.com")) throw new Error("Sheet is not publicly accessible");
  const text = await res.text();
  if (text.includes("<!DOCTYPE html")) throw new Error("Sheet requires sign-in");
  return parseCSV(text);
}

async function scrapeApify(supabase: SupabaseClient, userId: string, inputValue: string): Promise<CampaignLead[]> {
  const config = await getGlobalApiConfig(supabase, userId, "apify");
  const apiKey = getApiKey(config);
  if (!apiKey) throw new Error("Apify API token not configured");

  const datasetMatch = inputValue.match(/datasets\/([^/?]+)/);
  const runMatch = inputValue.match(/actor-runs\/([^/?]+)/);
  const datasetId = datasetMatch?.[1] ?? runMatch?.[1];
  if (!datasetId) throw new Error("Invalid Apify URL");

  const url = runMatch
    ? `https://api.apify.com/v2/actor-runs/${datasetId}/dataset/items?token=${apiKey}&limit=500`
    : `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=500`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Apify error: ${res.statusText}`);
  const items = await res.json() as Record<string, unknown>[];

  const FIELD_MAP: Record<string, keyof CampaignLead> = {
    firstName: "first_name", firstname: "first_name", first_name: "first_name",
    lastName: "last_name", lastname: "last_name", last_name: "last_name",
    email: "email", emailAddress: "email",
    company: "company", companyName: "company", organization: "company",
    title: "title", jobTitle: "title", position: "title",
    linkedinUrl: "linkedin_url", linkedin_url: "linkedin_url",
    website: "website", phone: "phone",
  };

  return items.map((item) => {
    const lead: CampaignLead = { first_name: "", last_name: "", email: "", company: "", title: "" };
    for (const [k, v] of Object.entries(item)) {
      const mapped = FIELD_MAP[k];
      if (mapped && typeof v === "string") (lead as Record<string, unknown>)[mapped] = v;
    }
    if (lead.first_name.includes(" ") && !lead.last_name) {
      const [first, ...rest] = lead.first_name.split(" ");
      lead.first_name = first;
      lead.last_name = rest.join(" ");
    }
    return lead;
  }).filter((l) => l.email?.includes("@"));
}

function parseCSV(text: string): CampaignLead[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
  const COL_MAP: Record<string, keyof CampaignLead> = {
    first_name: "first_name", firstname: "first_name", "first name": "first_name",
    last_name: "last_name", lastname: "last_name", "last name": "last_name",
    email: "email", email_address: "email", work_email: "email",
    company: "company", organization: "company", company_name: "company",
    title: "title", job_title: "title", jobtitle: "title", position: "title",
    linkedin_url: "linkedin_url", linkedin: "linkedin_url",
    website: "website", phone: "phone",
  };

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    const lead: CampaignLead = { first_name: "", last_name: "", email: "", company: "", title: "" };
    headers.forEach((h, i) => {
      const mapped = COL_MAP[h];
      if (mapped && cols[i]) (lead as Record<string, unknown>)[mapped] = cols[i];
    });
    return lead;
  }).filter((l) => l.email?.includes("@"));
}
