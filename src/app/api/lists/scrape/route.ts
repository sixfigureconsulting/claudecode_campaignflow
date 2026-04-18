/**
 * POST /api/lists/scrape
 *
 * Standalone list-builder scraping endpoint — no campaign project required.
 * Uses the user's global __integrations__ API keys (same keys stored in Settings).
 *
 * Handles: apollo, apify, phantombuster, hunter, hubspot, gsheet
 * CSV is parsed client-side; this route is for API/URL-based sources only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";
import type { CampaignLead } from "@/types/database";

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  source: z.enum(["apollo", "apify", "phantombuster", "hunter", "hubspot", "gsheet"]),
  inputValue: z.string().min(1).max(2000),
});

// ─── Field mappers ────────────────────────────────────────────────────────────

function mapApolloContact(c: Record<string, unknown>): CampaignLead {
  return {
    first_name: (c.first_name as string) ?? "",
    last_name: (c.last_name as string) ?? "",
    email: (c.email as string) ?? "",
    company: (c.organization_name as string) ?? ((c.organization as Record<string, unknown>)?.name as string) ?? "",
    title: (c.title as string) ?? "",
    linkedin_url: (c.linkedin_url as string) ?? null,
    website: (c.website_url as string) ?? ((c.organization as Record<string, unknown>)?.website_url as string) ?? null,
    phone: ((c.phone_numbers as Array<Record<string, unknown>>)?.[0]?.raw_number as string) ?? null,
  };
}

const APIFY_MAP: Record<string, keyof CampaignLead> = {
  firstName: "first_name", firstname: "first_name", first_name: "first_name",
  lastName: "last_name", lastname: "last_name", last_name: "last_name",
  fullName: "first_name", name: "first_name",
  email: "email", emailAddress: "email", workEmail: "email",
  company: "company", companyName: "company", organization: "company",
  title: "title", jobTitle: "title", headline: "title", position: "title",
  linkedinUrl: "linkedin_url", profileUrl: "linkedin_url", linkedin_url: "linkedin_url",
  website: "website", companyWebsite: "website",
  phone: "phone", phoneNumber: "phone",
};

function mapApifyItem(item: Record<string, unknown>): CampaignLead | null {
  const lead: Partial<CampaignLead> = {};
  for (const [k, v] of Object.entries(item)) {
    const mapped = APIFY_MAP[k];
    if (mapped && typeof v === "string" && v.trim()) (lead as Record<string, string>)[mapped] = v.trim();
  }
  // Array email fallback
  if (!lead.email) {
    const emails = item.emails as string[] | undefined;
    if (emails?.[0]) lead.email = emails[0];
  }
  if (lead.first_name && !lead.last_name && lead.first_name.includes(" ")) {
    const p = lead.first_name.trim().split(/\s+/);
    lead.first_name = p[0]; lead.last_name = p.slice(1).join(" ");
  }
  if (!((lead.email && lead.email.includes("@")) || (lead.phone && lead.phone.length > 5))) return null;
  if (!(lead.company || lead.first_name)) return null;
  return { first_name: lead.first_name ?? "", last_name: lead.last_name ?? "", email: lead.email ?? "", company: lead.company ?? "", title: lead.title ?? "", linkedin_url: lead.linkedin_url ?? null, website: lead.website ?? null, phone: lead.phone ?? null } as CampaignLead;
}

const PB_MAP: Record<string, keyof CampaignLead> = {
  firstName: "first_name", firstname: "first_name", first_name: "first_name",
  lastName: "last_name", lastname: "last_name", last_name: "last_name",
  fullName: "first_name", name: "first_name",
  email: "email", emailAddress: "email", workEmail: "email",
  company: "company", companyName: "company", currentCompany: "company",
  title: "title", jobTitle: "title", headline: "title", currentTitle: "title",
  linkedinUrl: "linkedin_url", profileUrl: "linkedin_url", vmid: "linkedin_url",
  website: "website", companyWebsite: "website",
  phone: "phone", phoneNumber: "phone",
};

function mapPhantomRecord(r: Record<string, unknown>): CampaignLead | null {
  const lead: Partial<CampaignLead> = {};
  for (const [k, v] of Object.entries(r)) {
    const mapped = PB_MAP[k];
    if (mapped && typeof v === "string" && v.trim()) (lead as Record<string, string>)[mapped] = v.trim();
  }
  if (lead.first_name && !lead.last_name && lead.first_name.includes(" ")) {
    const p = lead.first_name.trim().split(/\s+/);
    lead.first_name = p[0]; lead.last_name = p.slice(1).join(" ");
  }
  if (!((lead.email && lead.email.includes("@")) || (lead.phone && lead.phone.length > 5))) return null;
  if (!(lead.company || lead.first_name)) return null;
  return { first_name: lead.first_name ?? "", last_name: lead.last_name ?? "", email: lead.email ?? "", company: lead.company ?? "", title: lead.title ?? "", linkedin_url: lead.linkedin_url ?? null, website: lead.website ?? null, phone: lead.phone ?? null } as CampaignLead;
}

const GSHEET_MAP: Record<string, keyof CampaignLead> = {
  first_name: "first_name", firstname: "first_name", "first name": "first_name",
  last_name: "last_name", lastname: "last_name", "last name": "last_name",
  name: "first_name", "full name": "first_name",
  email: "email", "email address": "email", "work email": "email",
  company: "company", organization: "company", "company name": "company",
  title: "title", "job title": "title", position: "title",
  linkedin_url: "linkedin_url", linkedin: "linkedin_url",
  website: "website", "website url": "website",
  phone: "phone", "phone number": "phone", mobile: "phone",
};

function parseGSheetCSV(text: string): CampaignLead[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let cur = ""; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { values.push(cur.trim().replace(/^"|"$/g, "")); cur = ""; }
      else { cur += ch; }
    }
    values.push(cur.trim().replace(/^"|"$/g, ""));
    const lead: Partial<CampaignLead> = {};
    headers.forEach((h, i) => { const k = GSHEET_MAP[h]; if (k && values[i]) (lead as Record<string, string>)[k] = values[i]; });
    if (lead.first_name && !lead.last_name && lead.first_name.includes(" ")) {
      const p = lead.first_name.trim().split(/\s+/); lead.first_name = p[0]; lead.last_name = p.slice(1).join(" ");
    }
    return { first_name: lead.first_name ?? "", last_name: lead.last_name ?? "", email: lead.email ?? "", company: lead.company ?? "", title: lead.title ?? "", linkedin_url: lead.linkedin_url ?? null, website: lead.website ?? null, phone: lead.phone ?? null } as CampaignLead;
  }).filter((l) => (l.email?.includes("@") || (l.phone && l.phone.length > 5)) && !!(l.company || l.first_name));
}

function extractApolloListId(url: string): string | null {
  try {
    const hash = url.split("#")?.[1] ?? "";
    const p = new URLSearchParams(hash.split("?")?.[1] ?? "");
    return p.get("savedListId") ?? new URLSearchParams(url.split("?")?.[1] ?? "").get("savedListId") ?? null;
  } catch { return null; }
}

function extractPhantomAgentId(url: string): string | null {
  const m = url.match(/phantombuster\.com\/[^/]+\/phantoms\/([a-zA-Z0-9-]+)/);
  if (m) return m[1].split("-")[0];
  const d = url.match(/^(\d{10,})$/);
  return d ? d[1] : null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = rateLimit(`list-scrape:${user.id}`, { limit: 20, windowMs: 60_000 });
    if (!rl.success) return rateLimitResponse(rl.resetAt);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });

    const { source, inputValue } = parsed.data;

    // ── Apollo ──────────────────────────────────────────────────────────────
    if (source === "apollo") {
      const config = await getGlobalApiConfig(supabase, user.id, "apollo");
      const apiKey = getApiKey(config);
      if (!apiKey) return NextResponse.json({ error: "Apollo API key not configured. Add it in Settings → Integrations." }, { status: 400 });

      const listId = extractApolloListId(inputValue) ?? inputValue.trim();
      const leads: CampaignLead[] = [];
      let page = 1; let totalPages = 1;
      do {
        const res = await fetch("https://api.apollo.io/api/v1/contacts/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "Cache-Control": "no-cache" },
          body: JSON.stringify({ per_page: 100, page, saved_list_ids: [listId] }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return NextResponse.json({ error: `Apollo API error: ${err.message ?? res.statusText}` }, { status: 502 });
        }
        const data = await res.json();
        leads.push(...(data.contacts ?? []).map(mapApolloContact));
        totalPages = data.pagination?.total_pages ?? 1;
        page++;
        if (leads.length >= 500) break;
      } while (page <= totalPages);
      const valid = leads.filter((l) => l.email?.includes("@"));
      return NextResponse.json({ leads: valid, total: valid.length });
    }

    // ── Apify ───────────────────────────────────────────────────────────────
    if (source === "apify") {
      const config = await getGlobalApiConfig(supabase, user.id, "apify");
      const apiKey = getApiKey(config);
      if (!apiKey) return NextResponse.json({ error: "Apify API token not configured. Add it in Settings → Integrations." }, { status: 400 });

      // Support both dataset URLs and actor run URLs
      const url = inputValue.trim().includes("?")
        ? `${inputValue.trim()}&token=${apiKey}`
        : `${inputValue.trim()}?token=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return NextResponse.json({ error: `Apify error: ${res.statusText}` }, { status: 502 });
      const items: Record<string, unknown>[] = await res.json();
      const leads = items.flatMap((item) => Array.isArray(item) ? item as Record<string, unknown>[] : [item]).map(mapApifyItem).filter((l): l is CampaignLead => l !== null);
      return NextResponse.json({ leads, total: leads.length });
    }

    // ── PhantomBuster ───────────────────────────────────────────────────────
    if (source === "phantombuster") {
      const config = await getGlobalApiConfig(supabase, user.id, "phantombuster");
      const apiKey = getApiKey(config);
      if (!apiKey) return NextResponse.json({ error: "PhantomBuster API key not configured. Add it in Settings → Integrations." }, { status: 400 });

      const agentId = extractPhantomAgentId(inputValue.trim());
      if (!agentId) return NextResponse.json({ error: "Could not extract agent ID from the URL. Paste the full phantom URL from your PhantomBuster dashboard." }, { status: 400 });

      const agentRes = await fetch(`https://api.phantombuster.com/api/v2/agents/fetch-output?id=${agentId}`, {
        headers: { "X-Phantombuster-Key": apiKey },
      });
      if (!agentRes.ok) return NextResponse.json({ error: `PhantomBuster error: ${agentRes.statusText}` }, { status: 502 });

      const agentData = await agentRes.json();
      let records: Record<string, unknown>[] = [];

      // Output can be JSON string or S3 URL
      if (agentData.output) {
        try {
          const parsed2 = JSON.parse(agentData.output);
          records = Array.isArray(parsed2) ? parsed2 : [parsed2];
        } catch { /* not JSON */ }
      }
      if (records.length === 0 && agentData.resultObject) {
        try {
          const r = JSON.parse(agentData.resultObject);
          records = Array.isArray(r) ? r : [r];
        } catch { /* not JSON */ }
      }
      if (records.length === 0 && agentData.s3Folder) {
        const s3Res = await fetch(`https://cache.phantombuster.com/${agentData.s3Folder}/result.json`, {
          headers: { "X-Phantombuster-Key": apiKey },
        });
        if (s3Res.ok) records = await s3Res.json().catch(() => []);
      }

      const leads = records.map(mapPhantomRecord).filter((l): l is CampaignLead => l !== null);
      return NextResponse.json({ leads, total: leads.length });
    }

    // ── Hunter ──────────────────────────────────────────────────────────────
    if (source === "hunter") {
      const config = await getGlobalApiConfig(supabase, user.id, "hunter");
      const apiKey = getApiKey(config);
      if (!apiKey) return NextResponse.json({ error: "Hunter.io API key not configured. Add it in Settings → Integrations." }, { status: 400 });

      const domain = inputValue.replace(/^https?:\/\//, "").split("/")[0].trim();
      const leads: CampaignLead[] = [];
      let offset = 0;
      do {
        const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=100&offset=${offset}&api_key=${apiKey}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return NextResponse.json({ error: `Hunter.io error: ${err.errors?.[0]?.details ?? err.message ?? res.statusText}` }, { status: 502 });
        }
        const data = await res.json();
        const emails: Record<string, unknown>[] = data.data?.emails ?? [];
        if (emails.length === 0) break;
        const org: string = data.data?.organization ?? domain;
        for (const e of emails) {
          if (!e.value) continue;
          leads.push({ first_name: (e.first_name as string) ?? "", last_name: (e.last_name as string) ?? "", email: e.value as string, company: org, title: (e.position as string) ?? "", linkedin_url: (e.linkedin as string) ?? null, website: `https://${domain}`, phone: (e.phone_number as string) ?? null });
        }
        offset += 100;
        if (emails.length < 100 || leads.length >= 500) break;
      } while (true);
      return NextResponse.json({ leads, total: leads.length });
    }

    // ── HubSpot ─────────────────────────────────────────────────────────────
    if (source === "hubspot") {
      const config = await getGlobalApiConfig(supabase, user.id, "hubspot");
      const apiKey = getApiKey(config);
      if (!apiKey) return NextResponse.json({ error: "HubSpot API key not configured. Add it in Settings → Integrations." }, { status: 400 });

      const listId = inputValue.trim();
      const recordIds: string[] = [];
      let membAfter: string | null = null;
      do {
        const afterParam: string = membAfter ? `&after=${membAfter}` : "";
        const url = `https://api.hubapi.com/crm/v3/lists/${encodeURIComponent(listId)}/memberships?limit=100${afterParam}`;
        const membRes = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
        if (!membRes.ok) {
          const err = await membRes.json().catch(() => ({}));
          return NextResponse.json({ error: `HubSpot list error: ${err.message ?? membRes.statusText}. Check your list ID.` }, { status: 502 });
        }
        const membData = await membRes.json();
        for (const r of membData.results ?? []) recordIds.push((r as Record<string, string>).recordId);
        membAfter = membData.paging?.next?.after ?? null;
        if (recordIds.length >= 500) break;
      } while (membAfter);
      if (recordIds.length === 0) return NextResponse.json({ leads: [], total: 0 });

      const leads: CampaignLead[] = [];
      for (let i = 0; i < recordIds.length; i += 100) {
        const chunk = recordIds.slice(i, i + 100);
        const batchRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/read", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: chunk.map((id) => ({ id })), properties: ["firstname", "lastname", "email", "company", "jobtitle", "hs_linkedin_url", "website", "phone"] }),
        });
        if (!batchRes.ok) return NextResponse.json({ error: "Failed to fetch HubSpot contact details." }, { status: 502 });
        const batchData = await batchRes.json();
        for (const r of batchData.results ?? []) {
          const p = (r as Record<string, Record<string, string>>).properties ?? {};
          if (p.email?.includes("@")) leads.push({ first_name: p.firstname ?? "", last_name: p.lastname ?? "", email: p.email ?? "", company: p.company ?? "", title: p.jobtitle ?? "", linkedin_url: p.hs_linkedin_url ?? null, website: p.website ?? null, phone: p.phone ?? null });
        }
      }
      return NextResponse.json({ leads, total: leads.length });
    }

    // ── Google Sheets ───────────────────────────────────────────────────────
    if (source === "gsheet") {
      const match = inputValue.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) return NextResponse.json({ error: "Invalid Google Sheets URL. Paste the full URL from your browser." }, { status: 400 });
      const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
      const res = await fetch(csvUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CampaignFlow/1.0)" }, redirect: "follow" });
      if (!res.ok || res.url.includes("accounts.google.com")) return NextResponse.json({ error: "Sheet is not publicly accessible. Set sharing to Anyone with the link → Viewer." }, { status: 400 });
      const text = await res.text();
      if (text.includes("accounts.google.com") || text.includes("<!DOCTYPE html")) return NextResponse.json({ error: "Sheet requires sign-in. Set sharing to Anyone with the link → Viewer." }, { status: 400 });
      const leads = parseGSheetCSV(text);
      if (leads.length === 0) return NextResponse.json({ error: "No valid leads found. Ensure the sheet has email or phone columns." }, { status: 400 });
      return NextResponse.json({ leads, total: leads.length });
    }

    return NextResponse.json({ error: "Unsupported source" }, { status: 400 });
  } catch (error) {
    console.error("lists/scrape error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
