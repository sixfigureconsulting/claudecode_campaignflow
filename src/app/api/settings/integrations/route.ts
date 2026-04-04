import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptApiKey, decryptApiKey, maskApiKey } from "@/lib/encryption";
import { integrationConfigSchema } from "@/lib/validations";

// Find or create the user's default project to store global integration keys
async function getOrCreateGlobalProject(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  // Look for existing __default__ client
  let { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "__default__")
    .single();

  if (!client) {
    const { data: newClient } = await supabase
      .from("clients")
      .insert({ user_id: userId, name: "__default__" })
      .select("id")
      .single();
    client = newClient;
  }

  if (!client) return null;

  // Look for __integrations__ project
  let { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", client.id)
    .eq("name", "__integrations__")
    .single();

  if (!project) {
    const { data: newProject } = await supabase
      .from("projects")
      .insert({ client_id: client.id, name: "__integrations__", project_type: "custom" })
      .select("id")
      .single();
    project = newProject;
  }

  return project?.id ?? null;
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = await getOrCreateGlobalProject(supabase, user.id);
  if (!projectId) return NextResponse.json({ configs: [] });

  const { data } = await supabase
    .from("integration_configs")
    .select("service, api_key_encrypted, updated_at")
    .eq("project_id", projectId);

  const configs = (data ?? []).map((row) => {
    let masked_key = "••••••••";
    try { masked_key = maskApiKey(decryptApiKey(row.api_key_encrypted)); } catch {}
    return { service: row.service, masked_key, updated_at: row.updated_at };
  });

  return NextResponse.json({ configs });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = integrationConfigSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const projectId = await getOrCreateGlobalProject(supabase, user.id);
  if (!projectId) return NextResponse.json({ error: "Could not create integrations store" }, { status: 500 });

  const { service, api_key } = parsed.data;
  const encrypted = encryptApiKey(api_key);

  const { error } = await supabase
    .from("integration_configs")
    .upsert(
      { project_id: projectId, service, api_key_encrypted: encrypted, updated_at: new Date().toISOString() },
      { onConflict: "project_id,service" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service");
  if (!service) return NextResponse.json({ error: "Missing service" }, { status: 400 });

  const projectId = await getOrCreateGlobalProject(supabase, user.id);
  if (!projectId) return NextResponse.json({ success: true });

  await supabase
    .from("integration_configs")
    .delete()
    .eq("project_id", projectId)
    .eq("service", service);

  return NextResponse.json({ success: true });
}
