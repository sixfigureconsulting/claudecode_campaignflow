import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGlobalApiConfig, getApiKey } from "@/lib/api/get-integration-config";
import type { CampaignLead } from "@/types/database";

// Field name mapping — covers LinkedIn scrapers, email finders, Sales Nav extractors
const FIELD_MAP: Record<string, keyof CampaignLead> = {
  // Name variants
  firstName: "first_name", firstname: "first_name", first_name: "first_name",
  lastName: "last_name", lastname: "last_name", last_name: "last_name",
  fullName: "first_name", name: "first_name",
  // Email
  email: "email", emailAddress: "email", workEmail: "email",
  // Company
  company: "company", companyName: "company", organization: "company",
  currentCompany: "company", currentCompanyName: "company",
  // Title
  title: "title", jobTitle: "title", headline: "title", position: "title",
  currentPosition: "title", currentTitle: "title",
  // LinkedIn
  linkedinUrl: "linkedin_url", profileUrl: "linkedin_url", linkedInUrl: "linkedin_url",
  linkedin: "linkedin_url", vmid: "linkedin_url",
  // Website
  website: "website", companyWebsite: "website", websiteUrl: "website",
  // Phone
  phone: "phone", phoneNumber: "phone", mobilePhone: "phone",
};

function mapRecord(record: Record<string, unknown>): CampaignLead | null {
  const lead: Partial<CampaignLead> = {};
  for (const [key, value] of Object.entries(record)) {
    const mapped = FIELD_MAP[key];
    if (mapped && typeof value === "string" && value.trim()) {
      (lead as Record<string, string>)[mapped] = value.trim();
    }
  }

  // Split "Full Name" → first + last
  if (lead.first_name && !lead.last_name && lead.first_name.includes(" ")) {
    const parts = lead.first_name.trim().split(/\s+/);
    lead.first_name = parts[0];
    lead.last_name = parts.slice(1).join(" ");
  }

  const hasEmail = lead.email && lead.email.includes("@");
  const hasPhone = lead.phone && lead.phone.trim().length > 5;
  const hasIdentifier = !!(lead.company || lead.first_name);
  if (!(hasEmail || hasPhone) || !hasIdentifier) return null;

  return {
    first_name: lead.first_name ?? "",
    last_name: lead.last_name ?? "",
    email: lead.email ?? "",
    company: lead.company ?? "",
    title: lead.title ?? "",
    linkedin_url: lead.linkedin_url ?? null,
    website: lead.website ?? null,
    phone: lead.phone ?? null,
  } as CampaignLead;
}

function extractAgentId(url: string): string | null {
  // https://phantombuster.com/username/phantoms/12345678/...
  // https://phantombuster.com/phantombuster/phantoms/12345678-some-name/...
  const match = url.match(/phantombuster\.com\/[^/]+\/phantoms\/([a-zA-Z0-9-]+)/);
  if (match) return match[1].split("-")[0]; // strip slug suffix

  // Direct agent ID (numeric or uuid-like)
  const directMatch = url.match(/^(\d{10,})$/);
  if (directMatch) return directMatch[1];

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId, phantomUrl } = await request.json();
    if (!phantomUrl) return NextResponse.json({ error: "phantomUrl is required" }, { status: 400 });

    // Get PhantomBuster API key
    const config = await getGlobalApiConfig(supabase, user.id, "phantombuster");
    const apiKey = getApiKey(config);
    if (!apiKey) return NextResponse.json({ error: "PhantomBuster API key not configured. Add it in Settings → Integrations." }, { status: 400 });

    const agentId = extractAgentId(phantomUrl.trim());
    if (!agentId) return NextResponse.json({ error: "Invalid PhantomBuster URL. Paste the phantom URL from your PhantomBuster dashboard." }, { status: 400 });

    // Step 1: get the agent's latest output metadata
    const agentRes = await fetch(`https://api.phantombuster.com/api/v2/agents/fetch-output?id=${agentId}`, {
      headers: { "X-Phantombuster-Key": apiKey },
    });

    if (!agentRes.ok) {
      if (agentRes.status === 401 || agentRes.status === 403) {
        return NextResponse.json({ error: "Invalid PhantomBuster API key." }, { status: 400 });
      }
      if (agentRes.status === 404) {
        return NextResponse.json({ error: "Phantom not found. Check the URL and ensure you own this phantom." }, { status: 400 });
      }
      return NextResponse.json({ error: `PhantomBuster API error (${agentRes.status})` }, { status: 502 });
    }

    const agentData = await agentRes.json();

    // Step 2: fetch the output file (S3 URL from resultObject or outputUrl)
    const outputUrl: string | null = agentData.resultObject ?? agentData.outputUrl ?? null;
    if (!outputUrl) {
      return NextResponse.json({ error: "No output found for this phantom. Run it first to generate results." }, { status: 400 });
    }

    const outputRes = await fetch(outputUrl);
    if (!outputRes.ok) {
      return NextResponse.json({ error: "Could not fetch phantom output file." }, { status: 502 });
    }

    const contentType = outputRes.headers.get("content-type") ?? "";
    let records: Record<string, unknown>[] = [];

    if (contentType.includes("application/json") || outputUrl.endsWith(".json")) {
      const json = await outputRes.json();
      records = Array.isArray(json) ? json : (json.leads ?? json.data ?? json.results ?? []);
    } else {
      // CSV fallback
      const text = await outputRes.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) {
        return NextResponse.json({ error: "Phantom output is empty." }, { status: 400 });
      }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      records = lines.slice(1).map((line) => {
        const values: string[] = [];
        let current = ""; let inQuotes = false;
        for (const char of line) {
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === "," && !inQuotes) { values.push(current.trim().replace(/^"|"$/g, "")); current = ""; }
          else { current += char; }
        }
        values.push(current.trim().replace(/^"|"$/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
      });
    }

    const leads = records.map(mapRecord).filter(Boolean) as CampaignLead[];

    if (leads.length === 0) {
      return NextResponse.json({
        error: "No valid leads found in phantom output. Ensure the phantom produces contact data with email, phone, or LinkedIn fields.",
      }, { status: 400 });
    }

    return NextResponse.json({ leads, total: leads.length });
  } catch (error) {
    console.error("fetch-phantombuster-leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
