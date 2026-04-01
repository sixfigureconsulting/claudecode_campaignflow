import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { decryptApiKey, maskApiKey } from "@/lib/encryption";
import { ProjectTabs } from "@/components/projects/ProjectTabs";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ clientId: string; projectId: string }>;
}) {
  const { clientId, projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select(`
      *,
      clients!inner(id, name, user_id),
      reports(*, report_metrics(*))
    `)
    .eq("id", projectId)
    .eq("client_id", clientId)
    .eq("clients.user_id", user.id)
    .single();

  if (!project) notFound();

  const client = (project as any).clients;

  // Fetch integration configs (masked for client)
  const { data: rawConfigs } = await supabase
    .from("integration_configs")
    .select("service, api_key_encrypted, updated_at")
    .eq("project_id", projectId);

  const integrationConfigs = (rawConfigs ?? []).flatMap((row) => {
    try {
      return [{
        service: row.service,
        masked_key: maskApiKey(decryptApiKey(row.api_key_encrypted)),
        updated_at: row.updated_at,
      }];
    } catch {
      return [];
    }
  });

  // Fetch recent executions
  const { data: executions } = await supabase
    .from("executions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Check if user has Anthropic key configured
  const { data: aiConfig } = await supabase
    .from("ai_configs")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "anthropic")
    .single();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/clients" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Clients
        </Link>
        <span>/</span>
        <Link href={`/clients/${clientId}`} className="hover:text-foreground">
          {client.name}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="secondary">{project.project_type}</Badge>
            {project.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabbed content */}
      <ProjectTabs
        projectId={project.id}
        clientId={clientId}
        reports={project.reports ?? []}
        integrationConfigs={integrationConfigs}
        executions={(executions ?? []) as any}
        hasAnthropicKey={!!aiConfig}
      />
    </div>
  );
}
