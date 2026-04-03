"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Mail, Linkedin, Phone, Layers, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EditProjectDialog } from "./EditProjectDialog";
import { toast } from "@/components/ui/toast";

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  cold_email: {
    icon: <Mail className="h-5 w-5" />,
    color: "bg-blue-100 text-blue-600",
    label: "Cold Email",
  },
  linkedin: {
    icon: <Linkedin className="h-5 w-5" />,
    color: "bg-sky-100 text-sky-600",
    label: "LinkedIn Outreach",
  },
  multi_channel: {
    icon: <Layers className="h-5 w-5" />,
    color: "bg-purple-100 text-purple-600",
    label: "Multi-Channel",
  },
  cold_call: {
    icon: <Phone className="h-5 w-5" />,
    color: "bg-green-100 text-green-600",
    label: "Cold Calling",
  },
  custom: {
    icon: <FileText className="h-5 w-5" />,
    color: "bg-gray-100 text-gray-600",
    label: "Custom",
  },
};

interface ProjectCardProps {
  project: any;
  clientId: string;
  reportCount: number;
}

export function ProjectCard({ project, clientId, reportCount }: ProjectCardProps) {
  const config = TYPE_CONFIG[project.project_type] ?? TYPE_CONFIG.custom;
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const handleDelete = async () => {
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Project deleted", variant: "success" });
      setShowDelete(false);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ title: body.error ?? "Failed to delete project", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="relative group/card">
        <Link href={`/clients/${clientId}/projects/${project.id}`}>
          <Card className="h-full hover:shadow-md hover:border-brand-200 transition-all cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.color}`}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0 pr-7">
                  <h3 className="font-semibold text-sm leading-snug group-hover:text-brand-600 transition-colors truncate">
                    {project.name}
                  </h3>
                  <Badge variant="secondary" className="mt-1.5 text-xs">
                    {config.label}
                  </Badge>
                </div>
              </div>

              {project.description && (
                <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {reportCount} report{reportCount !== 1 ? "s" : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Actions menu — sits above the Link */}
        <div
          className="absolute top-3 right-3 z-10"
          onClick={(e) => e.preventDefault()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/card:opacity-100 transition-opacity focus:opacity-100"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onSelect={() => setShowEdit(true)} className="gap-2">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setShowDelete(true)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete project?"
        description="This will permanently delete the project and all its reports and metrics. This cannot be undone."
        onConfirm={handleDelete}
      />

      <EditProjectDialog
        project={project}
        open={showEdit}
        onOpenChange={setShowEdit}
      />
    </>
  );
}
