import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { requireCredits, deductCredits } from "@/lib/credits";

const MAX_ROWS = 50;
const APOLLO_API_URL = "https://api.apollo.io/v1/organizations/search";

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

async function lookupWebsite(companyName: string, apolloKey: string): Promise<string> {
  try {
    const res = await fetch(APOLLO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apolloKey, q_organization_name: companyName, per_page: 1 }),
    });
    if (!res.ok) return "";
    const json = await res.json();
    const org = json?.organizations?.[0];
    if (!org) return "";
    const domain = org.primary_domain || org.website_url || "";
    if (!domain) return "";
    return domain.startsWith("http") ? domain : `https://${domain}`;
  } catch {
    return "";
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: "Missing file or projectId" }, { status: 400 });
    }

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get Apollo API key for this project
    const { data: configRow } = await supabase
      .from("integration_configs")
      .select("api_key_encrypted")
      .eq("project_id", projectId)
      .eq("service", "apollo")
      .single();

    if (!configRow) {
      return NextResponse.json({ error: "Apollo API key not configured for this project" }, { status: 400 });
    }

    const apolloKey = decryptApiKey(configRow.api_key_encrypted);

    // Parse CSV
    const text = await file.text();
    const { data: rows } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (!rows.length) {
      return NextResponse.json({ error: "CSV is empty or has no rows" }, { status: 400 });
    }

    // Find the company name column (case-insensitive)
    const headers = Object.keys(rows[0]);
    const companyCol = headers.find((h) =>
      ["company name", "company", "organization", "account"].includes(h.toLowerCase().trim())
    );

    if (!companyCol) {
      return NextResponse.json({
        error: `Could not find a company name column. Found columns: ${headers.join(", ")}`,
      }, { status: 400 });
    }

    const limited = rows.slice(0, MAX_ROWS);
    let enriched = 0;

    // Credit check — 1 credit per row to enrich
    const { allowed, balance, required } = await requireCredits(supabase, user.id, "apollo_enrich", limited.length);
    if (!allowed) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${required} (${limited.length} rows × 1), have ${balance}.` },
        { status: 402 }
      );
    }

    // Log execution start
    const { data: execRow } = await supabase
      .from("executions")
      .insert({
        project_id: projectId,
        action_type: "apollo_enrich",
        status: "running",
        inputs_summary: `${limited.length} rows, company column: "${companyCol}"`,
      })
      .select("id")
      .single();

    const execId = execRow?.id;

    // Enrich each row
    const enrichedRows = [];
    for (const row of limited) {
      const companyName = row[companyCol]?.trim();
      let website = "";
      if (companyName) {
        website = await lookupWebsite(companyName, apolloKey);
        if (website) enriched++;
        await delay(500);
      }
      enrichedRows.push({ ...row, "Website URL": website });
    }

    // Update execution record
    if (execId) {
      await supabase
        .from("executions")
        .update({
          status: "completed",
          outputs_summary: `${enriched}/${limited.length} companies enriched with website URLs`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", execId);
    }

    if (enriched > 0) {
      await deductCredits(supabase, user.id, "apollo_enrich", enriched, { project_id: projectId });
    }

    // Return enriched CSV
    const csv = Papa.unparse(enrichedRows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="enriched_${file.name}"`,
      },
    });
  } catch (error) {
    console.error("Apollo enrich error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
