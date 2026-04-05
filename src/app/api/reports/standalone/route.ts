import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Creates a standalone report (not tied to a CampaignFlow campaign).
// Ensures a hidden __standalone__ client + project exists for the user,
// then creates a report under it.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, report_type, report_date, notes } = await request.json();
    if (!name || !report_type || !report_date) {
      return NextResponse.json({ error: "name, report_type, and report_date are required" }, { status: 400 });
    }

    const service = createServiceClient();

    // 1. Ensure __standalone__ client exists
    let { data: standaloneClient } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "__standalone__")
      .single();

    if (!standaloneClient) {
      const { data: created, error: clientErr } = await service
        .from("clients")
        .insert({ user_id: user.id, name: "__standalone__" })
        .select("id")
        .single();
      if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 });
      standaloneClient = created;
    }

    // 2. Ensure __standalone__ project exists under that client
    let { data: standaloneProject } = await supabase
      .from("projects")
      .select("id")
      .eq("client_id", standaloneClient!.id)
      .eq("name", "__standalone__")
      .single();

    if (!standaloneProject) {
      const { data: created, error: projectErr } = await service
        .from("projects")
        .insert({
          client_id: standaloneClient!.id,
          name: "__standalone__",
          project_type: "custom",
        })
        .select("id")
        .single();
      if (projectErr) return NextResponse.json({ error: projectErr.message }, { status: 500 });
      standaloneProject = created;
    }

    // 3. Create the report
    const { data: report, error: reportErr } = await service
      .from("reports")
      .insert({
        project_id: standaloneProject!.id,
        name,
        report_type,
        report_date,
        notes: notes || null,
      })
      .select("id, project_id")
      .single();

    if (reportErr) return NextResponse.json({ error: reportErr.message }, { status: 500 });

    return NextResponse.json({ reportId: report.id, projectId: report.project_id }, { status: 201 });
  } catch (err: any) {
    console.error("Standalone report creation error:", err);
    return NextResponse.json({ error: err.message ?? "Failed to create report" }, { status: 500 });
  }
}
