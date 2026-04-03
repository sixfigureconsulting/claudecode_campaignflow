import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api/validate-key";
import { createServiceClient } from "@/lib/supabase/server";
import { metricsArraySchema } from "@/lib/validations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    ({ userId } = await validateApiKey(request));
  } catch (err) {
    return err as NextResponse;
  }

  const { id: reportId } = await params;
  const supabase = createServiceClient();

  // Verify ownership
  const { data: report } = await supabase
    .from("reports")
    .select("id, projects!inner(clients!inner(user_id))")
    .eq("id", reportId)
    .eq("projects.clients.user_id", userId)
    .single();

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const body = await request.json();
  const parsed = metricsArraySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rows = parsed.data.metrics.map((m) => ({
    report_id: reportId,
    metric_name: m.metric_name,
    metric_value: m.metric_value,
    metric_category: m.metric_category,
  }));

  const { data, error } = await supabase
    .from("report_metrics")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
