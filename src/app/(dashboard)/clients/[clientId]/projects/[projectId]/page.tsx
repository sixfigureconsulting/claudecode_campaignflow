import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AddReportDialog } from "@/components/reports/AddReportDialog";
import { ReportsList } from "@/components/reports/ReportsList";
import { MetricsCharts } from "@/components/charts/MetricsCharts";
import { ArrowLeft } from "lucide-react";

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
        <AddReportDialog projectId={project.id} />
      </div>

      {/* Trend charts (show if 2+ reports) */}
      {(project.reports ?? []).length >= 2 && (
        <MetricsCharts reports={project.reports} />
      )}

      {/* Reports list */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Reports ({project.reports?.length ?? 0})
        </h2>
        <ReportsList
          reports={project.reports ?? []}
          clientId={clientId}
          projectId={project.id}
        />
      </div>
    </div>
  );
}
