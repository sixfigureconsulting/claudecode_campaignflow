import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { z } from "zod";
import type { CampaignLead } from "@/types/database";

const schema = z.object({
  projectId: z.string().uuid(),
  postUrl: z.string().url("Invalid URL"),
});

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

// Map a raw Apify result item to CampaignLead (best-effort)
function mapApifyItem(item: Record<string, unknown>): CampaignLead | null {
  const email =
    (item.email as string) ??
    (item.emailAddress as string) ??
    ((item.emails as string[])?.[0]) ??
    "";
  if (!email || !email.includes("@")) return null;

  const fullName = ((item.name as string) ?? (item.fullName as string) ?? "").trim();
  const nameParts = fullName.split(" ");
  const firstName =
    (item.firstName as string) ?? (item.first_name as string) ?? nameParts[0] ?? "";
  const lastName =
    (item.lastName as string) ??
    (item.last_name as string) ??
    nameParts.slice(1).join(" ") ??
    "";

  return {
    first_name: firstName,
    last_name: lastName,
    email,
    company:
      (item.company as string) ??
      (item.companyName as string) ??
      (item.organization as string) ??
      "",
    title:
      (item.title as string) ??
      (item.jobTitle as string) ??
      (item.headline as string) ??
      "",
    linkedin_url:
      (item.linkedinUrl as string) ??
      (item.linkedin_url as string) ??
      (item.profileUrl as string) ??
      null,
    website: (item.website as string) ?? (item.companyWebsite as string) ?? null,
    phone:
      (item.phone as string) ??
      (item.phoneNumber as string) ??
      ((item.phones as string[])?.[0]) ??
      null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );

    const { projectId, postUrl } = parsed.data;

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Get Apify API token
    const { data: keyRow } = await supabase
      .from("integration_configs")
      .select("api_key_encrypted")
      .eq("project_id", projectId)
      .eq("service", "apify")
      .single();

    if (!keyRow)
      return NextResponse.json(
        { error: "Apify API token not configured. Add it in the Integrations tab." },
        { status: 400 }
      );

    const apifyToken = decryptApiKey(keyRow.api_key_encrypted);

    // Run the Apify Web Scraper actor synchronously (returns when done)
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=60&memory=256`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: [{ url: postUrl }],
          maxCrawlingDepth: 0,
          maxPagesPerCrawl: 1,
          pageFunction: `async function pageFunction(context) {
            const { $ } = context;
            const results = [];
            // Extract any visible email addresses from the page
            const text = $('body').text();
            const emails = text.match(/[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/g) || [];
            emails.forEach(email => results.push({ email, source: context.request.url }));
            return results;
          }`,
        }),
      }
    );

    if (!runRes.ok) {
      const err = await runRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: `Apify error: ${(err as any).error?.message ?? runRes.statusText}` },
        { status: 502 }
      );
    }

    const items: Record<string, unknown>[] = await runRes.json();

    const leads: CampaignLead[] = items
      .flatMap((item) => {
        // Some actors return nested arrays
        if (Array.isArray(item)) return item as Record<string, unknown>[];
        return [item];
      })
      .map(mapApifyItem)
      .filter((l): l is CampaignLead => l !== null);

    return NextResponse.json({ leads, total: leads.length });
  } catch (error) {
    console.error("fetch-apify-leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
