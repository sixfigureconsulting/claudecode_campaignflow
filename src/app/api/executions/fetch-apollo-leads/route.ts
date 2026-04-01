import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { fetchApolloLeadsSchema } from "@/lib/validations";
import type { CampaignLead } from "@/types/database";

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

// Map Apollo contact fields → CampaignLead
function mapApolloContact(contact: Record<string, unknown>): CampaignLead {
  return {
    first_name: (contact.first_name as string) ?? "",
    last_name: (contact.last_name as string) ?? "",
    email: (contact.email as string) ?? "",
    company:
      (contact.organization_name as string) ??
      ((contact.organization as Record<string, unknown>)?.name as string) ??
      "",
    title: (contact.title as string) ?? "",
    linkedin_url: (contact.linkedin_url as string) ?? null,
    website:
      (contact.website_url as string) ??
      ((contact.organization as Record<string, unknown>)?.website_url as string) ??
      null,
    phone:
      ((contact.phone_numbers as Array<Record<string, unknown>>)?.[0]
        ?.raw_number as string) ?? null,
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
    const parsed = fetchApolloLeadsSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );

    const { projectId, apolloListId } = parsed.data;

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Get Apollo API key
    const { data: keyRow } = await supabase
      .from("integration_configs")
      .select("api_key_encrypted")
      .eq("project_id", projectId)
      .eq("service", "apollo")
      .single();

    if (!keyRow)
      return NextResponse.json(
        { error: "Apollo API key not configured. Add it in the Integrations tab." },
        { status: 400 }
      );

    const apolloKey = decryptApiKey(keyRow.api_key_encrypted);

    // Paginate through Apollo contacts/search
    const leads: CampaignLead[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const apolloBody: Record<string, unknown> = {
        per_page: 100,
        page,
      };
      if (apolloListId) {
        apolloBody.saved_list_ids = [apolloListId];
      }

      const res = await fetch("https://api.apollo.io/api/v1/contacts/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apolloKey,
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(apolloBody),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: `Apollo API error: ${err.message ?? res.statusText}` },
          { status: 502 }
        );
      }

      const data = await res.json();
      const contacts: Record<string, unknown>[] = data.contacts ?? [];
      leads.push(...contacts.map(mapApolloContact));

      totalPages = data.pagination?.total_pages ?? 1;
      page++;

      // Cap at 500 leads (5 pages) to avoid timeouts
      if (leads.length >= 500) break;
    } while (page <= totalPages);

    // Filter out leads with no email
    const validLeads = leads.filter((l) => l.email && l.email.includes("@"));

    return NextResponse.json({
      leads: validLeads,
      total: validLeads.length,
    });
  } catch (error) {
    console.error("fetch-apollo-leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
