import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api/validate-key";
import { createServiceClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validations";
import { z } from "zod";

const createReportSchema = reportSchema.extend({
  project_id: z.string().uuid("Invalid project_id"),
});

export async function GET(request: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await validateApiKey(request));
  } catch (err) {
    return err as NextResponse;
  }

  const projectId = request.nextUrl.searchParams.get("project_id");
  const supabase = createServiceClient();

  let query = supabase
    .from("reports")
    .select("*, projects!inner(clients!inner(user_id))")
    .eq("projects.clients.user_id", userId)
    .order("report_date", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clean = (data ?? []).map(({ projects: _p, ...r }) => r);
  return NextResponse.json({ data: clean });
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    ({ userId } = await validateApiKey(request));
  } catch (err) {
    return err as NextResponse;
  }

  const body = await request.json();
  const parsed = createReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify ownership of the project
  const { data: project } = await supabase
    .from("projects")
    .select("id, clients!inner(user_id)")
    .eq("id", parsed.data.project_id)
    .eq("clients.user_id", userId)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("reports")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
