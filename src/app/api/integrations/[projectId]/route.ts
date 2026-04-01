import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey, decryptApiKey, maskApiKey } from "@/lib/encryption";
import { integrationConfigSchema } from "@/lib/validations";

type Params = { params: Promise<{ projectId: string }> };

// Verify the project belongs to the authenticated user
async function verifyOwnership(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, userId: string) {
  const { data } = await supabase
    .from("projects")
    .select("id, clients!inner(user_id)")
    .eq("id", projectId)
    .eq("clients.user_id", userId)
    .single();
  return !!data;
}

// GET — return masked keys for this project
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("integration_configs")
      .select("service, api_key_encrypted, updated_at")
      .eq("project_id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const masked = (data ?? []).map((row) => ({
      service: row.service,
      masked_key: maskApiKey(decryptApiKey(row.api_key_encrypted)),
      updated_at: row.updated_at,
    }));

    return NextResponse.json({ configs: masked });
  } catch (error) {
    console.error("Integration config GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — save or update a key for a service
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = integrationConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { service, api_key } = parsed.data;
    const encrypted = encryptApiKey(api_key);

    const { error: upsertError } = await supabase
      .from("integration_configs")
      .upsert(
        { project_id: projectId, service, api_key_encrypted: encrypted, updated_at: new Date().toISOString() },
        { onConflict: "project_id,service" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Integration config POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — remove a service key
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const owned = await verifyOwnership(supabase, projectId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const service = searchParams.get("service");

    if (!service || !["apollo", "heyreach", "instantly", "openai", "hubspot", "slack"].includes(service)) {
      return NextResponse.json({ error: "Invalid service" }, { status: 400 });
    }

    await supabase
      .from("integration_configs")
      .delete()
      .eq("project_id", projectId)
      .eq("service", service);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
