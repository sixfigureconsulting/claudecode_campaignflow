import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddProjectDialog } from "@/components/projects/AddProjectDialog";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Globe, ArrowLeft, Building2 } from "lucide-react";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("*, projects(*, reports(id))")
    .eq("id", clientId)
    .eq("user_id", user.id)
    .single();

  if (!client) notFound();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/clients" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Clients
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{client.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-brand-100 text-brand-700 rounded-2xl flex items-center justify-center text-xl font-bold">
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {client.industry && (
                <Badge variant="secondary">
                  <Building2 className="h-3 w-3 mr-1" />
                  {client.industry}
                </Badge>
              )}
              {client.website && (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-600 hover:underline flex items-center gap-1"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {client.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
            {client.primary_offer && (
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                {client.primary_offer}
              </p>
            )}
          </div>
        </div>
        <AddProjectDialog clientId={client.id} />
      </div>

      {/* Projects */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Projects ({client.projects?.length ?? 0})
        </h2>

        {(client.projects ?? []).length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl py-16 text-center">
            <p className="text-muted-foreground mb-3">No projects yet</p>
            <AddProjectDialog clientId={client.id} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(client.projects ?? []).map((project: any) => (
              <ProjectCard
                key={project.id}
                project={project}
                clientId={client.id}
                reportCount={project.reports?.length ?? 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
