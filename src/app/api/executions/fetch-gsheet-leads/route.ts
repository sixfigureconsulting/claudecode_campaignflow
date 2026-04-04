import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CampaignLead } from "@/types/database";

const COL_MAP: Record<string, keyof CampaignLead> = {
  first_name: "first_name", firstname: "first_name", "first name": "first_name",
  last_name: "last_name", lastname: "last_name", "last name": "last_name",
  name: "first_name", "full name": "first_name", "contact name": "first_name",
  email: "email", "email address": "email", "work email": "email",
  company: "company", organization: "company", "company name": "company",
  organization_name: "company", "account name": "company",
  title: "title", "job title": "title", jobtitle: "title", position: "title", role: "title",
  linkedin_url: "linkedin_url", linkedin: "linkedin_url",
  "linkedin url": "linkedin_url", "linkedin profile url": "linkedin_url",
  "company linkedin url": "linkedin_url", "company linkedin": "linkedin_url",
  website: "website", "website url": "website", "company website": "website", url: "website",
  phone: "phone", "phone number": "phone", mobile: "phone",
  "company phone": "phone", "direct phone": "phone", telephone: "phone",
  "phone 1": "phone", "mobile phone": "phone",
};

function parseCSV(text: string): CampaignLead[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = ""; let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { values.push(current.trim().replace(/^"|"$/g, "")); current = ""; }
      else { current += char; }
    }
    values.push(current.trim().replace(/^"|"$/g, ""));

    const lead: Partial<CampaignLead> = {};
    headers.forEach((header, i) => {
      const key = COL_MAP[header];
      if (key && values[i]) (lead as Record<string, string>)[key] = values[i];
    });

    // Split "Full Name" → first + last
    if (lead.first_name && !lead.last_name && lead.first_name.includes(" ")) {
      const parts = lead.first_name.trim().split(/\s+/);
      lead.first_name = parts[0];
      lead.last_name = parts.slice(1).join(" ");
    }

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
  }).filter((l) => {
    const hasEmail = l.email && l.email.includes("@");
    const hasPhone = l.phone && l.phone.trim().length > 5;
    const hasIdentifier = !!(l.company || l.first_name);
    return (hasEmail || hasPhone) && hasIdentifier;
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sheetUrl } = await request.json();
    if (!sheetUrl) return NextResponse.json({ error: "sheetUrl is required" }, { status: 400 });

    // Extract sheet ID from any Google Sheets URL format
    const match = (sheetUrl as string).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return NextResponse.json({ error: "Invalid Google Sheets URL. Paste the full URL from your browser." }, { status: 400 });

    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    // Fetch server-side (bypasses browser CORS restrictions)
    const res = await fetch(csvUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CampaignFlow/1.0)",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.url.includes("accounts.google.com")) {
        return NextResponse.json(
          { error: "Sheet is not publicly accessible. Go to Share → Anyone with the link → Viewer, then try again." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: `Failed to fetch sheet (${res.status})` }, { status: 502 });
    }

    const text = await res.text();

    // If Google redirected to a login page, the content won't be CSV
    if (text.includes("accounts.google.com") || text.includes("<!DOCTYPE html")) {
      return NextResponse.json(
        { error: "Sheet requires sign-in. Set sharing to Anyone with the link → Viewer." },
        { status: 400 }
      );
    }

    const leads = parseCSV(text);

    if (leads.length === 0) {
      return NextResponse.json(
        { error: "No valid leads found. Ensure columns include email or phone plus company/name. Recognised columns: first_name, last_name, email, company, phone, linkedin_url, website, company name, company phone, website url." },
        { status: 400 }
      );
    }

    return NextResponse.json({ leads, total: leads.length });
  } catch (error) {
    console.error("fetch-gsheet-leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
